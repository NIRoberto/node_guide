# Lesson 8: AI-Powered Features with LangChain

## Table of Contents
1. [What is LangChain?](#what-is-langchain)
2. [Why LangChain over Raw OpenAI SDK?](#why-langchain-over-raw-openai-sdk)
3. [LangChain Core Concepts](#langchain-core-concepts)
4. [Setup & Configuration](#setup--configuration)
5. [Your First Chain](#your-first-chain)
6. [AI Listing Search](#ai-listing-search)
7. [Listing Description Generator](#listing-description-generator)
8. [Conversation Memory](#conversation-memory)
9. [Streaming Responses](#streaming-responses)
10. [Error Handling & Fallbacks](#error-handling--fallbacks)
11. [How It All Fits Together](#how-it-all-fits-together)

---

## What is LangChain?

LangChain is a framework for building applications powered by large language models (LLMs). It gives you building blocks — prompts, models, memory, chains — that you wire together to build AI features.

Without LangChain, you call the OpenAI API directly and manage everything yourself:
- Formatting prompts manually
- Parsing responses manually
- Managing conversation history manually
- Handling retries and errors manually

LangChain handles all of that for you with a clean, composable API.

```
Without LangChain:
  Your code → OpenAI API → raw response → parse manually → use

With LangChain:
  Your code → Chain (prompt + model + parser) → structured output → use
```

---

## Why LangChain over Raw OpenAI SDK?

| | Raw OpenAI SDK | LangChain |
|--|---------------|-----------|
| Prompt management | Manual string building | Prompt templates with variables |
| Output parsing | Manual JSON.parse | Built-in output parsers |
| Conversation memory | Manual array management | Built-in memory classes |
| Switch models | Rewrite all API calls | Change one line |
| Streaming | Manual event handling | Built-in streaming support |
| Chains | Manual orchestration | Composable chain primitives |

The biggest win is **model portability** — if you start with OpenAI and want to switch to Groq, Anthropic, or a local model, you change one import. Everything else stays the same.

---

## LangChain Core Concepts

### Model
The LLM you talk to. LangChain supports OpenAI, Anthropic, Groq, Ollama (local), and many others through a unified interface.

```typescript
import { ChatOpenAI } from "@langchain/openai";
const model = new ChatOpenAI({ model: "gpt-4o-mini" });
```

### Prompt Template
A reusable prompt with variables. Instead of building strings manually, you define a template and fill in the variables at runtime.

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromTemplate(
  "You are a helpful assistant. Answer this question: {question}"
);
```

### Chain
A sequence of steps — prompt → model → parser. The output of one step feeds into the next.

```typescript
const chain = prompt.pipe(model).pipe(outputParser);
const result = await chain.invoke({ question: "What is Node.js?" });
```

### Output Parser
Transforms the raw model response into a structured format — plain string, JSON object, list, etc.

```typescript
import { StringOutputParser } from "@langchain/core/output_parsers";
const parser = new StringOutputParser();
```

### Memory
Stores conversation history so the model can refer back to previous messages.

```typescript
import { BufferMemory } from "langchain/memory";
const memory = new BufferMemory();
```

---

## Setup & Configuration

### Install dependencies

```bash
npm install langchain @langchain/core @langchain/openai
```

If you want to use **Groq** (free tier, very fast):
```bash
npm install @langchain/groq
```

### Environment variables

Add to your `.env`:
```env
OPENAI_API_KEY=sk-...
# OR if using Groq (free):
GROQ_API_KEY=gsk_...
```

Add to `.env.example`:
```env
OPENAI_API_KEY=
# OR
GROQ_API_KEY=
```

### Create the AI config

**src/config/ai.ts:**
```typescript
import { ChatOpenAI } from "@langchain/openai";
// import { ChatGroq } from "@langchain/groq"; // uncomment to use Groq

export const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
  apiKey: process.env["OPENAI_API_KEY"],
});

// Groq alternative (free):
// export const model = new ChatGroq({
//   model: "llama3-8b-8192",
//   apiKey: process.env["GROQ_API_KEY"],
// });
```

`temperature` controls creativity — `0` is deterministic, `1` is very creative. `0.7` is a good default.

---

## Your First Chain

A simple chain that answers a question. This is the foundation — everything else builds on this pattern.

**src/controllers/v1/ai.controller.ts:**
```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { model } from "../../config/ai.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import type { Request, Response } from "express";

const prompt = ChatPromptTemplate.fromTemplate(
  "You are a helpful assistant for an Airbnb-like platform. {question}"
);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

export const askAI = asyncHandler(async (req: Request, res: Response) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  const answer = await chain.invoke({ question });
  res.json({ answer });
});
```

**Route:**
```typescript
router.post("/ai/ask", askAI);
```

**Test:**
```json
POST /api/v1/ai/ask
{ "question": "What makes a good Airbnb listing title?" }
```

---

## AI Listing Search

This is the most useful feature — a natural language search endpoint. The user types something like "cozy apartment in Kigali under $80 for 2 guests" and the AI extracts the filters, then you run a real Prisma query.

### How it works

```
User: "cozy apartment in Kigali under $80 for 2 guests"
  ↓
LangChain extracts structured filters:
  { location: "Kigali", type: "APARTMENT", maxPrice: 80, guests: 2 }
  ↓
Prisma query with those filters
  ↓
Real listings from the database
```

### Implementation

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { model } from "../../config/ai.js";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import type { Request, Response } from "express";

const extractFiltersPrompt = ChatPromptTemplate.fromTemplate(`
You are a search filter extractor for an Airbnb-like platform.

Extract search filters from the user's query and return ONLY a valid JSON object.
No explanation, no markdown, just the JSON.

Available listing types: APARTMENT, HOUSE, VILLA, CABIN

JSON format:
{{
  "location": "string or null",
  "type": "APARTMENT | HOUSE | VILLA | CABIN | null",
  "maxPrice": "number or null",
  "guests": "number or null"
}}

User query: {query}
`);

const filterChain = extractFiltersPrompt.pipe(model).pipe(new StringOutputParser());

export const aiSearch = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  const raw = await filterChain.invoke({ query });

  let filters: {
    location?: string | null;
    type?: string | null;
    maxPrice?: number | null;
    guests?: number | null;
  };

  try {
    filters = JSON.parse(raw);
  } catch {
    return res.status(422).json({ error: "Could not understand the search query" });
  }

  const listings = await prisma.listing.findMany({
    where: {
      ...(filters.location && {
        location: { contains: filters.location, mode: "insensitive" },
      }),
      ...(filters.type && { type: filters.type as any }),
      ...(filters.maxPrice && { pricePerNight: { lte: filters.maxPrice } }),
      ...(filters.guests && { guests: { gte: filters.guests } }),
    },
    include: { host: { select: { id: true, name: true } } },
    take: 10,
  });

  res.json({ filters, listings });
});
```

**Route:**
```typescript
router.post("/ai/search", aiSearch);
```

**Test:**
```json
POST /api/v1/ai/search
{ "query": "cozy apartment in Kigali under $80 for 2 guests" }
```

**Response:**
```json
{
  "filters": {
    "location": "Kigali",
    "type": "APARTMENT",
    "maxPrice": 80,
    "guests": 2
  },
  "listings": [...]
}
```

---

## Listing Description Generator

Hosts often struggle to write good listing descriptions. This endpoint takes basic listing details and generates a professional, compelling description.

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { model } from "../../config/ai.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import type { Request, Response } from "express";

const descriptionPrompt = ChatPromptTemplate.fromTemplate(`
You are a professional copywriter for an Airbnb-like platform.

Write a compelling, warm, and honest listing description based on these details:

Title: {title}
Type: {type}
Location: {location}
Price per night: ${"{price}"}
Max guests: {guests}
Amenities: {amenities}

Write 2-3 short paragraphs. Be specific, inviting, and highlight what makes this place special.
Do not make up features that are not in the amenities list.
`);

const descriptionChain = descriptionPrompt.pipe(model).pipe(new StringOutputParser());

export const generateDescription = asyncHandler(async (req: Request, res: Response) => {
  const { title, type, location, price, guests, amenities } = req.body;

  if (!title || !type || !location || !price || !guests) {
    return res.status(400).json({ error: "title, type, location, price and guests are required" });
  }

  const description = await descriptionChain.invoke({
    title,
    type,
    location,
    price,
    guests,
    amenities: Array.isArray(amenities) ? amenities.join(", ") : amenities ?? "none listed",
  });

  res.json({ description });
});
```

**Route:**
```typescript
router.post("/ai/generate-description", authenticate, generateDescription);
```

**Test:**
```json
POST /api/v1/ai/generate-description
Authorization: Bearer <token>
{
  "title": "Sunny Studio in Kigali",
  "type": "APARTMENT",
  "location": "Kigali, Rwanda",
  "price": 65,
  "guests": 2,
  "amenities": ["WiFi", "Kitchen", "Air conditioning", "City view"]
}
```

---

## Conversation Memory

For a guest support chatbot, the AI needs to remember what was said earlier in the conversation. Without memory, every message is treated as a fresh conversation.

```
Without memory:
  User: "I need a place in Kigali"
  AI: "Here are listings in Kigali..."
  User: "What about cheaper ones?"
  AI: "Cheaper ones where?" ← forgot the context

With memory:
  User: "I need a place in Kigali"
  AI: "Here are listings in Kigali..."
  User: "What about cheaper ones?"
  AI: "Here are cheaper listings in Kigali..." ← remembers
```

### Implementation with session-based memory

Each user session gets its own memory store identified by a `sessionId`.

```typescript
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { model } from "../../config/ai.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import type { Request, Response } from "express";

// In-memory session store — use Redis in production
const sessions = new Map<string, Array<HumanMessage | AIMessage>>();

const chatPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful guest support assistant for an Airbnb-like platform. Help users find listings, answer questions about bookings, and provide travel advice.",
  ],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

const chatChain = chatPrompt.pipe(model).pipe(new StringOutputParser());

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: "message and sessionId are required" });
  }

  const history = sessions.get(sessionId) ?? [];

  const response = await chatChain.invoke({
    history,
    input: message,
  });

  // Update history
  history.push(new HumanMessage(message));
  history.push(new AIMessage(response));
  sessions.set(sessionId, history);

  res.json({ response, sessionId });
});
```

**Route:**
```typescript
router.post("/ai/chat", chat);
```

**Test — first message:**
```json
POST /api/v1/ai/chat
{
  "sessionId": "user-123-session-1",
  "message": "I'm looking for a place in Kigali for 2 people"
}
```

**Test — follow-up (AI remembers context):**
```json
POST /api/v1/ai/chat
{
  "sessionId": "user-123-session-1",
  "message": "What about something with a pool?"
}
```

---

## Streaming Responses

For long AI responses, streaming sends text to the client word by word as it's generated — instead of waiting for the full response. This makes the UI feel much faster and more responsive.

```
Without streaming:  wait 3 seconds → full response appears at once
With streaming:     words appear one by one as they're generated
```

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { model } from "../../config/ai.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import type { Request, Response } from "express";

const streamPrompt = ChatPromptTemplate.fromTemplate(
  "You are a helpful assistant for an Airbnb platform. {question}"
);

const streamChain = streamPrompt.pipe(model);

export const streamAsk = asyncHandler(async (req: Request, res: Response) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  // Set headers for Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = await streamChain.stream({ question });

  for await (const chunk of stream) {
    const text = chunk.content?.toString() ?? "";
    if (text) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();
});
```

**Route:**
```typescript
router.post("/ai/stream", streamAsk);
```

---

## Error Handling & Fallbacks

AI calls can fail — rate limits, network issues, invalid API keys. Always handle these gracefully.

### Wrap AI calls in try/catch

```typescript
export const aiSearch = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.body;

  try {
    const raw = await filterChain.invoke({ query });
    const filters = JSON.parse(raw);
    // ... rest of the handler
  } catch (error: any) {
    // Rate limit from OpenAI
    if (error?.status === 429) {
      return res.status(429).json({ error: "AI service is busy, please try again shortly" });
    }
    // Invalid API key
    if (error?.status === 401) {
      return res.status(500).json({ error: "AI service configuration error" });
    }
    // JSON parse failed — AI returned unexpected format
    return res.status(422).json({ error: "Could not understand the search query, try rephrasing" });
  }
});
```

### Fallback to regular search

If the AI fails, fall back to a basic keyword search so the endpoint still works:

```typescript
let filters = {};

try {
  const raw = await filterChain.invoke({ query });
  filters = JSON.parse(raw);
} catch {
  // AI failed — fall back to treating the whole query as a location search
  filters = { location: query };
}

const listings = await prisma.listing.findMany({
  where: {
    ...(filters.location && {
      location: { contains: filters.location, mode: "insensitive" },
    }),
  },
  take: 10,
});
```

---

## How It All Fits Together

### New endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/ai/ask` | No | Ask the AI a general question |
| POST | `/api/v1/ai/search` | No | Natural language listing search |
| POST | `/api/v1/ai/generate-description` | Yes | Generate a listing description |
| POST | `/api/v1/ai/chat` | No | Conversational guest support |
| POST | `/api/v1/ai/stream` | No | Streaming AI response |

### Project structure additions

```
src/
├── config/
│   └── ai.ts                        ← LangChain model config
├── controllers/
│   └── v1/
│       └── ai.controller.ts         ← all AI handlers
└── routes/
    └── v1/
        └── ai.routes.ts             ← AI routes
```

### Full AI search flow

```
POST /api/v1/ai/search { query: "cozy villa in Musanze for 4 guests under $150" }
  ↓
LangChain prompt → model extracts filters
  ↓
{ location: "Musanze", type: "VILLA", guests: 4, maxPrice: 150 }
  ↓
prisma.listing.findMany({ where: { location, type, guests, pricePerNight } })
  ↓
{ filters: {...}, listings: [...] }
```

### Choosing a model

| Model | Provider | Cost | Speed | Best for |
|-------|----------|------|-------|---------|
| `gpt-4o-mini` | OpenAI | Low | Fast | General use, good quality |
| `gpt-4o` | OpenAI | Higher | Medium | Complex reasoning |
| `llama3-8b-8192` | Groq | Free | Very fast | Development, prototyping |
| `llama3-70b-8192` | Groq | Free | Fast | Better quality, still free |

For this course, **Groq with llama3** is recommended — it's free, fast, and requires no credit card.

---

## Summary

| Concept | What it is |
|---------|------------|
| LangChain | Framework for building LLM-powered apps — prompts, chains, memory, parsers |
| Model | The LLM you talk to — OpenAI, Groq, Anthropic, Ollama |
| Prompt Template | Reusable prompt with variables — `{question}`, `{location}` |
| Chain | Sequence of steps: prompt → model → parser |
| Output Parser | Transforms raw model response into a usable format |
| `StringOutputParser` | Returns the model response as a plain string |
| `pipe()` | Connects chain steps together |
| `invoke()` | Runs the chain with input variables |
| Memory | Stores conversation history so the model remembers context |
| `MessagesPlaceholder` | Injects conversation history into a prompt |
| Streaming | Sends response word by word as it's generated |
| Temperature | Controls creativity — 0 = deterministic, 1 = very creative |
| Fallback | What to do when the AI call fails — degrade gracefully |
| Groq | Free LLM provider — fast, no credit card needed |

---

**Resources:**
- [LangChain JS Docs](https://js.langchain.com/docs)
- [LangChain JS GitHub](https://github.com/langchain-ai/langchainjs)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Groq Console](https://console.groq.com) — free API key
- [LangChain Prompt Templates](https://js.langchain.com/docs/concepts/prompt_templates)
- [LangChain Output Parsers](https://js.langchain.com/docs/concepts/output_parsers)
