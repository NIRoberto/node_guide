# Lesson 6 Assignment: Performance Optimization

## Overview

gitExtend the Airbnb API with new features — Search & Filtering, Bookings, Reviews, and Stats — while applying every performance technique from lesson 6. This assignment is about building real endpoints the right way from the start: paginated, indexed, cached, rate limited, and optimized.

---

## What You're Building

### New Endpoints

#### Search & Filtering
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/listings/search` | Search listings by location, type, price range, guests |

#### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bookings` | Get all bookings (paginated) |
| GET | `/bookings/:id` | Get a single booking |
| GET | `/users/:id/bookings` | Get all bookings for a user |
| POST | `/bookings` | Create a new booking |
| DELETE | `/bookings/:id` | Cancel a booking |

#### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/listings/:id/reviews` | Get all reviews for a listing (paginated) |
| POST | `/listings/:id/reviews` | Add a review to a listing |
| DELETE | `/reviews/:id` | Delete a review |

#### Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/listings/stats` | Total listings, avg price, count by location and type |
| GET | `/users/stats` | Total users, count by role (host/guest) |

---

## Project Setup

Install the required packages:

```bash
npm install compression express-rate-limit
npm install -D @types/compression
```

Your folder structure after completing the assignment:

```
airbnb-api/
├── src/
│   ├── config/
│   │   ├── prisma.ts                  # connection pooling
│   │   └── cache.ts                   # in-memory cache helper
│   ├── controllers/
│   │   ├── users.controller.ts
│   │   ├── listings.controller.ts
│   │   ├── bookings.controller.ts
│   │   ├── reviews.controller.ts
│   │   └── stats.controller.ts
│   ├── middlewares/
│   │   └── rateLimiter.ts
│   ├── routes/
│   │   ├── users.routes.ts
│   │   ├── listings.routes.ts
│   │   ├── bookings.routes.ts
│   │   └── reviews.routes.ts
│   └── index.ts
├── prisma/
│   └── schema.prisma
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## Prisma Schema

Update your `schema.prisma` to include all models with proper indexes:

```prisma
model User {
  id        Int       @id @default(autoincrement())
  name      String
  email     String    @unique
  username  String    @unique
  phone     String
  role      String    @default("guest")
  avatar    String?
  bio       String?
  listings  Listing[]
  bookings  Booking[]
  reviews   Review[]
  createdAt DateTime  @default(now())

  @@index([name])
  @@index([role])
}

model Listing {
  id             Int       @id @default(autoincrement())
  title          String
  description    String
  location       String
  pricePerNight  Float
  guests         Int
  type           String
  amenities      String[]
  rating         Float?
  userId         Int
  user           User      @relation(fields: [userId], references: [id])
  bookings       Booking[]
  reviews        Review[]
  createdAt      DateTime  @default(now())

  @@index([userId])
  @@index([location])
  @@index([type])
  @@index([pricePerNight])
}

model Booking {
  id        Int      @id @default(autoincrement())
  userId    Int
  listingId Int
  checkIn   DateTime
  checkOut  DateTime
  guests    Int
  total     Float
  status    String   @default("confirmed")
  user      User     @relation(fields: [userId], references: [id])
  listing   Listing  @relation(fields: [listingId], references: [id])
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([listingId])
  @@index([status])
}

model Review {
  id        Int      @id @default(autoincrement())
  rating    Int
  comment   String
  userId    Int
  listingId Int
  user      User     @relation(fields: [userId], references: [id])
  listing   Listing  @relation(fields: [listingId], references: [id])
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([listingId])
}
```

After updating the schema run:
```bash
npx prisma migrate dev --name add_bookings_reviews_indexes
npx prisma generate
```

---

## Requirements

### 1. Search & Filtering — `GET /listings/search`

- Accept query params: `location`, `type`, `minPrice`, `maxPrice`, `guests`
- All params are optional — only filter by the ones provided
- Must be paginated (`page`, `limit`)
- Use Prisma `where` with conditional filters — only add a filter if the param exists
- Results must include the host's `name` and `email` using `include`
- Index on `location`, `type`, and `pricePerNight` must be in the schema

**Example request:**
```
GET /listings/search?location=NYC&type=apartment&minPrice=50&maxPrice=200&guests=2&page=1&limit=10
```

**Expected response:**
```json
{
  "data": [...],
  "meta": { "total": 12, "page": 1, "limit": 10, "totalPages": 2 }
}
```

### 2. Bookings

#### `POST /bookings`
- Required fields: `userId`, `listingId`, `checkIn`, `checkOut`, `guests`
- Return `400` if any required field is missing
- Calculate `total` automatically: `pricePerNight × number of nights`
- Return `404` if the user or listing doesn't exist
- Return `201` with the created booking

#### `GET /bookings` (paginated)
- Return all bookings with `page` and `limit` support
- Include the user's `name` and the listing's `title` and `location`
- Use `Promise.all` to fetch bookings and count in parallel

#### `GET /bookings/:id`
- Return `404` if not found
- Include full user and listing details

#### `GET /users/:id/bookings`
- Return all bookings for a specific user
- Must be paginated
- Return `404` if the user doesn't exist

#### `DELETE /bookings/:id`
- Return `404` if not found
- Return `200` with a success message

### 3. Reviews

#### `POST /listings/:id/reviews`
- Required fields: `userId`, `rating`, `comment`
- `rating` must be between 1 and 5 — return `400` if not
- Return `404` if the listing doesn't exist
- Return `201` with the created review

#### `GET /listings/:id/reviews` (paginated)
- Return all reviews for a listing with `page` and `limit` support
- Include the reviewer's `name` and `avatar`
- Use `Promise.all` to fetch reviews and count in parallel
- Cache the response for **30 seconds** — clear cache when a new review is posted

#### `DELETE /reviews/:id`
- Return `404` if not found
- Return `200` with a success message

### 4. Stats

#### `GET /listings/stats`
- Return the following — all in a **single** `Promise.all` call, no sequential queries:
  - `totalListings` — total count of all listings
  - `averagePrice` — average `pricePerNight` across all listings
  - `byLocation` — count of listings grouped by location
  - `byType` — count of listings grouped by type
- Cache the response for **5 minutes** — clear cache when a listing is created, updated, or deleted

**Expected response:**
```json
{
  "totalListings": 120,
  "averagePrice": 145.50,
  "byLocation": [
    { "location": "New York", "_count": { "location": 30 } }
  ],
  "byType": [
    { "type": "apartment", "_count": { "type": 45 } }
  ]
}
```

#### `GET /users/stats`
- Return `totalUsers` and `byRole` (count grouped by role)
- Cache for **5 minutes**

### 5. Pagination — all list endpoints

- Every `GET` endpoint that returns a list must support `page` and `limit`
- Default: `page=1`, `limit=10`
- Always return a `meta` object with `total`, `page`, `limit`, `totalPages`
- Always use `Promise.all` to fetch data and count simultaneously

### 6. Caching — `src/config/cache.ts`

- Create `getCache(key)` and `setCache(key, data, ttlSeconds)` helpers
- Cache `GET /listings` for **60 seconds**
- Cache `GET /listings/:id/reviews` for **30 seconds**
- Cache `GET /listings/stats` and `GET /users/stats` for **5 minutes**
- Invalidate relevant cache keys on any create, update, or delete operation

### 7. Rate Limiting — `src/middlewares/rateLimiter.ts`

- General limiter: **100 requests per 15 minutes** — apply to all routes
- Strict limiter: **20 requests per 15 minutes** — apply to all `POST` routes
- Return a clear error message on `429`

### 8. Compression — `index.ts`

- Apply `compression` middleware before all routes

### 9. Connection Pooling — `src/config/prisma.ts`

- Use `pg.Pool` with `max: 10`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 2000`
- Pass the pool to `PrismaPg`

---

## Testing

Test all endpoints using [Postman](https://www.postman.com/) or any REST client.

### Search & Filtering
- `GET /listings/search?location=NYC` — should return only NYC listings
- `GET /listings/search?minPrice=50&maxPrice=150` — should filter by price range
- `GET /listings/search?type=apartment&guests=2` — should filter by type and guests
- `GET /listings/search?page=2&limit=5` — should paginate correctly

### Bookings
- `POST /bookings` with valid data — should return `201` with calculated `total`
- `POST /bookings` with missing fields — should return `400`
- `GET /bookings?page=1&limit=5` — should return paginated bookings with user and listing info
- `GET /users/:id/bookings` — should return only that user's bookings
- `DELETE /bookings/:id` — should cancel the booking

### Reviews
- `POST /listings/:id/reviews` with `rating: 6` — should return `400`
- `POST /listings/:id/reviews` with valid data — should return `201`
- `GET /listings/:id/reviews` — should return paginated reviews with reviewer info
- Call `GET /listings/:id/reviews` twice — second call should be from cache

### Stats
- `GET /listings/stats` — should return totals, average price, and grouped counts
- `GET /users/stats` — should return total users and count by role
- Call stats endpoint twice — second call should be from cache
- Create a new listing then call stats — should return fresh data

### Rate Limiting
- Send 101 requests to any endpoint — should get `429`
- Send 21 `POST` requests — should get `429` sooner

### Compression
- Check response headers — should see `Content-Encoding: gzip`

---

## What You Should Practice

- Building search and filtering with dynamic Prisma `where` conditions
- Modeling relationships between resources (User → Listing → Booking → Review)
- Calculating derived values (booking total from price × nights)
- Using `groupBy` in Prisma for aggregations and stats
- Caching expensive aggregation queries with proper invalidation
- Applying rate limiting globally and per route type
- Writing all list endpoints with pagination from the start
- Running multiple independent queries in parallel with `Promise.all`
