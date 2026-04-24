import type { Request, Response, NextFunction } from "express";
import { Prisma } from "../../generated/prisma/client.js";

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

export function globalErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        return res.status(409).json({ error: "A record with that value already exists" });
      case "P2025":
        return res.status(404).json({ error: "Record not found" });
      case "P2003":
        return res.status(400).json({ error: "Invalid reference — related record does not exist" });
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ error: "Invalid data provided" });
  }

  const status = err.status ?? err.statusCode ?? 500;
  const message = status < 500 ? err.message : "Something went wrong";
  res.status(status).json({ error: message });
}
