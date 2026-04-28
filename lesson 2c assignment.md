# Lesson 2C Assignment: Airbnb API — Seeding & Database Scripts

## Overview

Set up a complete seed file for the Airbnb API, configure all database scripts in `package.json`, practice transactions, raw queries, and add indexes to the schema. After this, your database workflow is fully automated.

---

## Part 1 — Configure Package.json Scripts

Add all scripts to `package.json` and the Prisma seed config:

```json
{
  "scripts": {
    "dev": "nodemon --exec tsx src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:reset": "prisma migrate reset",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:status": "prisma migrate status",
    "db:fresh": "prisma migrate reset"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

> `db:fresh` runs `prisma migrate reset` which automatically triggers the seed — wipe + migrate + seed in one command

---

## Part 2 — Prisma Config File

Create `prisma.config.ts` at the root of your project:

- Import `dotenv/config` as the first line
- Export `defineConfig` from `prisma/config`
- Set `schema` to `"prisma/schema.prisma"`
- Set `datasource.url` to `process.env["DATABASE_URL"]`

Remove the `url` from the `datasource db` block in `schema.prisma` — the config file handles it now.

> `import "dotenv/config"` must be the first line in `prisma.config.ts` — Prisma reads this file before connecting, so `DATABASE_URL` must be loaded first

---

## Part 3 — Add Indexes to the Schema

Update `prisma/schema.prisma` to add indexes on frequently queried columns:

**Listing model — add:**
- `@@index([location])` — speeds up `GET /listings?location=...`
- `@@index([pricePerNight])` — speeds up `GET /listings?maxPrice=...`
- `@@index([type])` — speeds up `GET /listings?type=...`
- `@@index([hostId])` — speeds up `GET /users/:id/listings`
- `@@index([type, location])` — composite index for filtering by both

**Booking model — add:**
- `@@index([guestId])` — speeds up `GET /users/:id/bookings`
- `@@index([listingId])` — speeds up fetching bookings for a listing
- `@@index([listingId, checkIn, checkOut])` — speeds up the date overlap conflict check

Run a migration after adding indexes:
```bash
npm run db:migrate -- --name add_indexes
```

> Only index columns used in `WHERE`, `ORDER BY`, or `JOIN`. Do not index every column — indexes slow down writes

---

## Part 4 — Create the Seed File

Create `prisma/seed.ts` with the following requirements:

**Cleanup — delete in reverse dependency order:**
```typescript
await prisma.booking.deleteMany();
await prisma.listing.deleteMany();
await prisma.user.deleteMany();
```

**Users — use `upsert` instead of `create`:**
- 2 hosts (`role: "HOST"`) and 3 guests (`role: "GUEST"`)
- Hash all passwords with `bcrypt.hash("password123", 10)`
- Use `upsert` with `where: { email }` so the seed is safe to run multiple times without creating duplicates

```typescript
const alice = await prisma.user.upsert({
  where: { email: "alice@example.com" },
  update: {},
  create: {
    name: "Alice Johnson",
    email: "alice@example.com",
    username: "alice_host",
    password: await bcrypt.hash("password123", 10),
    role: "HOST",
  },
});
```

**Listings — use `createMany` for bulk insert:**
- At least 4 listings — one of each type: `APARTMENT`, `HOUSE`, `VILLA`, `CABIN`
- Use `createMany` with `skipDuplicates: true`
- Each listing must have at least 3 amenities and a valid `hostId`

> `createMany` does not return the created records — if you need the ids for bookings, create listings individually with `create` and store the results

**Bookings — create individually (need returned ids):**
- At least 3 bookings with future dates
- Calculate `totalPrice` correctly: `nights × listing.pricePerNight`
- At least one `CONFIRMED` and one `PENDING`

**Seed file structure:**
```typescript
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding...");

  // 1. Cleanup
  // 2. Create users with upsert
  // 3. Create listings with createMany (or create if you need ids)
  // 4. Create bookings

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
```

---

## Part 5 — Use Transactions in the Booking Controller

Update `createBooking` in `bookings.controller.ts` to use an interactive transaction. The conflict check and booking creation must be atomic — if two requests arrive at the same time, only one should succeed.

```typescript
const booking = await prisma.$transaction(async (tx) => {
  // Check for date conflicts inside the transaction
  const conflict = await tx.booking.findFirst({
    where: {
      listingId,
      status: "CONFIRMED",
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
  });

  if (conflict) {
    throw new Error("BOOKING_CONFLICT");
  }

  return tx.booking.create({
    data: { listingId, guestId, checkIn, checkOut, totalPrice, status: "PENDING" },
  });
});
```

Catch `"BOOKING_CONFLICT"` in the controller and return 409. All other errors go to `next(error)`.

> Using `tx` inside `$transaction` ensures the conflict check and the create happen atomically — no race condition between two simultaneous booking requests

---

## Part 6 — Add a Raw Query Endpoint

Add `GET /listings/stats` to `listings.routes.ts` and `listings.controller.ts`:

Use `$queryRaw` to return listing statistics grouped by location:

```typescript
const stats = await prisma.$queryRaw`
  SELECT
    location,
    COUNT(*)::int AS total,
    ROUND(AVG("pricePerNight")::numeric, 2) AS avg_price,
    MIN("pricePerNight") AS min_price,
    MAX("pricePerNight") AS max_price
  FROM listings
  GROUP BY location
  ORDER BY total DESC
`;

res.json(stats);
```

> Always use template literals with `$queryRaw` — Prisma parameterizes values automatically, preventing SQL injection. Never concatenate strings into raw queries

---

## Part 7 — Run and Verify

1. Run the seed:
   ```bash
   npm run db:seed
   ```

2. Open Prisma Studio and verify:
   ```bash
   npm run db:studio
   ```
   - Users exist with correct roles
   - Listings linked to correct hosts
   - Bookings have correct `totalPrice` and future dates
   - Running `db:seed` a second time does not create duplicate users (upsert works)

3. Test the transaction — try to create two bookings for the same listing and overlapping dates simultaneously. Only one should succeed with 201, the other should get 409.

4. Test the stats endpoint:
   ```
   GET /listings/stats
   ```
   Should return grouped statistics per location.

5. Test the full reset:
   ```bash
   npm run db:fresh
   ```

6. Check migration status:
   ```bash
   npm run db:status
   ```
   All migrations including `add_indexes` should show ✔

---

## Checklist

- [ ] `prisma.config.ts` created with `dotenv/config` as first import
- [ ] All `db:*` scripts added to `package.json`
- [ ] Indexes added to Listing and Booking models
- [ ] Migration `add_indexes` ran successfully
- [ ] Seed cleans data in correct order (children before parents)
- [ ] Users created with `upsert` — running seed twice creates no duplicates
- [ ] Passwords hashed with bcrypt
- [ ] Listings created with `createMany` and `skipDuplicates: true`
- [ ] `totalPrice` calculated correctly on all bookings
- [ ] `createBooking` uses `$transaction` for atomic conflict check + create
- [ ] `GET /listings/stats` returns grouped stats using `$queryRaw`
- [ ] `npm run db:seed` runs without errors
- [ ] `npm run db:fresh` wipes and re-seeds successfully
- [ ] `npm run db:status` shows all migrations applied

---

## Further Research

- **Faker.js** — look up `@faker-js/faker`. Use it to generate 50 realistic listings instead of writing them manually
- **`prisma.$transaction` timeout** — research the `timeout` and `maxWait` options on transactions. What happens if a transaction takes too long?
- **Explain Analyze** — look up `EXPLAIN ANALYZE` in PostgreSQL. Run it on a query before and after adding an index to see the performance difference
- **Prisma Accelerate** — research Prisma's connection pooling and caching service. Understand when you would use it over PgBouncer
