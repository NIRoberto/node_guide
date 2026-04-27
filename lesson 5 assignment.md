# Lesson 5 Assignment: Airbnb API — Swagger Documentation

## Overview

Document the entire Airbnb API with Swagger. By the end, every endpoint has full interactive documentation — schemas, request bodies, responses, authentication — all accessible at `/api-docs`.

---

## Project Setup

Install:
```bash
npm install swagger-jsdoc swagger-ui-express
npm install -D @types/swagger-jsdoc @types/swagger-ui-express
```

Your folder structure after completing the assignment:

```
airbnb-api/
├── src/
│   ├── config/
│   │   ├── prisma.ts
│   │   └── swagger.ts          # new
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── users.controller.ts
│   │   ├── listings.controller.ts
│   │   └── bookings.controller.ts
│   ├── middlewares/
│   │   └── auth.middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── users.routes.ts
│   │   ├── listings.routes.ts
│   │   └── bookings.routes.ts
│   └── index.ts
├── prisma/
│   └── schema.prisma
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## Requirements

### Part 1 — Swagger Setup

Create `src/config/swagger.ts`:
- Define OpenAPI spec with `title: "Airbnb API"`, `version: "1.0.0"`, and a meaningful description
- Set server URL to `http://localhost:3000`
- Define `bearerAuth` security scheme under `components.securitySchemes` — this adds an **Authorize** button to the UI where you paste your JWT token once and it is sent with all subsequent requests
- Point `apis` to `"./src/routes/*.ts"` — swagger-jsdoc scans these files for `@swagger` comments
- Export `setupSwagger(app: Express)`:
  - Mount Swagger UI at `/api-docs`
  - Expose raw JSON spec at `/api-docs.json` — useful for importing into Postman
  - Log the docs URL on startup

Call `setupSwagger(app)` in `index.ts` after middleware, before routes.

---

### Part 2 — Define All Schemas

Add `@swagger` JSDoc comments at the top of the relevant route files to define reusable schemas in `components/schemas`. Define schemas **once** and reference with `$ref` everywhere — never duplicate.

**User** — `id` (integer), `name`, `email`, `username`, `phone`, `role` (host/guest), `avatar` (nullable), `bio` (nullable), `createdAt` (date-time). Add `example` values to every field.

**Listing** — `id`, `title`, `description`, `location`, `pricePerNight` (number), `guests` (integer), `type` (apartment/house/villa/cabin), `amenities` (array of strings), `rating` (nullable number), `userId`, `host` (nested User `$ref`), `createdAt`

**Booking** — `id`, `checkIn` (date-time), `checkOut` (date-time), `total` (number), `status` (confirmed/cancelled), `userId`, `listingId`, `user` (nested User `$ref`), `listing` (nested Listing `$ref`), `createdAt`

**Review** — `id`, `rating` (integer 1-5), `comment`, `userId`, `listingId`, `user` (nested User `$ref`), `createdAt`

**RegisterInput** — `name`, `email`, `username`, `phone`, `password`, `role` — mark all as required

**LoginInput** — `email`, `password` — both required

**CreateListingInput** — `title`, `description`, `location`, `pricePerNight`, `guests`, `type`, `amenities` — all required

**CreateBookingInput** — `listingId` (integer), `userId` (integer), `checkIn` (date-time), `checkOut` (date-time) — all required

**CreateReviewInput** — `userId` (integer), `rating` (integer 1-5), `comment` — all required

**ErrorResponse** — `error` (string), example: `"Resource not found"`

**AuthResponse** — `token` (string), `user` (User `$ref`)

> Use `nullable: true` for optional fields that can be null (avatar, bio, rating)

---

### Part 3 — Document Auth Routes

Add `@swagger` comments to every route in `auth.routes.ts`. Document **every possible response** — not just 200:

**POST /auth/register** — tag: Auth, requestBody: RegisterInput, responses: 201 (User), 400 (ErrorResponse), 409 (ErrorResponse — email already in use)

**POST /auth/login** — tag: Auth, requestBody: LoginInput, responses: 200 (AuthResponse), 400, 401

**GET /auth/me** — tag: Auth, security: bearerAuth, responses: 200 (User), 401

**POST /auth/change-password** — tag: Auth, security: bearerAuth, requestBody: `{ currentPassword: string, newPassword: string }`, responses: 200, 400, 401

**POST /auth/forgot-password** — tag: Auth, requestBody: `{ email: string }`, description: same response returned whether email exists or not, responses: 200

**POST /auth/reset-password/{token}** — tag: Auth, path param: `token` (string, required), requestBody: `{ password: string }`, responses: 200, 400

---

### Part 4 — Document Users Routes

Add `@swagger` comments to all routes in `users.routes.ts`:

**GET /users** — tag: Users, security: bearerAuth, query params: `page` (integer, default 1), `limit` (integer, default 10), responses: 200 (array of User), 401

**GET /users/{id}** — tag: Users, security: bearerAuth, path param: `id`, responses: 200 (User), 401, 404

**PUT /users/{id}** — tag: Users, security: bearerAuth, path param: `id`, requestBody: UpdateUserInput (all fields optional), responses: 200 (User), 400, 401, 404

**DELETE /users/{id}** — tag: Users, security: bearerAuth, path param: `id`, responses: 200, 401, 404

---

### Part 5 — Document Listings Routes

Add `@swagger` comments to all routes in `listings.routes.ts`:

**GET /listings** — tag: Listings, query params (all optional):
- `page` (integer, default: 1)
- `limit` (integer, default: 10)
- `location` (string) — filter by location
- `type` (string, enum: apartment/house/villa/cabin)
- `minPrice` (number)
- `maxPrice` (number)
- `guests` (integer)

Responses: 200 (paginated listings with `data` and `meta`)

**GET /listings/{id}** — tag: Listings, path param: `id`, responses: 200 (Listing with host and reviews), 404

**POST /listings** — tag: Listings, security: bearerAuth, requestBody: CreateListingInput, responses: 201 (Listing), 400, 401

**PUT /listings/{id}** — tag: Listings, security: bearerAuth, path param: `id`, requestBody: all Listing fields optional, responses: 200 (Listing), 401, 404

**DELETE /listings/{id}** — tag: Listings, security: bearerAuth, path param: `id`, responses: 200, 401, 404

**GET /listings/search** — tag: Listings, same query params as `GET /listings`, responses: 200 (paginated listings)

**GET /listings/stats** — tag: Listings, responses: 200 (`{ totalListings, averagePrice, byLocation, byType }`)

---

### Part 6 — Document Bookings Routes

Add `@swagger` comments to all routes in `bookings.routes.ts`:

**GET /bookings** — tag: Bookings, security: bearerAuth, query params: `page`, `limit`, responses: 200 (paginated bookings with user and listing)

**GET /bookings/{id}** — tag: Bookings, security: bearerAuth, path param: `id`, responses: 200 (Booking with user and listing), 401, 404

**GET /users/{id}/bookings** — tag: Bookings, security: bearerAuth, path param: `id` (user id), query params: `page`, `limit`, responses: 200 (paginated bookings), 401, 404

**POST /bookings** — tag: Bookings, security: bearerAuth, requestBody: CreateBookingInput, description: `total` is auto-calculated from `pricePerNight × nights`, responses: 201 (Booking), 400, 401, 404

**DELETE /bookings/{id}** — tag: Bookings, security: bearerAuth, summary: "Cancel a booking", path param: `id`, responses: 200, 401, 404

---

### Part 7 — Document Reviews Routes

Add `@swagger` comments to all routes in `reviews.routes.ts`:

**GET /listings/{id}/reviews** — tag: Reviews, path param: `id` (listing id), query params: `page`, `limit`, responses: 200 (paginated reviews with reviewer name and avatar), 404

**POST /listings/{id}/reviews** — tag: Reviews, security: bearerAuth, path param: `id` (listing id), requestBody: CreateReviewInput, description: rating must be between 1 and 5, responses: 201 (Review), 400, 401, 404

**DELETE /reviews/{id}** — tag: Reviews, security: bearerAuth, path param: `id`, responses: 200, 401, 404

---

## Testing

Verify your documentation works correctly:

- Open `http://localhost:3000/api-docs` — all endpoints should be visible, grouped by tag
- Call `POST /auth/login` from Swagger UI → copy the token → click **Authorize** → paste token
- Test `GET /users` — should work with the token
- Test `POST /listings` — should show the request body form with all fields
- Test `GET /listings` — should show all query params as input fields
- Go to `http://localhost:3000/api-docs.json` — raw OpenAPI JSON should be visible
- Import `http://localhost:3000/api-docs.json` into Postman — all endpoints should appear

---

## Final Checklist

- [ ] Swagger UI accessible at `/api-docs`
- [ ] Raw spec accessible at `/api-docs.json`
- [ ] All endpoints documented with correct tags
- [ ] Every endpoint has all possible responses documented — not just 200
- [ ] All schemas defined once and referenced with `$ref` — no duplication
- [ ] Bearer auth works in Swagger UI — lock icon shows on protected routes
- [ ] Query params documented on all list endpoints
- [ ] Path params documented on all `/:id` endpoints
- [ ] File upload endpoints use `multipart/form-data`
- [ ] `example` values on all schema fields
- [ ] `nullable: true` on optional fields

---

## What You Should Practice

- Setting up Swagger in an Express TypeScript project
- Writing JSDoc `@swagger` comments for routes
- Defining reusable schemas with `$ref` to avoid duplication
- Documenting all HTTP methods, parameters, request bodies, and responses
- Using Swagger UI as a testing tool instead of Postman
- Documenting paginated responses with `meta` objects
- Documenting file upload endpoints with `multipart/form-data`
