# Lesson 2B Assignment: Airbnb API — Relationships, Validation & Error Handling

## Overview

Extend the Airbnb API by adding proper relationships between models, validating all incoming request data with Zod, and handling all errors centrally with a global error handler. Same project — better structure and safety.

---

## Endpoints Affected

All existing endpoints are affected by validation and error handling. New relationship queries are added to:

| Method | Endpoint | What changes |
|--------|----------|-------------|
| GET | `/listings` | Include host name and avatar, include `_count` of bookings |
| GET | `/listings/:id` | Include full host details and all bookings with guest info |
| GET | `/users/:id` | Include listings (if HOST) or bookings with listing details (if GUEST) |
| POST | `/listings` | Add Zod validation |
| POST | `/bookings` | Add Zod validation + date overlap check |
| POST | `/users` | Add Zod validation |
| PUT | `/listings/:id` | Add Zod validation |
| PUT | `/users/:id` | Add Zod validation |

---

## Part 1 — Update the Prisma Schema with Proper Relations

Update `prisma/schema.prisma` to add correct `onDelete` behavior to all relations:

**Listing → User (host):**
- `onDelete: Cascade` — when a host is deleted, delete all their listings

**Booking → User (guest):**
- `onDelete: Cascade` — when a guest is deleted, delete their bookings

**Booking → Listing:**
- `onDelete: Cascade` — when a listing is deleted, delete its bookings

**ListingPhoto → Listing:**
- `onDelete: Cascade` — when a listing is deleted, delete all its photos

Also add a `Profile` model with a one-to-one relation to User:
- `id` — Int, primary key
- `bio` — String? (optional)
- `website` — String? (optional)
- `country` — String? (optional)
- `user` — relation to User
- `userId` — Int, `@unique` — the `@unique` is what enforces one-to-one

Add `profile Profile?` to the User model.

Run migration: `add_relations_and_profile`

> The foreign key always lives on the "many" side. `@unique` on a foreign key turns a one-to-many into a one-to-one

### Research Task
Look up `onDelete: Restrict` vs `onDelete: Cascade`. When would you use Restrict instead of Cascade in the Airbnb context? Think about what should happen to bookings when a listing is deleted — should they be deleted too or blocked?

---

## Part 2 — Install and Configure Zod

Install:
```bash
npm install zod
```

Create `src/validators/listings.validator.ts`:

```typescript
import { z } from "zod";

export const createListingSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  location: z.string().min(2, "Location is required"),
  pricePerNight: z.number().positive("Price must be a positive number"),
  guests: z.number().int().min(1, "Must allow at least 1 guest"),
  type: z.enum(["APARTMENT", "HOUSE", "VILLA", "CABIN"]),
  amenities: z.array(z.string()).min(1, "At least one amenity is required"),
});

export const updateListingSchema = createListingSchema.partial();
// .partial() makes all fields optional — perfect for PUT/PATCH
```

Create `src/validators/users.validator.ts`:

```typescript
import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  phone: z.string().min(7, "Invalid phone number"),
  role: z.enum(["HOST", "GUEST"]).default("GUEST"),
});

export const updateUserSchema = createUserSchema.partial();
```

Create `src/validators/bookings.validator.ts`:

```typescript
import { z } from "zod";

export const createBookingSchema = z.object({
  listingId: z.number().int().positive(),
  checkIn: z.string().datetime("Invalid checkIn date"),
  checkOut: z.string().datetime("Invalid checkOut date"),
}).refine(
  (data) => new Date(data.checkIn) < new Date(data.checkOut),
  { message: "checkIn must be before checkOut", path: ["checkIn"] }
).refine(
  (data) => new Date(data.checkIn) > new Date(),
  { message: "checkIn must be in the future", path: ["checkIn"] }
);
```

> `.partial()` on a Zod schema makes all fields optional — use it for update schemas so clients can send only the fields they want to change. `.refine()` adds custom validation logic that spans multiple fields

---

## Part 3 — Apply Validation to Controllers

Update all controllers to use Zod validation with `safeParse`:

**listings.controller.ts — createListing:**
- Use `createListingSchema.safeParse(req.body)`
- If `!result.success` — return 400 with `{ errors: result.error.errors }`
- Use `result.data` for the Prisma create call

**listings.controller.ts — updateListing:**
- Use `updateListingSchema.safeParse(req.body)`
- Same error handling pattern

**users.controller.ts — createUser:**
- Use `createUserSchema.safeParse(req.body)`

**users.controller.ts — updateUser:**
- Use `updateUserSchema.safeParse(req.body)`

**bookings.controller.ts — createBooking:**
- Use `createBookingSchema.safeParse(req.body)`
- The `.refine()` checks already validate date logic — no need for manual date checks

---

## Part 4 — Update Queries to Use Relations

**listings.controller.ts — getAllListings:**
- Include host's `name` and `avatar` using `select` on the relation
- Include `_count` of bookings — `_count: { select: { bookings: true } }`
- Return listings with `host: { name, avatar }` and `_count: { bookings: 3 }`

**listings.controller.ts — getListingById:**
- Include full host details
- Include all bookings, and for each booking include the guest's `name` and `avatar`

```typescript
include: {
  host: true,
  bookings: {
    include: {
      guest: {
        select: { name: true, avatar: true },
      },
    },
  },
}
```

**users.controller.ts — getUserById:**
- If `user.role === "HOST"` — include their listings with booking counts
- If `user.role === "GUEST"` — include their bookings with listing title and location

**bookings.controller.ts — getBookingById:**
- Include full guest details (without password) and full listing details with host name

---

## Part 5 — Global Error Handler

Create `src/middlewares/errorHandler.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Zod validation errors — return all field errors at once
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

  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
}
```

Mount in `index.ts` as the **last middleware** — after all routes:

```typescript
import { errorHandler } from "./middlewares/errorHandler.js";

// all routes above...
app.use(errorHandler);
```

Update all controllers to use `next(error)` instead of inline try/catch:

```typescript
export async function createListing(req: Request, res: Response, next: NextFunction) {
  try {
    const result = createListingSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });

    const listing = await prisma.listing.create({ data: result.data });
    res.status(201).json(listing);
  } catch (error) {
    next(error); // global error handler takes it from here
  }
}
```

---

## Part 6 — Profile Endpoints

Add these endpoints using the one-to-one Profile relation:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/:id/profile` | Get a user's profile |
| POST | `/users/:id/profile` | Create a profile for a user |
| PUT | `/users/:id/profile` | Update a user's profile |

Create `src/validators/profile.validator.ts`:
- `bio` — optional string, max 300 characters
- `website` — optional string, valid URL format using `z.string().url()`
- `country` — optional string

**createProfile:**
- Check the user exists — 404 if not
- Check the user does not already have a profile — 409 if they do. Use `prisma.profile.findUnique({ where: { userId: id } })`
- Create the profile linked to the user

**updateProfile:**
- Check the user exists — 404 if not
- Check the profile exists — 404 if not
- Update with validated data

**getProfile:**
- Return the profile for the given user id — 404 if not found

---

## Project Structure

```
airbnb-api/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   └── prisma.ts
│   ├── controllers/
│   │   ├── users.controller.ts
│   │   ├── listings.controller.ts
│   │   └── bookings.controller.ts
│   ├── middlewares/
│   │   └── errorHandler.ts        ← new
│   ├── routes/
│   │   ├── users.routes.ts
│   │   ├── listings.routes.ts
│   │   └── bookings.routes.ts
│   ├── validators/                ← new
│   │   ├── listings.validator.ts
│   │   ├── users.validator.ts
│   │   ├── bookings.validator.ts
│   │   └── profile.validator.ts
│   └── index.ts
```

---

## Checklist

- [ ] `onDelete` behavior set on all relations
- [ ] Profile model added with one-to-one relation to User
- [ ] Migration ran successfully
- [ ] Zod schemas created for listings, users, bookings, and profile
- [ ] `createListing` validates with Zod — returns field-level errors on 400
- [ ] `updateListing` uses `.partial()` schema — all fields optional
- [ ] `createBooking` validates dates with `.refine()` — no manual date checks needed
- [ ] `getAllListings` includes host name/avatar and booking count
- [ ] `getListingById` includes host and bookings with guest details
- [ ] `getUserById` returns listings or bookings based on role
- [ ] Global error handler catches Zod errors, Prisma errors, and unknown errors
- [ ] All controllers use `next(error)` — no duplicate error handling
- [ ] Profile CRUD endpoints work correctly
- [ ] Duplicate profile returns 409

---

## Further Research

- **Zod `.transform()`** — look up how to transform data after validation, e.g. converting a date string to a `Date` object automatically
- **Zod `.superRefine()`** — more powerful than `.refine()`, lets you add multiple custom errors. Research when you'd use it over `.refine()`
- **Prisma `$transaction()`** — what if creating a booking and updating a listing's availability need to happen atomically? Research how transactions work
- **Relation filters** — look up `some`, `every`, `none` in Prisma. Add a query to get all listings that have no bookings yet
