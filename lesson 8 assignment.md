# Lesson 8 Assignment: AI-Powered Features with LangChain

## Overview

Build 5 AI-powered features on top of the existing Airbnb API. Each part goes beyond what the lesson showed — you will need to think about prompt design, data flow, error handling, and how AI connects to your real database. By the end, your API has production-quality AI features that actually work with real data.

---

## Setup

```bash
npm install langchain @langchain/core @langchain/groq
```

Add to `.env` and `.env.example`:
```env
GROQ_API_KEY=gsk_...
```

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

## Part 1 — Smart Listing Search with Pagination

### Endpoint
```
POST /api/v1/ai/search
```

### What makes this different from the lesson

The lesson showed a basic search that returns up to 10 results. This version must:

- Support `page` and `limit` query params — paginate the results just like `GET /api/v1/listings`
- Return a `meta` object with `total`, `page`, `limit`, `totalPages`
- Use `Promise.all` to fetch listings and count simultaneously
- If the AI extracts **no filters at all** (all null), return `400` with the message `"Could not extract any filters from your query, please be more specific"` — don't run an empty query that returns everything
- Include the host's `name` and `email` in each listing
- Use `temperature: 0` for the filter extraction model — you want deterministic JSON, not creative output. Create a **separate model instance** just for this endpoint with `temperature: 0`

### Expected request
```json
POST /api/v1/ai/search?page=1&limit=5
{
  "query": "apartment in Kigali under $100 for 2 guests"
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
  "data": [...],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 5,
    "totalPages": 3
  }
}
```

---

## Part 2 — Listing Description Generator with Tone Control

### Endpoint
```
POST /api/v1/ai/listings/:id/generate-description
```
Requires authentication. The `:id` is the listing ID.

### What makes this different from the lesson

Instead of sending listing details in the request body, this endpoint:

- Fetches the listing from the database using the `:id` param — return `404` if not found
- Checks that the authenticated user is the owner of the listing — return `403` if not
- Accepts an optional `tone` field in the request body: `"professional"`, `"casual"`, or `"luxury"` — default to `"professional"` if not provided
- The prompt must change based on the tone:
  - `professional` — formal, clear, business-like
  - `casual` — friendly, relaxed, conversational
  - `luxury` — elegant, premium, aspirational
- After generating the description, **save it to the database** by updating the listing's `description` field
- Return both the generated `description` and the updated `listing`

### Expected request
```json
POST /api/v1/ai/listings/a3f8c2d1-4b5e-4f6a-8c9d-1e2f3a4b5c6d/generate-description
Authorization: Bearer <host-token>
{
  "tone": "luxury"
}
```

### Expected response
```json
{
  "description": "Experience unparalleled comfort in this exquisite...",
  "listing": {
    "id": "a3f8c2d1-...",
    "title": "Sunny Studio in Kigali",
    "description": "Experience unparalleled comfort in this exquisite...",
    ...
  }
}
```

---

## Part 3 — Guest Support Chatbot with Listing Context

### Endpoint
```
POST /api/v1/ai/chat
```

### What makes this different from the lesson

The lesson showed a basic chatbot that just answers general questions. This version must:

- Accept an optional `listingId` in the request body
- If `listingId` is provided, fetch that listing from the database and inject its details into the **system prompt** so the AI can answer specific questions about it
- If `listingId` is not provided, the chatbot works as a general assistant
- Limit conversation history to the last **10 exchanges** (20 messages) — if history grows beyond that, trim the oldest messages. This prevents the prompt from getting too long and hitting token limits
- Add a `messageCount` field to the response showing how many messages are in the current session

### System prompt when listingId is provided:
```
You are a helpful guest support assistant for an Airbnb-like platform.
You are currently helping a guest with questions about this specific listing:

Title: {title}
Location: {location}
Price per night: ${price}
Max guests: {guests}
Type: {type}
Amenities: {amenities}
Description: {description}

Answer questions about this listing accurately based on the details above.
If asked something not covered by the listing details, say you don't have that information.
```

### Expected request — with listing context
```json
POST /api/v1/ai/chat
{
  "sessionId": "user-123-session-1",
  "listingId": "a3f8c2d1-4b5e-4f6a-8c9d-1e2f3a4b5c6d",
  "message": "Does this place have WiFi?"
}
```

### Expected response
```json
{
  "response": "Yes, this listing includes WiFi as one of its amenities...",
  "sessionId": "user-123-session-1",
  "messageCount": 2
}
```

---

## Part 4 — AI Booking Recommendation

### Endpoint
```
POST /api/v1/ai/recommend
```
Requires authentication.

### What to build

This endpoint recommends listings to a logged-in user based on their booking history.

- Fetch the authenticated user's last 5 bookings from the database, including the listing details for each
- If the user has no bookings, return `400` with `"No booking history found. Make some bookings first to get recommendations."`
- Build a summary of the user's booking history and pass it to the AI
- The AI must analyze the history and return a JSON object with:
  - `preferences` — what the AI inferred about the user (location preferences, price range, type preferences)
  - `searchFilters` — suggested Prisma filters to find matching listings (`location`, `type`, `maxPrice`, `guests`)
  - `reason` — a short explanation of why these filters were chosen
- Use the `searchFilters` to run a real Prisma query and return actual listings
- Exclude listings the user has already booked

### Prompt hint

Your prompt should include the booking history summary and instruct the AI to return only JSON in this format:
```json
{
  "preferences": "string describing what the user likes",
  "searchFilters": {
    "location": "string or null",
    "type": "string or null",
    "maxPrice": "number or null",
    "guests": "number or null"
  },
  "reason": "string explaining the recommendation"
}
```

### Expected response
```json
{
  "preferences": "User prefers apartments in Kigali, typically books for 2 guests, budget around $80/night",
  "reason": "Based on 3 previous bookings in Kigali, all apartments under $90",
  "searchFilters": {
    "location": "Kigali",
    "type": "APARTMENT",
    "maxPrice": 90,
    "guests": 2
  },
  "recommendations": [...]
}
```

---

## Part 5 — Listing Review Summarizer

### Endpoint
```
GET /api/v1/ai/listings/:id/review-summary
```

### What to build

This endpoint reads all reviews for a listing and generates an AI summary of what guests think about it.

- Fetch all reviews for the listing from the database, including the reviewer's name — return `404` if the listing doesn't exist
- If the listing has fewer than 3 reviews, return `400` with `"Not enough reviews to generate a summary (minimum 3 required)"`
- Format the reviews into a readable text block and pass it to the AI
- The AI must return a JSON object with:
  - `summary` — 2-3 sentence overall summary of guest experience
  - `positives` — array of 3 things guests consistently praised
  - `negatives` — array of things guests complained about (empty array if none)
  - `averageRating` — calculate this yourself from the reviews, do not ask the AI to calculate it
  - `totalReviews` — total number of reviews
- Cache the response for **10 minutes** using the in-memory cache from lesson 6 — clear the cache when a new review is posted for this listing

### Expected response
```json
{
  "summary": "Guests consistently praise the central location and cleanliness of this apartment. The host is responsive and check-in is smooth.",
  "positives": ["Great location", "Very clean", "Responsive host"],
  "negatives": ["Noisy street at night"],
  "averageRating": 4.3,
  "totalReviews": 14
}
```

---

## Error Handling — Required for All Parts

Every AI endpoint must handle these cases:

- **Missing required fields** → `400`
- **Resource not found** (listing, user) → `404`
- **Unauthorized** (wrong owner) → `403`
- **AI returns invalid JSON** → fall back gracefully, never crash
- **Groq rate limit (429)** → return `429` with `"AI service is busy, please try again in a moment"`
- **Invalid API key (401 from Groq)** → return `500` with `"AI service configuration error"`

---

## Testing

### Part 1 — Smart Search
- Search with a detailed query — verify `filters` are extracted correctly and `meta` is returned
- Search with `page=2&limit=3` — verify pagination works
- Search with a vague query like `"nice place"` where all filters are null — should return `400`
- Search with `temperature: 0` model — run the same query 3 times, filters should be identical every time

### Part 2 — Description Generator
- Generate with `tone: "luxury"` vs `tone: "casual"` — descriptions should feel noticeably different
- Try to generate for a listing you don't own — should return `403`
- After generating, fetch the listing from `GET /api/v1/listings/:id` — description should be updated in the database

### Part 3 — Chatbot with Context
- Send a message with a `listingId` — AI should answer based on that listing's actual amenities
- Ask about something not in the listing (e.g. "Is there a gym?") — AI should say it doesn't have that info
- Send 12 messages in one session — verify history is trimmed to 10 exchanges

### Part 4 — Recommendations
- Call without any bookings — should return `400`
- Make 3+ bookings then call — should return listings matching your booking patterns
- Verify recommended listings don't include ones you've already booked

### Part 5 — Review Summary
- Call on a listing with fewer than 3 reviews — should return `400`
- Call on a listing with 5+ reviews — should return structured JSON with all fields
- Call twice quickly — second call should be from cache (check response time)
- Post a new review then call again — cache should be cleared, fresh summary returned

---

## Final Checklist

- [ ] `GROQ_API_KEY` in `.env` and `.env.example`
- [ ] Separate `temperature: 0` model instance used for filter extraction
- [ ] AI search returns paginated results with `meta` object
- [ ] AI search returns `400` when all filters are null
- [ ] Description generator fetches listing from DB by `:id`
- [ ] Description generator checks ownership before generating
- [ ] Description generator saves result to the database
- [ ] Tone changes the prompt and produces noticeably different output
- [ ] Chatbot injects listing details into system prompt when `listingId` provided
- [ ] Chatbot trims history to last 10 exchanges
- [ ] Recommendation endpoint uses real booking history from DB
- [ ] Recommendations exclude already-booked listings
- [ ] Review summarizer calculates `averageRating` in code, not via AI
- [ ] Review summarizer caches response for 10 minutes
- [ ] Review summary cache is cleared when a new review is posted
- [ ] All endpoints handle AI errors gracefully with correct status codes
- [ ] All AI routes mounted under `/api/v1/ai`

---

## What You Should Practice

- Designing prompts that produce reliable, structured output
- Using different temperature values for different use cases
- Connecting AI output to real database reads and writes
- Injecting dynamic database content into AI prompts
- Managing conversation history size to avoid token limit issues
- Caching AI responses and invalidating cache correctly
- Handling AI API errors with appropriate HTTP status codes
- Building AI features that degrade gracefully when the AI fails
