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

Before we talk about LangChain specifically, let's understand what an LLM is.

### What is an LLM?

An **LLM (Large Language Model)** is an AI model trained on massive amounts of text data. It learns patterns in language and can generate human-like text, answer questions, summarize content, translate languages, write code, and much more.

Examples of LLMs:
- **GPT-4o** by OpenAI — the model behind ChatGPT
- **Claude** by Anthropic
- **Llama 3** by Meta — open source, can run locally
- **Gemini** by Google

You interact with an LLM by sending it a **prompt** — a text input — and it responds with generated text.

```
You send:    "What is the capital of France?"
LLM returns: "The capital of France is Paris."
```

In a backend API, you call the LLM's API over HTTP — just like calling any other third-party service.

### What is LangChain then?

LangChain is a framework that sits on top of LLM APIs and gives you higher-level tools to build AI-powered features. Instead of making raw HTTP calls and managing everything yourself, LangChain gives you:

- **Prompt Templates** — reusable prompts with variables
- **Chains** — connect prompt → model → parser in one pipeline
- **Memory** — store and inject conversation history automatically
- **Output Parsers** — transform raw text responses into structured data
- **Model abstraction** — swap between OpenAI, Groq, Anthropic with one line change

Think of it like Express for LLMs. You could build an HTTP server with raw Node.js `http` module — but Express makes it cleaner, faster, and more maintainable. LangChain does the same for AI.

```
Without LangChain:
  Your code → build prompt string manually
            → call OpenAI HTTP API
            → get raw text response
            → parse manually
            → handle errors manually
            → use result

With LangChain:
  Your code → Chain (prompt template + model + parser)
            → invoke with variables
            → get structured result
```

### What can you build with LangChain?

For our Airbnb API specifically:
- **Natural language search** — user types "cozy apartment in Kigali under $80" and the AI extracts the filters
- **Description generator** — host provides basic details, AI writes a professional listing description
- **Guest support chatbot** — AI answers questions about listings and bookings, remembers the conversation
- **Booking recommendations** — AI suggests listings based on user preferences

These are features that would be impossible or very complex to build without AI.

---

## Why LangChain over Raw OpenAI SDK?

You could call the OpenAI API directly without LangChain. Here is what that looks like:

```typescript
// Raw OpenAI SDK — no LangChain
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: `Answer this: ${question}` },
  ],
});

const answer = response.choices[0]?.message?.content ?? "";
```

This works fine for a single simple call. But as soon as you need prompt reuse, conversation history, structured output, or want to switch models — it gets messy fast.

Here is the same thing with LangChain:

```typescript
// LangChain
const prompt = ChatPromptTemplate.fromTemplate(
  "You are a helpful assistant. Answer this: {question}"
);
const chain = prompt.pipe(model).pipe(new StringOutputParser());
const answer = await chain.invoke({ question });
```

Cleaner, reusable, and swapping the model is just changing one import.

| | Raw OpenAI SDK | LangChain |
|--|---------------|-----------|
| Prompt management | Manual string building | Prompt templates with variables |
| Output parsing | Manual JSON.parse | Built-in output parsers |
| Conversation memory | Manual array management | Built-in memory classes |
| Switch models | Rewrite all API calls | Change one import |
| Streaming | Manual event handling | Built-in streaming support |
| Chains | Manual orchestration | Composable chain primitives |

The biggest win is **model portability**. If you start with OpenAI and want to switch to Groq, Anthropic, or a local Ollama model, you change one import. Every chain, every prompt, every parser stays exactly the same.

```typescript
// Switch from OpenAI to Groq — only this line changes
// import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";

// export const model = new ChatOpenAI({ model: "gpt-4o-mini" });
export const model = new ChatGroq({ model: "llama3-8b-8192" });

// Everything else in your codebase stays exactly the same
```

This matters a lot in real projects — OpenAI pricing changes, new models come out, you want to test different providers. With LangChain you're never locked in.

---

## LangChain Core Concepts

Before writing any code, you need to understand the 5 building blocks of LangChain. Every AI feature you build is a combination of these.

### 1. Model

The model is the LLM you talk to. LangChain wraps different LLM providers — OpenAI, Groq, Anthropic, Ollama — behind a unified interface. You call `.invoke()` the same way regardless of which provider you use.

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";

// OpenAI
const openaiModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
});

// Groq (free)
const groqModel = new ChatGroq({
  model: "llama3-8b-8192",
  temperature: 0.7,
});

// Both are called exactly the same way
const response = await openaiModel.invoke("Hello!");
const response2 = await groqModel.invoke("Hello!");
```

**What is `temperature`?**

Temperature controls how creative or random the model's responses are:

```
temperature: 0    → very deterministic, same answer every time
                    good for: data extraction, JSON parsing, factual answers

temperature: 0.7  → balanced, some creativity
                    good for: general chat, descriptions, recommendations

temperature: 1    → very creative, unpredictable
                    good for: creative writing, brainstorming
```

For extracting structured data (like search filters), use `temperature: 0`. For generating listing descriptions, use `temperature: 0.7`.

### 2. Prompt Template

A prompt template is a reusable prompt with named variables. Instead of building strings manually every time, you define the template once and fill in the variables when you call it.

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";

// ❌ Without prompt template — manual string building every time
const prompt = `You are a helpful assistant. The user is looking for listings in ${location} under $${maxPrice}.`;

// ✅ With prompt template — define once, reuse everywhere
const promptTemplate = ChatPromptTemplate.fromTemplate(
  "You are a helpful assistant. The user is looking for listings in {location} under ${maxPrice}."
);

// Fill in variables at call time
const filledPrompt = await promptTemplate.invoke({
  location: "Kigali",
  maxPrice: 100,
});
```

Variables in templates are written as `{variableName}` with curly braces. LangChain replaces them with the actual values when you invoke the template.

**System + Human messages:**

Most chat models expect two types of messages:
- **System message** — sets the AI's role and behavior ("You are a helpful assistant...")
- **Human message** — the actual user input

```typescript
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant for an Airbnb platform."],
  ["human", "{question}"],
]);
```

This is more explicit and gives you better control over the AI's behavior than a single string template.

### 3. Chain

A chain connects multiple steps together into a single pipeline. The output of one step automatically becomes the input of the next.

The most common chain is: **prompt → model → parser**

```typescript
const chain = prompt.pipe(model).pipe(outputParser);
```

You build it with `.pipe()` — just like piping streams in Node.js. Then you run the whole chain with `.invoke()`:

```typescript
// This runs all three steps in sequence:
// 1. prompt fills in the variables
// 2. model generates a response
// 3. parser formats the output
const result = await chain.invoke({ question: "What is Node.js?" });
```

Without chains, you'd have to call each step manually and pass the output yourself:

```typescript
// ❌ Without chain — manual step by step
const filledPrompt = await prompt.invoke({ question });
const modelResponse = await model.invoke(filledPrompt);
const parsed = parser.parse(modelResponse.content);

// ✅ With chain — one call does everything
const parsed = await chain.invoke({ question });
```

### 4. Output Parser

The model always returns a raw `AIMessage` object. An output parser transforms that into something more useful — a plain string, a JSON object, a list, etc.

```typescript
import { StringOutputParser } from "@langchain/core/output_parsers";

// Without parser — you get an AIMessage object
const response = await model.invoke("Hello");
console.log(response);         // AIMessage { content: "Hello! How can I help?", ... }
console.log(response.content); // "Hello! How can I help?"

// With StringOutputParser — you get a plain string directly
const chain = prompt.pipe(model).pipe(new StringOutputParser());
const text = await chain.invoke({ question: "Hello" });
console.log(text); // "Hello! How can I help?"
```

For this course we use `StringOutputParser` for most things. When we need structured JSON from the AI, we parse the string ourselves with `JSON.parse()`.

### 5. Memory

By default, every time you call a chain it has no memory of previous calls. Each call is completely independent — like starting a brand new conversation every time.

```
No memory:
  Call 1: "My name is Alice"  → AI: "Nice to meet you, Alice!"
  Call 2: "What is my name?"  → AI: "I don't know your name."  ✔ forgot!
```

Memory solves this by storing the conversation history and injecting it into every new prompt:

```
With memory:
  Call 1: "My name is Alice"  → AI: "Nice to meet you, Alice!"
  Call 2: "What is my name?"  → AI: "Your name is Alice."  ✔ remembers!
```

In LangChain, you manage memory by keeping an array of messages and passing it into the prompt using `MessagesPlaceholder`:

```typescript
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MessagesPlaceholder } from "@langchain/core/prompts";

// history is an array of past messages
const history = [
  new HumanMessage("My name is Alice"),
  new AIMessage("Nice to meet you, Alice!"),
];

// MessagesPlaceholder injects the history array into the prompt
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant."],
  new MessagesPlaceholder("history"),  // ← history gets injected here
  ["human", "{input}"],
]);

const response = await chain.invoke({ history, input: "What is my name?" });
// AI sees the full conversation and answers: "Your name is Alice."
```

We cover the full implementation of memory in the [Conversation Memory](#conversation-memory) section.

---

## Setup & Configuration

### How LLM APIs work

Before installing anything, understand what's happening under the hood. When you call an LLM:

1. You send an HTTP request to the provider's API (OpenAI, Groq, etc.) with your prompt
2. The provider runs your prompt through their model on their servers
3. They send back the generated text as a JSON response
4. LangChain wraps this whole process so you don't deal with raw HTTP

This means you need an **API key** — a credential that identifies your account and lets the provider bill you for usage. Keep it secret, never commit it to Git.

### Choosing a provider

For this course we recommend **Groq** because:
- It's completely **free** with a generous rate limit
- No credit card required
- Very fast responses (faster than OpenAI)
- Runs Meta's Llama 3 models which are excellent quality

Get your free Groq API key at [console.groq.com](https://console.groq.com) — sign up, go to API Keys, create a new key.

### Install dependencies

```bash
npm install langchain @langchain/core @langchain/groq
```

What each package does:
- `langchain` — the core framework, memory utilities
- `@langchain/core` — base types, prompt templates, output parsers
- `@langchain/groq` — Groq provider integration

If you prefer OpenAI instead:
```bash
npm install langchain @langchain/core @langchain/openai
```

### Environment variables

Add to your `.env`:
```env
# Groq (free — recommended for this course)
GROQ_API_KEY=gsk_...

# OR OpenAI (paid)
# OPENAI_API_KEY=sk-...
```

Add to `.env.example` so teammates know what's needed:
```env
GROQ_API_KEY=
# OPENAI_API_KEY=
```

### Create the AI config

Create a single file that exports the model. All your AI controllers import from here. This way if you ever switch providers, you change it in one place.

**src/config/ai.ts:**
```typescript
import { ChatGroq } from "@langchain/groq";

export const model = new ChatGroq({
  model: "llama3-8b-8192",
  temperature: 0.7,
  apiKey: process.env["GROQ_API_KEY"],
});
```

If you want to use OpenAI instead, just swap the import and class:
```typescript
import { ChatOpenAI } from "@langchain/openai";

export const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
  apiKey: process.env["OPENAI_API_KEY"],
});
```

Every controller imports `model` from this file — nothing else changes.

### Available Groq models

| Model | Speed | Quality | Best for |
|-------|-------|---------|----------|
| `llama3-8b-8192` | Fastest | Good | Development, simple tasks |
| `llama3-70b-8192` | Fast | Better | Production, complex tasks |
| `mixtral-8x7b-32768` | Medium | Good | Long context tasks |

Start with `llama3-8b-8192` — it's fast and good enough for everything in this course.

---

## Your First Chain

Before building the real features, let's build the simplest possible chain and understand exactly what happens at each step. This is the foundation — every other feature in this lesson is a variation of this pattern.

### What happens when you call a chain

```
chain.invoke({ question: "What makes a good listing title?" })
  ↓
Step 1 — Prompt Template fills in the variable:
  "You are a helpful assistant for an Airbnb-like platform.
   What makes a good listing title?"
  ↓
Step 2 — Model receives the filled prompt and generates a response:
  AIMessage { content: "A good listing title should be specific, highlight..." }
  ↓
Step 3 — StringOutputParser extracts the text from AIMessage:
  "A good listing title should be specific, highlight..."
  ↓
Your code receives a plain string
```

Each step is connected with `.pipe()`. The output of one step is automatically passed as input to the next.

### Implementation

**src/controllers/v1/ai.controller.ts:**
```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { model } from "../../config/ai.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import type { Request, Response } from "express";

// Define the prompt template once at the module level
// This is created once when the server starts, not on every request
const prompt = ChatPromptTemplate.fromTemplate(
  "You are a helpful assistant for an Airbnb-like platform. {question}"
);

// Build the chain: prompt → model → parser
// This is also created once at module level — chains are reusable
const chain = prompt.pipe(model).pipe(new StringOutputParser());

export const askAI = asyncHandler(async (req: Request, res: Response) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  // invoke() runs the full chain with the provided variables
  // It's async because it makes an HTTP call to the LLM API
  const answer = await chain.invoke({ question });

  res.json({ answer });
});
```

### Why define the chain at module level?

Notice the prompt and chain are defined **outside** the handler function, at the top of the file. This is intentional.

```typescript
// ✅ Correct — created once when the module loads
const chain = prompt.pipe(model).pipe(new StringOutputParser());

export const askAI = async (req, res) => {
  const answer = await chain.invoke({ question }); // reuse the chain
};

// ❌ Wrong — creates a new chain object on every single request
export const askAI = async (req, res) => {
  const chain = prompt.pipe(model).pipe(new StringOutputParser()); // wasteful
  const answer = await chain.invoke({ question });
};
```

Chains are stateless and reusable. Creating them once at module level is more efficient.

### Add the route

**src/routes/v1/ai.routes.ts:**
```typescript
import { Router } from "express";
import { askAI } from "../../controllers/v1/ai.controller.js";

const aiRouter = Router();

aiRouter.post("/ask", askAI);

export default aiRouter;
```

**Mount in src/routes/v1/index.ts:**
```typescript
import aiRouter from "./ai.routes.js";
v1Router.use("/ai", aiRouter);
```

### Test it

```json
POST /api/v1/ai/ask
{ "question": "What makes a good Airbnb listing title?" }
```

Expected response:
```json
{
  "answer": "A good Airbnb listing title should be specific and descriptive..."
}
```

This is the simplest possible AI feature. From here, every other feature just changes the prompt and adds more logic around it.

---

## AI Listing Search

This is the most powerful feature in this lesson. Instead of making users fill out filter dropdowns, they just type what they want in plain English and the AI figures out the filters.

### The problem with traditional search

Traditional search requires the user to know your filter options:
- Select a dropdown for type: APARTMENT, HOUSE, VILLA, CABIN
- Enter a number for max price
- Enter a number for guests
- Type a location exactly

This is friction. Users think in natural language, not filter forms.

### The AI approach

The user types: `"cozy apartment in Kigali under $80 for 2 guests"`

The AI reads that sentence and extracts:
```json
{ "location": "Kigali", "type": "APARTMENT", "maxPrice": 80, "guests": 2 }
```

Then you use those extracted values in a normal Prisma query. The AI does the parsing work, Prisma does the database work.

### Why instruct the AI to return JSON?

By default, the AI returns conversational text like:
> "Based on your query, I found that you're looking for an apartment in Kigali..."

That's useless for a database query. You need structured data. So you instruct the AI in the prompt to return **only JSON** — no explanation, no markdown, just the raw JSON object.

This technique is called **structured output extraction** and it's one of the most common patterns in AI-powered APIs.

### The prompt matters a lot

The quality of your prompt directly determines the quality of the AI's output. A vague prompt gives vague results. A specific prompt gives reliable results.

```
❌ Vague prompt:
  "Extract filters from: {query}"
  → AI might return anything — text, partial JSON, wrong format

✅ Specific prompt:
  "Extract filters and return ONLY a valid JSON object.
   No explanation, no markdown, just the JSON.
   Use null for any field not mentioned.
   Available types: APARTMENT, HOUSE, VILLA, CABIN"
  → AI reliably returns clean JSON every time
```

### Why `{{` double braces in the prompt?

In LangChain prompt templates, single curly braces `{variable}` are treated as template variables. If you want a literal `{` or `}` in your prompt (like in a JSON example), you must escape them with double braces `{{` and `}}`.

```typescript
// {query} → this is a template variable, gets replaced with the actual query
// {{ and }} → these become literal { and } in the final prompt
const prompt = ChatPromptTemplate.fromTemplate(`
Return this JSON format:
{{                        ← becomes { in the actual prompt
  "location": "string",
  "type": "string"
}}                        ← becomes } in the actual prompt

User query: {query}       ← this gets replaced with the actual query
`);
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
If the type is not mentioned or doesn't match, use null.
If a field is not mentioned in the query, use null.

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

  // Step 1: Ask the AI to extract filters from the natural language query
  const raw = await filterChain.invoke({ query });

  // Step 2: Parse the JSON the AI returned
  // The AI should return clean JSON but we wrap in try/catch just in case
  let filters: {
    location?: string | null;
    type?: string | null;
    maxPrice?: number | null;
    guests?: number | null;
  };

  try {
    filters = JSON.parse(raw);
  } catch {
    // AI returned something that isn't valid JSON — fall back to location search
    filters = { location: query };
  }

  // Step 3: Use the extracted filters in a normal Prisma query
  // The spread operator with && means: only add this filter if the value is not null
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

  // Return both the extracted filters (useful for debugging) and the listings
  res.json({ filters, listings });
});
```

### Add the route

```typescript
aiRouter.post("/search", aiSearch);
```

### Test it

```json
POST /api/v1/ai/search
{ "query": "cozy apartment in Kigali under $80 for 2 guests" }
```

Expected response:
```json
{
  "filters": {
    "location": "Kigali",
    "type": "APARTMENT",
    "maxPrice": 80,
    "guests": 2
  },
  "listings": [
    {
      "id": "a3f8c2d1-...",
      "title": "Cozy Studio in Kigali",
      "location": "Kigali",
      "pricePerNight": 65,
      "host": { "id": "...", "name": "Alice" }
    }
  ]
}
```

Try different queries to see how the AI handles them:
- `"villa with a pool for a family of 5"` → extracts type and guests
- `"something cheap under $50"` → extracts only maxPrice
- `"place in Musanze"` → extracts only location
- `"I want a house"` → extracts only type

---

## Listing Description Generator

Writing a good listing description is hard for most hosts. They know their place well but struggle to put it into words that attract guests. This endpoint takes the basic listing details and generates a professional, compelling description automatically.

### How the prompt is designed

The key to a good description generator is a well-crafted prompt. You need to:
1. Tell the AI what role it's playing (professional copywriter)
2. Give it all the listing details as variables
3. Set clear constraints (2-3 paragraphs, don't make up features)

Without the constraint "do not make up features", the AI might invent amenities that don't exist — which would be dishonest to guests.

### Implementation

```typescript
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
Do not use generic phrases like "perfect for" or "you will love".
`);

const descriptionChain = descriptionPrompt.pipe(model).pipe(new StringOutputParser());

export const generateDescription = asyncHandler(async (req: Request, res: Response) => {
  const { title, type, location, price, guests, amenities } = req.body;

  if (!title || !type || !location || !price || !guests) {
    return res.status(400).json({ error: "title, type, location, price and guests are required" });
  }

  // amenities is an array like ["WiFi", "Kitchen"] — join it into a string for the prompt
  const amenitiesText = Array.isArray(amenities)
    ? amenities.join(", ")
    : amenities ?? "none listed";

  const description = await descriptionChain.invoke({
    title,
    type,
    location,
    price,
    guests,
    amenities: amenitiesText,
  });

  res.json({ description });
});
```

### Add the route

```typescript
aiRouter.post("/generate-description", authenticate, generateDescription);
```

This route requires authentication — only logged-in users (hosts) should be able to generate descriptions.

### Test it

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

Expected response:
```json
{
  "description": "Nestled in the heart of Kigali, this bright studio apartment offers a comfortable retreat for two guests. The space is thoughtfully equipped with a full kitchen and reliable WiFi, making it ideal for both short stays and longer visits...."
}
```

The host can then copy this description directly into their listing or edit it to their taste.

---

## Conversation Memory

For a guest support chatbot, the AI needs to remember what was said earlier in the conversation. Without memory, every message is treated as a completely fresh conversation — the AI has no idea what was discussed before.

### Why memory is needed

```
Without memory — every message is independent:
  Message 1: "I need a place in Kigali for 2 people"
  AI: "Here are some listings in Kigali for 2 guests..."

  Message 2: "What about cheaper ones?"
  AI: "Cheaper ones where? I need more context."  ← forgot everything!

With memory — AI sees the full conversation:
  Message 1: "I need a place in Kigali for 2 people"
  AI: "Here are some listings in Kigali for 2 guests..."

  Message 2: "What about cheaper ones?"
  AI: "Here are cheaper listings in Kigali for 2 guests..."  ← remembers!
```

### How memory works in LangChain

LangChain doesn't magically remember things. You manage memory yourself by:
1. Keeping an array of past messages (`HumanMessage` and `AIMessage` objects)
2. Passing that array into the prompt using `MessagesPlaceholder`
3. After each exchange, adding the new messages to the array

The prompt then looks like this to the model:
```
System: You are a helpful assistant...
Human: I need a place in Kigali for 2 people      ← from history
AI: Here are some listings in Kigali...           ← from history
Human: What about cheaper ones?                   ← current message
```

The model sees the full conversation and responds in context.

### What is a sessionId?

Different users have different conversations. You need a way to keep each user's history separate. A `sessionId` is a unique string the client sends with every message to identify their conversation.

```
User A sends: { sessionId: "user-1-session", message: "..." }
User B sends: { sessionId: "user-2-session", message: "..." }

Server keeps separate history for each sessionId:
  sessions["user-1-session"] = [HumanMessage, AIMessage, ...]
  sessions["user-2-session"] = [HumanMessage, AIMessage, ...]
```

The client generates the sessionId — it can be a UUID, a user ID + timestamp, or any unique string.

### Implementation

```typescript
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { model } from "../../config/ai.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import type { Request, Response } from "express";

// Store conversation history per sessionId
// Map key = sessionId, value = array of messages
// Note: this is in-memory — it resets when the server restarts
// In production, store this in Redis so it persists across restarts
const sessions = new Map<string, Array<HumanMessage | AIMessage>>();

const chatPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful guest support assistant for an Airbnb-like platform. " +
    "Help users find listings, answer questions about bookings, and provide travel advice. " +
    "Be friendly, concise, and helpful.",
  ],
  new MessagesPlaceholder("history"),  // past messages get injected here
  ["human", "{input}"],                // current message
]);

const chatChain = chatPrompt.pipe(model).pipe(new StringOutputParser());

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: "message and sessionId are required" });
  }

  // Get existing history for this session, or start with empty array
  const history = sessions.get(sessionId) ?? [];

  // Run the chain with the current message and full history
  const response = await chatChain.invoke({
    history,   // all past messages
    input: message,  // current message
  });

  // Add the new exchange to history so next message has context
  history.push(new HumanMessage(message));
  history.push(new AIMessage(response));
  sessions.set(sessionId, history);

  res.json({ response, sessionId });
});
```

### Add the route

```typescript
aiRouter.post("/chat", chat);
```

### Test it — send multiple messages with the same sessionId

**First message:**
```json
POST /api/v1/ai/chat
{
  "sessionId": "user-123-session-1",
  "message": "I'm looking for a place in Kigali for 2 people"
}
```

**Second message — AI must remember the context:**
```json
POST /api/v1/ai/chat
{
  "sessionId": "user-123-session-1",
  "message": "What about something with a pool?"
}
```

**Third message — AI still remembers:**
```json
POST /api/v1/ai/chat
{
  "sessionId": "user-123-session-1",
  "message": "And what's the price range for those?"
}
```

If you send the second message with a **different** `sessionId`, the AI will have no context and ask for clarification — that's the expected behavior.

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
