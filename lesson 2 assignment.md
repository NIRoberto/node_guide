# Lesson 2 Assignment: Airbnb API — Databases & Prisma

## Overview

In lesson 1 you built the Airbnb API using in-memory arrays. It worked, but it had one critical problem — **every time the server restarts, all your data disappears**. Users, listings, and bookings are gone. That is not how real applications work.

In this assignment you will migrate the same Airbnb API to use a real **PostgreSQL database** with **Prisma**. You are not building a new project — you are upgrading the existing `airbnb-api` project. The endpoints stay the same. The difference is that data now lives in a real database and survives restarts, crashes, and deployments.

You will also add a new resource — **Bookings** — because an Airbnb-like app without bookings is just a listings directory.

---

## Why This Matters

Before you start, understand what you are actually solving:

**The in-memory problem:** When your server process stops, all JavaScript variables are cleared from RAM. Your users array, listings array — gone. A real app needs data to persist on disk, not in memory.

**Why PostgreSQL:** PostgreSQL stores data in files on disk. It survives restarts. It can handle millions of records. It enforces rules like "email must be unique" at the database level — not just in your code. It supports relationships between tables, which is exactly what you need for users, listings, and bookings.

**Why Prisma:** Writing raw SQL is error-prone and verbose. Prisma gives you a type-safe API to query your database using TypeScript. Your editor knows the shape of every query result. Typos in table names become TypeScript errors, not runtime crashes.

---

## What You're Migrating

Same endpoints from lesson 1, now backed by a real database:

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

### Bookings (New)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bookings` | Get all bookings |
| GET | `/bookings/:id` | Get a single booking |
| POST | `/bookings` | Create a booking |
| DELETE | `/bookings/:id` | Cancel a booking |

---

## Part 1 — Install & Configure Prisma

### Why this step exists

Your project currently has no database connection. Before you can query PostgreSQL, you need to install the tools that make it possible and tell them where your database lives.

`dotenv` is needed because your database URL contains a password — you never hardcode passwords in your code. You store them in a `.env` file and load them at runtime. `dotenv` does that loading.

`.env.example` exists so that when a teammate clones your project, they know exactly what environment variables to create. Without it, they would have no idea what variables are needed and the app would silently fail.

### Tasks

1. Install dependencies in your existing `airbnb-api` project:
   - Production: `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`
   - Dev: `prisma`, `@types/pg`

2. Run `npx prisma init` — this creates `prisma/schema.prisma` and a `.env` file with a `DATABASE_URL` placeholder

3. Create a PostgreSQL database called `airbnb_db`

4. Set `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/airbnb_db"
   ```

5. Create `.env.example` with variable names only — no values:
   ```
   DATABASE_URL=
   PORT=
   ```

6. Make sure `.env` is in `.gitignore` — it contains your database password

7. Create `prisma.config.ts` at the root:
   - Import `dotenv/config` at the top
   - Export the Prisma config pointing to your schema file and database URL

### Best Practices

- `import "dotenv/config"` must be the very first import in `index.ts` — before anything else reads `process.env`. If you import Prisma before dotenv loads, `DATABASE_URL` will be `undefined` and the connection will fail
- Never hardcode the database URL — if you push it to GitHub, anyone can access your database
- Always commit `.env.example` — it is the contract that tells others what variables the app needs

---

## Part 2 — Prisma Schema

### Why this step exists

The schema file is how you tell Prisma what your database looks like. Every model you define becomes a table. Every field becomes a column. Every relation becomes a foreign key.

**Why enums matter:** Without enums, a user's role could be any string — `"host"`, `"Host"`, `"HOST"`, `"hst"`. Enums enforce that only valid values can be stored. The database itself rejects anything else, not just your application code.

**Why relationships matter:** In a real Airbnb app, a listing belongs to a host (user), and a booking connects a guest (user) to a listing. These are not just references — they are enforced constraints. If you try to create a listing with a `hostId` that doesn't exist, the database will reject it. This is called **referential integrity** and it prevents orphaned data.

**Why `@updatedAt` matters:** Knowing when a record was last changed is essential for debugging, auditing, and syncing data with frontends. Prisma handles this automatically — you never need to set it manually.

### Tasks

Define the following models in `prisma/schema.prisma`:

**User model:**
- `id` — auto-incrementing integer, primary key
- `name` — required string
- `email` — required string, unique
- `username` — required string, unique
- `phone` — required string
- `role` — enum: `HOST` or `GUEST`, default `GUEST`
- `avatar` — optional string
- `bio` — optional string
- `createdAt` — DateTime, default now
- `listings` — relation: one user (host) has many listings
- `bookings` — relation: one user (guest) has many bookings

**Listing model:**
- `id` — auto-incrementing integer, primary key
- `title` — required string
- `description` — required string
- `location` — required string
- `pricePerNight` — Float
- `guests` — integer (max number of guests allowed)
- `type` — enum: `APARTMENT`, `HOUSE`, `VILLA`, `CABIN`
- `amenities` — String array (`String[]`)
- `rating` — optional Float
- `createdAt` — DateTime, default now
- `updatedAt` — DateTime, `@updatedAt`
- `host` — relation to User
- `hostId` — integer, foreign key
- `bookings` — relation: one listing has many bookings

**Booking model:**
- `id` — auto-incrementing integer, primary key
- `checkIn` — DateTime
- `checkOut` — DateTime
- `totalPrice` — Float
- `status` — enum: `PENDING`, `CONFIRMED`, `CANCELLED`, default `PENDING`
- `createdAt` — DateTime, default now
- `guest` — relation to User
- `guestId` — integer, foreign key
- `listing` — relation to Listing
- `listingId` — integer, foreign key

Define all enums: `Role`, `ListingType`, `BookingStatus`

After defining the schema:
1. Run `npx prisma migrate dev --name init`
2. Open `npx prisma studio` and verify all three tables were created with the correct columns
3. Manually insert 3 users (at least 1 host and 1 guest), 3 listings, and 2 bookings using Prisma Studio to confirm everything works before writing any code

### Best Practices

- Always give migrations descriptive names — `init`, `add_booking_model`, `add_rating_to_listing`. Migration files are permanent history. Vague names like `migration1` make it impossible to understand what changed
- Use enums for fields with a fixed set of values — it prevents invalid data at the database level, not just in your application
- Use `@updatedAt` on models that change over time — listings get updated, bookings change status. You want to know when

### Research Task

Look up how Prisma handles **array fields** (`String[]`). Understand that this is a PostgreSQL-specific feature — not all databases support it. Research what `onDelete: Cascade` does and when you should use it. For example: if a host deletes their account, what should happen to their listings? What should happen to existing bookings for those listings? Think through the business logic before deciding.

---

## Part 3 — Prisma Client Setup

### Why this step exists

The Prisma Client is the object you use to query your database. It needs to be created once and reused across your entire application — not created fresh on every request. Creating a new database connection on every request is extremely expensive and will crash your server under load.

The `connectDB()` function exists so your server can verify the database is reachable before accepting any traffic. If the database is down and your server starts anyway, every request will fail with a confusing error. Failing fast at startup is much cleaner.

### Tasks

1. Update `src/config/prisma.ts`:
   - Create `PrismaClient` with `PrismaPg` adapter using `process.env["DATABASE_URL"]`
   - Export a `connectDB()` async function that calls `prisma.$connect()` and logs success
   - Export `prisma` as the default export

2. Update `src/index.ts`:
   - Add `import "dotenv/config"` as the absolute first line — before any other import
   - Wrap the startup in an async `main()` function
   - Call `connectDB()` inside `main()` before `app.listen()`
   - Only call `app.listen()` after the database connects successfully
   - Read `PORT` from `process.env["PORT"]` with a fallback to `3000`

---

## Part 4 — Migrate Controllers to Prisma

### Why this step exists

Your controllers currently use `.find()`, `.push()`, and `.splice()` on JavaScript arrays. You are replacing all of that with Prisma queries that talk to the real database.

**Why `include` matters:** When a guest views a listing, they want to see the host's name and photo — not just a `hostId` number. Prisma's `include` lets you fetch related records in a single query instead of making multiple round trips to the database. One query is always faster than two.

**Why you check existence before updating/deleting:** If you call `prisma.user.update({ where: { id: 999 } })` and user 999 doesn't exist, Prisma throws an error. You need to handle that gracefully by checking first and returning a 404 — not letting the error bubble up as a 500.

**Why `totalPrice` must be calculated server-side:** Never trust the client to send the correct price. A malicious user could send `totalPrice: 0` and get a free booking. Always calculate it on the server using the listing's actual `pricePerNight` multiplied by the number of nights.

### Tasks

Replace all in-memory array operations in your controllers with Prisma queries.

**users.controller.ts:**
- `getAllUsers` — `prisma.user.findMany()`, use `_count` to include the number of listings each user has without fetching all listing data
- `getUserById` — `prisma.user.findUnique()`, include their listings and bookings, return 404 if not found
- `createUser` — validate required fields, check for duplicate email (return 409 with a clear message), create with `prisma.user.create()`
- `updateUser` — find first (return 404 if not found), then `prisma.user.update()`
- `deleteUser` — find first (return 404 if not found), then `prisma.user.delete()`

**listings.controller.ts:**
- `getAllListings` — `prisma.listing.findMany()`, include the host's `name` and `avatar` only (not the full user object)
- `getListingById` — `prisma.listing.findUnique()`, include full host details and all bookings, return 404 if not found
- `createListing` — validate required fields, verify the `hostId` exists (return 404 if host not found), create listing
- `updateListing` — find first (404), then update
- `deleteListing` — find first (404), then delete

**bookings.controller.ts (new):**
- `getAllBookings` — return all bookings, include guest's name and listing's title
- `getBookingById` — return booking with full guest and listing details, 404 if not found
- `createBooking` — validate `guestId`, `listingId`, `checkIn`, `checkOut` are all present. Verify both the guest and listing exist. Calculate `totalPrice` by finding the difference between `checkOut` and `checkIn` in days, then multiplying by `listing.pricePerNight`. Create the booking with status `PENDING`
- `deleteBooking` — find first (404), then delete — this represents a cancellation

### Best Practices

- Always check if related records exist before creating — verify the `hostId` exists before creating a listing. If you skip this, you get a foreign key constraint error from the database which is harder to handle cleanly
- Use `include` to return related data in a single query — never make two separate queries when one will do
- Use `select` when you only need specific fields — returning the full user object when you only need `name` and `avatar` wastes bandwidth
- Validate input before touching the database — fail fast with a clear 400 error rather than letting the database throw a cryptic constraint error

### Research Task

Look up Prisma's `select` vs `include`. They are different: `include` adds related records on top of all fields, `select` lets you pick exactly which fields to return. Try using `select` on `getAllListings` to return only `id`, `title`, `location`, `pricePerNight`, and the host's `name`. Research Prisma's `_count` — how do you return the number of bookings a listing has without fetching all the booking records?

---

## Part 5 — Advanced Queries

### Why this step exists

A real Airbnb app doesn't just return all listings. Users filter by city, by price, by property type. They paginate through results. Without these features, your API is not usable in a real product.

**Why pagination matters:** If you have 10,000 listings and a client calls `GET /listings`, you would return all 10,000 records in one response. That is slow, expensive, and crashes mobile apps. Pagination limits results to a manageable page size and lets clients load more on demand.

**Why server-side filtering matters:** Never return all records and filter on the client. The client would have to download everything first. Always filter at the database level using Prisma's `where` clause — only the matching records are fetched.

### Tasks

Add these features to your existing controllers:

1. **Filter listings by location** — `GET /listings?location=New York` — use Prisma's `contains` with `mode: "insensitive"` so "new york", "New York", and "NEW YORK" all match

2. **Filter listings by type** — `GET /listings?type=VILLA` — filter by the `ListingType` enum value

3. **Filter listings by max price** — `GET /listings?maxPrice=200` — use Prisma's `lte` (less than or equal) on `pricePerNight`

4. **Pagination on listings** — `GET /listings?page=1&limit=10` — use `skip` and `take`. Calculate `skip` as `(page - 1) * limit`. Default to page 1, limit 10 if not provided

5. **Get listings by host** — `GET /users/:id/listings` — return all listings where `hostId` matches the user's id

6. **Get bookings by guest** — `GET /users/:id/bookings` — return all bookings where `guestId` matches the user's id, include the listing details

7. **Update booking status** — `PATCH /bookings/:id/status` — accept `status` in the body, validate it is a valid `BookingStatus` value, update the booking

### Best Practices

- Always parse and validate query params — `req.query.page` is always a string, never a number. Convert with `parseInt` and check it is a valid positive integer
- Set sensible defaults for pagination — if no `limit` is provided, default to 10. Never return unlimited records
- Combine multiple filters in a single Prisma `where` object — all active filters apply together in one database query

### Research Task

Look up Prisma's `orderBy`. Add sorting to `GET /listings` — allow clients to sort by `pricePerNight` (asc/desc) and `createdAt` (asc/desc) via query params like `?sortBy=pricePerNight&order=asc`. Research Prisma's `findFirst` vs `findUnique` — `findUnique` requires a unique field, `findFirst` can use any field. When would you use each?

---

## Part 6 — Error Handling

### Why this step exists

Right now if Prisma throws an error — database is down, unique constraint violated, foreign key missing — your server will crash with an unhandled promise rejection. In production, that means your entire API goes down because of one bad request.

**Why you handle Prisma error codes specifically:** Prisma throws typed errors with codes like `P2002` (unique constraint) and `P2025` (record not found). If you catch these and return the right HTTP status code, the client gets a useful error. If you don't catch them, the client gets a 500 with no useful information.

**Why you never expose raw error messages:** Prisma error messages contain your table names, column names, and database structure. Sending them to the client is a security risk — it tells attackers exactly how your database is structured.

### Tasks

1. Wrap all controller functions in try/catch blocks

2. Handle Prisma-specific errors by importing `Prisma` from your generated client and checking `error instanceof Prisma.PrismaClientKnownRequestError`:
   - `P2002` — unique constraint violation (duplicate email or username) → return 409 with a clear message
   - `P2025` — record not found → return 404
   - `P2003` — foreign key constraint failed (e.g. invalid `hostId`) → return 400 with a message explaining the related record doesn't exist

3. For all other errors, return 500 with `"Something went wrong"` — never expose the raw error

4. Log all errors to the console on the server side with enough context to debug: the error code, the message, and which operation failed

### Best Practices

- Never send raw Prisma error messages to the client — they expose your database structure to potential attackers
- Log errors with context — knowing that a P2002 happened on `createUser` is much more useful than just knowing a P2002 happened somewhere
- A 500 error always means something unexpected happened — it should always be investigated. Log it properly

### Research Task

Research **global error handling middleware** in Express. It is a special middleware with 4 parameters `(err, req, res, next)`. Understand how to centralize all error handling in one place instead of duplicating try/catch in every controller. Try implementing it and removing the try/catch from your controllers.

---

## Updated Project Structure

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
- [ ] All three models defined with correct relationships and enums
- [ ] Migration ran successfully and all tables exist in the database
- [ ] Prisma Studio shows the correct table structure
- [ ] All users, listings, and bookings endpoints work correctly
- [ ] Filtering by location, type, and price works
- [ ] Pagination works on GET /listings
- [ ] `totalPrice` is calculated server-side (nights × pricePerNight)
- [ ] Errors are handled — no unhandled promise rejections
- [ ] Prisma error codes P2002, P2025, P2003 return correct HTTP status codes
- [ ] `.env` is not committed to Git
- [ ] `.env.example` exists

---

## Further Research

- Read about **database indexing** — add `@@index([location])` and `@@index([pricePerNight])` to the Listing model. Understand why indexes dramatically speed up queries on frequently filtered fields and why you don't just index every column
- Research **database transactions** — what if creating a booking and sending a confirmation email need to happen together atomically? Look up `prisma.$transaction()` and understand when you need it
- Look up the **N+1 query problem** — one of the most common performance issues with ORMs. Understand what it is, why it happens, and how Prisma's `include` prevents it
- Research **Prisma Studio** more deeply — you can use it to browse, filter, edit, and delete data visually during development. It is much faster than writing queries manually when debugging
