# Lesson 8 Assignment: AI-Powered Features with LangChain

## Overview

Extend the Airbnb API with AI-powered features using LangChain. You will build a natural language listing search, a listing description generator, and a conversational guest support chatbot — all integrated into the existing `/api/v1/` routes.

---

## Setup

### 1. Install dependencies

```bash
npm install langchain @langchain/core @langchain/groq
```

> Use Groq — it's free and requires no credit card. Get your API key at [console.groq.com](https://console.groq.com).

### 2. Add environment variables

Add to `.env`:
```env
GROQ_API_KEY=gsk_...
```

Add to `.env.example`:
```env
GROQ_API_KEY=
```

### 3. Create the AI config

**src/config/ai.ts:**
```typescript
import { ChatGroq } from "@langchain/groq";

export const model = new ChatGroq({
  model: "llama3-8b-8192",
  temperature: 0.7,
  apiKey: process.env["GROQ_API_KEY"],
});
```

---

## Folder Structure

After completing the assignment your structure should look like:

```
src/
├── config/
│   └── ai.ts
├── controllers/
│   └── v1/
│       └── ai.controller.ts
└── routes/
    └── v1/
        └── ai.routes.ts
```

---

## Part 1 — Natural Language Listing Search

### Endpoint
```
POST /api/v1/ai/search
```

### Requirements

- Accept a `query` string in the request body — return `400` if missing
- Use LangChain to extract filters from the query:
  - `location` — string or null
  - `type` — `APARTMENT | HOUSE | VILLA | CABIN` or null
  - `maxPrice` — number or null
  - `guests` — number or null
- The prompt must instruct the model to return **only valid JSON** — no explanation, no markdown
- Parse the JSON response — return `422` if parsing fails
- Run a Prisma query using the extracted filters — only apply a filter if it's not null
- Include the host's `name` in the response using `include`
- Return both the extracted `filters` and the `listings` array
- If the AI call fails for any reason, fall back to treating the full query as a location search

### Expected request
```json
POST /api/v1/ai/search
{
  "query": "cozy apartment in Kigali under $100 for 2 guests"
}
```

### Expected response
```json
{
  "filters": {
    "location": "Kigali",
    "type": "APARTMENT",
    "maxPrice": 100,
    "guests": 2
  },
  "listings": [...]
}
```

---

## Part 2 — Listing Description Generator

### Endpoint
```
POST /api/v1/ai/generate-description
```
Requires authentication.

### Requirements

- Required fields: `title`, `type`, `location`, `price`, `guests` — return `400` if any are missing
- `amenities` is optional — default to `"none listed"` if not provided
- Use a prompt that instructs the model to write 2-3 short paragraphs — warm, honest, specific
- The prompt must tell the model **not to make up features** not in the amenities list
- Return the generated `description` as a string

### Expected request
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

### Expected response
```json
{
  "description": "Welcome to Sunny Studio, a bright and modern apartment..."
}
```

---

## Part 3 — Guest Support Chatbot

### Endpoint
```
POST /api/v1/ai/chat
```

### Requirements

- Required fields: `message` and `sessionId` — return `400` if either is missing
- Each `sessionId` must have its own conversation history stored in a `Map`
- Use `MessagesPlaceholder` to inject history into the prompt
- The system prompt must identify the AI as a guest support assistant for an Airbnb-like platform
- After each exchange, push both the `HumanMessage` and `AIMessage` to the session history
- Return the `response` and `sessionId` in the response body
- Conversation history must persist across multiple requests with the same `sessionId`

### Expected request — first message
```json
POST /api/v1/ai/chat
{
  "sessionId": "user-123-session-1",
  "message": "I'm looking for a place in Kigali for 2 people"
}
```

### Expected request — follow-up (must remember context)
```json
POST /api/v1/ai/chat
{
  "sessionId": "user-123-session-1",
  "message": "What about something with a pool?"
}
```

### Expected response
```json
{
  "response": "...",
  "sessionId": "user-123-session-1"
}
```

---

## Part 4 — Routes

Create **src/routes/v1/ai.routes.ts** and register all three endpoints:

```
POST /api/v1/ai/search               → aiSearch (public)
POST /api/v1/ai/generate-description → generateDescription (authenticated)
POST /api/v1/ai/chat                 → chat (public)
```

Mount the router in **src/routes/v1/index.ts**:
```typescript
v1Router.use("/ai", aiRouter);
```

---

## Testing

Test all endpoints in Postman.

### AI Search
- `POST /api/v1/ai/search` with `"query": "villa in Musanze for 4 guests"` — should return filtered listings
- `POST /api/v1/ai/search` with `"query": "cheap place under $50"` — should filter by price
- `POST /api/v1/ai/search` with no `query` — should return `400`
- `POST /api/v1/ai/search` with a nonsense query — should fall back gracefully

### Description Generator
- `POST /api/v1/ai/generate-description` with valid data — should return a 2-3 paragraph description
- `POST /api/v1/ai/generate-description` without auth — should return `401`
- `POST /api/v1/ai/generate-description` missing `title` — should return `400`

### Chatbot
- Send two messages with the same `sessionId` — second response must reference the first message's context
- Send a message with a new `sessionId` — should start a fresh conversation
- Send without `sessionId` — should return `400`

---

## Final Checklist

- [ ] `GROQ_API_KEY` added to `.env` and `.env.example`
- [ ] `src/config/ai.ts` created with Groq model
- [ ] `POST /api/v1/ai/search` extracts filters and queries the database
- [ ] AI search falls back to location search on failure
- [ ] `POST /api/v1/ai/generate-description` requires auth and returns a description
- [ ] `POST /api/v1/ai/chat` maintains conversation history per `sessionId`
- [ ] All endpoints return `400` for missing required fields
- [ ] AI routes mounted under `/api/v1/ai` in the v1 router
- [ ] All three endpoints tested and working in Postman

---

## What You Should Practice

- Building LangChain chains with prompt templates and output parsers
- Extracting structured data (JSON) from LLM responses
- Connecting AI output to real database queries
- Managing per-session conversation history with `MessagesPlaceholder`
- Handling AI errors gracefully with fallbacks
- Integrating AI features into an existing versioned REST API
