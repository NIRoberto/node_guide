import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, username, password } = req.body;
  if (!name || !email || !username) {
    return res
      .status(400)
      .json({ error: "name, email and username are required" });
  }

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      username,
      password,
    },
  });

  res.status(201).json(newUser);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }
  const updated = await prisma.user.update({ where: { id }, data: req.body });
  res.json(updated);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }
  await prisma.user.delete({ where: { id } });
  res.json({ message: "User deleted successfully" });
});
