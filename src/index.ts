import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import usersRouter from "./routes/users.routes.js";
import listingsRouter from "./routes/listings.routes.js";
import authRouter from "./routes/auth.routers.js";
import aiRouter from "./routes/ai.routes.js";
import { prisma } from "./config/prisma.js";
import { notFound, globalErrorHandler } from "./middlewares/errorHandler.js";
import { authenticate } from "./middlewares/auth.middleware.js";

const app = express();
const PORT = process.env["PORT"] || 3000;

app.use(express.json());
app.use(express.static("public"));

// ─── Swagger ──────────────────────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Airbnb application");
});

app.use("/auth", authRouter);
app.use("/users", authenticate, usersRouter);
app.use("/listings", listingsRouter);
app.use("/ai", aiRouter);

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
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

connectDb();
