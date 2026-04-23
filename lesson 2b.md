# Lesson 2B: Relationships, Validation & Error Handling

## Table of Contents
1. [Relationships in Prisma](#relationships-in-prisma)
2. [One-to-Many Relationship](#one-to-many-relationship)
3. [Many-to-Many Relationship](#many-to-many-relationship)
4. [One-to-One Relationship](#one-to-one-relationship)
5. [Querying Relations](#querying-relations)
6. [Nested Writes](#nested-writes)
7. [onDelete Behavior](#ondelete-behavior)
8. [Validation](#validation)
9. [Prisma Error Handling](#prisma-error-handling)
10. [Global Error Handler](#global-error-handler)

---

## Relationships in Prisma

In a real app, data is connected. A user has many listings. A listing has many bookings. A booking belongs to both a user and a listing. These connections are called **relationships**.

Prisma handles relationships through two things:
- **Foreign keys** — a column in one table that references the primary key of another
- **Relation fields** — virtual fields in your schema that let you navigate between models

There are three types of relationships:
- **One-to-Many** — one user has many listings
- **Many-to-Many** — one listing has many amenity tags, one tag belongs to many listings
- **One-to-One** — one user has one profile

---

## One-to-Many Relationship

The most common relationship. One record on the "one" side connects to many records on the "many" side.

**Example: One User (host) has many Listings**

```prisma
model User {
  id       Int       @id @default(autoincrement())
  name     String
  email    String    @unique
  listings Listing[] // virtual field — not a real column
}

model Listing {
  id      Int    @id @default(autoincrement())
  title   String
  host    User   @relation(fields: [hostId], references: [id])
  hostId  Int    // real column — the foreign key
}
```

**Breaking it down:**

- `listings Listing[]` on User — virtual field, not stored in the database. Lets you access a user's listings via `user.listings`
- `host User` on Listing — virtual field pointing to the related User
- `hostId Int` — the actual foreign key column stored in the `listings` table
- `@relation(fields: [hostId], references: [id])` — tells Prisma that `hostId` maps to `id` on the User model

**The rule:** The foreign key (`hostId`) always lives on the "many" side — the Listing table, not the User table.

```
users table          listings table
-----------          ---------------
id  ←─────────────  hostId (FK)
name                 title
email                pricePerNight
```

---

## Many-to-Many Relationship

When records on both sides can relate to many records on the other side.

**Example: Listings and Tags (a listing can have many tags, a tag can belong to many listings)**

### Implicit Many-to-Many (Prisma handles the join table)

```prisma
model Listing {
  id   Int   @id @default(autoincrement())
  title String
  tags  Tag[]
}

model Tag {
  id       Int       @id @default(autoincrement())
  name     String    @unique
  listings Listing[]
}
```

Prisma automatically creates a hidden join table `_ListingToTag` in the database. You never interact with it directly.

### Explicit Many-to-Many (you control the join table)

Use this when the relationship itself has extra data — like a booking that connects a guest to a listing and also stores `checkIn`, `checkOut`, and `totalPrice`.

```prisma
model User {
  id       Int       @id @default(autoincrement())
  bookings Booking[]
}

model Listing {
  id       Int       @id @default(autoincrement())
  bookings Booking[]
}

model Booking {
  id        Int      @id @default(autoincrement())
  checkIn   DateTime
  checkOut  DateTime
  totalPrice Float
  guest     User     @relation(fields: [guestId], references: [id])
  guestId   Int
  listing   Listing  @relation(fields: [listingId], references: [id])
  listingId Int
}
```

The `Booking` model is the explicit join table. It connects User and Listing and carries its own data.

---

## One-to-One Relationship

One record on each side. Each user has exactly one profile, each profile belongs to exactly one user.

```prisma
model User {
  id      Int      @id @default(autoincrement())
  email   String   @unique
  profile Profile?
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String
  user   User   @relation(fields: [userId], references: [id])
  userId Int    @unique // @unique enforces the one-to-one
}
```

The `@unique` on `userId` is what makes it one-to-one — it prevents two profiles from having the same `userId`.

---

## Querying Relations

### include — fetch related records

```typescript
// Get a user with all their listings
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    listings: true,
  },
});
// user.listings is now an array of Listing objects
```

```typescript
// Get a listing with its host and all bookings
const listing = await prisma.listing.findUnique({
  where: { id: 1 },
  include: {
    host: true,
    bookings: {
      include: {
        guest: true, // nested include — get the guest for each booking
      },
    },
  },
});
```

### select — pick specific fields from related records

```typescript
// Get all listings, include only the host's name and email
const listings = await prisma.listing.findMany({
  include: {
    host: {
      select: {
        name: true,
        email: true,
      },
    },
  },
});
```

### _count — count related records without fetching them

```typescript
// Get all users with a count of their listings
const users = await prisma.user.findMany({
  include: {
    _count: {
      select: { listings: true },
    },
  },
});
// user._count.listings = 3
```

### where on relations — filter by related data

```typescript
// Get all listings that have at least one confirmed booking
const listings = await prisma.listing.findMany({
  where: {
    bookings: {
      some: {
        status: "CONFIRMED",
      },
    },
  },
});
```

Relation filters:
- `some` — at least one related record matches
- `every` — all related records match
- `none` — no related records match

---

## Nested Writes

Create or update related records in a single query.

### Create with related records

```typescript
// Create a user and their first listing at the same time
const user = await prisma.user.create({
  data: {
    name: "Alice",
    email: "alice@gmail.com",
    listings: {
      create: {
        title: "Cozy Apartment",
        location: "New York",
        pricePerNight: 120,
      },
    },
  },
  include: {
    listings: true,
  },
});
```

### Connect existing records

```typescript
// Create a listing and connect it to an existing user
const listing = await prisma.listing.create({
  data: {
    title: "Beach House",
    location: "Miami",
    pricePerNight: 250,
    host: {
      connect: { id: 1 }, // connect to existing user with id 1
    },
  },
});
```

### connectOrCreate

```typescript
// Connect to existing tag or create it if it doesn't exist
const listing = await prisma.listing.update({
  where: { id: 1 },
  data: {
    tags: {
      connectOrCreate: {
        where: { name: "beachfront" },
        create: { name: "beachfront" },
      },
    },
  },
});
```

---

## onDelete Behavior

What happens to related records when a parent is deleted? You control this with `onDelete`.

```prisma
model Listing {
  host   User @relation(fields: [hostId], references: [id], onDelete: Cascade)
  hostId Int
}
```

| Option | What happens |
|--------|-------------|
| `Cascade` | Delete all related records when parent is deleted |
| `Restrict` | Block deletion if related records exist |
| `SetNull` | Set the foreign key to null (field must be optional) |
| `NoAction` | Database decides (default — usually same as Restrict) |

**Airbnb example decisions:**
- Delete a host → `Cascade` delete their listings (no orphaned listings)
- Delete a listing → `Restrict` if it has active bookings (protect booking history)
- Delete a user → `SetNull` on reviews they wrote (keep the review, remove the author)

```prisma
model Listing {
  host    User     @relation(fields: [hostId], references: [id], onDelete: Cascade)
  hostId  Int
  bookings Booking[]
}

model Booking {
  listing   Listing @relation(fields: [listingId], references: [id], onDelete: Restrict)
  listingId Int
}
```

---

## Validation

Never trust data from the client. Validate before touching the database.

### Manual validation

```typescript
export async function createListing(req: Request, res: Response) {
  const { title, location, pricePerNight, guests } = req.body;

  // Check required fields
  if (!title || !location || !pricePerNight || !guests) {
    return res.status(400).json({ error: "title, location, pricePerNight and guests are required" });
  }

  // Check types
  if (typeof pricePerNight !== "number" || pricePerNight <= 0) {
    return res.status(400).json({ error: "pricePerNight must be a positive number" });
  }

  if (typeof guests !== "number" || guests < 1) {
    return res.status(400).json({ error: "guests must be at least 1" });
  }

  const listing = await prisma.listing.create({
    data: { title, location, pricePerNight, guests, hostId: req.userId },
  });

  res.status(201).json(listing);
}
```

### Validation with Zod

Zod is a TypeScript-first schema validation library. It validates the shape and types of data and gives you clean error messages automatically.

```bash
npm install zod
```

```typescript
import { z } from "zod";

// Define the schema
const createListingSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  location: z.string().min(2, "Location is required"),
  pricePerNight: z.number().positive("Price must be a positive number"),
  guests: z.number().int().min(1, "Must allow at least 1 guest"),
  type: z.enum(["APARTMENT", "HOUSE", "VILLA", "CABIN"]),
  amenities: z.array(z.string()).min(1, "At least one amenity is required"),
});

export async function createListing(req: Request, res: Response) {
  // Parse and validate — throws if invalid
  const result = createListingSchema.safeParse(req.body);

  if (!result.success) {
    // result.error.errors is an array of validation errors
    return res.status(400).json({ errors: result.error.errors });
  }

  // result.data is fully typed and validated
  const listing = await prisma.listing.create({
    data: { ...result.data, hostId: req.userId },
  });

  res.status(201).json(listing);
}
```

`safeParse` returns `{ success: true, data }` or `{ success: false, error }` — it never throws. Use `parse` if you want it to throw and catch it in your error handler.

### Common Zod validators

```typescript
z.string()                        // must be a string
z.string().min(3)                 // min length
z.string().max(100)               // max length
z.string().email()                // valid email format
z.string().url()                  // valid URL
z.number()                        // must be a number
z.number().int()                  // must be an integer
z.number().positive()             // must be > 0
z.number().min(1).max(5)          // between 1 and 5
z.boolean()                       // must be boolean
z.enum(["HOST", "GUEST"])         // must be one of these values
z.array(z.string())               // array of strings
z.array(z.string()).min(1)        // non-empty array
z.object({ name: z.string() })    // object with shape
z.string().optional()             // optional field
z.string().nullable()             // can be null
z.date()                          // must be a Date
```

---

## Prisma Error Handling

Prisma throws typed errors you can catch and handle specifically.

### PrismaClientKnownRequestError

These are expected database errors with specific codes:

```typescript
import { Prisma } from "../../generated/prisma/client.js";

export async function createUser(req: Request, res: Response) {
  try {
    const user = await prisma.user.create({ data: req.body });
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2002":
          // Unique constraint — duplicate email or username
          return res.status(409).json({
            error: `${error.meta?.target} already exists`,
          });
        case "P2025":
          // Record not found
          return res.status(404).json({ error: "Record not found" });
        case "P2003":
          // Foreign key constraint — related record doesn't exist
          return res.status(400).json({
            error: "Related record does not exist",
          });
        case "P2014":
          // Relation violation
          return res.status(400).json({ error: "Relation constraint violated" });
        default:
          return res.status(500).json({ error: "Something went wrong" });
      }
    }
    // Unknown error
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
}
```

### Common Prisma error codes

| Code | Meaning | HTTP Status |
|------|---------|------------|
| `P2002` | Unique constraint violation (duplicate email) | 409 |
| `P2003` | Foreign key constraint failed (invalid hostId) | 400 |
| `P2014` | Relation violation | 400 |
| `P2025` | Record not found (update/delete on missing record) | 404 |
| `P2016` | Query interpretation error | 400 |

---

## Global Error Handler

Instead of try/catch in every controller, you can centralize all error handling in one Express middleware.

A global error handler is a middleware with **4 parameters** — `(err, req, res, next)`. Express recognizes it as an error handler because of the 4th parameter.

```typescript
// src/middlewares/errorHandler.ts
import type { Request, Response, NextFunction } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({ errors: err.errors });
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        return res.status(409).json({ error: `${err.meta?.target} already exists` });
      case "P2025":
        return res.status(404).json({ error: "Record not found" });
      case "P2003":
        return res.status(400).json({ error: "Related record does not exist" });
      default:
        return res.status(500).json({ error: "Database error" });
    }
  }

  // Log unknown errors server-side — never expose details to client
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
}
```

Mount it in `index.ts` as the **last middleware** — after all routes:

```typescript
import { errorHandler } from "./middlewares/errorHandler.js";

app.use("/users", usersRouter);
app.use("/listings", listingsRouter);

// Must be last
app.use(errorHandler);
```

Now in your controllers, use `next(error)` instead of try/catch:

```typescript
export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.create({ data: req.body });
    res.status(201).json(user);
  } catch (error) {
    next(error); // passes to the global error handler
  }
}
```

Or with Zod — throw the validation error and let the handler catch it:

```typescript
export async function createListing(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createListingSchema.parse(req.body); // throws ZodError if invalid
    const listing = await prisma.listing.create({ data });
    res.status(201).json(listing);
  } catch (error) {
    next(error);
  }
}
```

---

## Summary

| Concept | What it is |
|---------|------------|
| One-to-Many | One user has many listings — foreign key on the "many" side |
| Many-to-Many | Listings and tags — Prisma creates a join table automatically |
| Explicit Join Table | A model that connects two others and carries its own data (Booking) |
| One-to-One | One user has one profile — `@unique` on the foreign key |
| `include` | Fetch related records in the same query |
| `select` | Pick specific fields from related records |
| `_count` | Count related records without fetching them |
| `some / every / none` | Filter by related record conditions |
| Nested writes | Create or connect related records in a single query |
| `onDelete: Cascade` | Delete related records when parent is deleted |
| `onDelete: Restrict` | Block deletion if related records exist |
| `onDelete: SetNull` | Set foreign key to null when parent is deleted |
| Zod | Schema validation library — validates shape and types of request data |
| `safeParse` | Validates without throwing — returns `{ success, data/error }` |
| `P2002` | Unique constraint violation → 409 |
| `P2025` | Record not found → 404 |
| `P2003` | Foreign key constraint failed → 400 |
| Global error handler | Express middleware with 4 params that catches all errors centrally |

---

**Resources:**
- [Prisma Relations Docs](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations)
- [Prisma Error Reference](https://www.prisma.io/docs/orm/reference/error-reference)
- [Zod Docs](https://zod.dev)
