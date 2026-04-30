import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] as string;

export interface AuthRequest extends Request {
  userId?: string;
  role?: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.userId = decoded.userId;
    req.role = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireHost(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.role !== "HOST" && req.role !== "ADMIN") {
    return res.status(403).json({ error: "Only hosts can perform this action" });
  }
  next();
}

export function requireGuest(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.role !== "GUEST" && req.role !== "ADMIN") {
    return res.status(403).json({ error: "Only guests can perform this action" });
  }
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
