import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import usersRouter from "./routes/users.routes.js";
import { prisma } from "./config/prisma.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Airbnb application");
});

app.use("/users", usersRouter);

// ─── Start Server ─────────────────────────────────────────────────────────────

async function connectDb() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.log("====================================");
    console.log(error);
    console.log("====================================");
  }
}

connectDb();
