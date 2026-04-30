import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

export const getAllListings = asyncHandler(async (req: Request, res: Response) => {
  const { location, type, maxPrice, page = "1", limit = "10", sortBy, order } = req.query;

  const listings = await prisma.listing.findMany({
    where: {
      ...(location && { location: { contains: location as string, mode: "insensitive" } }),
      ...(type && { type: type as any }),
      ...(maxPrice && { pricePerNight: { lte: parseFloat(maxPrice as string) } }),
    },
    include: { host: { select: { id: true, name: true } } },
    skip: (parseInt(page as string) - 1) * parseInt(limit as string),
    take: parseInt(limit as string),
    ...(sortBy && { orderBy: { [sortBy as string]: order ?? "asc" } }),
  });

  res.json(listings);
});

export const getListingById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params["id"] as string;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { host: { select: { id: true, name: true, email: true } } },
  });
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  res.json(listing);
});

export const createListing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, description, location, pricePerNight, guests, type, amenities } = req.body;

  if (!title || !description || !location || !pricePerNight || !guests || !type) {
    return res.status(400).json({ error: "title, description, location, pricePerNight, guests and type are required" });
  }

  const listing = await prisma.listing.create({
    data: {
      title,
      description,
      location,
      pricePerNight,
      guests,
      type,
      amenities: amenities ?? [],
      hostId: req.userId!,
    },
  });

  res.status(201).json(listing);
});

export const updateListing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params["id"] as string;
  const listing = await prisma.listing.findUnique({ where: { id } });

  if (!listing) return res.status(404).json({ error: "Listing not found" });

  if (listing.hostId !== req.userId && req.role !== "ADMIN") {
    return res.status(403).json({ error: "You can only edit your own listings" });
  }

  const updated = await prisma.listing.update({ where: { id }, data: req.body });
  res.json(updated);
});

export const deleteListing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params["id"] as string;
  const listing = await prisma.listing.findUnique({ where: { id } });

  if (!listing) return res.status(404).json({ error: "Listing not found" });

  if (listing.hostId !== req.userId && req.role !== "ADMIN") {
    return res.status(403).json({ error: "You can only delete your own listings" });
  }

  await prisma.listing.delete({ where: { id } });
  res.json({ message: "Listing deleted successfully" });
});
