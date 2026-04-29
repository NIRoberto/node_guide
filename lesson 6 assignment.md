# Lesson 6 Assignment: Performance Optimization

## Overview

Extend the Airbnb API with Bookings, Reviews, and Stats while applying every performance technique from lesson 6. Every endpoint you build must be production-quality from the start — paginated, indexed, cached, rate limited, and optimized. You will also fix performance problems in the existing listings and users endpoints.

---

## Setup

Install required packages:

```bash
npm install compression express-rate-limit
npm install -D @types/compression
```

---

## Part 1 — Fix Existing Endpoints

Before building new features, fix the performance problems in the code you already have.

### 1.1 — Add missing indexes to the schema

The current schema has no indexes on columns that are frequently queried. Add the following and run a migration:

```prisma
model User {
  // existing fields...
  @@index([role])
}

model Listing {
  // existing fields...
  @@index([hostId])
  @@index([location])
  @@index([type])
  @@index([pricePerNight])
  @@index([createdAt])
}
```

```bash
npx prisma migrate dev --name add_performance_indexes
```

### 1.2 — Fix `GET /api/v1/listings`

The current implementation has these problems:
- No pagination — returns all listings at once
- No limit cap — client can request unlimited rows
- `include: { host: true }` leaks the host's password hash

Fix all three:
- Add `page` and `limit` query params (default: `page=1`, `limit=10`)
- Cap `limit` at a maximum of 100
- Use `select` instead of `include` to return only `id`, `name`, and `email` from the host
- Use `Promise.all` for data + count
- Return a `meta` object
- Cache the response for **60 seconds** with a key that includes page and limit: `listing:all:page=${page}:limit=${limit}`
- Clear all `listing:all:` prefixed cache keys when a listing is created, updated, or deleted

### 1.3 — Fix `GET /api/v1/users`

Same problems as listings. Fix:
- Add pagination with `page`, `limit`, cap at 100
- Use `select` to exclude `password`, `resetToken`, `resetTokenExpiry` from the response
- Use `Promise.all` for data + count
- Return a `meta` object

### 1.4 — Fix `GET /api/v1/listings/:id`

The current implementation uses `include: { host: true }` which returns the host's full object including password. Fix it to use `select` and return only safe host fields.

---

## Part 2 — Bookings

### Schema

Add the Booking model to `schema.prisma`:

```prisma
model Booking {
  id        String   @id @default(uuid())
  checkIn   DateTime
  checkOut  DateTime
  guests    Int
  total     Float
  status    String   @default("confirmed")
  userId    String
  listingId String
  user      User     @relation(fields: [userId], references: [id])
  listing   Listing  @relation(fields: [listingId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([listingId])
  @@index([status])
  @@index([checkIn])
  @@index([checkOut])
}
```

Run the migration:
```bash
npx prisma migrate dev --name add_bookings
```

### Endpoints

#### `POST /api/v1/bookings` — Create a booking (GUEST only)

- Required fields: `listingId`, `checkIn`, `checkOut`, `guests`
- `checkIn` and `checkOut` must be valid dates — return `400` if not
- `checkIn` must be before `checkOut` — return `400` if not
- `checkIn` must not be in the past — return `400` if it is
- Return `404` if the listing doesn't exist
- Check for **booking conflicts** — if the listing already has a confirmed booking that overlaps with the requested dates, return `409` with `"Listing is not available for the selected dates"`
- Calculate `total` automatically: `pricePerNight × number of nights`
  - Number of nights = difference between `checkOut` and `checkIn` in days
- The `userId` comes from `req.userId` (authenticated user) — do not accept it from the request body
- Return `201` with the created booking including listing title and user name

#### `GET /api/v1/bookings` — Get all bookings (paginated, authenticated)

- Support `page` and `limit` (default: `page=1`, `limit=10`, max: `50`)
- Support optional `status` filter: `?status=confirmed`
- Include user's `name` and listing's `title`, `location`, `pricePerNight`
- Use `Promise.all` for data + count
- Return `meta` object

#### `GET /api/v1/bookings/:id` — Get a single booking

- Return `404` if not found
- Include full user details (no password) and full listing details
- Only the booking owner or an ADMIN can view it — return `403` otherwise

#### `GET /api/v1/users/:id/bookings` — Get all bookings for a user (paginated)

- Return `404` if the user doesn't exist
- Support `page` and `limit`
- Support optional `status` filter
- Return `meta` object

#### `PATCH /api/v1/bookings/:id/status` — Update booking status (authenticated)

- Only allowed status values: `confirmed`, `cancelled`, `completed` — return `400` for anything else
- Only the booking owner can cancel their own booking
- Only an ADMIN can mark a booking as `completed`
- Return `403` if the user doesn't have permission
- Return `404` if not found

#### `DELETE /api/v1/bookings/:id` — Cancel a booking (owner only)

- Return `404` if not found
- Only the booking owner or ADMIN can delete — return `403` otherwise
- Return `200` with a success message

---

## Part 3 — Reviews

### Schema

Add the Review model to `schema.prisma`:

```prisma
model Review {
  id        String   @id @default(uuid())
  rating    Int
  comment   String
  userId    String
  listingId String
  user      User     @relation(fields: [userId], references: [id])
  listing   Listing  @relation(fields: [listingId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([listingId])
  @@index([rating])
}
```

```bash
npx prisma migrate dev --name add_reviews
```

### Endpoints

#### `POST /api/v1/listings/:id/reviews` — Add a review (GUEST only)

- Return `404` if the listing doesn't exist
- `rating` must be an integer between 1 and 5 — return `400` if not
- `comment` is required and must be at least 10 characters — return `400` if not
- A user can only review a listing **once** — check for an existing review and return `409` if one exists
- A user can only review a listing they have **actually booked** — check for a completed or confirmed booking and return `403` with `"You can only review listings you have booked"` if none exists
- After creating the review, **update the listing's `rating` field** to the new average of all its reviews
- Clear the cache for this listing's reviews: `review:listing:${listingId}:*`
- Return `201` with the created review

#### `GET /api/v1/listings/:id/reviews` — Get reviews for a listing (paginated)

- Return `404` if the listing doesn't exist
- Support `page` and `limit` (default: `page=1`, `limit=10`)
- Support `sortBy`: `rating` or `createdAt` (default: `createdAt`)
- Support `order`: `asc` or `desc` (default: `desc`)
- Include reviewer's `name` only (no sensitive fields)
- Use `Promise.all` for data + count
- Cache the response for **2 minutes** with key: `review:listing:${id}:page=${page}:limit=${limit}:sort=${sortBy}:order=${order}`
- Return `meta` object

#### `DELETE /api/v1/reviews/:id` — Delete a review (owner or ADMIN)

- Return `404` if not found
- Return `403` if not the owner or ADMIN
- After deleting, **recalculate and update the listing's `rating`** field
- Clear the review cache for that listing
- Return `200` with a success message

---

## Part 4 — Stats

All stats endpoints must use a single `Promise.all` call — no sequential queries.

#### `GET /api/v1/listings/stats` — Listing statistics

Cache for **5 minutes** with key `listing:stats`. Clear when any listing is created, updated, or deleted.

Return:
```json
{
  "totalListings": 120,
  "averagePrice": 145.50,
  "minPrice": 25.00,
  "maxPrice": 850.00,
  "byLocation": [
    { "location": "Kigali", "_count": { "location": 45 } }
  ],
  "byType": [
    { "type": "APARTMENT", "_count": { "type": 60 } }
  ],
  "topRated": [
    { "id": "...", "title": "...", "rating": 4.9, "location": "..." }
  ]
}
```

- `topRated` — top 5 listings by rating, only include listings that have a rating
- `minPrice` and `maxPrice` — use Prisma's `aggregate` with `_min` and `_max`
- All four pieces of data must be fetched in a single `Promise.all`

#### `GET /api/v1/users/stats` — User statistics

Cache for **5 minutes** with key `user:stats`. Clear when any user is created or deleted.

Return:
```json
{
  "totalUsers": 340,
  "byRole": [
    { "role": "GUEST", "_count": { "role": 280 } },
    { "role": "HOST", "_count": { "role": 58 } }
  ],
  "newThisMonth": 24
}
```

- `newThisMonth` — count of users created in the current calendar month

#### `GET /api/v1/bookings/stats` — Booking statistics (ADMIN only)

Cache for **5 minutes** with key `booking:stats`.

Return:
```json
{
  "totalBookings": 890,
  "totalRevenue": 125400.00,
  "byStatus": [
    { "status": "confirmed", "_count": { "status": 650 } }
  ],
  "averageNights": 3.4
}
```

- `totalRevenue` — sum of `total` across all bookings using `aggregate` with `_sum`
- `averageNights` — calculate this in JavaScript from the bookings data, not via a DB query

---

## Part 5 — Performance Middleware

### 5.1 — Cache helper (`src/config/cache.ts`)

Implement these four functions:
- `getCache<T>(key: string): T | null`
- `setCache(key: string, data: unknown, ttlSeconds: number): void`
- `deleteCache(key: string): void`
- `deleteCacheByPrefix(prefix: string): void` — deletes all keys starting with the given prefix

### 5.2 — Rate limiter (`src/middlewares/rateLimiter.ts`)

Create three limiters:
- `generalLimiter` — 100 requests per 15 minutes, apply to all routes
- `authLimiter` — 10 requests per 15 minutes, apply to login, register, forgot-password
- `strictLimiter` — 30 requests per 15 minutes, apply to all POST/PUT/DELETE routes

### 5.3 — Compression (`src/index.ts`)

Apply `compression()` as the first middleware, before rate limiting and routes.

### 5.4 — Connection pooling (`src/config/prisma.ts`)

Configure `pg.Pool` with:
- `max: 10`
- `idleTimeoutMillis: 30000`
- `connectionTimeoutMillis: 2000`

---

## Testing

### Pagination
- `GET /api/v1/listings?page=2&limit=5` — should return listings 6-10 with correct `meta`
- `GET /api/v1/listings?limit=999` — should be capped at 100
- `GET /api/v1/listings` twice quickly — second response should come from cache (check response time)
- Create a listing — then `GET /api/v1/listings` — should return fresh data (cache cleared)

### Bookings
- `POST /api/v1/bookings` with `checkIn` in the past — should return `400`
- `POST /api/v1/bookings` with `checkIn` after `checkOut` — should return `400`
- Create two bookings for the same listing with overlapping dates — second should return `409`
- Verify `total` is calculated correctly: create a booking for 3 nights on a $100/night listing — `total` should be `300`
- `PATCH /api/v1/bookings/:id/status` with `status: "completed"` as a non-admin — should return `403`

### Reviews
- `POST /api/v1/listings/:id/reviews` without a booking — should return `403`
- `POST /api/v1/listings/:id/reviews` twice for the same listing — second should return `409`
- `POST /api/v1/listings/:id/reviews` with `rating: 6` — should return `400`
- `POST /api/v1/listings/:id/reviews` with `comment` shorter than 10 chars — should return `400`
- After posting a review, `GET /api/v1/listings/:id` — the listing's `rating` field should be updated
- `GET /api/v1/listings/:id/reviews?sortBy=rating&order=asc` — should return reviews sorted by rating ascending
- Call reviews endpoint twice — second call should be from cache

### Stats
- `GET /api/v1/listings/stats` — verify all fields are present and correct
- Create a new listing — call stats again — `totalListings` should be incremented and cache should be fresh
- `GET /api/v1/bookings/stats` without ADMIN token — should return `403`

### Rate Limiting
- Send 11 requests to `POST /api/v1/auth/login` — 11th should return `429`
- Check response headers — should include `RateLimit-Limit` and `RateLimit-Remaining`

### Compression
- Check response headers on any endpoint — should include `Content-Encoding: gzip`

---

## Final Checklist

- [ ] Indexes added for all foreign keys and frequently filtered columns
- [ ] `GET /api/v1/listings` is paginated, capped, uses `select` for host, returns `meta`
- [ ] `GET /api/v1/users` is paginated, excludes sensitive fields, returns `meta`
- [ ] `GET /api/v1/listings/:id` uses `select` for host fields
- [ ] Booking conflict check prevents double-booking
- [ ] Booking `total` is calculated from `pricePerNight × nights`
- [ ] Booking dates are validated (not in past, checkIn before checkOut)
- [ ] Review requires a booking before allowing submission
- [ ] Review prevents duplicate reviews per user per listing
- [ ] Review creation and deletion updates the listing's `rating` field
- [ ] All list endpoints return `meta` with `total`, `page`, `limit`, `totalPages`
- [ ] All list endpoints use `Promise.all` for data + count
- [ ] Stats endpoints use a single `Promise.all` for all queries
- [ ] Cache keys include all query params that affect the response
- [ ] Cache is cleared on create, update, and delete operations
- [ ] `deleteCacheByPrefix` is used to clear paginated caches
- [ ] Three rate limiters created and applied to correct routes
- [ ] Compression applied before all routes
- [ ] Connection pool configured with `max: 10`

---

## What You Should Practice

- Designing cache keys that are unique per distinct response
- Invalidating cache correctly without leaving stale data
- Validating date ranges and detecting conflicts in bookings
- Recalculating aggregate values (average rating) after mutations
- Using Prisma `aggregate` and `groupBy` for stats
- Applying different rate limits to different route types
- Using `select` to prevent sensitive field leakage
- Capping user-controlled pagination parameters
