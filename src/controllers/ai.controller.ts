import type { Request, Response } from "express";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser, StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import llm from "../config/ai.js";
import { prisma } from "../config/prisma.js";

// ─── Feature 1: Natural Language Search ──────────────────────────────────────

const searchPrompt = ChatPromptTemplate.fromTemplate(`
You are a search assistant for an Airbnb-like platform.
Extract search filters from the user's natural language query.

User query: {query}

Return a JSON object with these optional fields:
- location: string (city or area mentioned)
- type: one of APARTMENT, HOUSE, VILLA, CABIN (if mentioned)
- guests: number (max guests needed)
- maxPrice: number (maximum price per night in USD)

Return ONLY valid JSON. No explanation. No markdown. Example:
{{"location": "Miami", "type": "VILLA", "guests": 4, "maxPrice": 300}}

If a field is not mentioned, omit it from the JSON.
`);

const searchChain = searchPrompt.pipe(llm).pipe(new JsonOutputParser());

export async function naturalLanguageSearch(req: Request, res: Response) {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  const filters = (await searchChain.invoke({ query })) as {
    location?: string;
    type?: string;
    guests?: number;
    maxPrice?: number;
  };

  const where: Record<string, unknown> = {};

  if (filters.location) {
    where["location"] = { contains: filters.location, mode: "insensitive" };
  }
  if (filters.type) {
    where["type"] = filters.type;
  }
  if (filters.guests) {
    where["guests"] = { gte: filters.guests };
  }
  if (filters.maxPrice) {
    where["pricePerNight"] = { lte: filters.maxPrice };
  }

  const listings = await prisma.listing.findMany({
    where,
    include: {
      host: { select: { name: true } },
    },
    take: 10,
  });

  res.json({
    query,
    extractedFilters: filters,
    results: listings,
    count: listings.length,
  });
}

// ─── Feature 2: Listing Description Generator ────────────────────────────────

const descriptionPrompt = ChatPromptTemplate.fromTemplate(`
You are a professional copywriter for an Airbnb-like platform.
Write an engaging, warm, and descriptive listing description.

Listing details:
- Title: {title}
- Location: {location}
- Type: {type}
- Max guests: {guests}
- Amenities: {amenities}
- Price per night: {price} USD

Write a 3-paragraph description:
1. Opening hook — what makes this place special
2. The space — describe the property and its features
3. The location — what guests can do nearby

Keep it between 150-200 words. Be specific and inviting.
`);

const descriptionChain = descriptionPrompt.pipe(llm).pipe(new StringOutputParser());

export async function generateListingDescription(req: Request, res: Response) {
  const { title, location, type, guests, amenities, price } = req.body;

  if (!title || !location || !type || !guests || !amenities || !price) {
    return res.status(400).json({
      error: "title, location, type, guests, amenities, and price are required",
    });
  }

  const description = await descriptionChain.invoke({
    title,
    location,
    type,
    guests,
    amenities: Array.isArray(amenities) ? amenities.join(", ") : amenities,
    price,
  });

  res.json({ description });
}

// ─── Feature 3: Chatbot with Memory ──────────────────────────────────────────

// Store conversation histories per session in memory
// In production, use Redis or a database
const sessionHistories = new Map<string, InMemoryChatMessageHistory>();

function getSessionHistory(sessionId: string): InMemoryChatMessageHistory {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, new InMemoryChatMessageHistory());
  }
  return sessionHistories.get(sessionId)!;
}

const chatPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a helpful Airbnb assistant. Help guests find listings and answer questions.

Available listings:
{listingsContext}

Be friendly and concise. If you don't know something, say so.`,
  ],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
]);

const chatChain = chatPrompt.pipe(llm).pipe(new StringOutputParser());

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chatChain,
  getMessageHistory: getSessionHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
});

export async function chat(req: Request, res: Response) {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: "message and sessionId are required" });
  }

  const listings = await prisma.listing.findMany({
    take: 5,
    select: {
      title: true,
      location: true,
      pricePerNight: true,
      type: true,
      guests: true,
      amenities: true,
    },
  });

  const listingsContext = listings
    .map(
      (l) =>
        `- ${l.title} in ${l.location}: $${l.pricePerNight}/night, ${l.type}, up to ${l.guests} guests, amenities: ${l.amenities.join(", ")}`
    )
    .join("\n");

  const reply = await chainWithHistory.invoke(
    { input: message, listingsContext },
    { configurable: { sessionId } }
  );

  res.json({ reply, sessionId });
}
