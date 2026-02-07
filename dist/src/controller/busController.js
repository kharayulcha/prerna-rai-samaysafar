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
 * Create Bus - Admin only
 * Body: { busNumber, model }
 */
export const createBus = async (req, res) => {
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
            return res.status(403).json({ message: 'Only admin users can create buses' });
        }
        const orgId = payload?.orgId;
        if (!orgId)
            return res.status(400).json({ message: 'Organization ID missing from token' });
        const { busNumber, model } = req.body;
        if (!busNumber || !model) {
            return res.status(400).json({ message: 'Missing required fields: busNumber, model' });
        }
        const bus = await prisma.bus.create({
            data: {
                OrgId: orgId,
                BusNumber: String(busNumber),
                Model: String(model),
            },
        });
        return res.status(201).json({ message: 'Bus created successfully', bus });
    }
    catch (error) {
        console.error('Error creating bus:', error);
        return res.status(500).json({ message: 'Error creating bus', error: error.message });
    }
};
/**
 * Edit Bus - Admin only
 * PUT /api/buses/:id
 */
export const editBus = async (req, res) => {
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
            return res.status(403).json({ message: 'Only admin users can edit buses' });
        }
        const orgId = payload?.orgId;
        if (!orgId)
            return res.status(400).json({ message: 'Organization ID missing from token' });
        const busId = Number(req.params.id);
        if (isNaN(busId))
            return res.status(400).json({ message: 'Invalid bus id' });
        const existing = await prisma.bus.findUnique({ where: { BusId: busId } });
        if (!existing || existing.OrgId !== orgId)
            return res.status(404).json({ message: 'Bus not found' });
        const { busNumber, model } = req.body;
        const updated = await prisma.bus.update({
            where: { BusId: busId },
            data: {
                ...(busNumber !== undefined ? { BusNumber: String(busNumber) } : {}),
                ...(model !== undefined ? { Model: String(model) } : {}),
            },
        });
        return res.status(200).json({ message: 'Bus updated successfully', bus: updated });
    }
    catch (error) {
        console.error('Error updating bus:', error);
        return res.status(500).json({ message: 'Error updating bus', error: error.message });
    }
};
/**
 * Delete Bus - Admin only. Prevent deletion if trips exist for this bus.
 */
export const deleteBus = async (req, res) => {
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
            return res.status(403).json({ message: 'Only admin users can delete buses' });
        }
        const orgId = payload?.orgId;
        if (!orgId)
            return res.status(400).json({ message: 'Organization ID missing from token' });
        const busId = Number(req.params.id);
        if (isNaN(busId))
            return res.status(400).json({ message: 'Invalid bus id' });
        const bus = await prisma.bus.findUnique({ where: { BusId: busId }, include: { trips: true } });
        if (!bus || bus.OrgId !== orgId)
            return res.status(404).json({ message: 'Bus not found' });
        if (bus.trips && bus.trips.length > 0) {
            return res.status(400).json({ message: 'Cannot delete bus with existing trips. Remove trips first.' });
        }
        await prisma.$transaction(async (tx) => {
            await tx.routeBusAssignment.deleteMany({ where: { BusId: busId } });
            await tx.bus.delete({ where: { BusId: busId } });
        });
        return res.status(200).json({ message: 'Bus deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting bus:', error);
        return res.status(500).json({ message: 'Error deleting bus', error: error.message });
    }
};
/**
 * List buses scoped to organization
 */
export const listBuses = async (req, res) => {
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
        const { busNumber } = req.query;
        const where = { OrgId: Number(orgId) };
        if (busNumber)
            where.BusNumber = { contains: String(busNumber), mode: 'insensitive' };
        const buses = await prisma.bus.findMany({
            where,
            orderBy: { BusNumber: 'asc' },
            include: {
                routeAssignments: {
                    include: {
                        route: {
                            include: {
                                driverAssignments: {
                                    include: {
                                        driver: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        const mappedBuses = buses.map((bus) => {
            // Find the first driver from any assigned route
            let driverName = '';
            if (bus.routeAssignments && bus.routeAssignments.length > 0) {
                const firstAssignment = bus.routeAssignments[0];
                if ((firstAssignment?.route?.driverAssignments?.length ?? 0) > 0) {
                    driverName = firstAssignment?.route?.driverAssignments[0]?.driver?.Name ?? '';
                }
            }
            return {
                ...bus,
                DriverName: driverName,
            };
        });
        return res.status(200).json({ buses: mappedBuses });
    }
    catch (error) {
        console.error('Error listing buses:', error);
        return res.status(500).json({ message: 'Error listing buses', error: error.message });
    }
};
/**
 * Get single bus
 */
export const getBus = async (req, res) => {
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
        const busId = Number(req.params.id);
        if (isNaN(busId))
            return res.status(400).json({ message: 'Invalid bus id' });
        const bus = await prisma.bus.findUnique({ where: { BusId: busId } });
        if (!bus || bus.OrgId !== orgId)
            return res.status(404).json({ message: 'Bus not found' });
        return res.status(200).json({ bus });
    }
    catch (error) {
        console.error('Error fetching bus:', error);
        return res.status(500).json({ message: 'Error fetching bus', error: error.message });
    }
};
//# sourceMappingURL=busController.js.map