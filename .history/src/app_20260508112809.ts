import cors from "cors"; // Triggering restart
import "dotenv/config";
import type { Request, Response } from "express";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import prisma from "./model/index.js";
import busRoutes from "./routes/busRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import userRoutes from "./routes/userRoutes.js";

import { info, warn, error } from './utils/logger.js';

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

// Serve static uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));


// Socket.IO logic
io.on("connection", (socket: any) => {
  info("Client connected:", socket.id);

  socket.on("join-route", (routeId: any) => {
    socket.join(`route-${routeId}`);
    info(`User ${socket.id} joined route-${routeId}`);
  });

  socket.on("join-user", (userId: any) => {
    socket.join(`user-${userId}`);
    info(`User ${socket.id} joined user-${userId}`);
  });


  // Driver sends GPS location updates — persist to DB AND broadcast
  socket.on("update-location", async (data: { tripId: number; routeId: number; latitude: number; longitude: number; driverId: number }) => {
    info(`[GPS] Driver ${data.driverId} → trip ${data.tripId}: lat=${data.latitude} lng=${data.longitude}`);

    // Persist to DB so latestLocation is always populated for new viewers
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
      warn(`[GPS]  DB save failed for trip ${data.tripId}:`, err.message);
    }

    // Broadcast real-time update to all route watchers
    io.to(`route-${data.routeId}`).emit("location-update", {
      tripId: data.tripId,
      latitude: data.latitude,
      longitude: data.longitude,
      driverId: data.driverId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("delete-notification", (data: { notificationId: number }) => {
    io.emit("notificationDeleted", data);
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
app.use("/api/reports", reportRoutes);
app.use()

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  error("Unhandle Error:", err);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  
  res.status(status).json({
    message,
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  info(`Server running on port ${PORT}`);
});