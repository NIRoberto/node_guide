# Lesson 8: AI-Powered Features with LangChain & Groq

## Table of Contents
1. [What is AI in Backend APIs?](#what-is-ai-in-backend-apis)
2. [What is LangChain?](#what-is-langchain)
3. [What is Groq?](#what-is-groq)
4. [Getting a Free Groq API Key](#getting-a-free-groq-api-key)
5. [Installing Packages](#installing-packages)
6. [Setting Up LangChain with Groq](#setting-up-langchain-with-groq)
7. [Feature 1 — Natural Language Listing Search](#feature-1--natural-language-listing-search)
8. [Feature 2 — AI Listing Description Generator](#feature-2--ai-listing-description-generator)
9. [Feature 3 — Airbnb Chatbot with Memory](#feature-3--airbnb-chatbot-with-memory)
10. [Connecting to Express Routes](#connecting-to-express-routes)

---

## What is AI in Backend APIs?

AI features are no longer reserved for large tech companies. With tools like LangChain and free LLM APIs like Groq, you can add powerful AI capabilities to any Node.js API in minutes.

For an Airbnb-like app, AI can power:
- **Natural language search** — "find me a cozy place near the beach under $150"
- **Description generator** — host types a few keywords, AI writes a full listing description
- **Chatbot** — guests ask questions about listings, the AI answers with context

---

## What is LangChain?

**LangChain** is a framework for building applications powered by large language models (LLMs). It provides:

- A unified interface to connect to any LLM (OpenAI, Groq, Anthropic, etc.)
- **Prompt templates** — reusable, parameterized prompts
- **Chains** — connect multiple AI steps together
- **Memory** — give the AI conversation history so it remembers context
- **Output parsers** — parse AI responses into structured data

Without LangChain, you would call the LLM API directly and handle prompts, responses, and errors manually. LangChain abstracts all of that.

---

## What is Groq?

**Groq** is an AI inference platform that runs open-source LLMs (like Llama 3, Mixtral, Gemma) at extremely fast speeds. It has a **free tier** with generous rate limits — perfect for learning and small projects.

**Why Groq over OpenAI for this course:**
- Free — no credit card required
- Fast — responses in under 1 second
- Easy to set up — one API key, same LangChain interface
- Runs Llama 3 — a powerful open-source model from Meta

---

## Getting a Free Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Click **Sign Up** — you can sign up with Google or GitHub
3. After logging in, go to **API Keys** in the left sidebar
4. Click **Create API Key**
5. Give it a name (e.g. `airbnb-api`)
6. Copy the key — it starts with `gsk_...`

Add it to your `.env`:

```env
GROQ_API_KEY=gsk_your_key_here
```

**Free tier limits:**
- 14,400 requests per day
- 6,000 tokens per minute
- Plenty for development and small production apps

---

## Installing Packages

```bash
npm install @langchain/groq @langchain/core langchain
```

| Package | What it does |
|---------|-------------|
| `@langchain/groq` | LangChain integration for Groq's API |
| `@langchain/core` | Core LangChain types — prompts, messages, output parsers |
| `langchain` | Main LangChain package — chains, memory, agents |

---

## Setting Up LangChain with Groq

Create `src/config/ai.ts`:

```typescript
import { ChatGroq } from "@langchain/groq";

// Initialize the Groq model
// model: "llama-3.3-70b-versatile" is Groq's most capable free model
// temperature: 0 = deterministic (same input → same output) — good for structured tasks
// temperature: 1 = creative (more varied responses) — good for descriptions and chat
export const llm = new ChatGroq({
  apiKey: process.env["GROQ_API_KEY"],
  model: "llama-3.3-70b-versatile",
  temperature: 0.7,
});

export default llm;
```

### Available Groq models

| Model | Best for |
|-------|---------|
| `llama-3.3-70b-versatile` | General purpose — best quality |
| `llama-3.1-8b-instant` | Fast responses — lower quality |
| `mixtral-8x7b-32768` | Long context — up to 32k tokens |
| `gemma2-9b-it` | Instruction following |

---

## Feature 1 — Natural Language Listing Search

Instead of requiring users to fill in filter dropdowns, let them describe what they want in plain English and use AI to extract the filters.

**How it works:**
```
User input: "I need a villa in Miami for 4 people under $300 per night"
     ↓
AI extracts: { type: "VILLA", location: "Miami", guests: 4, maxPrice: 300 }
     ↓
Prisma query with those filters
     ↓
Returns matching listings
```

### Create the AI search controller

**src/controllers/v1/ai.controller.ts:**

```typescript
import type { Request, Response } from "express";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser, StringOutputParser } from "@langchain/core/output_parsers";
import llm from "../../config/ai.js";
import { prisma } from "../../config/prisma.js";

// ─── Natural Language Search ──────────────────────────────────────────────────

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

const parser = new JsonOutputParser();

const searchChain = searchPrompt.pipe(llm).pipe(parser);

export async function naturalLanguageSearch(req: Request, res: Response) {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  // Extract filters from natural language using AI
  const filters = await searchChain.invoke({ query }) as {
    location?: string;
    type?: string;
    guests?: number;
    maxPrice?: number;
  };

  // Build Prisma where clause from extracted filters
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
      host: { select: { name: true, avatar: true } },
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
```

---

## Feature 2 — AI Listing Description Generator

Hosts often struggle to write compelling listing descriptions. Give them an AI tool that generates a professional description from a few keywords.

**How it works:**
```
Host input: { title: "Beach House", location: "Miami", amenities: ["Pool", "WiFi", "BBQ"], guests: 6 }
     ↓
AI generates a full, engaging description
     ↓
Returns the description for the host to review and use
```

### Add to the AI controller

```typescript
// ─── Listing Description Generator ───────────────────────────────────────────

const descriptionPrompt = ChatPromptTemplate.fromTemplate(`
You are a professional copywriter for an Airbnb-like platform.
Write an engaging, warm, and descriptive listing description.

Listing details:
- Title: {title}
- Location: {location}
- Type: {type}
- Max guests: {guests}
- Amenities: {amenities}
- Price per night: ${"{price}"} USD

Write a 3-paragraph description:
1. Opening hook — what makes this place special
2. The space — describe the property and its features
3. The location — what guests can do nearby

Keep it between 150-200 words. Be specific and inviting. Do not use generic phrases like "perfect getaway".
`);

const descriptionChain = descriptionPrompt.pipe(llm).pipe(new StringOutputParser());

export async function generateListingDescription(req: Request, res: Response) {
  const { title, location, type, guests, amenities, price } = req.body;

  if (!title || !location || !type || !guests || !amenities || !price) {
    return res.status(400).json({ error: "title, location, type, guests, amenities, and price are required" });
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
```

---

## Feature 3 — Airbnb Chatbot with Memory

A chatbot that answers questions about listings and remembers the conversation context. If a user asks "what about the pool?" after asking about a listing, the AI knows what listing they mean.

**How it works:**
```
User: "Tell me about listings in New York"
AI:   "I found 3 listings in New York: ..."
User: "What's the cheapest one?"
AI:   "The cheapest is the Cozy Apartment at $120/night" ← remembers context
```

### Add to the AI controller

```typescript
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";

// Store conversation histories in memory
// In production, store these in Redis or a database
const sessionHistories = new Map<string, InMemoryChatMessageHistory>();

function getSessionHistory(sessionId: string): InMemoryChatMessageHistory {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, new InMemoryChatMessageHistory());
  }
  return sessionHistories.get(sessionId)!;
}

// ─── Chatbot ──────────────────────────────────────────────────────────────────

const chatPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a helpful Airbnb assistant. You help guests find listings, answer questions about properties, and assist with bookings.

Available listings context: {listingsContext}

Be friendly, concise, and helpful. If you don't know something, say so.
If asked about specific listings, refer to the context provided.`,
  ],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
]);

const chatChain = chatPrompt.pipe(llm);

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

  // Fetch recent listings to give the AI context about available properties
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
    .map((l) => `- ${l.title} in ${l.location}: $${l.pricePerNight}/night, ${l.type}, up to ${l.guests} guests, amenities: ${l.amenities.join(", ")}`)
    .join("\n");

  const reply = await chainWithHistory.invoke(
    { input: message, listingsContext },
    { configurable: { sessionId } }
  );

  res.json({ reply, sessionId });
}
```

---

## Connecting to Express Routes

Create `src/routes/v1/ai.routes.ts`:

```typescript
import { Router } from "express";
import {
  naturalLanguageSearch,
  generateListingDescription,
  chat,
} from "../../controllers/v1/ai.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

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
 *                 example: "cozy apartment in New York for 2 people under $150"
 *     responses:
 *       200:
 *         description: Listings matching the natural language query
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
 *                 example: "Beachfront Villa"
 *               location:
 *                 type: string
 *                 example: "Miami, FL"
 *               type:
 *                 type: string
 *                 example: "VILLA"
 *               guests:
 *                 type: integer
 *                 example: 6
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Pool", "WiFi", "BBQ"]
 *               price:
 *                 type: number
 *                 example: 250
 *     responses:
 *       200:
 *         description: Generated listing description
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
 *                 example: "What listings do you have in Miami?"
 *               sessionId:
 *                 type: string
 *                 example: "user-123-session-abc"
 *     responses:
 *       200:
 *         description: AI response
 */
router.post("/chat", chat);

export default router;
```

Mount in `src/routes/v1/index.ts`:

```typescript
import aiRouter from "./ai.routes.js";

v1Router.use("/ai", aiRouter);
```

Add `GROQ_API_KEY` to `.env.example`:

```env
GROQ_API_KEY=
```

### Testing the endpoints

**Natural language search:**
```
POST /api/v1/ai/search
Content-Type: application/json

{ "query": "cozy apartment in New York for 2 people under $150" }
```

**Generate description:**
```
POST /api/v1/ai/generate-description
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Beachfront Villa",
  "location": "Miami, FL",
  "type": "VILLA",
  "guests": 6,
  "amenities": ["Pool", "WiFi", "BBQ", "Beach access"],
  "price": 250
}
```

**Chat:**
```
POST /api/v1/ai/chat
Content-Type: application/json

{
  "message": "What listings do you have in Miami?",
  "sessionId": "user-session-001"
}
```

---

## Summary

| Concept | What it is |
|---------|------------|
| LangChain | Framework for building LLM-powered apps — prompts, chains, memory |
| Groq | Free AI inference platform — runs Llama 3 and other open-source models |
| `ChatGroq` | LangChain class that connects to Groq's API |
| `ChatPromptTemplate` | Reusable prompt with variables — `{query}`, `{title}`, etc. |
| `JsonOutputParser` | Parses AI response text into a JavaScript object |
| Chain (`.pipe()`) | Connects prompt → model → parser in sequence |
| `temperature` | Controls creativity: 0 = deterministic, 1 = creative |
| `RunnableWithMessageHistory` | Wraps a chain with conversation memory |
| `InMemoryChatMessageHistory` | Stores conversation history for a session in memory |
| `sessionId` | Unique identifier for a conversation — used to retrieve history |
| Natural language search | User describes what they want in plain English, AI extracts filters |
| Description generator | AI writes a full listing description from keywords |
| Chatbot with memory | AI assistant that remembers previous messages in the conversation |

---

**Resources:**
- [Groq Console](https://console.groq.com) — get your free API key
- [Groq Models](https://console.groq.com/docs/models) — available models and rate limits
- [LangChain JS Docs](https://js.langchain.com/docs)
- [LangChain Groq Integration](https://js.langchain.com/docs/integrations/chat/groq)
- [ChatPromptTemplate Docs](https://js.langchain.com/docs/concepts/prompt_templates)
