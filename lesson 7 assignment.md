# Lesson 7 Assignment: Airbnb API — Versioning

## Overview

Add API versioning to the Airbnb API. You will restructure the existing routes into `v1`, introduce `v2` with breaking changes, add deprecation headers to `v1`, and document both versions with Swagger.

---

## What You're Building

| Version | Endpoints | Status |
|---------|----------|--------|
| v1 | `/v1/users`, `/v1/listings`, `/v1/bookings`, `/v1/auth` | Deprecated |
| v2 | `/v2/users`, `/v2/listings`, `/v2/bookings`, `/v2/auth` | Current |

---

## Part 1 — Restructure Routes into v1

Move all existing routes into a versioned structure. No logic changes yet — just reorganize.

### New folder structure

```
src/
├── controllers/
│   ├── v1/
│   │   ├── users.controller.ts
│   │   ├── listings.controller.ts
│   │   ├── bookings.controller.ts
│   │   └── auth.controller.ts
│   └── v2/                        ← new (Part 2)
├── routes/
│   ├── v1/
│   │   ├── index.ts               ← groups all v1 routes
│   │   ├── users.routes.ts
│   │   ├── listings.routes.ts
│   │   ├── bookings.routes.ts
│   │   └── auth.routes.ts
│   └── v2/                        ← new (Part 2)
├── services/                      ← new — shared logic
│   ├── listings.service.ts
│   ├── users.service.ts
│   └── bookings.service.ts
└── index.ts
```

### Tasks

1. Move all existing controllers into `src/controllers/v1/`
2. Move all existing routes into `src/routes/v1/`
3. Create `src/routes/v1/index.ts` that groups all v1 routes:

```typescript
import { Router } from "express";
import usersRouter from "./users.routes.js";
import listingsRouter from "./listings.routes.js";
import bookingsRouter from "./bookings.routes.js";
import authRouter from "./auth.routes.js";

const v1Router = Router();

v1Router.use("/users", usersRouter);
v1Router.use("/listings", listingsRouter);
v1Router.use("/bookings", bookingsRouter);
v1Router.use("/auth", authRouter);

export default v1Router;
```

4. Update `index.ts` to mount v1 under `/v1`:

```typescript
import v1Router from "./routes/v1/index.js";

app.use("/v1", v1Router);
```

5. Verify all existing endpoints still work under `/v1/...`

---

## Part 2 — Extract a Services Layer

Before creating v2, extract shared database queries into a services layer. Both v1 and v2 controllers will use these — no duplicated Prisma queries.

Create `src/services/listings.service.ts`:
- `getAllListings(filters)` — `prisma.listing.findMany()` with location, type, price filters and pagination
- `getListingById(id)` — `prisma.listing.findUnique()` with host and bookings included
- `createListing(data)` — `prisma.listing.create()`
- `updateListing(id, data)` — `prisma.listing.update()`
- `deleteListing(id)` — `prisma.listing.delete()`

Create `src/services/users.service.ts`:
- `getAllUsers()` — `prisma.user.findMany()`
- `getUserById(id)` — `prisma.user.findUnique()` with listings or bookings based on role
- `updateUser(id, data)` — `prisma.user.update()`
- `deleteUser(id)` — `prisma.user.delete()`

Create `src/services/bookings.service.ts`:
- `createBooking(data)` — includes conflict check and `totalPrice` calculation
- `getBookingById(id)` — with guest and listing details
- `cancelBooking(id)` — updates status to `CANCELLED`

Update all v1 controllers to call the service functions instead of calling Prisma directly.

> The services layer is what makes versioning practical — v1 and v2 share the same database queries, only the response format differs

---

## Part 3 — Create v2 with Breaking Changes

v2 introduces the following breaking changes from v1:

### Breaking change 1 — Listings: `host` field

- **v1** — `host` is a string (the host's name only)
- **v2** — `host` is a full object `{ id, name, avatar, email }`

### Breaking change 2 — Bookings: `guestId` removed from request body

- **v1** — `POST /v1/bookings` requires `guestId` in the request body
- **v2** — `POST /v2/bookings` derives `guestId` from the JWT token (`req.userId`) — never from the body

### Breaking change 3 — Users: password field handling

- **v1** — password field is manually stripped in each controller
- **v2** — a `select` statement explicitly excludes `password` from all user queries at the service level

### Tasks

1. Create `src/routes/v2/index.ts` — same structure as v1 index
2. Create `src/controllers/v2/listings.controller.ts`:
   - Call the same `getListingById` service
   - Return `host` as a full object — do not flatten it to a string
3. Create `src/controllers/v2/bookings.controller.ts`:
   - `createBooking` — use `req.userId` as `guestId`, remove it from request body validation
4. Create `src/controllers/v2/users.controller.ts`:
   - All user queries use `select` to exclude `password` at the query level
5. Copy auth routes to v2 — no changes needed for auth
6. Mount v2 in `index.ts`:

```typescript
import v2Router from "./routes/v2/index.js";

app.use("/v1", v1Router);
app.use("/v2", v2Router);
```

7. Verify:
   - `GET /v1/listings/1` returns `host: "Alice Johnson"` (string)
   - `GET /v2/listings/1` returns `host: { id: 1, name: "Alice Johnson", avatar: "...", email: "..." }` (object)
   - `POST /v1/bookings` requires `guestId` in body
   - `POST /v2/bookings` does not accept `guestId` in body — uses token

---

## Part 4 — Add Deprecation Headers to v1

Create `src/middlewares/deprecation.middleware.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";

export function deprecateV1(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", "Sat, 01 Jan 2026 00:00:00 GMT");
  res.setHeader("Link", '</v2>; rel="successor-version"');
  next();
}
```

Apply it to all v1 routes in `index.ts`:

```typescript
import { deprecateV1 } from "./middlewares/deprecation.middleware.js";

app.use("/v1", deprecateV1, v1Router);
app.use("/v2", v2Router);
```

Verify by calling any v1 endpoint in Postman — the response headers should include `Deprecation: true` and `Sunset: ...`

---

## Part 5 — Default Version Redirect

When a client calls `/listings` without a version prefix, redirect them to the latest version:

```typescript
// In index.ts — before versioned routes
app.use("/listings", (req, res) => {
  res.redirect(301, `/v2/listings${req.url}`);
});

app.use("/users", (req, res) => {
  res.redirect(301, `/v2/users${req.url}`);
});

app.use("/bookings", (req, res) => {
  res.redirect(301, `/v2/bookings${req.url}`);
});

app.use("/auth", (req, res) => {
  res.redirect(301, `/v2/auth${req.url}`);
});
```

> 301 Moved Permanently tells clients and search engines the resource has permanently moved to the new URL

---

## Part 6 — Document Both Versions with Swagger

Update `src/config/swagger.ts` to document both versions:

```typescript
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Airbnb API",
      version: "2.0.0",
      description: "Airbnb REST API — v2 is current, v1 is deprecated",
    },
    servers: [
      {
        url: "http://localhost:3000/v2",
        description: "v2 — Current",
      },
      {
        url: "http://localhost:3000/v1",
        description: "v1 — Deprecated (sunset: Jan 2026)",
      },
    ],
    // ...
  },
  apis: ["./src/routes/v1/*.ts", "./src/routes/v2/*.ts"],
};
```

Add a deprecation note to all v1 route docs:

```typescript
/**
 * @swagger
 * /listings:
 *   get:
 *     summary: Get all listings
 *     tags: [Listings]
 *     deprecated: true
 *     description: >
 *       **Deprecated** — This endpoint will be removed on Jan 1, 2026.
 *       Please migrate to v2. In v2, the `host` field returns a full object
 *       instead of a string.
 */
```

The `deprecated: true` flag shows a strikethrough on the endpoint in Swagger UI — a clear visual warning.

Add a migration note to all v2 route docs explaining what changed from v1.

---

## Part 7 — Write a Migration Guide

Create `MIGRATION.md` at the root of the project:

```markdown
# Migration Guide: v1 → v2

## Breaking Changes

### GET /listings/:id and GET /listings

**v1 response:**
\`\`\`json
{
  "id": 1,
  "title": "Cozy Apartment",
  "host": "Alice Johnson"
}
\`\`\`

**v2 response:**
\`\`\`json
{
  "id": 1,
  "title": "Cozy Apartment",
  "host": {
    "id": 5,
    "name": "Alice Johnson",
    "avatar": "https://...",
    "email": "alice@example.com"
  }
}
\`\`\`

**What to update:** Change `listing.host` (string) to `listing.host.name` (string from object).

---

### POST /bookings

**v1 request body:**
\`\`\`json
{
  "listingId": 1,
  "guestId": 3,
  "checkIn": "2025-08-01",
  "checkOut": "2025-08-05"
}
\`\`\`

**v2 request body:**
\`\`\`json
{
  "listingId": 1,
  "checkIn": "2025-08-01",
  "checkOut": "2025-08-05"
}
\`\`\`

**What to update:** Remove `guestId` from the request body. The API now reads it from your JWT token.

---

## Timeline

- **Now** — v2 is available. v1 is deprecated.
- **Jan 1, 2026** — v1 will be removed. All v1 requests will return 410 Gone.
```

---

## Final Project Structure

```
airbnb-api/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   ├── prisma.ts
│   │   └── swagger.ts
│   ├── controllers/
│   │   ├── v1/
│   │   │   ├── auth.controller.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── listings.controller.ts
│   │   │   └── bookings.controller.ts
│   │   └── v2/
│   │       ├── auth.controller.ts
│   │       ├── users.controller.ts
│   │       ├── listings.controller.ts
│   │       └── bookings.controller.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   └── deprecation.middleware.ts
│   ├── routes/
│   │   ├── v1/
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── listings.routes.ts
│   │   │   └── bookings.routes.ts
│   │   └── v2/
│   │       ├── index.ts
│   │       ├── auth.routes.ts
│   │       ├── users.routes.ts
│   │       ├── listings.routes.ts
│   │       └── bookings.routes.ts
│   ├── services/
│   │   ├── listings.service.ts
│   │   ├── users.service.ts
│   │   └── bookings.service.ts
│   └── index.ts
├── MIGRATION.md
├── .env
├── .env.example
└── .gitignore
```

---

## Checklist

- [ ] All existing routes moved into `src/routes/v1/` and `src/controllers/v1/`
- [ ] Services layer created — no Prisma calls directly in controllers
- [ ] All v1 endpoints work under `/v1/...`
- [ ] v2 created with all 3 breaking changes implemented
- [ ] `GET /v1/listings/:id` returns `host` as string
- [ ] `GET /v2/listings/:id` returns `host` as full object
- [ ] `POST /v1/bookings` requires `guestId` in body
- [ ] `POST /v2/bookings` uses `req.userId` — no `guestId` in body
- [ ] Deprecation headers on all v1 responses (`Deprecation`, `Sunset`, `Link`)
- [ ] Unversioned routes redirect to v2 with 301
- [ ] Swagger documents both versions with correct server URLs
- [ ] v1 routes marked `deprecated: true` in Swagger — strikethrough visible in UI
- [ ] `MIGRATION.md` explains all breaking changes with before/after examples

---

## Further Research

- **Semantic versioning** — research `semver`. Understand the difference between major (breaking), minor (new features), and patch (bug fixes) versions and how it applies to APIs
- **API changelog** — look at how Stripe maintains their [API changelog](https://stripe.com/docs/upgrades). Research how to communicate API changes to developers effectively
- **Content negotiation** — research the `Accept` header and how it is used for header-based versioning. Understand `application/vnd.airbnb.v2+json`
