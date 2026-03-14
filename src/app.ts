import cors from "cors"; // Triggering restart
import "dotenv/config";
import type { Request, Response } from "express";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import prisma from "./model/index.js";
import busRoutes from "./routes/busRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { info, warn } from './utils/logger.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.IO logic
io.on("connection", (socket: any) => {
  info("Client connected:", socket.id);

  socket.on("join-route", (routeId: any) => {
    socket.join(`route-${routeId}`);
    info(`User ${socket.id} joined route-${routeId}`);
  });

  // Driver sends GPS location updates — persist to DB AND broadcast
  socket.on("update-location", async (data: { tripId: number; routeId: number; latitude: number; longitude: number; driverId: number }) => {
    info(`[GPS] Driver ${data.driverId} → trip ${data.tripId}: lat=${data.latitude} lng=${data.longitude}`);

    // 1️⃣ Persist to DB so latestLocation is always populated for new viewers
    try {
      await prisma.location.create({
        data: {
          TripId: Number(data.tripId),
          Latitude: Number(data.latitude),
          Longitude: Number(data.longitude),
        },
      });
      info(`[GPS] ✅ Location saved to DB — trip ${data.tripId}: ${data.latitude}, ${data.longitude}`);
    } catch (err: any) {
      warn(`[GPS] ❌ DB save failed for trip ${data.tripId}:`, err.message);
    }

    // 2️⃣ Broadcast real-time update to all route watchers
    io.to(`route-${data.routeId}`).emit("location-update", {
      tripId: data.tripId,
      latitude: data.latitude,
      longitude: data.longitude,
      driverId: data.driverId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    info("Client disconnected:", socket.id);
  });
});

// Export io to be used in controllers
export { io };

// Routes
app.get("/", async (req: Request, res: Response) => {
  res.send("This is the backend of samaysafar");
});

app.use("/api/users", userRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/payments", paymentRoutes);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  info(`Server running on port ${PORT}`);
});