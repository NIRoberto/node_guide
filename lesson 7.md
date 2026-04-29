# Lesson 7: API Versioning & Deployment

## Table of Contents
1. [Changing IDs from Int to UUID](#changing-ids-from-int-to-uuid)
2. [What is API Versioning?](#what-is-api-versioning)
3. [Why Version Before Deploying](#why-version-before-deploying)
4. [URL Path Versioning in Express](#url-path-versioning-in-express)
5. [Deprecation Headers](#deprecation-headers)
6. [What is Deployment?](#what-is-deployment)
7. [Development vs Production](#development-vs-production)
8. [Preparing Your App for Production](#preparing-your-app-for-production)
9. [Environment Variables in Production](#environment-variables-in-production)
10. [Database Migration Strategy](#database-migration-strategy)
11. [Migrating from Local to Production Database](#migrating-from-local-to-production-database)
12. [Hosted Database Options](#hosted-database-options)
13. [Deploying to Render](#deploying-to-render)
14. [How It All Fits Together](#how-it-all-fits-together)

---

## Changing IDs from Int to UUID

### Why UUID over Int?

So far all your models use `Int` with `autoincrement()` for IDs:

```prisma
id Int @id @default(autoincrement())
```

This works fine locally, but has real problems in production:

- **Predictable** — anyone can guess other users' IDs (`/users/1`, `/users/2`, `/users/3`)
- **Enumerable** — attackers can scrape all your data by incrementing the ID
- **Merge conflicts** — if you ever have multiple databases or data imports, IDs collide
- **Leaks business data** — your 5th user has `id: 5` — competitors know how many users you have

**UUID** (Universally Unique Identifier) solves all of this:

```
Int ID:   1, 2, 3, 4, 5
UUID:     a3f8c2d1-4b5e-4f6a-8c9d-1e2f3a4b5c6d
```

UUIDs are random 128-bit values — impossible to guess, globally unique, and reveal nothing about your data.

### Update the Prisma schema

Change every model's `id` field from `Int @default(autoincrement())` to `String @default(uuid())`:

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  username  String   @unique
  password  String
  role      Role     @default(GUEST)
  listings  Listing[]
  bookings  Booking[]
  createdAt DateTime @default(now())
}

model Listing {
  id            String   @id @default(uuid())
  title         String
  location      String
  pricePerNight Float
  guests        Int
  type          String
  userId        String   // foreign keys also become String
  user          User     @relation(fields: [userId], references: [id])
  bookings      Booking[]
  createdAt     DateTime @default(now())
}

model Booking {
  id        String   @id @default(uuid())
  checkIn   DateTime
  checkOut  DateTime
  total     Float
  status    String   @default("confirmed")
  userId    String
  listingId String
  user      User     @relation(fields: [userId], references: [id])
  listing   Listing  @relation(fields: [listingId], references: [id])
  createdAt DateTime @default(now())
}
```

Key changes:
- `id Int` → `id String`
- `@default(autoincrement())` → `@default(uuid())`
- All foreign keys (`userId`, `listingId`) → `String`

### Run the migration

```bash
npx prisma migrate dev --name change_ids_to_uuid
```

> If you have existing data with integer IDs, you need to reset the database first since you can't convert integers to UUIDs in place:
> ```bash
> npx prisma migrate reset
> ```

### Update your TypeScript types

Anywhere you used `parseInt()` to convert route params to numbers, remove it — IDs are now strings:

```typescript
// ❌ Before — parseInt because id was a number
export async function getUserById(req: Request, res: Response) {
  const id = parseInt(req.params["id"] as string);
  const user = await prisma.user.findUnique({ where: { id } });
  ...
}

// ✅ After — id is already a string, no conversion needed
export async function getUserById(req: Request, res: Response) {
  const id = req.params["id"] as string;
  const user = await prisma.user.findUnique({ where: { id } });
  ...
}
```

Also update any TypeScript interfaces or types that referenced `id: number`:

```typescript
// ❌ Before
interface User {
  id: number;
  name: string;
}

// ✅ After
interface User {
  id: string;
  name: string;
}
```

And the `AuthRequest` interface in your auth middleware:

```typescript
export interface AuthRequest extends Request {
  userId?: string;  // was number, now string
  role?: string;
}
```

And the JWT payload:

```typescript
// sign
jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

// verify
const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
//                                                           ^^^^^^ was number
```

### What a UUID looks like in responses

```json
{
  "id": "a3f8c2d1-4b5e-4f6a-8c9d-1e2f3a4b5c6d",
  "name": "Alice",
  "email": "alice@gmail.com"
}
```

URLs look like:
```
GET /api/v1/users/a3f8c2d1-4b5e-4f6a-8c9d-1e2f3a4b5c6d
```

### Int vs UUID — when to use each

| | Int (autoincrement) | UUID |
|--|--------------------|---------|
| Readable | ✅ Short, simple | ❌ Long string |
| Secure | ❌ Predictable | ✅ Unguessable |
| Performance | ✅ Slightly faster index | ❌ Slightly slower |
| Distributed systems | ❌ Collisions possible | ✅ Globally unique |
| Best for | Internal tools, small apps | Public APIs, production apps |

For any public-facing API — use UUID.

---

## What is API Versioning?

Once your API is live and clients are using it, you cannot freely change it. If you rename a field, remove an endpoint, or change a response structure, every client that depends on the old behavior breaks.

**API versioning** lets you introduce breaking changes without breaking existing clients. You maintain multiple versions simultaneously — old clients stay on v1, new clients use v2.

This is why versioning must happen **before deployment** — adding it after means changing all your URLs, which is itself a breaking change.

### What is a breaking change?

A breaking change is anything that causes existing clients to stop working:

| Change | Why it breaks clients |
|--------|----------------------|
| Renaming a field: `pricePerNight` → `price` | Client code reading `pricePerNight` gets `undefined` |
| Removing a field from a response | Client code that depends on it breaks |
| Changing a field's type: `id` from `number` to `string` | Type checks and comparisons fail |
| Removing an endpoint | Client gets 404 |
| Changing required fields on a request body | Client requests start failing with 400 |
| Changing authentication method | All authenticated requests fail |

### What is NOT a breaking change?

These are safe to deploy without a new version:

- Adding a new **optional** field to a response — clients that don't know about it just ignore it
- Adding a new endpoint — existing clients don't call it
- Bug fixes that don't change the response contract
- Performance improvements
- Adding optional query parameters

### Versioning strategies

There are three common approaches to API versioning:

**1. URL Path Versioning** — version in the URL
```
GET /v1/listings
GET /v2/listings
```
Pros: visible, easy to test, easy to route. Used by Stripe, GitHub, Twilio.
Cons: URLs change between versions.

**2. Header Versioning** — version in a request header
```
GET /listings
API-Version: 2
```
Pros: clean URLs. Cons: harder to test in a browser, less visible.

**3. Query Parameter Versioning** — version as a query param
```
GET /listings?version=2
```
Pros: easy to test. Cons: pollutes query params, not RESTful.

**URL path versioning is the industry standard** — it is what we use in this course.

---

## Why Version Before Deploying

The golden rule: **structure your routes with a version prefix from day one**, even if you only have v1.

```typescript
// ✅ Do this from the start — easy to add v2 later
app.use("/api/v1", v1Router);

// ❌ Don't do this — adding versioning later is a breaking change
app.use("/users", usersRouter);
app.use("/listings", listingsRouter);
```

If you deploy without versioning and later need to add it, you have to change all your URLs — which breaks every client already using your API. You'd need to release a "v1" that is identical to what you had, just to give clients time to update their URLs. That's wasted effort that's entirely avoidable.

**Real-world example:** Twitter's API launched without versioning. When they added it, they had to maintain both `/users` and `/1/users` simultaneously for years while clients migrated. Don't repeat that mistake.

---

## URL Path Versioning in Express

URL path versioning is the most common approach — the version is part of the URL: `/v1/listings`, `/v2/listings`. It is explicit, easy to test in Postman or a browser, and used by Stripe, GitHub, and Twilio.

### Project structure

Organize your routes and controllers by version from the start:

```
src/
├── controllers/
│   └── v1/
│       ├── auth.controller.ts
│       ├── users.controller.ts
│       ├── listings.controller.ts
│       └── bookings.controller.ts
├── routes/
│   └── v1/
│       ├── index.ts              ← groups all v1 routes
│       ├── auth.routes.ts
│       ├── users.routes.ts
│       ├── listings.routes.ts
│       └── bookings.routes.ts
└── index.ts
```

When breaking changes are needed, you add `v2/` alongside `v1/` — the old version stays untouched.

### Create the v1 router

**src/routes/v1/index.ts** — groups all v1 routes into a single router:

```typescript
import { Router } from "express";
import authRouter from "./auth.routes.js";
import usersRouter from "./users.routes.js";
import listingsRouter from "./listings.routes.js";
import bookingsRouter from "./bookings.routes.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/users", usersRouter);
v1Router.use("/listings", listingsRouter);
v1Router.use("/bookings", bookingsRouter);

export default v1Router;
```

### Mount in index.ts

```typescript
import v1Router from "./routes/v1/index.js";

app.use("/api/v1", v1Router);
```

Now all endpoints are under `/api/v1/...`:

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/users
GET    /api/v1/users/:id
GET    /api/v1/listings
POST   /api/v1/listings
DELETE /api/v1/bookings/:id
```

### Adding v2 later

When you have breaking changes, create a `v2` folder. You only need to create files for the routes that actually changed — everything else can be re-exported from v1:

```
src/routes/
├── v1/
│   ├── index.ts
│   ├── auth.routes.ts
│   ├── users.routes.ts
│   └── listings.routes.ts
└── v2/
    ├── index.ts
    └── listings.routes.ts   ← only this changed in v2
```

**src/routes/v2/index.ts:**
```typescript
import { Router } from "express";
import authRouter from "../v1/auth.routes.js";    // reuse v1 — unchanged
import usersRouter from "../v1/users.routes.js";  // reuse v1 — unchanged
import listingsRouter from "./listings.routes.js"; // new v2 version

const v2Router = Router();

v2Router.use("/auth", authRouter);
v2Router.use("/users", usersRouter);
v2Router.use("/listings", listingsRouter); // v2 listings with breaking changes

export default v2Router;
```

**src/index.ts:**
```typescript
import v1Router from "./routes/v1/index.js";
import v2Router from "./routes/v2/index.js";

app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);
```

Both versions run simultaneously. Old clients on `/v1` are unaffected. New clients use `/v2`.

### Redirect unversioned routes

If a client calls `/listings` without a version, redirect them to the latest:

```typescript
app.use("/listings", (req, res) => {
  res.redirect(301, `/api/v1/listings${req.url}`);
});
```

`301 Moved Permanently` tells clients and search engines the resource has permanently moved.

---

## Deprecation Headers

When you release v2, you do not remove v1 immediately. You **deprecate** it — warn clients it will be removed, giving them time to migrate. The standard way to communicate this is through HTTP response headers.

### The deprecation headers

```
Deprecation: true
Sunset: Sat, 01 Jan 2026 00:00:00 GMT
Link: </api/v2>; rel="successor-version"
```

- `Deprecation: true` — signals this version is deprecated
- `Sunset` — the exact date and time the version will be shut down
- `Link` — points clients to the replacement version

These are standardized headers defined in [RFC 8594](https://datatracker.ietf.org/doc/html/rfc8594). Well-built API clients check for these headers and can alert developers automatically.

### Implement the deprecation middleware

**src/middlewares/deprecation.middleware.ts:**
```typescript
import type { Request, Response, NextFunction } from "express";

export function deprecateV1(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", "Sat, 01 Jan 2026 00:00:00 GMT");
  res.setHeader("Link", '</api/v2>; rel="successor-version"');
  next();
}
```

### Apply when v2 is released

```typescript
import { deprecateV1 } from "./middlewares/deprecation.middleware.js";

// Every v1 response now includes deprecation headers
app.use("/api/v1", deprecateV1, v1Router);
app.use("/api/v2", v2Router);
```

### Sunset — shut down v1

When the sunset date arrives, replace v1 with a `410 Gone` response:

```typescript
app.use("/api/v1", (req: Request, res: Response) => {
  res.status(410).json({
    error: "API v1 has been discontinued. Please migrate to /api/v2.",
    migration_guide: "https://your-app.com/docs/migration-v1-to-v2",
  });
});
```

`410 Gone` is the correct status code — it means the resource existed but has been permanently removed. This is different from `404 Not Found` which means it never existed.

### Versioning lifecycle

```
Phase 1 — Active
  /api/v1 works normally
  /api/v2 does not exist yet

Phase 2 — v2 Released
  /api/v1 works + sends Deprecation + Sunset headers
  /api/v2 works normally
  Clients have time to migrate

Phase 3 — v1 Sunset
  /api/v1 returns 410 Gone
  /api/v2 works normally
  Migration complete
```

Give clients at least **6 months** between deprecation and sunset. Enterprise clients may need longer.

---

## What is Deployment?

So far everything has run on your local machine. **Deployment** means putting your app on a server that's accessible on the internet — so real users can use it 24/7.

When you deploy, your app runs on someone else's computer (a cloud server) instead of yours. That server has a public IP address and a domain name, so anyone in the world can reach it.

```
Local machine (only you)         Cloud server (everyone)
─────────────────────────        ──────────────────────────
localhost:3000                   https://your-app.onrender.com
Local PostgreSQL                 Hosted PostgreSQL
.env file                        Platform environment variables
Manual restart                   Auto-restart on crash
```

---

## Development vs Production

Understanding the difference between these two environments is critical before deploying.

| | Development | Production |
|--|------------|------------|
| Where it runs | Your laptop | Cloud server |
| Who can access | Only you | Anyone on the internet |
| Database | Local PostgreSQL | Hosted PostgreSQL |
| Environment variables | `.env` file | Platform dashboard |
| Restarts | Manual (`npm run dev`) | Automatic on crash |
| TypeScript | Run directly with `tsx` | Compiled to JS first |
| Logs | Your terminal | Platform log viewer |
| Errors | Full stack traces | Generic messages only |

### Why you can't use `tsx` in production

In development, `tsx` runs TypeScript directly — fast and convenient. In production, you compile TypeScript to JavaScript first with `tsc`, then run the compiled output with `node`. This is faster and more stable.

```
Development:  tsx src/index.ts        (runs TS directly)
Production:   tsc → node dist/index.js (compile first, then run)
```

---

## Preparing Your App for Production

Before deploying, your app needs a few changes to work correctly in a production environment.

### 1. Add build and start scripts

```json
"scripts": {
  "dev": "nodemon --exec tsx src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "migrate": "prisma migrate deploy"
}
```

- `npm run build` — compiles TypeScript to `dist/`
- `npm start` — runs the compiled JavaScript
- `npm run migrate` — applies pending migrations to production DB

### 2. Make PORT dynamic

Hosting platforms assign a port dynamically — you can't hardcode `3000`. Always read from `process.env`:

```typescript
const PORT = Number(process.env["PORT"]) || 3000;
```

### 3. Add a health check endpoint

Hosting platforms ping a URL to verify your app is running. Add this to `index.ts`:

```typescript
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date() });
});
```

### 4. Add a global error handler

Never expose raw error messages to clients in production — they can reveal sensitive info. Add this as the **last middleware** in `index.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);  // log full error server-side
  res.status(500).json({ error: "Something went wrong" });  // generic message to client
});
```

### 5. Add a 404 handler

Add this just **before** the global error handler:

```typescript
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});
```

### 6. Add request logging with morgan

```bash
npm install morgan
npm install -D @types/morgan
```

```typescript
import morgan from "morgan";

// dev format in development, combined format in production
app.use(process.env["NODE_ENV"] === "production" ? morgan("combined") : morgan("dev"));
```

`morgan("combined")` logs IP address, user agent, and response time — the standard format for production log analysis.

### 7. Create a .env.example file

Never commit your `.env` file. Create a `.env.example` with all variable names but no values — this tells teammates and your hosting platform what variables are needed:

```env
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
PORT=
NODE_ENV=
API_URL=
```

### 8. Verify your build works locally

Before pushing to production, always test the build locally:

```bash
npm run build    # should compile without errors
npm start        # should start the server from dist/
```

If it works locally, it will work in production.

---

## Environment Variables in Production

Your `.env` file stays on your local machine — it's in `.gitignore` and never pushed to GitHub. In production, you set environment variables through your hosting platform's dashboard.

**Why not commit .env?**
- It contains passwords, API keys, and secrets
- Anyone with access to your GitHub repo could steal them
- Different environments (dev, staging, production) need different values

Every hosting platform has a way to set environment variables:
- **Render** → Service → Environment tab

These are injected into `process.env` when your app starts — exactly like a `.env` file, but secure.

### Production environment variables

```
DATABASE_URL=postgresql://...   ← provided by your hosted DB
JWT_SECRET=<long-random-string> ← generate a strong one, never reuse dev secret
JWT_EXPIRES_IN=7d
PORT=                           ← leave empty, platform sets this automatically
NODE_ENV=production
API_URL=https://your-app.onrender.com
```

**Generating a strong JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Database Migration Strategy

This is the most important part of deployment. Your local database and production database are completely separate — changes you make locally don't automatically appear in production.

### How Prisma migrations work

Every time you change your schema and run `prisma migrate dev`, Prisma creates a migration file in `prisma/migrations/`. These files are SQL — they describe exactly what changed.

```
prisma/migrations/
├── 20240101_init/
│   └── migration.sql          ← CREATE TABLE users ...
├── 20240115_add_listings/
│   └── migration.sql          ← CREATE TABLE listings ...
└── 20240120_add_indexes/
    └── migration.sql          ← CREATE INDEX ...
```

These migration files are committed to Git. When you deploy, you run `prisma migrate deploy` which applies any migrations that haven't been applied to the production database yet.

### migrate dev vs migrate deploy

| Command | Use in | What it does |
|---------|--------|-------------|
| `prisma migrate dev` | Development only | Creates migration file + applies it + regenerates client |
| `prisma migrate deploy` | Production only | Applies pending migrations — never creates new ones |
| `prisma migrate reset` | Development only | Drops everything and re-runs all migrations from scratch |
| `prisma db push` | Prototyping only | Pushes schema changes without creating migration files |

**Never run `prisma migrate dev` or `prisma migrate reset` in production** — they can drop your data.

### Migration workflow

```
Local development:
  1. Change schema.prisma
  2. npx prisma migrate dev --name describe_the_change
  3. Migration file created in prisma/migrations/
  4. git add . && git commit && git push

Production (automatic on deploy):
  5. npx prisma migrate deploy
  6. Pending migrations applied to production DB
  7. App starts
```

---

## Migrating from Local to Production Database

When you first deploy, your production database is empty. You need to apply all your local migrations to it.

### Step 1 — Make sure all migrations are committed

```bash
git status   # prisma/migrations/ should be committed
```

### Step 2 — Set DATABASE_URL to your production database

In your hosting platform's environment variables, set `DATABASE_URL` to your hosted database connection string.

### Step 3 — Run migrations on deploy

Add `prisma migrate deploy` to your build command in the hosting platform:

```
Build Command: npm run build && npx prisma migrate deploy
Start Command: npm start
```

This runs automatically every time you deploy. Prisma tracks which migrations have already been applied — it only runs new ones.

### Step 4 — Verify migrations ran

After deploying, check your hosting platform's logs. You should see:

```
Applying migration `20240101_init`
Applying migration `20240115_add_listings`
Applying migration `20240120_add_indexes`
Database connected successfully
Server running on http://localhost:PORT
```

### What if a migration fails in production?

Prisma wraps each migration in a transaction. If a migration fails halfway through, it rolls back automatically — your database stays in a consistent state.

Check the logs for the error, fix the migration locally, test it, then redeploy.

### Seeding production data

If you need initial data in production (admin user, default categories, etc.), create a seed file:

**prisma/seed.ts:**
```typescript
import prisma from "../src/config/prisma.js";

async function seed() {
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@example.com",
      username: "admin",
    },
  });

  console.log("Seed completed");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Add to `package.json`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Run locally:
```bash
npx prisma db seed
```

Use `upsert` instead of `create` in seeds — it won't fail if the record already exists.

---

## Hosted Database Options

Your local PostgreSQL database is only on your machine. In production you need a **hosted database** — a PostgreSQL instance running on a cloud server.

| Service | Free Tier | Best for |
|---------|----------|---------|
| **Neon** | 512MB, 10 branches | Serverless PostgreSQL, great free tier, branching for dev/prod |
| **Supabase** | 500MB | Also gives you auth, storage, and realtime out of the box |
| **Render PostgreSQL** | 1GB (90 days free) | Same platform as your app |

### Connection string format

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?sslmode=require
```

Most hosted databases require SSL (`sslmode=require`). Railway and Neon add this automatically.

### Connection pooling in production

Hosted databases have connection limits. With multiple server instances, you can hit the limit fast. Use a connection pooler:

**Option 1 — PgBouncer (built into Supabase)**

Supabase provides a PgBouncer URL alongside the direct URL. Use the PgBouncer URL for your app:

```env
DATABASE_URL="postgresql://user:pass@host:6543/db?pgbouncer=true&connection_limit=1"
```

**Option 2 — Neon serverless driver**

Neon has a serverless driver that handles pooling automatically — no configuration needed.

---

## Deploying to Render

Render is a cloud platform with a free tier for web services and PostgreSQL databases — easy to set up and works great for Node.js apps.

### Step 1 — Push your code to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

Make sure `.env` is NOT committed:
```bash
git status   # .env must not appear in the list
```

### Step 2 — Create a Render account

Go to [render.com](https://render.com) and sign up with GitHub.

### Step 3 — Create a PostgreSQL database

1. Click **New** → **PostgreSQL**
2. Give it a name (e.g. `airbnb-db`) and select the free plan
3. Click **Create Database**
4. Copy the **Internal Database URL** — you'll need this in the next step

### Step 4 — Create a Web Service

1. Click **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:

```
Name:          airbnb-api
Environment:   Node
Region:        closest to your users
Build Command: npm install && npm run build && npx prisma generate && npx prisma migrate deploy
Start Command: npm start
```

### Step 5 — Set environment variables

Go to your web service → **Environment** tab and add:

```
DATABASE_URL=<paste the Internal Database URL from step 3>
JWT_SECRET=<generate a strong random string>
JWT_EXPIRES_IN=7d
NODE_ENV=production
API_URL=https://your-app.onrender.com
```

### Step 6 — Deploy

Click **Create Web Service**. Render builds and deploys your app automatically. Watch the build logs — you should see migrations running and the server starting.

Your app is live at `https://your-app.onrender.com`.

> On Render's free tier, the service spins down after 15 minutes of inactivity and takes ~30 seconds to wake up on the next request. Upgrade to a paid plan to avoid this in production.

### Subsequent deployments

Every `git push origin main` triggers a new deployment automatically:

```bash
# make changes locally
git add .
git commit -m "add bookings feature"
git push origin main
# Render detects the push, builds, migrates, and deploys automatically
```

---

## How It All Fits Together

### Final project structure

```
my-app/
├── prisma/
│   ├── migrations/          ← committed to Git — applied on deploy
│   │   ├── 20240101_init/
│   │   └── 20240115_add_listings/
│   ├── seed.ts              ← optional seed data
│   └── schema.prisma
├── src/
│   ├── config/
│   │   └── prisma.ts
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   └── index.ts
├── dist/                    ← compiled output (gitignored)
├── .env                     ← local only, never commit
├── .env.example             ← commit this
├── .gitignore
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

### Full deployment flow

```
Local Development
  ↓
Change schema → npx prisma migrate dev --name change_name
  ↓
git add . && git commit && git push origin main
  ↓
Render detects push
  ↓
npm install
  ↓
npm run build  (tsc → compiles TypeScript to dist/)
  ↓
npx prisma generate  (regenerates Prisma Client)
  ↓
npx prisma migrate deploy  (applies new migrations to production DB)
  ↓
npm start  (node dist/index.js)
  ↓
App live at https://your-app.onrender.com
```

### Checklist before deploying

- [ ] `PORT` reads from `process.env["PORT"]` with a fallback
- [ ] All secrets are in `.env` and `.env` is in `.gitignore`
- [ ] `.env.example` exists with all variable names
- [ ] `npm run build` compiles without TypeScript errors
- [ ] `npm start` runs the compiled output correctly
- [ ] All `prisma/migrations/` files are committed to Git
- [ ] `prisma migrate deploy` is in the build command
- [ ] Global error handler is the last middleware
- [ ] 404 handler is just before the error handler
- [ ] Health check at `GET /health` returns 200
- [ ] `NODE_ENV=production` is set in the platform

### Checklist after deploying

- [ ] App is accessible at the public URL
- [ ] `/health` returns `{ status: "ok" }`
- [ ] `/api-docs` loads Swagger UI
- [ ] Can register a user
- [ ] Can login and get a token
- [ ] Protected routes work with the token
- [ ] Database migrations ran — check platform logs

---

## Summary

| Concept | What it is |
|---------|------------|
| UUID | Universally Unique Identifier — random string ID, unguessable, used in production APIs |
| `@default(uuid())` | Prisma attribute that auto-generates a UUID for each new record |
| Int autoincrement | Sequential integer IDs — predictable and not safe for public APIs |
| API Versioning | Maintaining multiple versions so breaking changes don't break existing clients |
| Breaking change | Any change that causes existing clients to stop working |
| URL path versioning | Version in the URL: `/v1/listings` — most common approach |
| `v1Router` | An Express Router that groups all v1 routes under `/v1` |
| Deprecation header | `Deprecation: true` — warns clients a version will be removed |
| Sunset header | `Sunset: <date>` — the date a deprecated version is removed |
| 410 Gone | Status code for a resource that existed but has been permanently removed |
| Deployment | Running your app on a cloud server accessible on the internet |
| Production | The live environment real users interact with |
| `npm run build` | Compiles TypeScript to JavaScript for production |
| `npm start` | Runs the compiled JavaScript in production |
| `prisma migrate deploy` | Applies pending migrations in production — safe, no resets |
| `prisma migrate dev` | Development only — creates + applies migrations |
| Migration file | SQL file that records a schema change — committed to Git |
| Seed | Script to insert initial data into the database |
| `.env.example` | Template showing what variables are needed — safe to commit |
| Render | Cloud hosting platform with a free tier for Node.js + PostgreSQL |
| Neon | Serverless PostgreSQL — great free tier with branching |
| Health check | Endpoint that returns 200 — hosting platforms use it to verify your app is running |
| Global error handler | Last middleware — catches all unhandled errors, returns generic message |
| PgBouncer | PostgreSQL connection pooler — built into Supabase |

---

**Resources:**
- [Render Docs](https://render.com/docs)
- [Neon PostgreSQL](https://neon.tech)
- [Supabase](https://supabase.com)
- [Prisma Deploy Guide](https://www.prisma.io/docs/guides/deployment)
- [Prisma Migrate Deploy](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-deploy)
