import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { connectDB } from "./config/prisma.js";
import usersRouter from "./routes/users.routes.js";

const app = express();
const PORT = 3000;

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Airbnb application");
});

app.use("/users", usersRouter);

// ─── Start Server ─────────────────────────────────────────────────────────────

async function main() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
