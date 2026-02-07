import jwt from 'jsonwebtoken';
import prisma from '../model/index.js';
const JWT_SECRET = process.env.JWT_SECRET || 'samaysafar_secret_key';
/**
 * Helper function to check if user is admin based on JWT payload
 * Checks multiple possible field names for flexibility
 */
const isAdminUser = (payload) => {
    // Check roleId first (most reliable)
    if (payload?.roleId === 1 || payload?.RoleId === 1)
        return true;
    // Collect all possible role field values
    const roleCandidates = [
        payload?.role,
        payload?.Role,
        payload?.userRole,
        payload?.UserRole,
        payload?.userType,
        payload?.UserType,
        payload?.roleName,
        payload?.RoleName,
    ]
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v).toLowerCase());
    // Check if any role field contains "1" (roleId as string)
    if (roleCandidates.some((r) => r === '1'))
        return true;
    // Check if any role field contains admin-related keywords
    if (roleCandidates.some((r) => /admin|orgadmin|organization/.test(r))) {
        return true;
    }
    // Check boolean admin flags
    return !!(payload?.isAdmin ?? payload?.IsAdmin ?? payload?.admin);
};
/**
 * Create Route - Admin (organization admin) creates a route and assigns buses/drivers
 * Body: { name, description?, scheduleDays, startTime, busIds?: number[], driverIds?: number[] }
 */
export const createRoute = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authorization header missing or malformed' });
        }
        const token = authHeader.split(' ')[1];
        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        }
        catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        // Only admin users can create routes
        if (!isAdminUser(payload)) {
            return res.status(403).json({ message: 'Only admin users can create routes' });
        }
        const orgId = payload?.orgId;
        if (!orgId) {
            return res.status(400).json({ message: 'Organization ID missing from token' });
        }
        const { name, description, scheduleDays, startTime, busIds, driverIds } = req.body;
        if (!name || !scheduleDays || !startTime) {
            return res.status(400).json({ message: 'Missing required fields: name, scheduleDays, startTime' });
        }
        // Validate arrays if provided
        const busIdsArr = Array.isArray(busIds) ? busIds.map(Number) : [];
        const driverIdsArr = Array.isArray(driverIds) ? driverIds.map(Number) : [];
        // Transaction: create route and assignments
        const result = await prisma.$transaction(async (tx) => {
            const route = await tx.route.create({
                data: {
                    OrgId: orgId,
                    Name: name,
                    Description: description ?? null,
                    ScheduleDays: scheduleDays,
                    StartTime: startTime,
                },
            });
            // Validate and create bus assignments
            if (busIdsArr.length > 0) {
                // Verify buses belong to this org
                const buses = await tx.bus.findMany({
                    where: { BusId: { in: busIdsArr }, OrgId: orgId },
                    select: { BusId: true },
                });
                const foundBusIds = new Set(buses.map((b) => b.BusId));
                const missingBuses = busIdsArr.filter((id) => !foundBusIds.has(id));
                if (missingBuses.length > 0) {
                    throw new Error(`Some buses are not found or do not belong to this organization: ${missingBuses.join(',')}`);
                }
                // Create assignments
                for (const busId of busIdsArr) {
                    await tx.routeBusAssignment.create({
                        data: {
                            RouteId: route.RouteId,
                            BusId: busId,
                        },
                    });
                }
            }
            // Validate and create driver assignments
            if (driverIdsArr.length > 0) {
                // Verify drivers belong to this org and have role 'driver'
                const drivers = await tx.users.findMany({
                    where: { UserId: { in: driverIdsArr }, OrgId: orgId, Role: 'driver' },
                    select: { UserId: true },
                });
                const foundDriverIds = new Set(drivers.map((d) => d.UserId));
                const missingDrivers = driverIdsArr.filter((id) => !foundDriverIds.has(id));
                if (missingDrivers.length > 0) {
                    throw new Error(`Some drivers are not found, not drivers, or do not belong to this organization: ${missingDrivers.join(',')}`);
                }
                for (const driverId of driverIdsArr) {
                    await tx.routeDriverAssignment.create({
                        data: {
                            RouteId: route.RouteId,
                            DriverId: driverId,
                        },
                    });
                }
            }
            return route;
        });
        // Fetch created route with assignments for response
        const createdRoute = await prisma.route.findUnique({
            where: { RouteId: result.RouteId },
            include: {
                busAssignments: { include: { bus: true } },
                driverAssignments: { include: { driver: true } },
            },
        });
        return res.status(201).json({ message: 'Route created successfully', route: createdRoute });
    }
    catch (error) {
        console.error('Error creating route:', error);
        // If it's a validation/error thrown above, return 400
        if (error.message && (error.message.startsWith('Some buses') || error.message.startsWith('Some drivers'))) {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Error creating route', error: error.message });
    }
};
/**
 * Edit Route - update name, description, scheduleDays, startTime, busIds, driverIds
 * PUT /api/routes/:id
 */
export const editRoute = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authorization header missing or malformed' });
        }
        const token = authHeader.split(' ')[1];
        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        }
        catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        // Only admin users can edit routes
        if (!isAdminUser(payload)) {
            return res.status(403).json({ message: 'Only admin users can edit routes' });
        }
        const orgId = payload?.orgId;
        if (!orgId)
            return res.status(400).json({ message: 'Organization ID missing from token' });
        const routeId = Number(req.params.id);
        if (isNaN(routeId))
            return res.status(400).json({ message: 'Invalid route id' });
        // Verify route exists and belongs to org
        const existingRoute = await prisma.route.findUnique({ where: { RouteId: routeId } });
        if (!existingRoute || existingRoute.OrgId !== orgId) {
            return res.status(404).json({ message: 'Route not found' });
        }
        const { name, description, scheduleDays, startTime, busIds, driverIds } = req.body;
        // Validate arrays
        const busIdsArr = Array.isArray(busIds) ? busIds.map(Number) : undefined;
        const driverIdsArr = Array.isArray(driverIds) ? driverIds.map(Number) : undefined;
        const updated = await prisma.$transaction(async (tx) => {
            // Update basic fields
            const route = await tx.route.update({
                where: { RouteId: routeId },
                data: {
                    ...(name !== undefined ? { Name: name } : {}),
                    ...(description !== undefined ? { Description: description } : {}),
                    ...(scheduleDays !== undefined ? { ScheduleDays: scheduleDays } : {}),
                    ...(startTime !== undefined ? { StartTime: startTime } : {}),
                },
            });
            // Replace bus assignments if provided
            if (busIdsArr !== undefined) {
                // Verify buses belong to org
                if (busIdsArr.length > 0) {
                    const buses = await tx.bus.findMany({ where: { BusId: { in: busIdsArr }, OrgId: orgId }, select: { BusId: true } });
                    const foundBusIds = new Set(buses.map((b) => b.BusId));
                    const missingBuses = busIdsArr.filter((id) => !foundBusIds.has(id));
                    if (missingBuses.length > 0) {
                        throw new Error(`Some buses are not found or do not belong to this organization: ${missingBuses.join(',')}`);
                    }
                }
                // Delete old assignments
                await tx.routeBusAssignment.deleteMany({ where: { RouteId: routeId } });
                // Create new assignments
                for (const busId of busIdsArr) {
                    await tx.routeBusAssignment.create({ data: { RouteId: routeId, BusId: busId } });
                }
            }
            // Replace driver assignments if provided
            if (driverIdsArr !== undefined) {
                if (driverIdsArr.length > 0) {
                    const drivers = await tx.users.findMany({ where: { UserId: { in: driverIdsArr }, OrgId: orgId, Role: 'driver' }, select: { UserId: true } });
                    const foundDriverIds = new Set(drivers.map((d) => d.UserId));
                    const missingDrivers = driverIdsArr.filter((id) => !foundDriverIds.has(id));
                    if (missingDrivers.length > 0) {
                        throw new Error(`Some drivers are not found, not drivers, or do not belong to this organization: ${missingDrivers.join(',')}`);
                    }
                }
                await tx.routeDriverAssignment.deleteMany({ where: { RouteId: routeId } });
                for (const driverId of driverIdsArr) {
                    await tx.routeDriverAssignment.create({ data: { RouteId: routeId, DriverId: driverId } });
                }
            }
            return route;
        });
        // Return updated route with assignments
        const updatedRoute = await prisma.route.findUnique({ where: { RouteId: updated.RouteId }, include: { busAssignments: { include: { bus: true } }, driverAssignments: { include: { driver: true } } } });
        return res.status(200).json({ message: 'Route updated successfully', route: updatedRoute });
    }
    catch (error) {
        console.error('Error updating route:', error);
        if (error.message && (error.message.startsWith('Some buses') || error.message.startsWith('Some drivers'))) {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Error updating route', error: error.message });
    }
};
/**
 * Delete Route - DELETE /api/routes/:id
 * Only admin can delete a route; prevent deletion if trips exist
 */
export const deleteRoute = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authorization header missing or malformed' });
        }
        const token = authHeader.split(' ')[1];
        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        }
        catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        if (!isAdminUser(payload)) {
            return res.status(403).json({ message: 'Only admin users can delete routes' });
        }
        const orgId = payload?.orgId;
        if (!orgId)
            return res.status(400).json({ message: 'Organization ID missing from token' });
        const routeId = Number(req.params.id);
        if (isNaN(routeId))
            return res.status(400).json({ message: 'Invalid route id' });
        const route = await prisma.route.findUnique({ where: { RouteId: routeId }, include: { trips: true } });
        if (!route || route.OrgId !== orgId) {
            return res.status(404).json({ message: 'Route not found' });
        }
        if (route.trips && route.trips.length > 0) {
            return res.status(400).json({ message: 'Cannot delete route with existing trips. Please remove trips first.' });
        }
        await prisma.$transaction(async (tx) => {
            await tx.routeBusAssignment.deleteMany({ where: { RouteId: routeId } });
            await tx.routeDriverAssignment.deleteMany({ where: { RouteId: routeId } });
            await tx.route.delete({ where: { RouteId: routeId } });
        });
        return res.status(200).json({ message: 'Route deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting route:', error);
        return res.status(500).json({ message: 'Error deleting route', error: error.message });
    }
};
/**
 * List Routes - GET /api/routes
 * Returns routes scoped to the authenticated user's organization
 */
export const listRoutes = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authorization header missing or malformed' });
        }
        const token = authHeader.split(' ')[1];
        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        }
        catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        // Determine organization id
        let orgId = payload?.orgId;
        // If token lacks orgId (rare), try to fetch from user record
        if (!orgId && payload?.userId) {
            const user = await prisma.users.findUnique({ where: { UserId: Number(payload.userId) } });
            orgId = user?.OrgId;
        }
        if (!orgId)
            return res.status(400).json({ message: 'Organization context not found' });
        // Optional query filters: name
        const { name } = req.query;
        const where = { OrgId: Number(orgId) };
        if (name) {
            where.Name = { contains: String(name), mode: 'insensitive' };
        }
        const routes = await prisma.route.findMany({
            where,
            include: {
                busAssignments: { include: { bus: true } },
                driverAssignments: { include: { driver: true } },
            },
            orderBy: { Name: 'asc' },
        });
        return res.status(200).json({ routes });
    }
    catch (error) {
        console.error('Error listing routes:', error);
        return res.status(500).json({ message: 'Error listing routes', error: error.message });
    }
};
/**
 * Get single Route - GET /api/routes/:id
 */
export const getRoute = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authorization header missing or malformed' });
        }
        const token = authHeader.split(' ')[1];
        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        }
        catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        let orgId = payload?.orgId;
        if (!orgId && payload?.userId) {
            const user = await prisma.users.findUnique({ where: { UserId: Number(payload.userId) } });
            orgId = user?.OrgId;
        }
        if (!orgId)
            return res.status(400).json({ message: 'Organization context not found' });
        const routeId = Number(req.params.id);
        if (isNaN(routeId))
            return res.status(400).json({ message: 'Invalid route id' });
        const route = await prisma.route.findUnique({
            where: { RouteId: routeId },
            include: { busAssignments: { include: { bus: true } }, driverAssignments: { include: { driver: true } }, trips: true },
        });
        if (!route || route.OrgId !== orgId)
            return res.status(404).json({ message: 'Route not found' });
        return res.status(200).json({ route });
    }
    catch (error) {
        console.error('Error fetching route:', error);
        return res.status(500).json({ message: 'Error fetching route', error: error.message });
    }
};
/**
 * Get Student Schedule - GET /api/routes/student-schedule
 * Returns the schedule for the route assigned to the authenticated student
 */
export const getStudentSchedule = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Authorization header missing or malformed" });
        }
        const token = authHeader.split(" ")[1];
        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        }
        catch (err) {
            return res.status(401).json({ message: "Invalid or expired token" });
        }
        const userId = Number(payload?.userId);
        if (!userId)
            return res.status(400).json({ message: "User ID missing from token" });
        // Fetch user and their assigned route
        const user = await prisma.users.findUnique({
            where: { UserId: userId },
            include: {
                assignedRoute: {
                    include: {
                        driverAssignments: { include: { driver: true } },
                        busAssignments: { include: { bus: true } },
                    },
                },
            },
        });
        if (!user || user.Role?.toLowerCase() !== "student") {
            return res.status(403).json({ message: "Only students can access this schedule" });
        }
        if (!user.assignedRoute) {
            return res.status(200).json({ schedule: null, message: "No route assigned to this student" });
        }
        const route = user.assignedRoute;
        // ScheduleDays is comma separated or "Daily"
        const days = route.ScheduleDays === "Daily"
            ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            : route.ScheduleDays.split(",").map(d => d.trim());
        const schedule = days.map(day => ({
            day,
            time: route.StartTime,
            routeName: route.Name,
        }));
        return res.status(200).json({
            routeName: route.Name,
            startTime: route.StartTime,
            scheduleDays: route.ScheduleDays,
            schedule,
            driver: route.driverAssignments[0]?.driver?.Name || "N/A",
            bus: route.busAssignments[0]?.bus?.BusNumber || "N/A"
        });
    }
    catch (error) {
        console.error("Error fetching student schedule:", error);
        return res.status(500).json({ message: "Error fetching student schedule", error: error.message });
    }
};
//# sourceMappingURL=routeController.js.map