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

A slow API is a broken API. Users leave if a page takes more than 3 seconds to load. At scale, small inefficiencies become huge problems.

**Common performance killers in Node.js APIs:**
- Fetching thousands of rows when you only need 10
- Running the same expensive query over and over
- No indexes on columns you filter by
- Accepting unlimited requests from a single client
- Sending uncompressed responses over the network
- Opening a new database connection on every request

Each section in this lesson fixes one of these problems.

---

## Pagination

### The Problem

When you have 100,000 users in your database and someone calls `GET /users`, you don't want to return all 100,000 at once. That would:
- Slow down the database query
- Use huge amounts of memory
- Send a massive response over the network
- Crash the client trying to render it

**Pagination** splits results into pages — return 20 at a time, let the client ask for the next page.

### Offset Pagination

The most common approach. Uses `skip` (how many to skip) and `take` (how many to return).

```
GET /users?page=1&limit=20   → users 1-20
GET /users?page=2&limit=20   → users 21-40
GET /users?page=3&limit=20   → users 41-60
```

**Implementation with Prisma:**

```typescript
// GET /users?page=1&limit=20
export async function getAllUsers(req: Request, res: Response) {
  const page = parseInt(req.query["page"] as string) || 1;
  const limit = parseInt(req.query["limit"] as string) || 20;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({ skip, take: limit }),
    prisma.user.count(),
  ]);

  res.json({
    data: users,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
```

**Response:**
```json
{
  "data": [...],
  "meta": {
    "total": 500,
    "page": 1,
    "limit": 20,
    "totalPages": 25
  }
}
```

The `meta` object tells the client how many pages exist so it can render pagination controls.

### Cursor Pagination

Better for large datasets and real-time data. Instead of skipping rows, you use the last item's `id` as a cursor.

```
GET /users?cursor=50&limit=20   → users after id 50
```

```typescript
export async function getAllUsers(req: Request, res: Response) {
  const cursor = req.query["cursor"] ? parseInt(req.query["cursor"] as string) : undefined;
  const limit = parseInt(req.query["limit"] as string) || 20;

  const users = await prisma.user.findMany({
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { id: "asc" },
  });

  const nextCursor = users.length === limit ? users[users.length - 1]?.id : null;

  res.json({ data: users, nextCursor });
}
```

### Which to use?

| | Offset Pagination | Cursor Pagination |
|--|------------------|------------------|
| Simple to implement | ✅ | ❌ |
| Works with page numbers | ✅ | ❌ |
| Fast on large datasets | ❌ | ✅ |
| Handles real-time data | ❌ | ✅ |

Use offset for admin dashboards and simple lists. Use cursor for feeds, infinite scroll, and large tables.

---

## Indexing

### The Problem

Without indexes, every query scans the entire table row by row to find matches. With 1 million users, `WHERE email = 'alice@gmail.com'` checks all 1 million rows.

An **index** is a data structure that makes lookups fast — like the index at the back of a book. Instead of reading every page, you jump straight to the right one.

### How slow is it without an index?

```
Table with 1,000,000 rows
No index:    ~500ms  (full table scan)
With index:  ~1ms    (index lookup)
```

### Adding indexes in Prisma

```prisma
model User {
  id       Int    @id @default(autoincrement())
  name     String
  email    String @unique   // @unique automatically creates an index
  username String @unique

  @@index([name])           // index on name column
}

model Listing {
  id        Int    @id @default(autoincrement())
  title     String
  location  String
  userId    Int

  @@index([userId])         // index on userId — always index foreign keys
  @@index([location])       // index on location — if you filter by it often
}
```

After adding indexes, run:
```bash
npx prisma migrate dev --name add_indexes
```

### When to add an index

Add an index on a column when you:
- Filter by it in `WHERE` clauses (`where: { email }`)
- Sort by it in `ORDER BY` (`orderBy: { createdAt: 'desc' }`)
- Use it as a foreign key (`userId`, `listingId`)
- Search by it frequently

**Don't** add indexes on every column — they slow down writes (INSERT, UPDATE, DELETE) because the index has to be updated too.

### Rule of thumb

| Column type | Index? |
|-------------|--------|
| Primary key (`id`) | ✅ automatic |
| `@unique` fields | ✅ automatic |
| Foreign keys (`userId`) | ✅ always |
| Columns you filter by often | ✅ yes |
| Columns you rarely query | ❌ no |
| Boolean columns | ❌ rarely worth it |

---

## Query Optimization

### Select only what you need

Don't fetch columns you don't use. If you only need `id` and `name`, don't fetch `bio`, `avatar`, `createdAt`, etc.

```typescript
// ❌ fetches everything
const users = await prisma.user.findMany();

// ✅ fetches only what's needed
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true },
});
```

### Avoid N+1 queries

The N+1 problem is one of the most common performance bugs. It happens when you run one query to get a list, then run another query for each item in that list.

```typescript
// ❌ N+1 problem — 1 query for listings + 1 query per listing for the user
const listings = await prisma.listing.findMany();
for (const listing of listings) {
  const user = await prisma.user.findUnique({ where: { id: listing.userId } });
}
// If there are 100 listings → 101 database queries!

// ✅ Use include — 1 query with a JOIN
const listings = await prisma.listing.findMany({
  include: { user: true },
});
// 1 query total
```

### Use `include` vs `select` wisely

```typescript
// include — adds the related data on top of all fields
const listing = await prisma.listing.findUnique({
  where: { id: 1 },
  include: { user: true },  // adds full user object
});

// select — pick exactly what you want, including relations
const listing = await prisma.listing.findUnique({
  where: { id: 1 },
  select: {
    title: true,
    location: true,
    user: { select: { name: true, email: true } },  // only name and email from user
  },
});
```

### Run independent queries in parallel

If two queries don't depend on each other, run them at the same time with `Promise.all`.

```typescript
// ❌ sequential — waits for each one
const users = await prisma.user.findMany();
const listings = await prisma.listing.findMany();
// total time = time(users) + time(listings)

// ✅ parallel — runs at the same time
const [users, listings] = await Promise.all([
  prisma.user.findMany(),
  prisma.listing.findMany(),
]);
// total time = max(time(users), time(listings))
```

---

## Caching

### The Problem

Some data doesn't change often — a list of cities, popular listings, user profiles. Fetching them from the database on every request is wasteful.

**Caching** stores the result of an expensive operation so you can return it instantly next time without hitting the database.

```
Without cache:  Request → Database query (50ms) → Response
With cache:     Request → Cache hit (1ms) → Response
```

### In-memory cache (simple, no extra tools)

For simple cases, a plain JavaScript `Map` works fine. Data lives in server memory and resets on restart.

```typescript
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function setCache(key: string, data: unknown, ttlSeconds: number) {
  cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function getCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}
```

Using it in a controller:
```typescript
export async function getAllListings(req: Request, res: Response) {
  const cacheKey = "all_listings";
  const cached = getCache(cacheKey);

  if (cached) {
    return res.json(cached);  // return instantly from cache
  }

  const listings = await prisma.listing.findMany();
  setCache(cacheKey, listings, 60);  // cache for 60 seconds

  res.json(listings);
}
```

### Redis (production caching)

For production, use **Redis** — a fast in-memory database built for caching. It survives across multiple server instances and has built-in TTL support.

```bash
npm install redis
```

```typescript
import { createClient } from "redis";

const redis = createClient({ url: process.env["REDIS_URL"] });
await redis.connect();

export async function getAllListings(req: Request, res: Response) {
  const cached = await redis.get("all_listings");

  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const listings = await prisma.listing.findMany();
  await redis.setEx("all_listings", 60, JSON.stringify(listings)); // TTL = 60s

  res.json(listings);
}
```

### Cache invalidation

When data changes, you need to clear the cache so stale data isn't returned.

```typescript
export async function createListing(req: Request, res: Response) {
  const listing = await prisma.listing.create({ data: req.body });

  await redis.del("all_listings");  // clear cache when new listing is created

  res.status(201).json(listing);
}
```

### What to cache

| Good to cache | Don't cache |
|---------------|-------------|
| Lists that change rarely | User-specific data |
| Expensive aggregations | Passwords, tokens |
| Public data | Real-time data |
| Config/lookup data | Frequently changing data |

---

## Rate Limiting

### The Problem

Without rate limiting, a single client can send thousands of requests per second to your API — intentionally (DDoS attack) or accidentally (buggy client). This can crash your server or database.

**Rate limiting** restricts how many requests a client can make in a time window.

```
Client sends 1000 requests/second
Rate limiter allows 100 requests/minute per IP
→ After 100 requests, client gets 429 Too Many Requests
```

### Setup with express-rate-limit

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // max 100 requests per window per IP
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,      // sends rate limit info in response headers
});

app.use(limiter);  // apply to all routes
```

### Different limits for different routes

```typescript
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

app.use("/api", generalLimiter);
app.use("/auth/login", strictLimiter);   // stricter limit on login
app.use("/auth/register", strictLimiter);
```

### Response headers

When rate limiting is active, the client receives headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1714000000
```

This lets clients know how many requests they have left and when the window resets.

---

## Compression

### The Problem

Every response your API sends travels over the network. Large JSON responses waste bandwidth and slow down the client.

**Compression** shrinks the response body before sending it. The client decompresses it automatically. A 100KB response can become 10KB — a 90% reduction.

```
Without compression:  100KB JSON → network → client
With compression:     10KB gzip  → network → client (10x faster)
```

### Setup with compression middleware

```bash
npm install compression
npm install -D @types/compression
```

```typescript
import compression from "compression";

app.use(compression());  // compress all responses
```

That's it. Express will automatically compress responses using gzip when the client supports it (all modern browsers and HTTP clients do).

### How it works

1. Client sends request with header: `Accept-Encoding: gzip`
2. Server compresses response and sends: `Content-Encoding: gzip`
3. Client decompresses automatically

### When compression helps most

Compression is most effective on large text-based responses — JSON, HTML, CSS. It has little effect on already-compressed formats like images or videos.

```typescript
// Only compress responses larger than 1KB (default is 1KB)
app.use(compression({ threshold: 1024 }));
```

---

## Connection Pooling

### The Problem

Opening a database connection is expensive — it involves a TCP handshake, authentication, and setup. If your app opens a new connection for every request and closes it after, you're wasting time on every single request.

```
Without pooling:
Request → open connection (50ms) → query (5ms) → close connection → Response

With pooling:
Request → reuse existing connection (0ms) → query (5ms) → Response
```

**Connection pooling** keeps a set of connections open and reuses them across requests.

### How Prisma handles pooling

Prisma has built-in connection pooling. By default it maintains a pool of connections based on your CPU count.

You can configure the pool size in your connection string:

```env
DATABASE_URL="postgresql://postgres:1234@localhost:5432/my_app?connection_limit=10"
```

Or via the adapter:

```typescript
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"] as string,
  max: 10,              // maximum connections in the pool
  idleTimeoutMillis: 30000,   // close idle connections after 30s
  connectionTimeoutMillis: 2000,  // fail if can't connect within 2s
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

### Pool size guidelines

| Environment | Recommended pool size |
|-------------|----------------------|
| Development | 2-5 |
| Small production | 5-10 |
| Medium production | 10-20 |
| Large production | 20-50 |

Don't set it too high — PostgreSQL has a maximum connection limit (default 100). If you have 5 server instances each with a pool of 30, that's 150 connections — over the limit.

### Prisma Accelerate (production pooling)

For production apps with multiple server instances, use **Prisma Accelerate** — a connection pooler that sits between your app and database, managing thousands of connections efficiently.

```env
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=your_key"
```

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
