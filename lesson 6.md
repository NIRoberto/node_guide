# Lesson 6: Performance in Node.js APIs

## Table of Contents
1. [Why Performance Matters](#why-performance-matters)
2. [Pagination](#pagination)
3. [Indexing](#indexing)
4. [Query Optimization](#query-optimization)
5. [Caching](#caching)
6. [Rate Limiting](#rate-limiting)
7. [Compression](#compression)
8. [Connection Pooling](#connection-pooling)

---

## Why Performance Matters

A slow API is a broken API. Users leave if a page takes more than 3 seconds to load. At scale, small inefficiencies that are invisible in development become catastrophic in production.

### What "at scale" actually means

In development you test with 5 users and 20 listings. Everything is fast. Then you deploy and 10,000 users sign up. Suddenly:

- `GET /listings` returns 50,000 rows — the response takes 8 seconds and crashes the mobile app trying to render it
- Every page load hits the database 30 times because of N+1 queries
- A single angry user writes a script that sends 500 requests per second and takes your server down
- Your PostgreSQL server hits its connection limit and starts rejecting requests

None of these problems show up in development. They only appear in production, when real users are affected.

### The cost of bad performance

```
100ms response time  → users don't notice
1s response time     → users notice a slight delay
3s response time     → 40% of users abandon the page
10s response time    → almost everyone leaves
```

Performance is not an optimization you add later. It is a feature you build from the start. Every technique in this lesson is something you apply as you write the code — not after.

### What this lesson fixes

| Problem | Fix |
|---------|-----|
| Returning 50,000 rows when you need 10 | Pagination |
| Full table scan on every query | Indexing |
| Fetching columns and rows you don't need | Query optimization |
| Running the same expensive query 1000 times | Caching |
| One client sending unlimited requests | Rate limiting |
| Sending 500KB JSON when 50KB is enough | Compression |
| Opening a new DB connection on every request | Connection pooling |

---

## Pagination

### The Problem

When you have 100,000 listings in your database and someone calls `GET /listings`, you do not want to return all 100,000 at once. That would:
- Make PostgreSQL scan and load 100,000 rows into memory
- Serialize all of them into a massive JSON string
- Send hundreds of megabytes over the network
- Crash the mobile app trying to render 100,000 items

**Pagination** splits results into pages — return 20 at a time, let the client ask for the next page when they need it.

### How skip and take work

Prisma uses `skip` and `take` to paginate:
- `take` — how many rows to return (your `limit`)
- `skip` — how many rows to skip before starting

```
Page 1: skip=0,  take=20  → rows 1-20
Page 2: skip=20, take=20  → rows 21-40
Page 3: skip=40, take=20  → rows 41-60

skip = (page - 1) * limit
```

### Offset Pagination

The most common approach. The client sends `page` and `limit` as query params.

```typescript
export const getAllListings = asyncHandler(async (req: Request, res: Response) => {
  const page  = parseInt(req.query["page"]  as string) || 1;
  const limit = parseInt(req.query["limit"] as string) || 20;
  const skip  = (page - 1) * limit;

  // Run both queries at the same time — don't wait for one before starting the other
  const [listings, total] = await Promise.all([
    prisma.listing.findMany({ skip, take: limit }),
    prisma.listing.count(),
  ]);

  res.json({
    data: listings,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});
```

**Why `Promise.all` here?**

You need two things: the page of data AND the total count (to calculate `totalPages`). These two queries are completely independent — one doesn't need the result of the other. Running them in parallel cuts the response time roughly in half.

```
// Sequential — wasteful
const listings = await prisma.listing.findMany(...); // wait 20ms
const total    = await prisma.listing.count();       // wait another 15ms
// total: ~35ms

// Parallel — efficient
const [listings, total] = await Promise.all([...]);  // both run at the same time
// total: ~20ms
```

**Response:**
```json
{
  "data": [...],
  "meta": {
    "total": 500,
    "page": 2,
    "limit": 20,
    "totalPages": 25
  }
}
```

The `meta` object is what the frontend uses to render page numbers, "next" buttons, and "showing 21-40 of 500" labels.

### Always cap the limit

Never let the client request unlimited rows. A client could send `limit=999999` and bypass your pagination entirely.

```typescript
const limit = Math.min(parseInt(req.query["limit"] as string) || 20, 100);
//                     ↑ what client asked for                    ↑ maximum allowed
```

This caps the limit at 100 regardless of what the client sends.

### Cursor Pagination

Offset pagination has a hidden problem with large datasets. When you do `skip=10000, take=20`, PostgreSQL still has to scan and discard 10,000 rows before returning your 20. The bigger the page number, the slower the query.

**Cursor pagination** solves this. Instead of skipping rows, you use the last item's `id` as a bookmark — PostgreSQL jumps directly to that point.

```
First page:  no cursor         → returns items 1-20, last id = "abc123"
Next page:   cursor=abc123     → returns items after abc123
Next page:   cursor=xyz789     → returns items after xyz789
```

```typescript
export const getAllListings = asyncHandler(async (req: Request, res: Response) => {
  const cursor = req.query["cursor"] as string | undefined;
  const limit  = Math.min(parseInt(req.query["limit"] as string) || 20, 100);

  const listings = await prisma.listing.findMany({
    take: limit,
    skip: cursor ? 1 : 0,           // skip the cursor item itself
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { id: "asc" },         // must always order by the cursor field
  });

  // If we got a full page, there are more items — send the last id as the next cursor
  const nextCursor = listings.length === limit
    ? listings[listings.length - 1]?.id
    : null;  // null means no more pages

  res.json({ data: listings, nextCursor });
});
```

### Which to use?

| | Offset Pagination | Cursor Pagination |
|--|------------------|------------------|
| Simple to implement | ✅ | ❌ |
| Works with page numbers | ✅ | ❌ |
| Fast on large datasets | ❌ | ✅ |
| Consistent with real-time inserts | ❌ | ✅ |
| Shows total page count | ✅ | ❌ |

Use **offset** for admin dashboards, search results, and any UI with page numbers.
Use **cursor** for feeds, infinite scroll, and tables with millions of rows.

---

## Indexing

### The Problem

Without an index, every query does a **full table scan** — PostgreSQL reads every single row from top to bottom to find matches. With 10 rows this is instant. With 1,000,000 rows this takes hundreds of milliseconds.

```
SELECT * FROM listings WHERE location = 'Kigali';

Without index: PostgreSQL reads all 1,000,000 rows → finds 200 matches → ~500ms
With index:    PostgreSQL jumps directly to Kigali rows → ~1ms
```

An **index** is a separate data structure PostgreSQL maintains alongside your table. Think of it like the index at the back of a textbook — instead of reading every page to find "pagination", you look it up in the index and jump straight to page 47.

### What an index actually looks like

When you add `@@index([location])` to your Listing model, PostgreSQL creates a B-tree structure that looks roughly like:

```
Kigali    → [row 3, row 17, row 42, row 89, ...]
Musanze   → [row 5, row 23, row 67, ...]
Nyamirambo → [row 8, row 31, ...]
```

When you query `WHERE location = 'Kigali'`, PostgreSQL looks up "Kigali" in this structure in O(log n) time and gets the exact row pointers — no scanning needed.

### The cost of indexes

Indexes are not free. Every time you INSERT, UPDATE, or DELETE a row, PostgreSQL must also update every index on that table. More indexes = slower writes.

```
No indexes:    INSERT takes 2ms,  SELECT takes 500ms
With indexes:  INSERT takes 5ms,  SELECT takes 1ms
```

For read-heavy APIs (most APIs are), this tradeoff is almost always worth it. But don't add indexes blindly on every column.

### Adding indexes in Prisma

```prisma
model Listing {
  id            String   @id @default(uuid())
  title         String
  location      String
  pricePerNight Float
  type          String
  hostId        String
  createdAt     DateTime @default(now())

  host     User      @relation(fields: [hostId], references: [id])

  // Always index foreign keys — you almost always query by them
  @@index([hostId])

  // Index columns you filter by often
  @@index([location])
  @@index([type])
  @@index([pricePerNight])

  // Composite index — when you frequently filter by BOTH location AND type together
  @@index([location, type])
}
```

After adding indexes, create and apply the migration:
```bash
npx prisma migrate dev --name add_indexes
```

### Composite indexes

A composite index covers multiple columns together. It is useful when you frequently filter by two columns at the same time.

```typescript
// This query benefits from @@index([location, type])
prisma.listing.findMany({
  where: { location: "Kigali", type: "APARTMENT" }
});

// This query does NOT benefit from @@index([location, type])
// because type is the second column — the index only helps if location is included
prisma.listing.findMany({
  where: { type: "APARTMENT" }  // needs its own @@index([type])
});
```

Rule: a composite index `[a, b]` helps queries that filter by `a` alone or `a + b` together. It does NOT help queries that filter by `b` alone.

### When to add an index — the rule

| Column | Index? | Why |
|--------|--------|-----|
| Primary key (`id`) | ✅ automatic | Always needed |
| `@unique` fields (`email`) | ✅ automatic | Unique constraint creates one |
| Foreign keys (`hostId`, `listingId`) | ✅ always | You almost always query by these |
| Columns in `where` filters | ✅ yes | Direct lookup benefit |
| Columns in `orderBy` | ✅ yes | Sorting without scanning |
| Columns you rarely query | ❌ no | Slows writes for no benefit |
| Boolean columns | ❌ rarely | Low cardinality — not selective enough |
| Columns updated very frequently | ❌ careful | Index maintenance cost adds up |

---

## Query Optimization

### Select only what you need

Every column you fetch costs memory and network bandwidth. If you only need `id` and `name` to render a dropdown, don't fetch `bio`, `avatar`, `resetToken`, `createdAt`, and everything else.

```typescript
// ❌ fetches all columns — including password hash, reset tokens, everything
const users = await prisma.user.findMany();

// ✅ fetches only what the client actually needs
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true },
});
```

This matters more than it seems. A User row with all fields might be 500 bytes. With `select`, it's 80 bytes. Across 1000 rows that's 500KB vs 80KB — before compression.

### Avoid N+1 queries

The N+1 problem is the most common and most damaging performance bug in backend APIs. It happens when you run one query to get a list, then run a separate query for each item in that list.

```typescript
// ❌ N+1 problem
const listings = await prisma.listing.findMany(); // 1 query

for (const listing of listings) {
  // This runs once per listing — if there are 100 listings, that's 100 more queries
  const host = await prisma.user.findUnique({ where: { id: listing.hostId } });
  console.log(listing.title, host?.name);
}
// Total: 1 + 100 = 101 queries for 100 listings
// At 5ms per query: 505ms just for database calls
```

The fix is `include` — Prisma fetches the related data in a single JOIN query:

```typescript
// ✅ 1 query with a JOIN — gets listings AND their hosts in one round trip
const listings = await prisma.listing.findMany({
  include: { host: true },
});
// Total: 1 query
// At 5ms per query: 5ms
```

**How to spot N+1 in your code:** any `await prisma.*` call inside a loop is almost always an N+1 problem.

### `include` vs `select` — know the difference

These two are often confused:

```typescript
// include — returns ALL fields of the model PLUS the related data
const listing = await prisma.listing.findUnique({
  where: { id },
  include: { host: true },
  // returns: { id, title, location, pricePerNight, ..., host: { id, name, email, password, ... } }
  // problem: host includes password hash and other sensitive fields!
});

// select — you control exactly which fields come back, including from relations
const listing = await prisma.listing.findUnique({
  where: { id },
  select: {
    id: true,
    title: true,
    location: true,
    pricePerNight: true,
    host: {
      select: { id: true, name: true, email: true },  // only safe fields
    },
  },
  // returns exactly what you specified — nothing more
});
```

Use `select` when returning data to clients — it prevents accidentally leaking sensitive fields. Use `include` for internal server-side logic where you need the full object.

### Filtering and sorting at the database level

Never fetch all rows and filter in JavaScript. Always push filtering and sorting into the Prisma query so the database does the work.

```typescript
// ❌ Wrong — fetches ALL listings then filters in JS
const allListings = await prisma.listing.findMany();
const kigaliListings = allListings.filter(l => l.location === "Kigali");

// ✅ Correct — database returns only Kigali listings
const kigaliListings = await prisma.listing.findMany({
  where: { location: { contains: "Kigali", mode: "insensitive" } },
});
```

The wrong version loads every row into Node.js memory. The correct version lets PostgreSQL use its index and return only the matching rows.

### Run independent queries in parallel

If two queries don't depend on each other, run them at the same time.

```typescript
// ❌ Sequential — waits for each query before starting the next
const user     = await prisma.user.findUnique({ where: { id } });    // 15ms
const listings = await prisma.listing.findMany({ where: { hostId: id } }); // 20ms
const bookings = await prisma.booking.findMany({ where: { userId: id } }); // 18ms
// Total: 15 + 20 + 18 = 53ms

// ✅ Parallel — all three run at the same time
const [user, listings, bookings] = await Promise.all([
  prisma.user.findUnique({ where: { id } }),
  prisma.listing.findMany({ where: { hostId: id } }),
  prisma.booking.findMany({ where: { userId: id } }),
]);
// Total: max(15, 20, 18) = 20ms
```

This is a free performance win whenever you need multiple unrelated pieces of data in one request.

---

## Caching

### The Problem

Some data is expensive to compute and doesn't change often. Listing stats, popular listings, location counts — these require aggregation queries that scan thousands of rows. Running them on every single request is wasteful.

**Caching** stores the result of an expensive operation so you can return it instantly on the next request without touching the database.

```
Without cache:
  Request 1 → DB aggregation query (80ms) → Response
  Request 2 → DB aggregation query (80ms) → Response
  Request 3 → DB aggregation query (80ms) → Response
  1000 requests → 1000 DB queries → 80,000ms of DB work

With cache (TTL = 60s):
  Request 1 → DB aggregation query (80ms) → store in cache → Response
  Request 2 → cache hit (1ms) → Response
  Request 3 → cache hit (1ms) → Response
  1000 requests → 1 DB query + 999 cache hits → ~1,080ms of work
```

### In-memory cache

For simple cases, a plain JavaScript `Map` works fine. No extra dependencies, no setup. The cache lives in server memory and resets when the server restarts.

**src/config/cache.ts:**
```typescript
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export function setCache(key: string, data: unknown, ttlSeconds: number): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  // Check if the entry has expired
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);  // clean up expired entry
    return null;
  }

  return entry.data as T;
}

export function deleteCache(key: string): void {
  cache.delete(key);
}

export function deleteCacheByPrefix(prefix: string): void {
  // Delete all keys that start with the given prefix
  // Useful for clearing all paginated pages of a resource at once
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
```

### Using the cache in a controller

```typescript
import { getCache, setCache, deleteCache } from "../config/cache.js";

export const getListingStats = asyncHandler(async (req: Request, res: Response) => {
  const cacheKey = "listing:stats";

  // Check cache first
  const cached = getCache<object>(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Cache miss — run the expensive queries
  const [total, avgResult, byLocation, byType] = await Promise.all([
    prisma.listing.count(),
    prisma.listing.aggregate({ _avg: { pricePerNight: true } }),
    prisma.listing.groupBy({ by: ["location"], _count: { location: true } }),
    prisma.listing.groupBy({ by: ["type"], _count: { type: true } }),
  ]);

  const stats = {
    totalListings: total,
    averagePrice: avgResult._avg.pricePerNight,
    byLocation,
    byType,
  };

  // Store in cache for 5 minutes
  setCache(cacheKey, stats, 300);

  res.json(stats);
});
```

### Cache invalidation — the hard part

The biggest challenge with caching is knowing when to clear it. If you cache listing stats and someone creates a new listing, the cached stats are now wrong — they show the old count.

You must clear the cache whenever the underlying data changes:

```typescript
export const createListing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const listing = await prisma.listing.create({ data: req.body });

  // Clear all listing-related caches — data has changed
  deleteCache("listing:stats");
  deleteCacheByPrefix("listing:all:");  // clears all paginated pages

  res.status(201).json(listing);
});

export const deleteListing = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.listing.delete({ where: { id: req.params["id"] } });

  deleteCache("listing:stats");
  deleteCacheByPrefix("listing:all:");

  res.json({ message: "Listing deleted" });
});
```

### Cache key design

Cache keys must be unique per distinct response. If your endpoint supports pagination, the cache key must include the page and limit — otherwise page 1 and page 2 would return the same cached data.

```typescript
// ❌ Wrong — same key for all pages
const cacheKey = "listing:all";

// ✅ Correct — unique key per page
const cacheKey = `listing:all:page=${page}:limit=${limit}`;

// ✅ Correct — unique key per listing
const cacheKey = `listing:${id}`;

// ✅ Correct — unique key per listing's reviews page
const cacheKey = `listing:${id}:reviews:page=${page}:limit=${limit}`;
```

### What to cache and what not to

| Cache this | Don't cache this |
|------------|------------------|
| Aggregation stats (counts, averages) | User-specific data (their bookings, profile) |
| Public listing lists | Passwords, tokens, secrets |
| Expensive `groupBy` queries | Real-time data (availability, live prices) |
| Rarely changing config data | Data that changes on every request |

### Redis — for production

The in-memory cache has one major limitation: it resets when the server restarts, and it doesn't work across multiple server instances. If you have 3 server instances, each has its own separate cache — they don't share data.

**Redis** is a dedicated in-memory data store that solves both problems. It runs as a separate service, persists across restarts, and all server instances share the same cache.

```bash
npm install redis
```

```typescript
import { createClient } from "redis";

const redis = createClient({ url: process.env["REDIS_URL"] });
await redis.connect();

// Set with TTL
await redis.setEx("listing:stats", 300, JSON.stringify(stats));

// Get
const cached = await redis.get("listing:stats");
if (cached) return res.json(JSON.parse(cached));

// Delete
await redis.del("listing:stats");
```

For this course, the in-memory cache is sufficient. In production with multiple instances, switch to Redis.

---

## Rate Limiting

### The Problem

Without rate limiting, a single IP address can send unlimited requests to your API. This causes two types of problems:

**Intentional abuse — DDoS attacks:**
An attacker sends 10,000 requests per second to your server. Your Node.js process maxes out its CPU. Your PostgreSQL connection pool fills up. Your server stops responding to legitimate users.

**Accidental abuse — buggy clients:**
A mobile app has a bug that puts an API call in an infinite loop. One user's phone sends 500 requests per second without them knowing. Same result.

**Rate limiting** restricts how many requests a single client (identified by IP address) can make in a time window. Once they hit the limit, they get `429 Too Many Requests` until the window resets.

```
Window: 15 minutes, limit: 100 requests

Client sends request 1-100:   200 OK
Client sends request 101:     429 Too Many Requests
Client sends request 102-200: 429 Too Many Requests
... (until 15 minutes resets)
Client sends request 201:     200 OK  (window reset)
```

### Setup

```bash
npm install express-rate-limit
```

**src/middlewares/rateLimiter.ts:**
```typescript
import rateLimit from "express-rate-limit";

// General limiter — applies to all routes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minute window
  max: 100,                   // 100 requests per window per IP
  standardHeaders: true,      // include rate limit info in response headers
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes",
  },
});

// Strict limiter — for sensitive endpoints like login and register
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // only 10 attempts per 15 minutes
  message: {
    error: "Too many attempts, please try again after 15 minutes",
  },
});
```

**Apply in src/index.ts:**
```typescript
import { generalLimiter, authLimiter } from "./middlewares/rateLimiter.js";

// Apply general limiter to all routes
app.use(generalLimiter);

// Apply strict limiter specifically to auth endpoints
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/auth/forgot-password", authLimiter);
```

### Why stricter limits on auth routes?

Login and register endpoints are the most abused. Without strict limits:
- **Brute force attacks** — attacker tries thousands of password combinations on a known email
- **Credential stuffing** — attacker tries username/password pairs leaked from other sites
- **Account enumeration** — attacker probes register to find which emails are registered

10 attempts per 15 minutes makes all of these attacks impractical.

### Response headers

When `standardHeaders: true` is set, every response includes:
```
RateLimit-Limit: 100
RateLimit-Remaining: 87
RateLimit-Reset: 2024-01-01T12:15:00.000Z
```

Well-built clients read these headers and slow down automatically before hitting the limit.

---

## Compression

### The Problem

Every byte your API sends travels over the network. A `GET /listings` response with 50 listings might be 80KB of JSON. On a slow mobile connection, that's noticeable. Multiply by thousands of requests per minute and you're burning bandwidth unnecessarily.

**Compression** shrinks the response body before sending it over the network. The client decompresses it automatically. JSON compresses extremely well because it has lots of repeated keys and whitespace.

```
Without compression:  80KB JSON  → network → client
With gzip:            12KB gzip  → network → client (85% smaller)
```

### How it works

1. Client sends request with header: `Accept-Encoding: gzip, deflate`
2. Server sees this header, compresses the response body with gzip
3. Server sends response with header: `Content-Encoding: gzip`
4. Client automatically decompresses — your code doesn't need to do anything

All modern browsers, Postman, and HTTP clients send `Accept-Encoding: gzip` by default. You get compression for free on every request.

### Setup

```bash
npm install compression
npm install -D @types/compression
```

```typescript
import compression from "compression";

// Add before all routes — order matters
app.use(compression());
```

That's it. One line. Every response is now compressed automatically.

### Compression threshold

Compressing tiny responses (like `{ "message": "ok" }`) wastes CPU for no benefit. The default threshold is 1KB — responses smaller than that are not compressed.

```typescript
app.use(compression({ threshold: 1024 }));  // only compress responses > 1KB
```

### What compresses well vs what doesn't

| Content type | Compression benefit |
|-------------|--------------------|
| JSON responses | ✅ Excellent — 60-90% smaller |
| HTML, CSS, JS | ✅ Excellent |
| Plain text | ✅ Good |
| Already-compressed images (JPEG, PNG) | ❌ None — already compressed |
| Binary data | ❌ Minimal |

For an API that returns JSON, compression is always worth enabling.

---

## Connection Pooling

### The Problem

Every time your app talks to PostgreSQL, it needs a **connection** — a persistent TCP socket between your Node.js process and the database server. Opening a connection involves:
- TCP handshake
- SSL negotiation
- PostgreSQL authentication
- Session setup

This takes 20-50ms. If your app opens a new connection for every request and closes it after, you're adding 20-50ms of overhead to every single database operation.

```
Without pooling (new connection per request):
  Request → open connection (40ms) → query (5ms) → close connection → Response
  Total: 45ms, 40ms of which is wasted on connection setup

With pooling (reuse existing connections):
  Request → get connection from pool (0ms) → query (5ms) → return to pool → Response
  Total: 5ms
```

### How connection pooling works

A connection pool keeps a set of connections open and ready. When a request comes in, it borrows a connection from the pool, uses it, and returns it when done. The connection stays open for the next request.

```
Pool with max=10:

  [conn1] [conn2] [conn3] [conn4] [conn5] [conn6] [conn7] [conn8] [conn9] [conn10]
     ↓        ↓
  Request A  Request B   (8 connections idle, ready for next requests)
```

### Prisma's built-in pooling

Prisma has connection pooling built in. By default it creates a pool sized to `num_physical_cpus * 2 + 1`. For most development machines that's 5-9 connections.

You can configure it via the connection string:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/airbnb_db?connection_limit=10"
```

### Explicit pooling with pg.Pool

For more control, configure the pool explicitly using `pg.Pool` and pass it to Prisma:

**src/config/prisma.ts:**
```typescript
import { PrismaClient } from "../../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"] as string,
  max: 10,                    // maximum open connections
  idleTimeoutMillis: 30000,   // close a connection if idle for 30s
  connectionTimeoutMillis: 2000, // fail if can't get a connection within 2s
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

### Pool size guidelines

Don't set the pool too large. PostgreSQL has a default maximum of 100 connections. If you have 5 server instances each with `max: 30`, that's 150 connections — over the limit, and new connections will be rejected.

| Environment | Recommended `max` |
|-------------|-------------------|
| Development | 5 |
| Single server production | 10-20 |
| Multiple server instances | `floor(100 / num_instances) - 5` |

### What happens when the pool is full

If all connections are in use and a new request comes in, it waits up to `connectionTimeoutMillis` for a connection to become available. If none frees up in time, the request fails with a connection timeout error.

This is why `connectionTimeoutMillis: 2000` is important — it fails fast with a clear error instead of hanging forever.

---

## Summary

| Technique | Problem it solves | When to use |
|-----------|------------------|-------------|
| Pagination | Returning too much data at once | Any endpoint that returns a list |
| Indexing | Slow database queries | Columns you filter/sort by often |
| Query optimization | Unnecessary data fetching, N+1 | Always — write efficient queries from the start |
| Caching | Repeated expensive queries | Data that doesn't change often |
| Rate limiting | Abuse, DDoS, runaway clients | Every public API |
| Compression | Large response payloads | Every API — easy win |
| Connection pooling | Slow connection setup overhead | Every production app |

### Quick wins (add these to every project)

```typescript
import compression from "compression";
import rateLimit from "express-rate-limit";

app.use(compression());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

Two lines. Instant improvement on every response.

---

**Resources:**
- [Prisma Pagination Docs](https://www.prisma.io/docs/orm/prisma-client/queries/pagination)
- [express-rate-limit](https://www.npmjs.com/package/express-rate-limit)
- [compression middleware](https://www.npmjs.com/package/compression)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Redis Docs](https://redis.io/docs/)
