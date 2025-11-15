import express from "express";
import type { Request, Response } from "express";


const app = express();

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, this is the backend of SamaySafar");
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log("Server running on port ${PORT}");
});