import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import usersRouter from "./routes/users.routes.js";
import listingsRouter from "./routes/listings.routes.js";
import { prisma } from "./config/prisma.js";
import { notFound, globalErrorHandler } from "./middlewares/errorHandler.js";
import { authenticate, requireAdmin } from "./middlewares/auth.middleware.js";
import dotenv from "dotenv";
import authRouter from "./routes/auth.routers.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Airbnb application");
});

app.use("/auth", authRouter);
app.use("/users", authenticate, usersRouter);  // all user routes require auth
app.use("/listings", listingsRouter);           // public GET, protected POST/PUT/DELETE

// ─── Error Handling ───────────────────────────────────────────────────────────

app.use(notFound);
app.use(globalErrorHandler);

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
