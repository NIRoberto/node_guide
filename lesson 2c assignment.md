# Lesson 2C Assignment: Airbnb API — Seeding & Database Scripts

## Overview

Set up a seed file for the Airbnb API and configure all database scripts in `package.json`. After this, resetting and re-seeding your database is a single command.

---

## Part 1 — Configure Package.json Scripts

Add these scripts to `package.json` and the Prisma seed config:

```json
{
  "scripts": {
    "dev": "nodemon --exec tsx src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "db:migrate": "prisma migrate dev",
    "db:reset": "prisma migrate reset",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate",
    "db:fresh": "prisma migrate reset"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

> `db:fresh` runs `prisma migrate reset` which automatically triggers the seed after resetting — wipe + migrate + seed in one command

---

## Part 2 — Create the Seed File

Create `prisma/seed.ts` with the following data:

**Users:**
- 2 hosts with `role: "HOST"`
- 3 guests with `role: "GUEST"`
- Hash all passwords with `bcrypt.hash("password123", 10)` — never use plain text

**Listings:**
- At least 4 listings — one of each type: `APARTMENT`, `HOUSE`, `VILLA`, `CABIN`
- Each listing linked to a host using `hostId`
- Each listing has at least 3 amenities

**Bookings:**
- At least 3 bookings linked to existing guests and listings
- Use future dates for `checkIn` and `checkOut`
- Calculate `totalPrice` correctly: `nights × listing.pricePerNight`
- At least one `CONFIRMED` and one `PENDING` status

**Cleanup — always delete existing data first, in this exact order:**
```typescript
await prisma.booking.deleteMany();
await prisma.listing.deleteMany();
await prisma.user.deleteMany();
```

> Delete children before parents — foreign key constraints will throw if you delete a user who still has listings

**Seed file structure:**
```typescript
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Clean existing data
  // 2. Create users
  // 3. Create listings
  // 4. Create bookings
  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
```

---

## Part 3 — Run and Verify

1. Run the seed:
   ```bash
   npm run db:seed
   ```

2. Open Prisma Studio and verify all data is correct:
   ```bash
   npm run db:studio
   ```
   - Users exist with correct roles
   - Listings are linked to the correct host
   - Bookings reference valid guests and listings
   - `totalPrice` is correct on each booking

3. Test the full reset workflow:
   ```bash
   npm run db:fresh
   ```
   Verify Prisma Studio shows fresh seed data after the reset.

---

## Checklist

- [ ] All `db:*` scripts added to `package.json`
- [ ] `"prisma": { "seed": "tsx prisma/seed.ts" }` added to `package.json`
- [ ] Seed cleans existing data in correct order before inserting
- [ ] Passwords hashed with bcrypt — no plain text
- [ ] 2 hosts, 3 guests, 4 listings (all types), 3 bookings
- [ ] All listings linked to a host via `hostId`
- [ ] All bookings linked to a guest and listing via `guestId` and `listingId`
- [ ] `totalPrice` calculated correctly
- [ ] `npm run db:seed` runs without errors
- [ ] `npm run db:fresh` wipes and re-seeds successfully
- [ ] Prisma Studio shows all data correctly

---

## Further Research

- **Faker.js** — look up `@faker-js/faker`. Generates realistic fake data (names, emails, prices). Research how to use it to generate 50 listings instead of writing them manually
- **`createMany`** — look up `prisma.user.createMany()`. Understand when it is faster than multiple `create()` calls and what its limitations are
