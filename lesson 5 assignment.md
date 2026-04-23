# Lesson 5 Assignment: Airbnb API — Swagger Documentation & Deployment

## Overview

This is the final assignment. Your Airbnb API is fully functional — it has a database, authentication, emails, and file uploads. But right now it only exists on your laptop. Nobody else can use it.

In this assignment you will do two things:

1. **Document the API with Swagger** — so any developer can understand and test every endpoint without reading your source code
2. **Deploy the API to production** — so it runs on a real server, accessible to anyone on the internet, 24/7

You are completing the same `airbnb-api` project. This is the final step that turns your local project into a real, live product.

---

## Why Documentation Matters

Imagine joining a team and being handed an API with no documentation. You have no idea what endpoints exist, what fields they expect, what they return, or what errors they produce. You have to read through every controller file to figure it out. That is a terrible experience.

Swagger solves this. It generates an interactive web page from comments in your code. Any developer — frontend, mobile, or backend — can open `/api-docs`, see every endpoint, read what it does, and test it directly in the browser without writing a single line of code.

**Why Swagger over writing a README:** Documentation written separately from code goes out of date. When you add a new field to a response, you have to remember to update the README. With Swagger, the documentation lives next to the code — it is much easier to keep in sync.

---

## Why Deployment Matters

A local server is only accessible on your machine. Deployment puts your app on a server that runs 24/7, has a public URL, and can be accessed by anyone in the world. This is what turns a project into a product.

**Why you cannot just leave it running on your laptop:** Your laptop sleeps, restarts, and is not always connected to the internet. A production server runs continuously, has a stable IP address, and is managed by professionals.

**Why environment variables are different in production:** Your `.env` file stays on your laptop — it is in `.gitignore` and never pushed to GitHub. In production, you set environment variables through the hosting platform's dashboard. They are injected into `process.env` when your app starts, just like a `.env` file, but stored securely.

---

## What You're Completing

- Full Swagger documentation for every endpoint in the Airbnb API
- Live production deployment on Railway
- Hosted PostgreSQL database
- Production-ready environment and build configuration

---

## Part 1 — Swagger Setup

### Why this step exists

Swagger UI reads an OpenAPI specification — a JSON document that describes your entire API. `swagger-jsdoc` generates this spec automatically from JSDoc comments you write above your route definitions. `swagger-ui-express` serves the spec as a beautiful interactive web page.

**Why you set the server URL dynamically:** In development, your API runs at `http://localhost:3000`. In production, it runs at `https://your-app.railway.app`. The Swagger UI needs to know the correct URL to send test requests to. Reading it from an environment variable means the same code works in both environments.

**Why you expose `/api-docs.json`:** The raw JSON spec can be imported directly into Postman — it creates a complete Postman collection with all your endpoints automatically. It can also be used to generate client SDKs in other languages.

### Tasks

Install Swagger packages:
```bash
npm install swagger-jsdoc swagger-ui-express
npm install -D @types/swagger-jsdoc @types/swagger-ui-express
```

Create `src/config/swagger.ts`:
- Define the OpenAPI spec with `title: "Airbnb API"`, `version: "1.0.0"`, and a meaningful description
- Set the server URL: use `process.env["API_URL"]` in production, `http://localhost:3000` in development — check `process.env["NODE_ENV"] === "production"`
- Define the `bearerAuth` security scheme under `components.securitySchemes` — this adds an **Authorize** button to the Swagger UI where you paste your JWT token once and it is sent with all subsequent requests
- Point `apis` to `"./src/routes/*.ts"` — swagger-jsdoc scans these files for `@swagger` comments
- Export `setupSwagger(app: Express)` that:
  - Mounts Swagger UI at `/api-docs`
  - Exposes the raw JSON spec at `/api-docs.json`
  - Logs the docs URL to the console on startup

Call `setupSwagger(app)` in `index.ts` after middleware but before routes.

Add to `.env`:
```
NODE_ENV=development
API_URL=https://your-app.railway.app
```

### Best Practices

- Call `setupSwagger` before mounting routes — the spec is generated from route file comments, but the UI itself should be available regardless
- The `/api-docs.json` endpoint is extremely useful — share it with frontend developers so they can import the entire API into Postman with one click

---

## Part 2 — Define All Schemas

### Why this step exists

Schemas define the shape of your data — what a User looks like, what a Listing contains, what a request body expects. You define them once in `components/schemas` and reference them everywhere with `$ref`. This means if you add a field to User, you update the schema in one place and every endpoint that references it is automatically updated.

**Why `example` values matter:** Without examples, a developer reading your docs sees `type: string` and has no idea what a valid value looks like. With examples, they see `"alice@gmail.com"` and immediately understand. Good examples make documentation actually useful.

### Tasks

Add `@swagger` JSDoc comments to define reusable schemas. Place them at the top of `users.routes.ts` before the router definition:

**User** — id (integer), name (string), email (string), username (string), phone (string), role (string, enum: HOST/GUEST), avatar (string, nullable), bio (string, nullable), createdAt (string, format: date-time)

**Listing** — id, title, description, location, pricePerNight (number), guests (integer), type (string, enum: APARTMENT/HOUSE/VILLA/CABIN), amenities (array of strings), rating (number, nullable), hostId (integer), host (nested User object), createdAt

**Booking** — id, checkIn (string, format: date-time), checkOut (string, format: date-time), totalPrice (number), status (string, enum: PENDING/CONFIRMED/CANCELLED), guestId, guest (nested User), listingId, listing (nested Listing), createdAt

**RegisterInput** — name, email, username, phone, password, role — mark name, email, username, phone, password as required

**LoginInput** — email, password — both required

**CreateListingInput** — title, description, location, pricePerNight, guests, type, amenities — all required

**CreateBookingInput** — listingId (integer), checkIn (string, format: date-time), checkOut (string, format: date-time) — all required

**ErrorResponse** — error (string) with example `"Resource not found"`

**AuthResponse** — token (string), user (User schema reference)

### Best Practices

- Add `example` values to every single field — documentation without examples is much less useful
- Use `nullable: true` for optional fields that can be null (avatar, bio, rating)
- Mark required fields explicitly with the `required` array — this tells developers exactly what they must send

---

## Part 3 — Document Auth Routes

### Why this step exists

Auth routes are the entry point to your entire API. Every developer using your API needs to understand how to register, log in, and get a token before they can do anything else. These docs must be crystal clear.

**Why you document every possible response:** A developer integrating your API needs to know what to expect when something goes wrong — not just when it succeeds. If you only document 200 responses, they have no idea how to handle a 401 or 409 in their frontend code.

### Tasks

Add `@swagger` JSDoc comments to every route in `auth.routes.ts`:

**POST /auth/register:**
- Tag: `[Auth]`
- Summary: `"Register a new user account"`
- Description: explain that `role` determines whether the user is a HOST or GUEST, and that hosts can create listings while guests can make bookings
- RequestBody: `RegisterInput` schema, required: true
- Responses: 201 (User schema), 400 (ErrorResponse — missing fields or weak password), 409 (ErrorResponse — email already registered)

**POST /auth/login:**
- Tag: `[Auth]`
- Summary: `"Login and receive a JWT token"`
- Description: explain that the returned token must be sent as `Authorization: Bearer <token>` on all protected requests
- RequestBody: `LoginInput` schema
- Responses: 200 (AuthResponse schema), 400 (ErrorResponse), 401 (ErrorResponse — invalid credentials)

**GET /auth/me:**
- Tag: `[Auth]`
- Security: `bearerAuth`
- Summary: `"Get the currently authenticated user's profile"`
- Description: explain that hosts get their listings included, guests get their bookings included
- Responses: 200 (User schema), 401 (ErrorResponse)

**POST /auth/change-password:**
- Tag: `[Auth]`
- Security: `bearerAuth`
- Summary: `"Change the authenticated user's password"`
- RequestBody: inline schema with `currentPassword` (string, required) and `newPassword` (string, required, min 8 chars)
- Responses: 200 (success message object), 400 (ErrorResponse), 401 (ErrorResponse — wrong current password)

**POST /auth/forgot-password:**
- Tag: `[Auth]`
- Summary: `"Request a password reset email"`
- Description: explain that the same response is returned whether the email exists or not — this is intentional for security
- RequestBody: inline schema with `email` (string, required)
- Responses: 200 (success message object — always returned)

**POST /auth/reset-password/{token}:**
- Tag: `[Auth]`
- Summary: `"Reset password using the token from the reset email"`
- Description: explain that the token comes from the email link, expires in 1 hour, and can only be used once
- Path parameter: `token` (string, required, description: "The reset token from the email link")
- RequestBody: inline schema with `password` (string, required, min 8 chars)
- Responses: 200 (success message), 400 (ErrorResponse — invalid or expired token)

---

## Part 4 — Document Listings Routes

### Why this step exists

Listings are the core resource of your Airbnb API. Documenting the query parameters for filtering and pagination is especially important — without this, developers have no idea these features exist.

### Tasks

Add `@swagger` comments to all routes in `listings.routes.ts`. Place the schema definitions at the top of the file.

**GET /listings:**
- Tag: `[Listings]`
- Summary: `"Get all listings with optional filtering and pagination"`
- Description: explain all available filters
- Query parameters (all optional):
  - `location` (string) — filter by location, case-insensitive partial match
  - `type` (string, enum: APARTMENT/HOUSE/VILLA/CABIN) — filter by property type
  - `maxPrice` (number) — filter listings with pricePerNight ≤ this value
  - `page` (integer, default: 1) — page number for pagination
  - `limit` (integer, default: 10) — number of results per page
  - `sortBy` (string, enum: pricePerNight/createdAt) — field to sort by
  - `order` (string, enum: asc/desc) — sort direction
- Responses: 200 (array of Listing schemas)

**GET /listings/{id}:**
- Tag: `[Listings]`
- Path parameter: `id` (integer, required)
- Responses: 200 (Listing schema with host and bookings), 404 (ErrorResponse)

**POST /listings:**
- Tag: `[Listings]`
- Security: `bearerAuth`
- Description: explain that only users with role HOST can create listings
- RequestBody: `CreateListingInput` schema
- Responses: 201 (Listing schema), 400 (ErrorResponse), 401, 403 (ErrorResponse — not a host)

**PUT /listings/{id}:**
- Tag: `[Listings]`
- Security: `bearerAuth`
- Description: explain that only the listing's host can update it
- Path parameter: `id`
- RequestBody: inline schema with all Listing fields optional
- Responses: 200 (Listing schema), 401, 403 (ErrorResponse — not the owner), 404

**DELETE /listings/{id}:**
- Tag: `[Listings]`
- Security: `bearerAuth`
- Description: explain ownership requirement
- Responses: 200 (success message), 401, 403, 404

**GET /users/{id}/listings:**
- Tag: `[Listings]`
- Summary: `"Get all listings by a specific host"`
- Path parameter: `id` (the host's user id)
- Responses: 200 (array of Listing schemas), 404

---

## Part 5 — Document Bookings Routes

### Why this step exists

Bookings are the most complex resource — they involve date validation, conflict checking, and role restrictions. The documentation must explain all these business rules clearly so developers know exactly what to send and what errors to expect.

### Tasks

Add `@swagger` comments to all routes in `bookings.routes.ts`:

**GET /bookings:**
- Tag: `[Bookings]`
- Security: `bearerAuth`
- Responses: 200 (array of Booking schemas)

**GET /bookings/{id}:**
- Tag: `[Bookings]`
- Security: `bearerAuth`
- Responses: 200 (Booking schema with guest and listing), 404

**POST /bookings:**
- Tag: `[Bookings]`
- Security: `bearerAuth`
- Description: explain that only GUEST role can create bookings, checkIn must be before checkOut, both must be in the future, and the listing must be available for those dates
- RequestBody: `CreateBookingInput` schema
- Responses: 201 (Booking schema), 400 (ErrorResponse — invalid dates), 401, 403 (ErrorResponse — not a guest), 404 (ErrorResponse — listing not found), 409 (ErrorResponse — listing already booked for those dates)

**DELETE /bookings/{id}:**
- Tag: `[Bookings]`
- Security: `bearerAuth`
- Summary: `"Cancel a booking"`
- Description: explain that only the booking's guest can cancel it, and that the booking status is set to CANCELLED (not deleted)
- Responses: 200 (success message), 400 (ErrorResponse — already cancelled), 401, 403, 404

**PATCH /bookings/{id}/status:**
- Tag: `[Bookings]`
- Security: `bearerAuth`
- Summary: `"Update booking status"`
- RequestBody: inline schema with `status` (string, enum: PENDING/CONFIRMED/CANCELLED, required)
- Responses: 200 (Booking schema), 400, 401, 404

**GET /users/{id}/bookings:**
- Tag: `[Bookings]`
- Security: `bearerAuth`
- Summary: `"Get all bookings made by a specific guest"`
- Responses: 200 (array of Booking schemas), 404

---

## Part 6 — Document Upload Routes

### Why this step exists

File upload endpoints are the trickiest to document because they use `multipart/form-data` instead of JSON. Without clear documentation, developers have no idea how to send files — they will try to send JSON and wonder why it does not work.

### Tasks

Add `@swagger` comments to all routes in `upload.routes.ts`:

**POST /users/{id}/avatar:**
- Tag: `[Users]`
- Security: `bearerAuth`
- Summary: `"Upload a profile picture"`
- Description: explain that users can only upload their own avatar, accepted formats are jpeg/png/webp, max size is 5MB, and uploading a new avatar automatically deletes the old one
- Path parameter: `id` (integer, required)
- RequestBody with `multipart/form-data`:
  ```yaml
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
- Responses: 200 (User schema), 400 (ErrorResponse — no file or wrong type), 401, 403, 404

**DELETE /users/{id}/avatar:**
- Tag: `[Users]`
- Security: `bearerAuth`
- Responses: 200 (success message), 400 (ErrorResponse — no avatar to remove), 401, 403, 404

**POST /listings/{id}/photos:**
- Tag: `[Listings]`
- Security: `bearerAuth`
- Summary: `"Upload photos for a listing"`
- Description: explain the 5-photo limit, that only the host can upload, and accepted formats
- RequestBody with `multipart/form-data` using an array:
  ```yaml
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
- Responses: 200 (Listing schema with photos), 400 (ErrorResponse — limit reached or no files), 401, 403, 404

**DELETE /listings/{id}/photos/{photoId}:**
- Tag: `[Listings]`
- Security: `bearerAuth`
- Path parameters: `id` (listing id), `photoId` (photo id)
- Responses: 200 (success message), 401, 403, 404

---

## Part 7 — Prepare for Production

### Why this step exists

Your development setup uses `tsx` to run TypeScript directly. Production servers do not have `tsx` — they run plain JavaScript. You need to compile your TypeScript to JavaScript first, then run the compiled output.

**Why `PORT` must be dynamic:** Hosting platforms assign a random port to your app — you cannot hardcode `3000`. If you do, your app will start but the platform will not be able to route traffic to it and it will appear to be down.

**Why `prisma migrate deploy` instead of `prisma migrate dev`:** `migrate dev` is for development — it creates new migration files and can reset the database. `migrate deploy` only applies existing migrations without creating new ones or resetting anything. It is safe to run in production.

**Why a global error handler:** Without one, any unhandled error in a controller causes Express to return an HTML error page (or crash). A global error handler catches everything and returns a consistent JSON error response.

**Why a health check endpoint:** Hosting platforms ping `/health` every few seconds to verify your app is running. If it does not respond, the platform restarts your app. Without it, the platform has no way to know if your app is healthy.

### Tasks

1. Add scripts to `package.json`:
   ```json
   "build": "tsc",
   "start": "node dist/index.js",
   "migrate": "prisma migrate deploy"
   ```

2. Verify `npm run build` compiles without TypeScript errors — fix any errors before deploying

3. Verify `npm start` runs the compiled output correctly — test locally with `npm run build && npm start`

4. Update `.env.example` with all variables needed in production:
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

5. Make sure `PORT` is read dynamically in `index.ts`:
   ```typescript
   const PORT = Number(process.env["PORT"]) || 3000;
   ```

6. Add a **global error handler** as the last middleware in `index.ts` — it has 4 parameters `(err, req, res, next)`. Log the full error server-side, return 500 with `"Something went wrong"` to the client. Never expose the raw error message

7. Add a **404 handler** just before the global error handler — catches any request to a route that does not exist and returns `{ error: "Route not found" }` with status 404

8. Add a **health check endpoint** `GET /health` — returns `{ status: "ok", uptime: process.uptime(), timestamp: new Date() }` with status 200

---

## Part 8 — Deploy to Railway

### Why this step exists

Railway is one of the simplest platforms for deploying Node.js apps. It connects to your GitHub repository, detects that it is a Node.js project, and deploys automatically every time you push to your main branch. It also provides a managed PostgreSQL database that integrates directly with your app.

**Why you must not commit `.env`:** Your `.env` file contains database passwords, JWT secrets, and API keys. If you push it to GitHub, anyone who finds your repository can access your database, impersonate users, and delete all your data. Always verify `.env` is in `.gitignore` before pushing.

**Why you run migrations as part of the build:** Your production database starts empty. Without running migrations, Prisma has no tables to query and every request will fail. Running `prisma migrate deploy` as part of the build command ensures the database is always in sync with your schema.

### Tasks

1. Push your code to GitHub — before pushing, verify `.env` is NOT included:
   ```bash
   git status  # .env should not appear in the list
   ```

2. Go to [railway.app](https://railway.app) and sign up with GitHub

3. Click **New Project** → **Deploy from GitHub repo** → select your `airbnb-api` repository

4. Add a PostgreSQL database: click **New** → **Database** → **PostgreSQL** — Railway automatically adds `DATABASE_URL` to your environment variables

5. Set all other environment variables in Railway's **Variables** tab — copy the names from `.env.example` and fill in production values:
   - Use a strong, randomly generated `JWT_SECRET` — never reuse your development secret
   - Set `NODE_ENV=production`
   - Set `API_URL` to your Railway app URL (you will get this after first deploy)

6. Set build and start commands in Railway's **Settings** → **Deploy**:
   - Build Command: `npm run build && npx prisma migrate deploy`
   - Start Command: `npm start`

7. Deploy and verify the full user journey works in production:
   - Open `https://your-app.railway.app/api-docs` — Swagger UI should load
   - Register a new user through Swagger UI
   - Login and copy the token
   - Click **Authorize** in Swagger UI and paste the token
   - Create a listing (as a host)
   - Make a booking (as a guest)
   - Upload an avatar
   - Check that the welcome email arrived in your inbox

### Best Practices

- Always test the full user journey after deploying — do not assume it works just because the build succeeded
- Set `NODE_ENV=production` — some packages behave differently in production mode (better performance, less verbose logging)
- Use a different `JWT_SECRET` in production than in development — if your development secret leaks, production tokens are still safe

---

## Part 9 — Add Request Logging

### Why this step exists

In development, you can see what is happening by looking at your terminal. In production, you cannot see the terminal — you need logs. Morgan logs every HTTP request with the method, URL, status code, and response time. When something goes wrong in production, logs are how you figure out what happened.

**Why different formats for dev vs production:** `morgan("dev")` uses colors and a compact format — great for reading in a terminal. `morgan("combined")` uses the Apache Combined Log Format — includes IP address, user agent, and referrer. This is the standard format that log analysis tools understand.

### Tasks

Install Morgan:
```bash
npm install morgan
npm install -D @types/morgan
```

Add to `index.ts` as the very first middleware (before everything else):
```typescript
import morgan from "morgan";
app.use(process.env["NODE_ENV"] === "production" ? morgan("combined") : morgan("dev"));
```

### Best Practices

- Add Morgan as the first middleware — it should log every request, including ones that fail in other middleware
- Never log request bodies in production — they may contain passwords, tokens, or personal data

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
├── .env                  ← never commit
├── .env.example          ← always commit
├── .gitignore
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

---

## Final Checklist

- [ ] Swagger UI accessible at `/api-docs` in both development and production
- [ ] All endpoints documented — auth, users, listings, bookings, uploads
- [ ] Every endpoint has all possible responses documented (not just 200)
- [ ] Bearer auth works in Swagger UI — Authorize button accepts JWT token
- [ ] File upload endpoints use `multipart/form-data` in docs
- [ ] `npm run build` compiles without TypeScript errors
- [ ] `npm start` runs the compiled production build
- [ ] `PORT` is read from `process.env` with a fallback
- [ ] `.env` is NOT in the repository — verified with `git status`
- [ ] `.env.example` exists with all variable names
- [ ] Global error handler returns JSON, not HTML
- [ ] 404 handler catches unknown routes
- [ ] Health check at `/health` returns 200
- [ ] App deployed and accessible at a public Railway URL
- [ ] Database migrations ran successfully in production
- [ ] Full user journey works in production: register → login → create listing → book → upload photos
- [ ] Welcome email arrives in inbox after registration
- [ ] Swagger UI works in production at `/api-docs`
- [ ] Morgan logs requests in the Railway log viewer

---

## Further Research

- Research **API versioning** — how do you handle breaking changes without breaking existing clients? Look at how Stripe versions their API (`/v1/`, `/v2/`). Understand URL versioning vs header versioning and the tradeoffs of each
- Look up **CORS** (Cross-Origin Resource Sharing) — research the `cors` package for Express. Understand why browsers block cross-origin requests and how to configure CORS correctly so your Airbnb frontend can call your API
- Research **helmet.js** — a collection of security middleware for Express that sets important HTTP headers. Read what each header does and why it matters for security
- Look up **CI/CD with GitHub Actions** — understand how to automatically run tests and deploy on every push to main. This is how professional teams ship code without manual deployment steps
- Read about the **12-Factor App methodology** — 12 best practices for building production-ready applications. You have already applied most of them in this course without knowing it. Read through all 12 and identify which ones you implemented
