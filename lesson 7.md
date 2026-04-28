# Lesson 7: API Versioning

## Table of Contents
1. [What is API Versioning?](#what-is-api-versioning)
2. [Why Versioning Matters](#why-versioning-matters)
3. [Versioning Strategies](#versioning-strategies)
4. [URL Path Versioning](#url-path-versioning)
5. [Header Versioning](#header-versioning)
6. [Query Parameter Versioning](#query-parameter-versioning)
7. [Implementing URL Versioning in Express](#implementing-url-versioning-in-express)
8. [Structuring Versioned Code](#structuring-versioned-code)
9. [Deprecating Old Versions](#deprecating-old-versions)
10. [Versioning Best Practices](#versioning-best-practices)

---

## What is API Versioning?

Once your API is live and clients are using it — frontend apps, mobile apps, third-party integrations — you cannot just change it freely. If you rename a field, remove an endpoint, or change a response structure, every client that depends on the old behavior breaks.

**API versioning** is the practice of maintaining multiple versions of your API simultaneously so that:
- Existing clients keep working on the old version
- New clients use the latest version
- You can introduce breaking changes without breaking anyone

Think of it like a software release. When a company releases v2 of their app, v1 still works for users who haven't updated. The same principle applies to APIs.

---

## Why Versioning Matters

### What is a breaking change?

A **breaking change** is any change that causes existing clients to stop working correctly:

- Renaming a field: `pricePerNight` → `price`
- Removing a field from a response
- Changing a field's type: `id` from `number` to `string`
- Removing an endpoint
- Changing required fields on a request body
- Changing authentication behavior

### What is a non-breaking change?

These are safe to deploy without versioning:

- Adding a new optional field to a response
- Adding a new endpoint
- Adding a new optional request parameter
- Bug fixes that don't change the contract

### Real-world example

Imagine your Airbnb API returns:

```json
{
  "id": 1,
  "pricePerNight": 120,
  "host": "Alice Johnson"
}
```

Your mobile app reads `listing.host` as a string to display the host name.

Now you want to change `host` to return a full object:

```json
{
  "id": 1,
  "pricePerNight": 120,
  "host": {
    "id": 5,
    "name": "Alice Johnson",
    "avatar": "https://..."
  }
}
```

Every mobile app that reads `listing.host` as a string now crashes. Without versioning, you have no way to make this change safely.

With versioning:
- `GET /v1/listings/:id` — returns `host` as a string (old behavior, existing clients)
- `GET /v2/listings/:id` — returns `host` as an object (new behavior, new clients)

---

## Versioning Strategies

There are three main approaches. Each has tradeoffs.

### 1. URL Path Versioning

The version is part of the URL:

```
GET /v1/listings
GET /v2/listings
```

**Pros:**
- Immediately visible — you can see the version in the URL
- Easy to test in a browser or Postman
- Easy to route in Express
- Most widely used — Stripe, GitHub, Twitter all use this

**Cons:**
- URLs are longer
- Technically, the URL should identify a resource, not a version

### 2. Header Versioning

The version is sent in a custom request header:

```
GET /listings
Accept-Version: 2
```

or using the `Accept` header:

```
GET /listings
Accept: application/vnd.airbnb.v2+json
```

**Pros:**
- Clean URLs — the resource URL doesn't change
- Follows REST principles more strictly

**Cons:**
- Not visible in the URL — harder to test in a browser
- Clients must remember to send the header
- More complex to implement and document

### 3. Query Parameter Versioning

The version is a query parameter:

```
GET /listings?version=2
GET /listings?v=2
```

**Pros:**
- Easy to test — just add `?v=2` to any URL
- No URL structure changes

**Cons:**
- Query params are meant for filtering, not versioning
- Easy to forget or omit
- Caching can be tricky

### Which one to use?

**Use URL path versioning** for most projects. It is the most common, the most visible, and the easiest to implement and document. Stripe, GitHub, Twilio, and most major APIs use it.

---

## URL Path Versioning

This is the recommended approach. Every endpoint is prefixed with the version:

```
/v1/users
/v1/listings
/v1/bookings

/v2/users
/v2/listings
```

### How it looks in practice

```
# v1 — original API
GET  /v1/listings          → returns host as a string
POST /v1/bookings          → requires guestId in body

# v2 — updated API
GET  /v2/listings          → returns host as a full object
POST /v2/bookings          → guestId comes from JWT token, not body
```

Clients on v1 keep working. New clients use v2. Both run simultaneously.

---

## Header Versioning

The client sends the version in a header. Your middleware reads it and routes accordingly.

```typescript
// Client sends:
// GET /listings
// Accept-Version: 2

app.use((req, res, next) => {
  const version = req.headers["accept-version"] ?? "1";
  req.apiVersion = version;
  next();
});

app.get("/listings", (req, res) => {
  if (req.apiVersion === "2") {
    // return v2 response
  } else {
    // return v1 response
  }
});
```

This approach keeps URLs clean but adds complexity to every controller.

---

## Query Parameter Versioning

```typescript
// Client sends:
// GET /listings?v=2

app.get("/listings", (req, res) => {
  const version = req.query["v"] ?? "1";

  if (version === "2") {
    // return v2 response
  } else {
    // return v1 response
  }
});
```

Simple to implement but not recommended for production APIs.

---

## Implementing URL Versioning in Express

### Basic setup

```typescript
import express from "express";
import v1UsersRouter from "./routes/v1/users.routes.js";
import v2UsersRouter from "./routes/v2/users.routes.js";
import v1ListingsRouter from "./routes/v1/listings.routes.js";
import v2ListingsRouter from "./routes/v2/listings.routes.js";

const app = express();
app.use(express.json());

// v1 routes
app.use("/v1/users", v1UsersRouter);
app.use("/v1/listings", v1ListingsRouter);

// v2 routes
app.use("/v2/users", v2UsersRouter);
app.use("/v2/listings", v2ListingsRouter);
```

### Using Express Router for versioning

A cleaner approach — group all v1 routes under one router and all v2 routes under another:

```typescript
// src/routes/v1/index.ts
import { Router } from "express";
import usersRouter from "./users.routes.js";
import listingsRouter from "./listings.routes.js";
import bookingsRouter from "./bookings.routes.js";

const v1Router = Router();

v1Router.use("/users", usersRouter);
v1Router.use("/listings", listingsRouter);
v1Router.use("/bookings", bookingsRouter);

export default v1Router;
```

```typescript
// src/routes/v2/index.ts
import { Router } from "express";
import usersRouter from "./users.routes.js";
import listingsRouter from "./listings.routes.js";
import bookingsRouter from "./bookings.routes.js";

const v2Router = Router();

v2Router.use("/users", usersRouter);
v2Router.use("/listings", listingsRouter);
v2Router.use("/bookings", bookingsRouter);

export default v2Router;
```

```typescript
// src/index.ts
import v1Router from "./routes/v1/index.js";
import v2Router from "./routes/v2/index.js";

app.use("/v1", v1Router);
app.use("/v2", v2Router);
```

Now all v1 endpoints are under `/v1/...` and all v2 endpoints are under `/v2/...`.

---

## Structuring Versioned Code

### Folder structure

```
src/
├── controllers/
│   ├── v1/
│   │   ├── users.controller.ts
│   │   └── listings.controller.ts
│   └── v2/
│       ├── users.controller.ts
│       └── listings.controller.ts
├── routes/
│   ├── v1/
│   │   ├── index.ts
│   │   ├── users.routes.ts
│   │   └── listings.routes.ts
│   └── v2/
│       ├── index.ts
│       ├── users.routes.ts
│       └── listings.routes.ts
└── index.ts
```

### Sharing code between versions

Most of your code stays the same between versions. Only the parts that changed need to be different. Use shared utilities, services, and Prisma queries:

```typescript
// src/services/listings.service.ts — shared between v1 and v2
export async function getListingById(id: number) {
  return prisma.listing.findUnique({
    where: { id },
    include: { host: true, bookings: true },
  });
}
```

```typescript
// src/controllers/v1/listings.controller.ts
import { getListingById } from "../../services/listings.service.js";

export async function getListing(req: Request, res: Response) {
  const listing = await getListingById(parseInt(req.params["id"] as string));
  if (!listing) return res.status(404).json({ error: "Not found" });

  // v1 — return host as a string
  res.json({
    ...listing,
    host: listing.host.name,
  });
}
```

```typescript
// src/controllers/v2/listings.controller.ts
import { getListingById } from "../../services/listings.service.js";

export async function getListing(req: Request, res: Response) {
  const listing = await getListingById(parseInt(req.params["id"] as string));
  if (!listing) return res.status(404).json({ error: "Not found" });

  // v2 — return host as a full object
  res.json(listing);
}
```

The database query is shared. Only the response shape differs.

### Services layer

As your API grows, extract business logic into a **services layer** that both versions share:

```
src/
├── services/
│   ├── listings.service.ts    ← shared Prisma queries and business logic
│   ├── users.service.ts
│   └── bookings.service.ts
├── controllers/
│   ├── v1/                    ← format responses for v1
│   └── v2/                    ← format responses for v2
└── routes/
    ├── v1/
    └── v2/
```

This way, when you add a new version, you only write new controllers — not new database queries.

---

## Deprecating Old Versions

When you release v2, v1 does not disappear immediately. You deprecate it — warn clients that it will be removed in the future, giving them time to migrate.

### Deprecation header

Add a `Deprecation` header to all v1 responses to warn clients:

```typescript
// src/middlewares/deprecation.ts
import type { Request, Response, NextFunction } from "express";

export function deprecateV1(req: Request, res: Response, next: NextFunction) {
  // Warn clients that v1 is deprecated
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", "Sat, 01 Jan 2026 00:00:00 GMT"); // removal date
  res.setHeader(
    "Link",
    '<https://your-api.com/v2>; rel="successor-version"'
  );
  next();
}
```

Apply it to all v1 routes:

```typescript
import { deprecateV1 } from "./middlewares/deprecation.js";

app.use("/v1", deprecateV1, v1Router);
app.use("/v2", v2Router);
```

Now every v1 response includes headers telling clients:
- This version is deprecated
- It will be removed on a specific date
- Here is the link to the new version

### Deprecation timeline

A good deprecation timeline:
1. **Release v2** — announce v1 is deprecated, set a sunset date (at least 6 months away)
2. **Add deprecation headers** to all v1 responses
3. **Communicate** — email API users, update documentation, post in changelogs
4. **Monitor** — track how many clients are still using v1
5. **Sunset date** — remove v1 on the announced date

### Sunset — removing a version

When the sunset date arrives, return 410 Gone for all v1 requests:

```typescript
app.use("/v1", (req, res) => {
  res.status(410).json({
    error: "API v1 has been discontinued. Please migrate to v2.",
    documentation: "https://your-api.com/docs/migration-v1-to-v2",
  });
});
```

410 Gone is the correct status code — it means the resource existed but has been permanently removed.

---

## Versioning Best Practices

### Start with versioning from day one

Even if you only have v1, structure your routes as `/v1/...` from the beginning. Adding versioning later requires changing all your URLs which is itself a breaking change.

```typescript
// ✅ Do this from the start
app.use("/v1/users", usersRouter);

// ❌ Don't do this and add versioning later
app.use("/users", usersRouter);
```

### Only version when you have breaking changes

Do not create a new version for every small change. Only create v2 when you have actual breaking changes. Non-breaking changes (adding fields, adding endpoints) can go into the existing version.

### Keep versions small and focused

A new version should only change what needs to change. If only the listings endpoint changed, only `GET /v2/listings` needs to exist — everything else can still be on v1.

### Document the differences

When you release v2, document exactly what changed from v1:

```
## Migration Guide: v1 → v2

### GET /listings/:id
- v1: `host` field is a string (host's name)
- v2: `host` field is an object with `id`, `name`, `avatar`

### POST /bookings
- v1: requires `guestId` in request body
- v2: `guestId` is derived from the JWT token — remove it from the request body
```

### Use semantic versioning for major changes only

API versions (`v1`, `v2`) represent **major** versions — breaking changes. Minor improvements and bug fixes do not need a new version number.

### Never break v1 while maintaining it

Once v1 is live, treat it as frozen. Do not add new required fields, do not change response shapes, do not remove endpoints. Only bug fixes are acceptable.

---

## Summary

| Concept | What it is |
|---------|------------|
| Breaking change | A change that causes existing clients to stop working |
| Non-breaking change | Adding new fields or endpoints — safe to deploy without versioning |
| URL path versioning | Version in the URL: `/v1/listings`, `/v2/listings` — most common |
| Header versioning | Version in a request header: `Accept-Version: 2` |
| Query param versioning | Version as a query param: `/listings?v=2` |
| Deprecation | Warning clients that a version will be removed — add `Deprecation` header |
| Sunset | The date a deprecated version is removed — return 410 Gone after this date |
| Services layer | Shared business logic and database queries used by all versions |
| 410 Gone | HTTP status for a resource that existed but has been permanently removed |
| Migration guide | Documentation explaining what changed between versions |

---

**Resources:**
- [Stripe API Versioning](https://stripe.com/docs/api/versioning)
- [GitHub REST API Versioning](https://docs.github.com/en/rest/overview/api-versions)
- [OpenAPI Versioning Guide](https://swagger.io/blog/api-versioning/api-versioning-best-practices/)
- [RFC 8594 — Sunset Header](https://www.rfc-editor.org/rfc/rfc8594)
