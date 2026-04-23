# Lesson 2 Assignment: Airbnb API — Databases & Prisma

## Overview

Migrate the Airbnb API from lesson 1 to use a real **PostgreSQL database** with **Prisma**. Same project, same endpoints — replace in-memory arrays with real database queries. Also add a new **Bookings** resource.

---

## Endpoints

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | Get all users |
| GET | `/users/:id` | Get a user with their listings |
| POST | `/users` | Create a user |
| PUT | `/users/:id` | Update a user |
| DELETE | `/users/:id` | Delete a user |

### Listings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/listings` | Get all listings |
| GET | `/listings/:id` | Get a single listing |
| POST | `/listings` | Create a listing |
| PUT | `/listings/:id` | Update a listing |
| DELETE | `/listings/:id` | Delete a listing |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bookings` | Get all bookings |
| GET | `/bookings/:id` | Get a single booking |
| POST | `/bookings` | Create a booking |
| DELETE | `/bookings/:id` | Cancel a booking |

---

## Part 1 — Install & Configure Prisma

1. Install in your existing `airbnb-api` project:
   - Production: `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`
   - Dev: `prisma`, `@types/pg`

2. Run `npx prisma init`

3. Create a PostgreSQL database called `airbnb_db`

4. Set `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/airbnb_db"
   ```

5. Create `.env.example` with variable names only:
   ```
   DATABASE_URL=
   PORT=
   ```

6. Confirm `.env` is in `.gitignore` — it contains your database password, never commit it

7. Create `prisma.config.ts` at the root — import `dotenv/config` and export the Prisma config pointing to your schema and database URL

> `import "dotenv/config"` must be the very first import in `index.ts` — if anything reads `process.env` before dotenv loads, `DATABASE_URL` will be `undefined`

---

## Part 2 — Prisma Schema

Define the following models in `prisma/schema.prisma`:

**User:**
- `id` — Int, `@id @default(autoincrement())`
- `name` — String
- `email` — String, `@unique`
- `username` — String, `@unique`
- `phone` — String
- `role` — `Role` enum, default `GUEST`
- `avatar` — String? (optional)
- `bio` — String? (optional)
- `createdAt` — DateTime, `@default(now())`
- `listings` — relation to Listing (one host has many listings)
- `bookings` — relation to Booking (one guest has many bookings)

**Listing:**
- `id` — Int, `@id @default(autoincrement())`
- `title`, `description`, `location` — String
- `pricePerNight` — Float
- `guests` — Int
- `type` — `ListingType` enum
- `amenities` — String[]
- `rating` — Float? (optional)
- `createdAt` — DateTime, `@default(now())`
- `updatedAt` — DateTime, `@updatedAt`
- `host` — relation to User
- `hostId` — Int, foreign key
- `bookings` — relation to Booking

**Booking:**
- `id` — Int, `@id @default(autoincrement())`
- `checkIn`, `checkOut` — DateTime
- `totalPrice` — Float
- `status` — `BookingStatus` enum, default `PENDING`
- `createdAt` — DateTime, `@default(now())`
- `guest` — relation to User
- `guestId` — Int, foreign key
- `listing` — relation to Listing
- `listingId` — Int, foreign key

**Enums:**
- `Role`: `HOST`, `GUEST`
- `ListingType`: `APARTMENT`, `HOUSE`, `VILLA`, `CABIN`
- `BookingStatus`: `PENDING`, `CONFIRMED`, `CANCELLED`

After defining the schema:
1. Run `npx prisma migrate dev --name init`
2. Open `npx prisma studio` — verify all three tables exist with correct columns
3. Insert 3 users (at least 1 host, 1 guest), 3 listings, and 2 bookings manually in Prisma Studio

> Always give migrations descriptive names — migration files are permanent history of your database changes

### Research Task
Look up `onDelete: Cascade` in Prisma. What happens to a host's listings when the host is deleted? What should happen to bookings? Think through the business logic before deciding.

---

## Part 3 — Prisma Client Setup

1. Update `src/config/prisma.ts`:
   - Create `PrismaClient` with `PrismaPg` adapter using `process.env["DATABASE_URL"]`
   - Export `connectDB()` — calls `prisma.$connect()` and logs success
   - Export `prisma` as default

2. Update `src/index.ts`:
   - `import "dotenv/config"` as the absolute first line
   - Wrap startup in an async `main()` function
   - Call `connectDB()` before `app.listen()` — server only starts after database connects
   - Read `PORT` from `process.env["PORT"]` with fallback to `3000`

---

## Part 4 — Migrate Controllers to Prisma

Replace all in-memory array operations with Prisma queries.

**users.controller.ts:**
- `getAllUsers` — `prisma.user.findMany()`, use `_count` to include number of listings per user
- `getUserById` — `prisma.user.findUnique()`, include listings and bookings, return 404 if not found
- `createUser` — validate required fields, check duplicate email (return 409), `prisma.user.create()`
- `updateUser` — find first (404 if not found), then `prisma.user.update()`
- `deleteUser` — find first (404 if not found), then `prisma.user.delete()`

**listings.controller.ts:**
- `getAllListings` — `prisma.listing.findMany()`, include only host's `name` and `avatar`
- `getListingById` — `prisma.listing.findUnique()`, include full host details and bookings, 404 if not found
- `createListing` — validate required fields, verify `hostId` exists (404 if not), create listing
- `updateListing` — find first (404), then update
- `deleteListing` — find first (404), then delete

**bookings.controller.ts (new):**
- `getAllBookings` — include guest name and listing title
- `getBookingById` — include full guest and listing details, 404 if not found
- `createBooking` — validate `guestId`, `listingId`, `checkIn`, `checkOut` are present. Verify guest and listing exist. Calculate `totalPrice` server-side: `(checkOut - checkIn in days) × listing.pricePerNight` — never trust the client to send the price. Create with status `PENDING`
- `deleteBooking` — find first (404), then delete

> Use `include` to fetch related data in one query. Use `select` when you only need specific fields — returning the full user object when you only need `name` wastes bandwidth

### Research Task
Look up Prisma's `select` vs `include` and `_count`. Try using `select` on `getAllListings` to return only `id`, `title`, `location`, `pricePerNight`, and the host's `name`.

---

## Part 5 — Advanced Queries

1. **Filter by location** — `GET /listings?location=New York` — use `contains` with `mode: "insensitive"`

2. **Filter by type** — `GET /listings?type=VILLA` — filter by `ListingType` enum

3. **Filter by max price** — `GET /listings?maxPrice=200` — use Prisma's `lte`

4. **Pagination** — `GET /listings?page=1&limit=10` — use `skip` and `take`. Calculate `skip` as `(page - 1) * limit`. Default: page 1, limit 10

5. **Listings by host** — `GET /users/:id/listings` — return all listings where `hostId` matches

6. **Bookings by guest** — `GET /users/:id/bookings` — return all bookings where `guestId` matches, include listing details

7. **Update booking status** — `PATCH /bookings/:id/status` — accept `status` in body, validate it is a valid `BookingStatus`, update

> `req.query.page` is always a string — always parse with `parseInt` and validate it is a positive integer before using

### Research Task
Look up Prisma's `orderBy`. Add sorting to `GET /listings` — allow `?sortBy=pricePerNight&order=asc`. Research `findFirst` vs `findUnique` — when would you use each?

---

## Part 6 — Error Handling

1. Wrap all controller functions in try/catch

2. Handle Prisma error codes — import `Prisma` from your generated client and check `error instanceof Prisma.PrismaClientKnownRequestError`:
   - `P2002` — unique constraint (duplicate email/username) → 409
   - `P2025` — record not found → 404
   - `P2003` — foreign key constraint (invalid `hostId`) → 400

3. For all other errors → return 500 with `"Something went wrong"` — never expose raw Prisma error messages to the client, they reveal your database structure

4. Log all errors server-side with the error code, message, and which operation failed

### Research Task
Research **global error handling middleware** in Express — a middleware with 4 parameters `(err, req, res, next)`. Try centralizing all error handling in one place instead of try/catch in every controller.

---

## Project Structure

```
airbnb-api/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   └── prisma.ts
│   ├── controllers/
│   │   ├── users.controller.ts
│   │   ├── listings.controller.ts
│   │   └── bookings.controller.ts    ← new
│   ├── routes/
│   │   ├── users.routes.ts
│   │   ├── listings.routes.ts
│   │   └── bookings.routes.ts        ← new
│   └── index.ts
├── .env
├── .env.example
├── .gitignore
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

---

## Checklist

- [ ] PostgreSQL database created and connected
- [ ] All three models with correct relationships and enums
- [ ] Migration ran — all tables exist in Prisma Studio
- [ ] All endpoints work with correct status codes
- [ ] Filtering by location, type, and price works
- [ ] Pagination works on GET /listings
- [ ] `totalPrice` calculated server-side
- [ ] Prisma error codes P2002, P2025, P2003 handled correctly
- [ ] `.env` not committed to Git
- [ ] `.env.example` exists

---

## Further Research

- **Database indexing** — add `@@index([location])` and `@@index([pricePerNight])` to Listing. Understand why indexes speed up queries on frequently filtered fields
- **Database transactions** — look up `prisma.$transaction()`. When would you need it in the booking flow?
- **N+1 query problem** — a common ORM performance issue. Understand what it is and how Prisma's `include` prevents it
