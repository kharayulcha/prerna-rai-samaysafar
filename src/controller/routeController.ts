import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../model/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'samaysafar_secret_key';

/**
 * Helper function to check if user is admin based on JWT payload
 * Checks multiple possible field names for flexibility
 */
const isAdminUser = (payload: any): boolean => {
  // Check roleId first (most reliable)
  if (payload?.roleId === 1 || payload?.RoleId === 1) return true;

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
  if (roleCandidates.some((r) => r === '1')) return true;

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
export const createRoute = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
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

    const { name, description, scheduleDays, startTime, busIds, driverIds } = req.body as any;

    if (!name || !scheduleDays || !startTime) {
      return res.status(400).json({ message: 'Missing required fields: name, scheduleDays, startTime' });
    }

    // Validate arrays if provided
    const busIdsArr: number[] = Array.isArray(busIds) ? busIds.map(Number) : [];
    const driverIdsArr: number[] = Array.isArray(driverIds) ? driverIds.map(Number) : [];

    // Transaction: create route and assignments
    const result = await prisma.$transaction(async (tx) => {
      const route = await tx.route.create({
        data: {
          OrgId: Number(orgId),
          Name: name,
          Description: description ?? null,
          ScheduleDays: scheduleDays,
          StartTime: startTime,
        },
      });

      // Validate and create bus assignments
      if (busIdsArr.length > 0) {
        const buses = await tx.bus.findMany({
          where: { BusId: { in: busIdsArr }, OrgId: Number(orgId) },
        });
        if (buses.length !== busIdsArr.length) throw new Error('Some buses not found or unauthorized');

        for (const busId of busIdsArr) {
          await tx.routeBusAssignment.create({
            data: { RouteId: route.RouteId, BusId: busId },
          });
        }
      }

      // Validate and create driver assignments
      if (driverIdsArr.length > 0) {
        const drivers = await tx.users.findMany({
          where: { UserId: { in: driverIdsArr }, OrgId: Number(orgId), Role: 'driver' },
        });
        if (drivers.length !== driverIdsArr.length) throw new Error('Some drivers not found or unauthorized');

        for (const driverId of driverIdsArr) {
          await tx.routeDriverAssignment.create({
            data: { RouteId: route.RouteId, DriverId: driverId },
          });
          // SYNC: Update the direct RouteId on the user
          await tx.users.update({
            where: { UserId: driverId },
            data: { RouteId: route.RouteId },
          });
        }
      }

      return route;
    });

    const createdRoute = await prisma.route.findUnique({
      where: { RouteId: result.RouteId },
      include: {
        busAssignments: { include: { bus: true } },
        driverAssignments: { include: { driver: true } },
      },
    });

    return res.status(201).json({ message: 'Route created successfully', route: createdRoute });
  } catch (error: any) {
    console.error('Error creating route:', error);
    return res.status(500).json({ message: 'Error creating route', error: error.message });
  }
};

/**
 * Edit Route
 */
export const editRoute = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!isAdminUser(payload)) return res.status(403).json({ message: 'Only admin users can edit routes' });

    let orgId = payload?.orgId || payload?.OrgId;
    if (!orgId) return res.status(400).json({ message: 'Organization ID missing from token' });

    const routeId = Number(req.params.id);
    if (isNaN(routeId)) return res.status(400).json({ message: 'Invalid route id' });

    const { name, description, scheduleDays, startTime, busIds, driverIds } = req.body as any;

    const busIdsArr: number[] | undefined = Array.isArray(busIds) ? busIds.map(Number) : undefined;
    const driverIdsArr: number[] | undefined = Array.isArray(driverIds) ? driverIds.map(Number) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update basic route info
      const route = await tx.route.update({
        where: { RouteId: routeId },
        data: {
          ...(name !== undefined ? { Name: name } : {}),
          ...(description !== undefined ? { Description: description } : {}),
          ...(scheduleDays !== undefined ? { ScheduleDays: scheduleDays } : {}),
          ...(startTime !== undefined ? { StartTime: startTime } : {}),
        },
      });

      // 2. Handle bus assignments
      if (busIdsArr !== undefined) {
        await tx.routeBusAssignment.deleteMany({ where: { RouteId: routeId } });
        for (const busId of busIdsArr) {
          await tx.routeBusAssignment.create({ data: { RouteId: routeId, BusId: busId } });
        }
      }

      // 3. Handle driver assignments
      if (driverIdsArr !== undefined) {
        // Find old assigned drivers to clear their RouteId
        const oldAssignments = await tx.routeDriverAssignment.findMany({ where: { RouteId: routeId } });
        const oldDriverIds = oldAssignments.map(a => a.DriverId);

        // CLEAR: Nullify RouteId for old drivers if they are not in the new list
        const driversToClear = oldDriverIds.filter(id => !driverIdsArr.includes(id));
        if (driversToClear.length > 0) {
          await tx.users.updateMany({
            where: { UserId: { in: driversToClear }, RouteId: routeId },
            data: { RouteId: null },
          });
        }

        // Delete old assignments
        await tx.routeDriverAssignment.deleteMany({ where: { RouteId: routeId } });

        // Add new assignments and SYNC direct RouteId
        for (const driverId of driverIdsArr) {
          await tx.routeDriverAssignment.create({ data: { RouteId: routeId, DriverId: driverId } });
          await tx.users.update({
            where: { UserId: driverId },
            data: { RouteId: routeId },
          });
        }
      }

      return route;
    });

    const refreshed = await prisma.route.findUnique({
      where: { RouteId: routeId },
      include: { busAssignments: { include: { bus: true } }, driverAssignments: { include: { driver: true } } },
    });

    return res.status(200).json({ message: 'Route updated successfully', route: refreshed });
  } catch (error: any) {
    console.error('Error updating route:', error);
    return res.status(500).json({ message: 'Error updating route', error: error.message });
  }
};

/**
 * Delete Route
 */
export const deleteRoute = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!isAdminUser(payload)) return res.status(403).json({ message: 'Only admin users can delete routes' });

    let orgId = payload?.orgId || payload?.OrgId;
    if (!orgId) return res.status(400).json({ message: 'Organization ID missing from token' });

    const routeId = Number(req.params.id);
    if (isNaN(routeId)) return res.status(400).json({ message: 'Invalid route id' });

    const route = await prisma.route.findUnique({
      where: { RouteId: routeId },
      include: { trips: true },
    });

    if (!route || route.OrgId !== Number(orgId)) return res.status(404).json({ message: 'Route not found' });

    if (route.trips && route.trips.length > 0) {
      return res.status(400).json({ message: 'Cannot delete route with active or past trips for history preservation. Please archive instead.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Nullify RouteId for all users (Drivers/Students) linked to this route
      await tx.users.updateMany({
        where: { RouteId: routeId },
        data: { RouteId: null },
      });

      // 2. Nullify RouteId in Bill records if any
      await tx.bill.updateMany({
        where: { RouteId: routeId },
        data: { RouteId: null },
      });

      // 3. Delete assignments
      await tx.routeBusAssignment.deleteMany({ where: { RouteId: routeId } });
      await tx.routeDriverAssignment.deleteMany({ where: { RouteId: routeId } });

      // 4. Finally delete the route
      await tx.route.delete({ where: { RouteId: routeId } });
    });

    return res.status(200).json({ message: 'Route deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting route:', error);
    return res.status(500).json({ message: 'Error deleting route', error: error.message });
  }
};

/**
 * List Routes - GET /api/routes
 * Returns routes scoped to the authenticated user's organization
 */
export const listRoutes = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Determine organization id
    let orgId = payload?.orgId;

    // If token lacks orgId (rare), try to fetch from user record
    if (!orgId && payload?.userId) {
      const user = await prisma.users.findUnique({ where: { UserId: Number(payload.userId) } });
      orgId = user?.OrgId;
    }

    if (!orgId) return res.status(400).json({ message: 'Organization context not found' });

    // Optional query filters: name
    const { name } = req.query as any;
    const where: any = { OrgId: Number(orgId) };
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
  } catch (error: any) {
    console.error('Error listing routes:', error);
    return res.status(500).json({ message: 'Error listing routes', error: error.message });
  }
};

/**
 * Get single Route - GET /api/routes/:id
 */
export const getRoute = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    let orgId = payload?.orgId;
    if (!orgId && payload?.userId) {
      const user = await prisma.users.findUnique({ where: { UserId: Number(payload.userId) } });
      orgId = user?.OrgId;
    }

    if (!orgId) return res.status(400).json({ message: 'Organization context not found' });

    const routeId = Number(req.params.id);
    if (isNaN(routeId)) return res.status(400).json({ message: 'Invalid route id' });

    const route = await prisma.route.findUnique({
      where: { RouteId: routeId },
      include: { busAssignments: { include: { bus: true } }, driverAssignments: { include: { driver: true } }, trips: true },
    });

    if (!route || route.OrgId !== orgId) return res.status(404).json({ message: 'Route not found' });

    return res.status(200).json({ route });
  } catch (error: any) {
    console.error('Error fetching route:', error);
    return res.status(500).json({ message: 'Error fetching route', error: error.message });
  }
};

/**
 * Get Student Schedule - GET /api/routes/student-schedule
 * Returns the schedule for the route assigned to the authenticated student
 */
export const getStudentSchedule = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization header missing or malformed" });
    }

    const token = authHeader.split(" ")[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const userId = Number(payload?.userId);
    if (!userId) return res.status(400).json({ message: "User ID missing from token" });

    // Fetch user and their assigned route
    const user = await prisma.users.findUnique({
      where: { UserId: userId },
      include: {
        assignedRoute: {
          include: {
            driverAssignments: { 
              include: { 
                driver: {
                  include: { assignedBus: true }
                } 
              } 
            },
            busAssignments: { include: { bus: true } },
            stops: { orderBy: { SequenceOrder: 'asc' } },
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
      bus: route.busAssignments[0]?.bus?.BusNumber || route.driverAssignments[0]?.driver?.assignedBus?.BusNumber || "N/A",
      stops: route.stops.map(s => ({
        id: s.StopId,
        name: s.Name,
        latitude: s.Latitude,
        longitude: s.Longitude,
        sequenceOrder: s.SequenceOrder,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching student schedule:", error);
    return res.status(500).json({ message: "Error fetching student schedule", error: error.message });
  }
};

/**
 * Get Route Stops - GET /api/routes/:id/stops
 */
export const getRouteStops = async (req: Request, res: Response) => {
  try {
    const routeId = Number(req.params.id);
    if (isNaN(routeId)) return res.status(400).json({ message: 'Invalid route id' });

    const stops = await prisma.routeStop.findMany({
      where: { RouteId: routeId },
      orderBy: { SequenceOrder: 'asc' },
    });

    return res.status(200).json({ stops });
  } catch (error: any) {
    console.error('Error fetching stops:', error);
    return res.status(500).json({ message: 'Error fetching stops', error: error.message });
  }
};

/**
 * Add Route Stop - POST /api/routes/:id/stops
 */
export const addRouteStop = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!isAdminUser(payload)) return res.status(403).json({ message: 'Only admin users can add stops' });

    const routeId = Number(req.params.id);
    const { name, latitude, longitude, sequenceOrder } = req.body as any;

    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Missing required fields: name, latitude, longitude' });
    }

    // Determine sequence order if not provided
    let finalSequence = sequenceOrder;
    if (finalSequence === undefined) {
      const lastStop = await prisma.routeStop.findFirst({
        where: { RouteId: routeId },
        orderBy: { SequenceOrder: 'desc' },
      });
      finalSequence = (lastStop?.SequenceOrder ?? 0) + 1;
    }

    const stop = await prisma.routeStop.create({
      data: {
        RouteId: routeId,
        Name: name,
        Latitude: parseFloat(latitude),
        Longitude: parseFloat(longitude),
        SequenceOrder: Number(finalSequence),
      },
    });

    return res.status(201).json({ message: 'Stop added successfully', stop });
  } catch (error: any) {
    console.error('Error adding stop:', error);
    return res.status(500).json({ message: 'Error adding stop', error: error.message });
  }
};

/**
 * Update Route Stop - PUT /api/routes/:id/stops/:stopId
 */
export const updateRouteStop = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!isAdminUser(payload)) return res.status(403).json({ message: 'Only admin users can update stops' });

    const stopId = Number(req.params.stopId);
    if (isNaN(stopId)) return res.status(400).json({ message: 'Invalid stop id' });

    const { name, latitude, longitude, sequenceOrder } = req.body as any;

    const updated = await prisma.routeStop.update({
      where: { StopId: stopId },
      data: {
        ...(name !== undefined ? { Name: name } : {}),
        ...(latitude !== undefined ? { Latitude: parseFloat(latitude) } : {}),
        ...(longitude !== undefined ? { Longitude: parseFloat(longitude) } : {}),
        ...(sequenceOrder !== undefined ? { SequenceOrder: Number(sequenceOrder) } : {}),
      },
    });

    return res.status(200).json({ message: 'Stop updated successfully', stop: updated });
  } catch (error: any) {
    console.error('Error updating stop:', error);
    return res.status(500).json({ message: 'Error updating stop', error: error.message });
  }
};

/**
 * Delete Route Stop - DELETE /api/routes/:id/stops/:stopId
 */
export const deleteRouteStop = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token as string, JWT_SECRET as string) as any;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!isAdminUser(payload)) return res.status(403).json({ message: 'Only admin users can delete stops' });

    const stopId = Number(req.params.stopId);
    if (isNaN(stopId)) return res.status(400).json({ message: 'Invalid stop id' });

    await prisma.routeStop.delete({
      where: { StopId: stopId },
    });

    return res.status(200).json({ message: 'Stop deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting stop:', error);
    return res.status(500).json({ message: 'Error deleting stop', error: error.message });
  }
};

/**
 * Get Full Route Details - GET /api/routes/:id/details
 * Scoped for Driver app to show their assigned route
 */
export const getRouteDetails = async (req: Request, res: Response) => {
  try {
    const routeId = Number(req.params.id);
    if (isNaN(routeId)) return res.status(400).json({ message: 'Invalid route id' });

    const route = await prisma.route.findUnique({
      where: { RouteId: routeId },
      include: {
        stops: {
          orderBy: { SequenceOrder: 'asc' },
        },
        trips: {
          where: { Status: 'active' },
          orderBy: { TripId: 'desc' },
          take: 1,
        },
      },
    });

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    // Try to find an assigned bus for this route
    const busAssignment = await prisma.routeBusAssignment.findFirst({
      where: { RouteId: routeId, Status: 'active' },
      include: { bus: true },
    });

    const driverAssignment = await prisma.routeDriverAssignment.findFirst({
      where: { RouteId: routeId, Status: 'active' },
      include: { driver: { include: { assignedBus: true } } },
    });

    const activeTrip = route.trips[0] || null;

    return res.status(200).json({
      routeId: route.RouteId,
      name: route.Name,
      busNumber: busAssignment?.bus?.BusNumber || driverAssignment?.driver?.assignedBus?.BusNumber || 'Not Assigned',
      totalStops: route.stops.length,
      estimatedTime: '45 mins', // Static fallback for now
      scheduledStartTime: route.StartTime,
      scheduleDays: route.ScheduleDays,
      stops: route.stops.map(s => ({
        id: s.StopId,
        name: s.Name,
        latitude: s.Latitude,
        longitude: s.Longitude,
        sequenceOrder: s.SequenceOrder,
      })),
      description: route.Description,
      tripInfo: activeTrip ? {
        tripId: activeTrip.TripId,
        startTime: activeTrip.StartTime,
        status: activeTrip.Status,
        isActive: true,
      } : null,
    });
  } catch (error: any) {
    console.error('Error fetching route details:', error);
    return res.status(500).json({ message: 'Error fetching route details', error: error.message });
  }
};

/**
 * Search Places - Proxy to bypass React Native strict fetches
 */
export const searchPlaces = async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ features: [] });
    // Use global fetch on Node 18+ to hit Photon
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Proxy place search error:', error);
    return res.status(500).json({ features: [], error: 'Failed to proxy place search' });
  }
};

/**
 * OSRM Driving Route Proxy - Bypass mobile network request blocks
 */
export const osrmRouteProxy = async (req: Request, res: Response) => {
  try {
    const { coords, overview, geometries, steps } = req.query;
    if (!coords) return res.status(400).json({ error: 'Missing coords' });
    
    const params = new URLSearchParams();
    if (overview) params.append('overview', overview as string);
    if (geometries) params.append('geometries', geometries as string);
    if (steps) params.append('steps', steps as string);
    
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?${params.toString()}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "SamaySafar/1.0 (dev@samaysafar.local)" }
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('OSRM Proxy error:', error);
    return res.status(500).json({ error: 'Failed to fetch OSRM proxy' });
  }
};
