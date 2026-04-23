# Lesson 2C: Seeding, Package.json Scripts & Database Workflow

## Table of Contents
1. [What is Seeding?](#what-is-seeding)
2. [Creating a Seed File](#creating-a-seed-file)
3. [Running the Seed](#running-the-seed)
4. [Seeding with Relationships](#seeding-with-relationships)
5. [Package.json Scripts](#packagejson-scripts)
6. [Full Database Workflow](#full-database-workflow)
7. [Prisma Studio](#prisma-studio)
8. [Reset & Fresh Start](#reset--fresh-start)
9. [Common Issues & Fixes](#common-issues--fixes)

---

## What is Seeding?

When you create a new database, it is completely empty. Every time you reset the database during development, all your test data is gone and you have to manually re-enter it through Postman or Prisma Studio.

**Seeding** solves this. A seed file is a script that fills your database with initial data automatically. You run it once after setting up or resetting the database and your app has real data to work with immediately.

Seeding is useful for:
- **Development** — have realistic test data every time you reset
- **Testing** — consistent data for automated tests
- **Demo environments** — pre-fill a demo with sample listings and users
- **Required data** — things that must exist before the app works (admin user, default categories)

---

## Creating a Seed File

Create `prisma/seed.ts`:

```typescript
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data first — order matters because of foreign keys
  // Delete in reverse order of dependencies
  await prisma.booking.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  console.log("🗑️  Cleared existing data");

  // ─── Seed Users ───────────────────────────────────────────────────────────

  const alice = await prisma.user.create({
    data: {
      name: "Alice Johnson",
      email: "alice@example.com",
      username: "alice_host",
      password: "$2b$10$hashedpasswordhere", // use bcrypt in real seeds
      role: "HOST",
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: "Bob Smith",
      email: "bob@example.com",
      username: "bob_guest",
      password: "$2b$10$hashedpasswordhere",
      role: "GUEST",
    },
  });

  const carol = await prisma.user.create({
    data: {
      name: "Carol White",
      email: "carol@example.com",
      username: "carol_guest",
      password: "$2b$10$hashedpasswordhere",
      role: "GUEST",
    },
  });

  console.log("👥 Created users");

  // ─── Seed Listings ────────────────────────────────────────────────────────

  const listing1 = await prisma.listing.create({
    data: {
      title: "Cozy apartment in downtown",
      description: "A beautiful apartment in the heart of the city",
      location: "New York, NY",
      pricePerNight: 120,
      guests: 2,
      type: "APARTMENT",
      amenities: ["WiFi", "Kitchen", "Air conditioning"],
      hostId: alice.id,
    },
  });

  const listing2 = await prisma.listing.create({
    data: {
      title: "Beach house with ocean view",
      description: "Wake up to stunning ocean views every morning",
      location: "Miami, FL",
      pricePerNight: 250,
      guests: 6,
      type: "HOUSE",
      amenities: ["WiFi", "Pool", "Beach access", "BBQ"],
      hostId: alice.id,
    },
  });

  const listing3 = await prisma.listing.create({
    data: {
      title: "Mountain cabin retreat",
      description: "Escape the city in this peaceful mountain cabin",
      location: "Denver, CO",
      pricePerNight: 180,
      guests: 4,
      type: "CABIN",
      amenities: ["Fireplace", "Hiking trails", "WiFi"],
      hostId: alice.id,
    },
  });

  console.log("🏠 Created listings");

  // ─── Seed Bookings ────────────────────────────────────────────────────────

  await prisma.booking.create({
    data: {
      checkIn: new Date("2025-08-01"),
      checkOut: new Date("2025-08-05"),
      totalPrice: 480, // 4 nights × 120
      status: "CONFIRMED",
      guestId: bob.id,
      listingId: listing1.id,
    },
  });

  await prisma.booking.create({
    data: {
      checkIn: new Date("2025-09-10"),
      checkOut: new Date("2025-09-15"),
      totalPrice: 1250, // 5 nights × 250
      status: "PENDING",
      guestId: carol.id,
      listingId: listing2.id,
    },
  });

  console.log("📅 Created bookings");
  console.log("✅ Seeding complete!");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Running the Seed

### Tell Prisma where your seed file is

Add this to `package.json`:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Now you can run:

```bash
npx prisma db seed
```

Prisma also runs the seed automatically after `prisma migrate reset` — so resetting the database and re-seeding is a single command.

### Seed with real hashed passwords

In a real seed file, hash passwords properly with bcrypt:

```typescript
import bcrypt from "bcrypt";

const hashedPassword = await bcrypt.hash("password123", 10);

await prisma.user.create({
  data: {
    email: "alice@example.com",
    password: hashedPassword,
  },
});
```

---

## Seeding with Relationships

When seeding related data, always create the parent before the child — you need the parent's `id` to set the foreign key.

```typescript
// ✅ Correct order — create user first, then listing
const user = await prisma.user.create({ data: { ... } });
const listing = await prisma.listing.create({
  data: {
    ...
    hostId: user.id, // use the id from the created user
  },
});

// ✅ Alternative — nested create in one query
const user = await prisma.user.create({
  data: {
    name: "Alice",
    email: "alice@example.com",
    listings: {
      create: [
        { title: "Apartment", location: "NYC", pricePerNight: 120, guests: 2, type: "APARTMENT", amenities: [] },
        { title: "Beach House", location: "Miami", pricePerNight: 250, guests: 6, type: "HOUSE", amenities: [] },
      ],
    },
  },
});
```

### Deleting seed data in the right order

Foreign key constraints prevent you from deleting a parent that has children. Always delete children first:

```typescript
// ✅ Correct — delete in reverse dependency order
await prisma.booking.deleteMany();   // bookings reference listings and users
await prisma.listing.deleteMany();   // listings reference users
await prisma.user.deleteMany();      // users have no dependencies

// ❌ Wrong — will throw a foreign key constraint error
await prisma.user.deleteMany();      // fails — listings still reference users
```

---

## Package.json Scripts

A well-configured `package.json` makes working with your database fast and consistent. Here is a complete setup for an Airbnb-style project:

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

    "db:fresh": "prisma migrate reset && prisma db seed"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### What each script does

| Script | Command | When to use |
|--------|---------|-------------|
| `npm run dev` | `nodemon --exec tsx src/index.ts` | Start dev server with auto-restart |
| `npm run build` | `tsc` | Compile TypeScript for production |
| `npm start` | `node dist/index.js` | Run production build |
| `npm run db:migrate` | `prisma migrate dev` | Create and apply a new migration |
| `npm run db:migrate:prod` | `prisma migrate deploy` | Apply migrations in production |
| `npm run db:reset` | `prisma migrate reset` | Wipe database and re-run all migrations |
| `npm run db:seed` | `prisma db seed` | Run the seed file |
| `npm run db:studio` | `prisma studio` | Open visual database browser |
| `npm run db:generate` | `prisma generate` | Regenerate Prisma Client after schema change |
| `npm run db:push` | `prisma db push` | Push schema without creating migration (prototyping) |
| `npm run db:status` | `prisma migrate status` | Check which migrations have been applied |
| `npm run db:fresh` | reset + seed | Wipe everything and start fresh with seed data |

### How to create a named migration

```bash
npm run db:migrate -- --name add_bookings_table
# or directly:
npx prisma migrate dev --name add_bookings_table
```

---

## Full Database Workflow

Here is the exact sequence of commands for common situations:

### Starting a new project from scratch

```bash
# 1. Initialize Prisma
npx prisma init

# 2. Define your models in prisma/schema.prisma

# 3. Create the first migration
npm run db:migrate -- --name init

# 4. Seed the database
npm run db:seed

# 5. Start the server
npm run dev
```

### After changing the schema (adding a field or model)

```bash
# 1. Edit prisma/schema.prisma

# 2. Create a migration for the change
npm run db:migrate -- --name add_avatar_to_user

# Prisma automatically regenerates the client after migrate
# If you only changed the schema without migrating, regenerate manually:
npm run db:generate
```

### Resetting everything during development

```bash
# Wipe the database, re-run all migrations, and re-seed
npm run db:fresh
```

This is the most useful command during development. When your data gets messy or you want a clean state, one command resets everything.

### Checking what migrations have been applied

```bash
npm run db:status
```

Output:
```
3 migrations found in prisma/migrations

✔ 20240101_init
✔ 20240102_add_bookings
✗ 20240103_add_avatar  ← not yet applied
```

### Pulling schema from an existing database

If you have an existing database and want Prisma to generate the schema from it:

```bash
npx prisma db pull
```

---

## Prisma Studio

Prisma Studio is a visual database browser that runs in your browser. It lets you view, filter, create, edit, and delete records without writing any code.

```bash
npm run db:studio
# Opens at http://localhost:5555
```

**What you can do in Prisma Studio:**
- Browse all tables and records
- Filter and sort records
- Create new records manually
- Edit existing records inline
- Delete records
- Navigate relationships — click on a foreign key to jump to the related record

This is extremely useful during development for:
- Verifying your seed data looks correct
- Debugging — checking what is actually in the database
- Quickly editing test data without writing queries
- Exploring relationships between models

---

## Reset & Fresh Start

### prisma migrate reset

```bash
npm run db:reset
```

This command:
1. Drops the entire database
2. Re-creates it
3. Re-runs all migrations from scratch
4. Automatically runs `prisma db seed` if configured in `package.json`

> Use this during development when your database is in a broken state or you want to start clean. **Never run this in production** — it deletes all data.

### prisma db push

```bash
npm run db:push
```

Pushes your schema directly to the database without creating a migration file. Useful when:
- Prototyping and you don't care about migration history yet
- You want to quickly test a schema change

Once you are happy with the schema, create a proper migration with `migrate dev`.

### Difference between migrate dev and db push

| | `migrate dev` | `db push` |
|--|--------------|-----------|
| Creates migration file | ✅ Yes | ❌ No |
| Safe for production | ✅ Yes | ❌ No |
| Tracks history | ✅ Yes | ❌ No |
| Good for prototyping | Slower | ✅ Faster |
| Good for teams | ✅ Yes | ❌ No |

---

## Common Issues & Fixes

### "The migration is not applied to the database"

```bash
npm run db:migrate:prod
# or
npx prisma migrate deploy
```

### "Prisma Client is not up to date"

After changing the schema, the generated client is outdated:

```bash
npm run db:generate
```

### "Cannot find module '../../generated/prisma/client.js'"

The client has not been generated yet:

```bash
npm run db:generate
```

### "Foreign key constraint failed"

You are trying to create a record with a `hostId` that does not exist, or delete a user who still has listings. Check:
- The related record exists before creating
- Delete children before parents in your seed cleanup

### "Environment variable not found: DATABASE_URL"

`dotenv/config` is not imported before Prisma is initialized. Make sure `import "dotenv/config"` is the very first line in both `index.ts` and `seed.ts`.

### Schema drift — database does not match schema

When the database and schema are out of sync:

```bash
# Check what's different
npx prisma migrate status

# Reset and start fresh (dev only)
npm run db:fresh
```

---

## Summary

| Concept | What it is |
|---------|------------|
| Seed file | Script that fills the database with initial data |
| `prisma db seed` | Runs the seed file |
| `prisma migrate reset` | Wipes database, re-runs migrations, runs seed |
| `prisma migrate dev` | Creates a new migration and applies it |
| `prisma migrate deploy` | Applies existing migrations — safe for production |
| `prisma db push` | Pushes schema without creating a migration — prototyping only |
| `prisma generate` | Regenerates the Prisma Client after schema changes |
| `prisma studio` | Visual database browser at localhost:5555 |
| `prisma migrate status` | Shows which migrations have been applied |
| `db:fresh` script | Reset + seed in one command — most useful dev command |
| `deleteMany` order | Always delete children before parents — foreign key constraints |
| `"prisma": { "seed": "..." }` | Tells Prisma which file to run for seeding |

---

**Resources:**
- [Prisma Seeding Docs](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding)
- [Prisma Migrate Docs](https://www.prisma.io/docs/orm/prisma-migrate)
- [Prisma Studio Docs](https://www.prisma.io/docs/orm/tools/prisma-studio)
