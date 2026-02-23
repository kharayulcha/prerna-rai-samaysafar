import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { io } from '../app.js';
import prisma from '../model/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'samaysafar_secret_key';

// Helper to extract driver ID from token
const getDriverIdFromToken = (req: Request): number | null => {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token as string, JWT_SECRET as string) as any;
        return Number(payload?.userId);
    } catch {
        return null;
    }
};

export const startTrip = async (req: Request, res: Response) => {
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

        const driverId = Number(payload?.userId);
        const { routeId, busId } = req.body as any;

        if (!routeId || !busId) {
            return res.status(400).json({ message: 'Missing routeId or busId' });
        }

        const trip = await prisma.trip.create({
            data: {
                RouteId: Number(routeId),
                BusId: Number(busId),
                DriverId: driverId,
                StartTime: new Date(),
                Status: 'active',
            },
            include: {
                route: true,
            }
        });

        // Create a notification record for all users in this route
        const students = await prisma.users.findMany({
            where: { RouteId: Number(routeId), Role: 'student' }
        });

        for (const student of students) {
            await prisma.notification.create({
                data: {
                    UserId: student.UserId,
                    Type: 'trip_started',
                    Message: `Your bus for route ${trip.route.Name} has started!`,
                    TripId: trip.TripId,
                }
            });
        }

        // Emit real-time notification
        io.to(`route-${routeId}`).emit('notification', {
            type: 'trip_started',
            message: `Bus for route ${trip.route.Name} has started!`,
            routeId: routeId,
            tripId: trip.TripId
        });

        return res.status(201).json({ message: 'Trip started successfully', trip });
    } catch (error: any) {
        console.error('Error starting trip:', error);
        return res.status(500).json({ message: 'Error starting trip', error: error.message });
    }
};

export const endTrip = async (req: Request, res: Response) => {
    try {
        const { tripId } = req.body as any;

        if (!tripId) {
            return res.status(400).json({ message: 'Missing tripId' });
        }

        const trip = await prisma.trip.update({
            where: { TripId: Number(tripId) },
            data: {
                EndTime: new Date(),
                Status: 'completed',
            },
            include: {
                route: true
            }
        });

        // Create a notification record for all users in this route
        const students = await prisma.users.findMany({
            where: { RouteId: Number(trip.RouteId), Role: 'student' }
        });

        for (const student of students) {
            await prisma.notification.create({
                data: {
                    UserId: student.UserId,
                    Type: 'trip_ended',
                    Message: `Bus for route ${trip.route.Name} has arrived/finished.`,
                    TripId: trip.TripId,
                }
            });
        }

        // Notify users
        io.to(`route-${trip.RouteId}`).emit('notification', {
            type: 'trip_ended',
            message: `Bus for route ${trip.route.Name} has arrived/finished.`,
            routeId: trip.RouteId,
            tripId: trip.TripId
        });

        return res.status(200).json({ message: 'Trip ended successfully', trip });
    } catch (error: any) {
        console.error('Error ending trip:', error);
        return res.status(500).json({ message: 'Error ending trip', error: error.message });
    }
};

// Save a GPS location point for a trip and broadcast via Socket.IO
export const saveLocation = async (req: Request, res: Response) => {
    try {
        const driverId = getDriverIdFromToken(req);
        if (!driverId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { tripId, latitude, longitude } = req.body as any;

        if (!tripId || latitude == null || longitude == null) {
            return res.status(400).json({ message: 'Missing tripId, latitude, or longitude' });
        }

        // Verify the trip exists and belongs to this driver
        const trip = await prisma.trip.findFirst({
            where: { TripId: Number(tripId), DriverId: driverId, Status: 'active' },
        });

        if (!trip) {
            return res.status(404).json({ message: 'Active trip not found for this driver' });
        }

        // Save location to database
        const location = await prisma.location.create({
            data: {
                TripId: Number(tripId),
                Latitude: Number(latitude),
                Longitude: Number(longitude),
            },
        });

        // Broadcast location update via Socket.IO
        io.to(`route-${trip.RouteId}`).emit('location-update', {
            tripId: trip.TripId,
            latitude: Number(latitude),
            longitude: Number(longitude),
            driverId,
            timestamp: new Date().toISOString(),
        });

        return res.status(200).json({ message: 'Location saved', location });
    } catch (error: any) {
        console.error('Error saving location:', error);
        return res.status(500).json({ message: 'Error saving location', error: error.message });
    }
};

// Get the active trip for a specific route (for students to track)
export const getActiveTrip = async (req: Request, res: Response) => {
    try {
        const { routeId } = req.params as any;

        const trip = await prisma.trip.findFirst({
            where: { RouteId: Number(routeId), Status: 'active' },
            orderBy: { TripId: 'desc' }, // ← always get the most recent active trip
            include: {
                route: true,
                bus: true,
                driver: { select: { UserId: true, Name: true, Phone: true } },
                locations: {
                    orderBy: { LocationId: 'desc' },
                    take: 1,
                },
            },
        });

        if (!trip) {
            return res.status(404).json({ message: 'No active trip for this route' });
        }

        return res.status(200).json({
            trip,
            latestLocation: trip.locations[0] || null,
        });
    } catch (error: any) {
        console.error('Error getting active trip:', error);
        return res.status(500).json({ message: 'Error getting active trip', error: error.message });
    }
};

// Get the active trip for the currently logged-in user's route
// Works for students (RouteId in token), parents (child's RouteId), and drivers (assigned route)
export const getMyActiveTrip = async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization as string | undefined;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const token = authHeader.split(' ')[1];
        let payload: any;
        try {
            payload = jwt.verify(token as string, JWT_SECRET as string) as any;
        } catch {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        const role: string = (payload?.role || payload?.Role || '').toLowerCase();
        const queryRouteId = req.query.routeId ? Number(req.query.routeId) : null;
        let routeId: number | null = queryRouteId;

        if (routeId) {
            // Permission check for non-admins
            const userRouteId = Number(payload?.RouteId ?? payload?.routeId) || null;
            const isAdmin = role.includes('admin') || role.includes('orgadmin');
            if (!isAdmin && routeId !== userRouteId) {
                routeId = userRouteId;
            }
        }

        if (!routeId) {
            if (role === 'student') {
                routeId = Number(payload?.RouteId ?? payload?.routeId) || null;
                if (!routeId) {
                    const studentId = Number(payload?.userId);
                    const studentUser = await prisma.users.findUnique({
                        where: { UserId: studentId },
                        select: { RouteId: true },
                    });
                    routeId = studentUser?.RouteId ?? null;
                }
            } else if (role === 'parent') {
                const children: any[] = payload?.children ?? [];
                if (children.length > 0) {
                    routeId = Number(children[0]?.routeId ?? children[0]?.RouteId) || null;
                }
                if (!routeId) {
                    const parentId = Number(payload?.userId);
                    const firstChild = await prisma.users.findFirst({
                        where: { ParentId: parentId, Role: 'student' },
                        select: { RouteId: true },
                    });
                    routeId = firstChild?.RouteId ?? null;
                }
            } else if (role === 'driver') {
                const driverId = Number(payload?.userId);
                const assignment = await prisma.routeDriverAssignment.findFirst({
                    where: { DriverId: driverId, Status: 'active' },
                    select: { RouteId: true },
                });
                routeId = assignment?.RouteId ?? null;
            }
        }

        if (!routeId) {
            return res.status(404).json({ message: 'No route assigned to your account' });
        }

        const trip = await prisma.trip.findFirst({
            where: { RouteId: routeId, Status: 'active' },
            orderBy: { TripId: 'desc' },
            include: {
                route: true,
                bus: true,
                driver: { select: { UserId: true, Name: true, Phone: true } },
                locations: {
                    orderBy: { LocationId: 'desc' },
                    take: 1,
                },
            },
        });

        if (!trip) {
            return res.status(404).json({ message: 'No active trip on this route right now', routeId });
        }

        return res.status(200).json({
            trip,
            latestLocation: trip.locations[0] || null,
            routeId,
        });
    } catch (error: any) {
        console.error('Error getting my active trip:', error);
        return res.status(500).json({ message: 'Error getting active trip', error: error.message });
    }
};

// Get location history for a trip
export const getTripLocations = async (req: Request, res: Response) => {
    try {
        const { tripId } = req.params as any;

        const locations = await prisma.location.findMany({
            where: { TripId: Number(tripId) },
            orderBy: { LocationId: 'asc' },
        });

        return res.status(200).json({ locations });
    } catch (error: any) {
        console.error('Error getting trip locations:', error);
        return res.status(500).json({ message: 'Error getting trip locations', error: error.message });
    }
};
