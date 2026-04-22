import type { Request, Response } from "express";
import prisma from "../config/prisma.js";

export async function getAllUsers(req: Request, res: Response) {
  const users = await prisma.user.findMany();
  res.json(users);
}

export async function getUserById(req: Request, res: Response) {
  const id = parseInt(req.params["id"] as string);
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
}

export async function createUser(req: Request, res: Response) {
  const { name, email, username } = req.body;

  if (!name || !email || !username) {
    return res.status(400).json({ error: "name, email and username are required" });
  }

  const newUser = await prisma.user.create({ data: { name, email, username } });
  res.status(201).json(newUser);
}

export async function updateUser(req: Request, res: Response) {
  const id = parseInt(req.params["id"] as string);
  const existing = await prisma.user.findUnique({ where: { id } });

  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }

  const updated = await prisma.user.update({ where: { id }, data: req.body });
  res.json(updated);
}

export async function deleteUser(req: Request, res: Response) {
  const id = parseInt(req.params["id"] as string);
  const existing = await prisma.user.findUnique({ where: { id } });

  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }

  await prisma.user.delete({ where: { id } });
  res.json({ message: "User deleted successfully" });
}
