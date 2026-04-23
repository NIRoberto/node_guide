# Lesson 5 Assignment: Airbnb API — Swagger Documentation & Deployment

## Overview

Document the entire Airbnb API with Swagger and deploy it to a live production server with a hosted PostgreSQL database. By the end, your API is publicly accessible on the internet with full interactive documentation.

---

## Part 1 — Swagger Setup

Install:
```bash
npm install swagger-jsdoc swagger-ui-express
npm install -D @types/swagger-jsdoc @types/swagger-ui-express
```

Add to `.env`:
```
NODE_ENV=development
API_URL=https://your-app.railway.app
```

Create `src/config/swagger.ts`:
- Define OpenAPI spec: `title: "Airbnb API"`, `version: "1.0.0"`, meaningful description
- Set server URL dynamically — `process.env["API_URL"]` in production, `http://localhost:3000` in development (check `NODE_ENV`)
- Define `bearerAuth` security scheme under `components.securitySchemes` — this adds an **Authorize** button to the UI where you paste your JWT token once and it is sent with all subsequent requests
- Point `apis` to `"./src/routes/*.ts"` — swagger-jsdoc scans these files for `@swagger` comments
- Export `setupSwagger(app: Express)`:
  - Mount Swagger UI at `/api-docs`
  - Expose raw JSON spec at `/api-docs.json` — useful for importing into Postman automatically
  - Log the docs URL on startup

Call `setupSwagger(app)` in `index.ts` after middleware, before routes.

---

## Part 2 — Define All Schemas

Add `@swagger` JSDoc comments at the top of `users.routes.ts` to define reusable schemas in `components/schemas`. Define schemas once and reference with `$ref` everywhere — never duplicate:

**User** — id (integer), name, email, username, phone, role (HOST/GUEST), avatar (nullable), bio (nullable), createdAt (date-time). Add `example` values to every field

**Listing** — id, title, description, location, pricePerNight (number), guests (integer), type (APARTMENT/HOUSE/VILLA/CABIN), amenities (array of strings), rating (nullable), hostId, host (nested User), createdAt

**Booking** — id, checkIn (date-time), checkOut (date-time), totalPrice, status (PENDING/CONFIRMED/CANCELLED), guestId, guest (nested User), listingId, listing (nested Listing), createdAt

**RegisterInput** — name, email, username, phone, password, role — mark name/email/username/phone/password as required

**LoginInput** — email, password — both required

**CreateListingInput** — title, description, location, pricePerNight, guests, type, amenities — all required

**CreateBookingInput** — listingId (integer), checkIn (date-time), checkOut (date-time) — all required

**ErrorResponse** — error (string), example: `"Resource not found"`

**AuthResponse** — token (string), user (User `$ref`)

> Use `nullable: true` for optional fields that can be null (avatar, bio, rating)

---

## Part 3 — Document Auth Routes

Add `@swagger` comments to every route in `auth.routes.ts`. Document every possible response — not just 200:

**POST /auth/register** — tag: Auth, requestBody: RegisterInput, responses: 201 (User), 400 (ErrorResponse), 409 (ErrorResponse)

**POST /auth/login** — tag: Auth, requestBody: LoginInput, responses: 200 (AuthResponse), 400, 401

**GET /auth/me** — tag: Auth, security: bearerAuth, responses: 200 (User), 401

**POST /auth/change-password** — tag: Auth, security: bearerAuth, requestBody: `{ currentPassword: string, newPassword: string }`, responses: 200, 400, 401

**POST /auth/forgot-password** — tag: Auth, requestBody: `{ email: string }`, description: same response returned whether email exists or not, responses: 200

**POST /auth/reset-password/{token}** — tag: Auth, path param: `token` (string, required, description: "Token from the reset email link — expires in 1 hour, single use"), requestBody: `{ password: string }`, responses: 200, 400

---

## Part 4 — Document Listings Routes

Add `@swagger` comments to all routes in `listings.routes.ts`:

**GET /listings** — tag: Listings, query params (all optional):
- `location` (string) — case-insensitive partial match
- `type` (string, enum: APARTMENT/HOUSE/VILLA/CABIN)
- `maxPrice` (number)
- `page` (integer, default: 1)
- `limit` (integer, default: 10)
- `sortBy` (string, enum: pricePerNight/createdAt)
- `order` (string, enum: asc/desc)
- Responses: 200 (array of Listing)

**GET /listings/{id}** — tag: Listings, path param: id, responses: 200 (Listing with host and bookings), 404

**POST /listings** — tag: Listings, security: bearerAuth, description: HOST role required, requestBody: CreateListingInput, responses: 201, 400, 401, 403

**PUT /listings/{id}** — tag: Listings, security: bearerAuth, description: only the listing's host can update, requestBody: all Listing fields optional, responses: 200, 401, 403, 404

**DELETE /listings/{id}** — tag: Listings, security: bearerAuth, responses: 200, 401, 403, 404

**GET /users/{id}/listings** — tag: Listings, path param: id (host's user id), responses: 200 (array of Listing), 404

---

## Part 5 — Document Bookings Routes

Add `@swagger` comments to all routes in `bookings.routes.ts`:

**GET /bookings** — tag: Bookings, security: bearerAuth, responses: 200 (array of Booking)

**GET /bookings/{id}** — tag: Bookings, security: bearerAuth, responses: 200 (Booking with guest and listing), 404

**POST /bookings** — tag: Bookings, security: bearerAuth, description: GUEST role required, checkIn must be before checkOut and in the future, returns 409 if listing already booked for those dates, requestBody: CreateBookingInput, responses: 201, 400, 401, 403, 404, 409

**DELETE /bookings/{id}** — tag: Bookings, security: bearerAuth, summary: "Cancel a booking", description: only the booking's guest can cancel, status set to CANCELLED not deleted, responses: 200, 400 (already cancelled), 401, 403, 404

**PATCH /bookings/{id}/status** — tag: Bookings, security: bearerAuth, requestBody: `{ status: string }` (enum: PENDING/CONFIRMED/CANCELLED), responses: 200, 400, 401, 404

**GET /users/{id}/bookings** — tag: Bookings, security: bearerAuth, path param: id (guest's user id), responses: 200 (array of Booking), 404

---

## Part 6 — Document Upload Routes

Add `@swagger` comments to all routes in `upload.routes.ts`. File upload endpoints use `multipart/form-data` — not JSON:

**POST /users/{id}/avatar** — tag: Users, security: bearerAuth, description: users can only upload their own avatar, accepted formats jpeg/png/webp, max 5MB, uploading replaces the old avatar automatically:
```yaml
requestBody:
  required: true
  content:
    multipart/form-data:
      schema:
        type: object
        required: [image]
        properties:
          image:
            type: string
            format: binary
            description: Profile picture (jpeg, png, webp — max 5MB)
```
Responses: 200 (User), 400, 401, 403, 404

**DELETE /users/{id}/avatar** — tag: Users, security: bearerAuth, responses: 200, 400, 401, 403, 404

**POST /listings/{id}/photos** — tag: Listings, security: bearerAuth, description: only the host can upload, max 5 photos per listing:
```yaml
requestBody:
  required: true
  content:
    multipart/form-data:
      schema:
        type: object
        properties:
          photos:
            type: array
            items:
              type: string
              format: binary
            description: Up to 5 image files (jpeg, png, webp — max 5MB each)
```
Responses: 200 (Listing with photos), 400, 401, 403, 404

**DELETE /listings/{id}/photos/{photoId}** — tag: Listings, security: bearerAuth, path params: id, photoId, responses: 200, 401, 403, 404

---

## Part 7 — Prepare for Production

1. Add scripts to `package.json`:
   ```json
   "build": "tsc",
   "start": "node dist/index.js",
   "migrate": "prisma migrate deploy"
   ```

2. Run `npm run build` — fix all TypeScript errors before deploying

3. Test locally: `npm run build && npm start` — verify it works before pushing

4. Update `.env.example` with all variables:
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

5. Make `PORT` dynamic in `index.ts`:
   ```typescript
   const PORT = Number(process.env["PORT"]) || 3000;
   ```

6. Add **global error handler** as the last middleware in `index.ts` — 4 parameters `(err, req, res, next)`. Log full error server-side, return 500 with `"Something went wrong"` to client — never expose raw error messages

7. Add **404 handler** just before the global error handler — returns `{ error: "Route not found" }` for unknown routes

8. Add **health check** `GET /health` — returns `{ status: "ok", uptime: process.uptime(), timestamp: new Date() }`. Hosting platforms ping this to verify your app is running

---

## Part 8 — Deploy to Railway

1. Verify `.env` is NOT in the repository before pushing:
   ```bash
   git status   # .env must not appear
   ```

2. Push to GitHub

3. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo

4. Add PostgreSQL: New → Database → PostgreSQL — Railway automatically adds `DATABASE_URL` to your env vars

5. Set all other env variables in Railway's **Variables** tab — use a strong randomly generated `JWT_SECRET`, never reuse your development secret

6. Set in Railway **Settings → Deploy**:
   - Build Command: `npm run build && npx prisma migrate deploy`
   - Start Command: `npm start`

7. Deploy and verify the full user journey in production:
   - Open `https://your-app.railway.app/api-docs` — Swagger UI loads
   - Register a user
   - Login, copy the token
   - Click **Authorize** in Swagger UI, paste the token
   - Create a listing (as host)
   - Make a booking (as guest)
   - Upload an avatar
   - Check welcome email arrived in inbox

---

## Part 9 — Add Request Logging

Install:
```bash
npm install morgan
npm install -D @types/morgan
```

Add as the very first middleware in `index.ts`:
```typescript
import morgan from "morgan";
app.use(process.env["NODE_ENV"] === "production" ? morgan("combined") : morgan("dev"));
```

> `morgan("combined")` in production logs IP address, user agent, and response time — the standard format for log analysis tools. Never log request bodies — they may contain passwords

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
- [ ] All endpoints documented with correct schemas and responses
- [ ] Every endpoint has all possible responses documented — not just 200
- [ ] Bearer auth works in Swagger UI
- [ ] File upload endpoints use `multipart/form-data` in docs
- [ ] `npm run build` compiles without errors
- [ ] `npm start` runs the production build
- [ ] `PORT` read from `process.env` with fallback
- [ ] `.env` NOT in the repository
- [ ] `.env.example` exists with all variable names
- [ ] Global error handler returns JSON, not HTML
- [ ] 404 handler catches unknown routes
- [ ] Health check at `/health` returns 200
- [ ] App deployed and accessible at a public URL
- [ ] Database migrations ran in production
- [ ] Full user journey works in production
- [ ] Welcome email arrives in inbox after registration
- [ ] Swagger UI works in production

---

## Further Research

- **API versioning** — how do you handle breaking changes? Look at how Stripe versions their API (`/v1/`, `/v2/`). Understand URL versioning vs header versioning
- **CORS** — research the `cors` package. Understand why browsers block cross-origin requests and how to configure it for your Airbnb frontend
- **helmet.js** — security middleware for Express. Read what each header protection does
- **CI/CD with GitHub Actions** — how to automatically deploy on every push to main
- **12-Factor App methodology** — 12 best practices for production apps. You have already applied most of them in this course
