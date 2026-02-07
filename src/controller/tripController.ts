import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { io } from '../app.js';
import prisma from '../model/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'samaysafar_secret_key';

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
