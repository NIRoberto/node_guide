# Lesson 5 Assignment: Airbnb API — Swagger Documentation & Deployment

## Overview

This is the final assignment. You will document the entire Airbnb API using Swagger/OpenAPI and deploy it to a live production environment with a hosted PostgreSQL database. By the end, your Airbnb API will be publicly accessible on the internet with full interactive documentation.

---

## What You're Completing

- Full Swagger documentation for every endpoint
- Live production deployment on Railway or Render
- Hosted PostgreSQL database
- Production-ready environment configuration

---

## Part 1 — Swagger Setup

### Tasks

Install Swagger packages:
```bash
npm install swagger-jsdoc swagger-ui-express
npm install -D @types/swagger-jsdoc @types/swagger-ui-express
```

Create `src/config/swagger.ts`:
- Define the OpenAPI spec with:
  - `title`: `"Airbnb API"`
  - `version`: `"1.0.0"`
  - `description`: `"REST API for Airbnb listings, users, and bookings"`
- Set the server URL dynamically — `process.env["API_URL"]` in production, `http://localhost:3000` in development
- Define `bearerAuth` security scheme under `components.securitySchemes`
- Point `apis` to `./src/routes/*.ts`
- Export `setupSwagger(app)` that mounts Swagger UI at `/api-docs` and exposes raw JSON at `/api-docs.json`

Call `setupSwagger(app)` in `index.ts` before your routes.

Add to `.env`:
```
API_URL=https://your-app.railway.app
NODE_ENV=development
```

### Best Practices

- The `/api-docs.json` endpoint lets Postman import your entire API spec automatically — very useful for testing
- Keep the OpenAPI version at `3.0.0` — it's the most widely supported

---

## Part 2 — Define All Schemas

### Tasks

Add `@swagger` JSDoc comments to define reusable schemas. Define all of these in `components/schemas`:

**User** — id, name, email, username, phone, role, avatar, bio, createdAt

**Listing** — id, title, description, location, pricePerNight, guests, type, amenities, rating, coverImage, hostId, host (nested User), createdAt

**Booking** — id, checkIn, checkOut, totalPrice, status, guestId, guest (nested User), listingId, listing (nested Listing), createdAt

**RegisterInput** — name, email, username, phone, password, role (mark all required except role)

**LoginInput** — email, password (both required)

**CreateListingInput** — title, description, location, pricePerNight, guests, type, amenities (all required)

**CreateBookingInput** — listingId, checkIn, checkOut (all required)

**ErrorResponse** — error (string)

**AuthResponse** — token (string), user (User)

### Best Practices

- Define schemas once and reference with `$ref` everywhere — never duplicate
- Add `example` values to every field — makes the docs much more useful for developers reading them
- Use `nullable: true` for optional fields that can be null (avatar, rating, bio)

---

## Part 3 — Document Auth Routes

### Tasks

Add `@swagger` comments to every route in `auth.routes.ts`:

**POST /auth/register** — tag: Auth, requestBody: RegisterInput, responses: 201 (User), 400, 409

**POST /auth/login** — tag: Auth, requestBody: LoginInput, responses: 200 (AuthResponse), 400, 401

**GET /auth/me** — tag: Auth, security: bearerAuth, responses: 200 (User), 401

**POST /auth/change-password** — tag: Auth, security: bearerAuth, requestBody: `{ currentPassword, newPassword }`, responses: 200, 400, 401

**POST /auth/forgot-password** — tag: Auth, requestBody: `{ email }`, responses: 200

**POST /auth/reset-password/{token}** — tag: Auth, path param: token, requestBody: `{ password }`, responses: 200, 400

---

## Part 4 — Document Users, Listings & Bookings Routes

### Tasks

Add `@swagger` comments to all routes in `users.routes.ts`, `listings.routes.ts`, and `bookings.routes.ts`.

For each route document:
- Summary and description
- Tags: `[Users]`, `[Listings]`, or `[Bookings]`
- Security (`bearerAuth`) where required
- Path parameters (`:id`)
- Query parameters where applicable:
  - `GET /listings` — `location`, `type`, `maxPrice`, `page`, `limit`
  - `GET /users/:id/listings` — no extra params
  - `GET /users/:id/bookings` — no extra params
- Request body schema
- All possible responses: 200/201, 400, 401, 403, 404, 409

Make sure to document:
- `PATCH /bookings/:id/status` — accepts `{ status }` in body
- `GET /users/:id/listings` — returns listings for a specific host
- `GET /users/:id/bookings` — returns bookings for a specific guest

### Best Practices

- Document every possible response — not just the happy path
- Write meaningful descriptions — explain business rules in the description (e.g. "Only the listing's host can update it")
- Use tags consistently — all listing routes under `Listings`, all booking routes under `Bookings`

---

## Part 5 — Document Upload Routes

### Tasks

Add `@swagger` comments to all routes in `upload.routes.ts`.

For file upload endpoints use `multipart/form-data`:

```yaml
requestBody:
  required: true
  content:
    multipart/form-data:
      schema:
        type: object
        properties:
          image:
            type: string
            format: binary
            description: Image file (jpeg, png, webp — max 5MB)
```

For multiple file upload (`POST /listings/:id/photos`):
```yaml
photos:
  type: array
  items:
    type: string
    format: binary
  description: Up to 5 image files
```

Document all 4 upload endpoints with correct content types, security, and responses.

---

## Part 6 — Prepare for Production

### Tasks

1. Add scripts to `package.json`:
   ```json
   "build": "tsc",
   "start": "node dist/index.js",
   "migrate": "prisma migrate deploy"
   ```

2. Verify `npm run build` compiles without TypeScript errors

3. Verify `npm start` runs the compiled output correctly

4. Create `.env.example` with all variable names:
   ```
   DATABASE_URL=
   JWT_SECRET=
   JWT_EXPIRES_IN=
   EMAIL_HOST=
   EMAIL_PORT=
   EMAIL_USER=
   EMAIL_PASS=
   EMAIL_FROM=
   CLOUDINARY_CLOUD_NAME=
   CLOUDINARY_API_KEY=
   CLOUDINARY_API_SECRET=
   PORT=
   NODE_ENV=
   API_URL=
   ```

5. Make sure `PORT` is read dynamically:
   ```typescript
   const PORT = Number(process.env["PORT"]) || 3000;
   ```

6. Add a **global error handler** in `index.ts` — a middleware with 4 parameters `(err, req, res, next)` that catches unhandled errors and returns 500 with a generic message

7. Add a **404 handler** after all routes — returns `{ error: "Route not found" }` for unknown routes

8. Add a **health check endpoint** `GET /health` — returns `{ status: "ok", timestamp: new Date() }`

### Best Practices

- Test your production build locally before deploying: `npm run build && npm start`
- The global error handler should log the full error server-side but only send a generic message to the client
- The health check endpoint is used by Railway/Render to verify your app is running

---

## Part 7 — Deploy to Railway

### Tasks

1. Push your code to GitHub — verify `.env` is NOT in the repository

2. Go to [railway.app](https://railway.app) and create a new project from your GitHub repo

3. Add a **PostgreSQL** database service to your project

4. Set all environment variables in Railway's Variables tab

5. Set build and start commands in Railway's Settings:
   - Build: `npm run build && npx prisma migrate deploy`
   - Start: `npm start`

6. Deploy and verify:
   - API responds at `https://your-app.railway.app`
   - Swagger UI works at `https://your-app.railway.app/api-docs`
   - Register a user through Swagger UI
   - Login and copy the token
   - Click **Authorize** in Swagger UI and paste the token
   - Create a listing using the authenticated request
   - Make a booking
   - Upload an avatar

### Best Practices

- Use a strong, randomly generated `JWT_SECRET` in production — never reuse your development secret
- Set `NODE_ENV=production` in Railway's environment variables
- After deploying, test the full user journey: register → login → create listing → make booking

---

## Part 8 — Add Request Logging

### Tasks

Install Morgan:
```bash
npm install morgan
npm install -D @types/morgan
```

Add to `index.ts`:
- Use `morgan("dev")` in development
- Use `morgan("combined")` in production (check `process.env["NODE_ENV"]`)

Morgan logs every request with method, URL, status code, and response time — essential for debugging production issues.

### Best Practices

- `morgan("combined")` in production logs the full request including IP address and user agent — useful for security auditing
- Never log request bodies in production — they may contain passwords or sensitive data

---

## Final Project Structure

```
airbnb-api/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   ├── cloudinary.ts
│   │   ├── email.ts
│   │   ├── multer.ts
│   │   ├── prisma.ts
│   │   └── swagger.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── upload.controller.ts
│   │   ├── users.controller.ts
│   │   ├── listings.controller.ts
│   │   └── bookings.controller.ts
│   ├── middlewares/
│   │   └── auth.middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── upload.routes.ts
│   │   ├── users.routes.ts
│   │   ├── listings.routes.ts
│   │   └── bookings.routes.ts
│   ├── templates/
│   │   └── emails.ts
│   └── index.ts
├── .env
├── .env.example
├── .gitignore
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

---

## Final Checklist

- [ ] Swagger UI accessible at `/api-docs`
- [ ] All endpoints documented with schemas, parameters, and responses
- [ ] Bearer auth works in Swagger UI — can test protected endpoints
- [ ] File upload endpoints documented with `multipart/form-data`
- [ ] `npm run build` compiles without errors
- [ ] `npm start` runs the production build
- [ ] `.env` is NOT in the repository
- [ ] `.env.example` exists with all variable names
- [ ] App deployed and accessible at a public URL
- [ ] Database migrations ran in production
- [ ] Full user journey works in production: register → login → create listing → book → upload photos
- [ ] Health check at `/health` returns 200
- [ ] Swagger UI works in production

---

## Further Research

- Research **API versioning** — how do you handle breaking changes? Look at how Stripe versions their API (`/v1/`, `/v2/`). Understand URL versioning vs header versioning
- Look up **CORS** — research the `cors` package for Express. Understand why browsers block cross-origin requests and how to configure it correctly for your Airbnb frontend
- Research **helmet.js** — security middleware for Express. Read what each of its protections does
- Look up **CI/CD with GitHub Actions** — understand how to automatically run tests and deploy on every push to main. This is how professional teams ship code
- Research **database connection pooling** — look up PgBouncer and why it matters when your Airbnb API scales to multiple server instances
- Read about the **12-Factor App methodology** — 12 best practices for production applications. You've already applied most of them in this course without knowing it
