import { Router } from "express";
import {
  naturalLanguageSearch,
  generateListingDescription,
  chat,
} from "../controllers/ai.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered features
 */

/**
 * @swagger
 * /ai/search:
 *   post:
 *     summary: Search listings using natural language
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 example: "cozy cabin for 4 people under $200 in Aspen"
 *     responses:
 *       200:
 *         description: Matching listings with extracted filters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                 extractedFilters:
 *                   type: object
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 */
router.post("/search", naturalLanguageSearch);

/**
 * @swagger
 * /ai/generate-description:
 *   post:
 *     summary: Generate a listing description using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, location, type, guests, amenities, price]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Sunset Villa"
 *               location:
 *                 type: string
 *                 example: "Miami, FL"
 *               type:
 *                 type: string
 *                 enum: [APARTMENT, HOUSE, VILLA, CABIN]
 *                 example: VILLA
 *               guests:
 *                 type: integer
 *                 example: 6
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Pool", "WiFi", "Kitchen"]
 *               price:
 *                 type: number
 *                 example: 350
 *     responses:
 *       200:
 *         description: Generated description
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 description:
 *                   type: string
 */
router.post("/generate-description", authenticate, generateListingDescription);

/**
 * @swagger
 * /ai/chat:
 *   post:
 *     summary: Chat with the Airbnb AI assistant
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message, sessionId]
 *             properties:
 *               message:
 *                 type: string
 *                 example: "What listings do you have in New York?"
 *               sessionId:
 *                 type: string
 *                 example: "user-session-123"
 *     responses:
 *       200:
 *         description: AI reply
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *                 sessionId:
 *                   type: string
 */
router.post("/chat", chat);

export default router;
