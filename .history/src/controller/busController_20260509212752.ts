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
 * Create Bus - Admin only
 * Body: { busNumber, model }
 */
export const createBus = async (req: Request, res: Response) => {
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

    if (!isAdminUser(payload)) {
      return res.status(403).json({ message: 'Only admin users can create buses' });
    }

    const orgId = payload?.orgId;
    if (!orgId) return res.status(400).json({ message: 'Organization ID missing from token' });

    const { busNumber, model } = req.body as any;

    if (!busNumber || !model) {
      return res.status(400).json({ message: 'Missing required fields: busNumber, model' });
    }

    // Check if bus with same number already exists in this organization
    const existingBus = await prisma.bus.findFirst({
      where: {
        OrgId: orgId,
        BusNumber: String(busNumber),
      },
    });

    if (existingBus) {
      return res.status(400).json({ message: `Bus with number ${busNumber} already exists in your organization` });
    }

    const bus = await prisma.bus.create({
      data: {
        OrgId: orgId,
        BusNumber: String(busNumber),
        Model: String(model),
      },
    });

    return res.status(201).json({ message: 'Bus created successfully', bus });
  } catch (error: any) {
    console.error('Error creating bus:', error);
    return res.status(500).json({ message: 'Error creating bus', error: error.message });
  }
};

/**
 * Edit Bus - Admin only
 * PUT /api/buses/:id
 */
export const editBus = async (req: Request, res: Response) => {
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

    if (!isAdminUser(payload)) {
      return res.status(403).json({ message: 'Only admin users can edit buses' });
    }

    const orgId = payload?.orgId;
    if (!orgId) return res.status(400).json({ message: 'Organization ID missing from token' });

    const busId = Number(req.params.id);
    if (isNaN(busId)) return res.status(400).json({ message: 'Invalid bus id' });

    const existing = await prisma.bus.findUnique({ where: { BusId: busId } });
    if (!existing || existing.OrgId !== orgId) return res.status(404).json({ message: 'Bus not found' });

    const { busNumber, model } = req.body as any;

    // If busNumber is being updated, check if it already exists in this organization
    if (busNumber !== undefined) {
      const duplicateBus = await prisma.bus.findFirst({
        where: {
          OrgId: orgId,
          BusNumber: String(busNumber),
          BusId: { not: busId }, // Exclude current bus from check
        },
      });

      if (duplicateBus) {
        return res.status(400).json({ message: `Bus with number ${busNumber} already exists in your organization` });
      }
    }

    const updated = await prisma.bus.update({
      where: { BusId: busId },
      data: {
        ...(busNumber !== undefined ? { BusNumber: String(busNumber) } : {}),
        ...(model !== undefined ? { Model: String(model) } : {}),
      },
    });

    return res.status(200).json({ message: 'Bus updated successfully', bus: updated });
  } catch (error: any) {
    console.error('Error updating bus:', error);
    return res.status(500).json({ message: 'Error updating bus', error: error.message });
  }
};

/**
 * Delete Bus - Admin only. Prevent deletion if trips exist for this bus.
 */
export const deleteBus = async (req: Request, res: Response) => {
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

    if (!isAdminUser(payload)) {
      return res.status(403).json({ message: 'Only admin users can delete buses' });
    }

    const orgId = payload?.orgId;
    if (!orgId) return res.status(400).json({ message: 'Organization ID missing from token' });

    const busId = Number(req.params.id);
    if (isNaN(busId)) return res.status(400).json({ message: 'Invalid bus id' });

    const bus = await prisma.bus.findUnique({ where: { BusId: busId }, include: { trips: true } });
    if (!bus || bus.OrgId !== orgId) return res.status(404).json({ message: 'Bus not found' });

    // Block only if there is a currently ACTIVE trip
    const hasActiveTrip = bus.trips.some((t) => t.Status === 'active');
    if (hasActiveTrip) {
      return res.status(400).json({ message: 'Cannot delete bus while it has an active trip. End the trip first.' });
    }

    await prisma.$transaction(async (tx) => {
      // Cascade-delete completed trip records (locations → notifications → trips)
      const tripIds = bus.trips.map((t) => t.TripId);
      if (tripIds.length > 0) {
        await tx.location.deleteMany({ where: { TripId: { in: tripIds } } });
        await tx.notification.deleteMany({ where: { TripId: { in: tripIds } } });
        await tx.trip.deleteMany({ where: { TripId: { in: tripIds } } });
      }
      await tx.routeBusAssignment.deleteMany({ where: { BusId: busId } });
      await tx.bus.delete({ where: { BusId: busId } });
    });

    return res.status(200).json({ message: 'Bus deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting bus:', error);
    return res.status(500).json({ message: 'Error deleting bus', error: error.message });
  }
};

/**
 * List buses scoped to organization
 */
export const listBuses = async (req: Request, res: Response) => {
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

    const { busNumber } = req.query as any;
    const where: any = { OrgId: Number(orgId) };
    if (busNumber) where.BusNumber = { contains: String(busNumber), mode: 'insensitive' };

    const buses = await prisma.bus.findMany({
      where,
      orderBy: { BusNumber: 'asc' },
      include: {
        assignedUsers: {
          where: { Role: 'driver' },
          select: {
            Name: true,
            Phone: true,
            RouteId: true,
            assignedRoute: {
              select: { RouteId: true, Name: true },
            },
            driverRoutes: {
              where: { Status: 'active' },
              include: {
                route: { select: { RouteId: true, Name: true } },
              },
            },
          },
        },
        routeAssignments: {
          where: { Status: 'active' },
          include: {
            route: {
              select: { Name: true },
            },
          },
        },
        trips: {
          where: { Status: 'active' },
          include: {
            route: { select: { Name: true } },
            driver: { select: { Name: true, Phone: true } },
          },
        },
      },
    });

    const mappedBuses = buses.map((bus) => {
      // 1. Determine driver info (prefer live trip driver, fallback to assigned driver)
      const activeTrip = bus.trips[0] || null;
      let driverName = activeTrip?.driver?.Name || bus.assignedUsers[0]?.Name || 'Unassigned';
      let driverPhone = activeTrip?.driver?.Phone || bus.assignedUsers[0]?.Phone || '';

      // 2. Determine route name (prefer live trip route, fallback to assigned route)
      const assignedDriver = bus.assignedUsers[0] || null;
      const assignedRoute =
        bus.routeAssignments[0]?.route ||
        assignedDriver?.assignedRoute ||
        assignedDriver?.driverRoutes[0]?.route ||
        null;
      let routeName = activeTrip?.route?.Name || assignedRoute?.Name || 'No Route';

      return {
        BusId: bus.BusId,
        BusNumber: bus.BusNumber,
        Model: bus.Model,
        Status: activeTrip ? 'active' : 'idle',
        DriverName: driverName,
        DriverPhone: driverPhone,
        RouteName: routeName,
        ActiveTrip: activeTrip ? {
          TripId: activeTrip.TripId,
          RouteId: activeTrip.RouteId,
          RouteName: activeTrip.route.Name,
          StartTime: activeTrip.StartTime,
          DriverName: activeTrip.driver.Name,
          DriverPhone: activeTrip.driver.Phone,
        } : null,
      };
    });

    return res.status(200).json({ buses: mappedBuses });
  } catch (error: any) {
    console.error('Error listing buses:', error);
    return res.status(500).json({ message: 'Error listing buses', error: error.message });
  }
};

/**
 * Get single bus
 */
export const getBus = async (req: Request, res: Response) => {
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

    const busId = Number(req.params.id);
    if (isNaN(busId)) return res.status(400).json({ message: 'Invalid bus id' });

    const bus = await prisma.bus.findUnique({ where: { BusId: busId } });
    if (!bus || bus.OrgId !== orgId) return res.status(404).json({ message: 'Bus not found' });

    return res.status(200).json({ bus });
  } catch (error: any) {
    console.error('Error fetching bus:', error);
    return res.status(500).json({ message: 'Error fetching bus', error: error.message });
  }
};

/**
 * Get Fleet Status - Live status of all buses in the organization
 */
export const getFleetStatus = async (req: Request, res: Response) => {
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

    let orgId = payload?.orgId || payload?.OrgId;
    if (!orgId && payload?.userId) {
      const user = await prisma.users.findUnique({ where: { UserId: Number(payload.userId) } });
      orgId = user?.OrgId;
    }

    if (!orgId) return res.status(400).json({ message: 'Organization context not found' });

    // 1. Fetch all buses for the organization (include assigned drivers/routes for fallback)
    const buses = await prisma.bus.findMany({
      where: { OrgId: Number(orgId) },
      orderBy: { BusNumber: 'asc' },
      include: {
        assignedUsers: {
          where: { Role: 'driver' },
          select: {
            Name: true,
            Phone: true,
            RouteId: true,
            assignedRoute: {
              select: { RouteId: true, Name: true },
            },
            driverRoutes: {
              where: { Status: 'active' },
              include: {
                route: { select: { RouteId: true, Name: true } },
              },
            },
          },
        },
        routeAssignments: {
          where: { Status: 'active' },
          include: {
            route: {
              select: { RouteId: true, Name: true },
            },
          },
        },
      },
    });

    // 2. Fetch all active trips for the organization
    const activeTrips = await prisma.trip.findMany({
      where: {
        Status: 'active',
        bus: { OrgId: Number(orgId) },
      },
      include: {
        route: true,
        driver: true,
      },
    });

    // 3. Map buses to include their current status and active trip info
    const fleetStatus = buses.map((bus) => {
      const activeTrip = activeTrips.find((t) => t.BusId === bus.BusId);
      const assignedDriver = bus.assignedUsers[0] || null;
      const assignedRoute =
        bus.routeAssignments[0]?.route ||
        assignedDriver?.assignedRoute ||
        assignedDriver?.driverRoutes[0]?.route ||
        null;

      const driverName = activeTrip?.driver?.Name || assignedDriver?.Name || 'Unassigned';
      const driverPhone = activeTrip?.driver?.Phone || assignedDriver?.Phone || '';
      const routeName = activeTrip?.route?.Name || assignedRoute?.Name || 'No Route';
      const routeId = activeTrip?.RouteId || assignedRoute?.RouteId || null;

      return {
        BusId: bus.BusId,
        BusNumber: bus.BusNumber,
        Model: bus.Model,
        Status: activeTrip ? 'active' : 'idle',
        DriverName: driverName,
        DriverPhone: driverPhone,
        RouteId: routeId,
        RouteName: routeName,
        ActiveTrip: activeTrip ? {
          TripId: activeTrip.TripId,
          RouteId: activeTrip.RouteId,
          RouteName: activeTrip.route.Name,
          StartTime: activeTrip.StartTime,
          DriverName: activeTrip.driver.Name,
          DriverPhone: activeTrip.driver.Phone,
        } : null,
      };
    });

    return res.status(200).json({ fleet: fleetStatus });
  } catch (error: any) {
    console.error('Error fetching fleet status:', error);
    return res.status(500).json({ message: 'Error fetching fleet status', error: error.message });
  }
};