import "dotenv/config";
import type { Request, Response } from "express";
import express from "express";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";

const app = express();

// Middleware
// CORS (adjust origin to your frontend's URL if needed)
app.use(
  cors({
    origin: "*", // e.g. "http://localhost:5173" or your deployed frontend
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", async (req: Request, res: Response) => {
  res.send("This is the backend of samaysafar");
});

app.use("/api/users", userRoutes);

// Load port from .env or fallback to 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});