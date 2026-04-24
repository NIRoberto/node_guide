import { Router } from "express";
import {
  getAllListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
} from "../controllers/listings.controller.js";
import { authenticate, requireHost } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", getAllListings);
router.get("/:id", getListingById);
router.post("/", authenticate, requireHost, createListing);
router.put("/:id", authenticate, updateListing);
router.delete("/:id", authenticate, deleteListing);

export default router;
