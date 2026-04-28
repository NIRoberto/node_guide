# Lesson 7: API Versioning & Deployment

## Table of Contents
1. [What is API Versioning?](#what-is-api-versioning)
2. [Why Version Before Deploying](#why-version-before-deploying)
3. [URL Path Versioning in Express](#url-path-versioning-in-express)
4. [Deprecation Headers](#deprecation-headers)
5. [What is Deployment?](#what-is-deployment)
6. [Development vs Production](#development-vs-production)
7. [Preparing Your App for Production](#preparing-your-app-for-production)
8. [Environment Variables in Production](#environment-variables-in-production)
9. [Database Migration Strategy](#database-migration-strategy)
10. [Migrating from Local to Production Database](#migrating-from-local-to-production-database)
11. [Hosted Database Options](#hosted-database-options)
12. [Deploying to Railway](#deploying-to-railway)
13. [Deploying to Render](#deploying-to-render)
14. [How It All Fits Together](#how-it-all-fits-together)

---

## What is API Versioning?

Once your API is live and clients are using it, you cannot freely change it. If you rename a field, remove an endpoint, or change a response structure, every client that depends on the old behavior breaks.

**API versioning** lets you introduce changes without breaking existing clients. You maintain multiple versions simultaneously — old clients stay on v1, new clients use v2.

This is why versioning must happen **before deployment** — adding it after means changing all your URLs, which is itself a breaking change.

### What is a breaking change?

A breaking change is anything that causes existing clients to stop working:

- Renaming a field: `pricePerNight` → `price`
- Removing a field from a response
- Changing a field's type: `id` from `number` to `string`
- Removing an endpoint
- Changing required fields on a request body

### What is NOT a breaking change?

These are safe to deploy without a new version:

- Adding a new optional field to a response
- Adding a new endpoint
- Bug fixes that don't change the contract

---

## Why Version Before Deploying

The golden rule: **structure your routes with a version prefix from day one**, even if you only have v1.

```typescript
// ✅ Do this from the start — easy to add v2 later
app.use("/v1/users", usersRouter);
app.use("/v1/listings", listingsRouter);

// ❌ Don't do this — adding versioning later is a breaking change
app.use("/users", usersRouter);
app.use("/listings", listingsRouter);
```

If you deploy without versioning and later need to add it, you have to change all your URLs — which breaks every client already using your API.

---

## URL Path Versioning in Express

URL path versioning is the most common approach — the version is part of the URL: `/v1/listings`, `/v2/listings`. It is visible, easy to test, and used by Stripe, GitHub, and Twilio.

### Group all routes under a version router

**src/routes/v1/index.ts:**
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

**src/index.ts:**
```typescript
import v1Router from "./routes/v1/index.js";

app.use("/v1", v1Router);
```

Now all your endpoints are under `/v1/...`. When you have breaking changes later, you create a `v2Router` the same way and mount it under `/v2`.

### Folder structure

```
src/
├── routes/
│   ├── v1/
│   │   ├── index.ts          ← groups all v1 routes
│   │   ├── auth.routes.ts
│   │   ├── users.routes.ts
│   │   ├── listings.routes.ts
│   │   └── bookings.routes.ts
│   └── v2/                   ← created when you have breaking changes
├── controllers/
│   ├── v1/
│   └── v2/
└── index.ts
```

### Redirect unversioned routes to latest version

If a client calls `/listings` without a version, redirect them to the latest:

```typescript
// Before versioned routes in index.ts
app.use("/listings", (req, res) => {
  res.redirect(301, `/v1/listings${req.url}`);
});
```

301 Moved Permanently tells clients and search engines the resource has permanently moved.

---

## Deprecation Headers

When you release v2, you do not remove v1 immediately. You **deprecate** it — warn clients it will be removed, giving them time to migrate.

Add a deprecation middleware to all v1 routes:

```typescript
// src/middlewares/deprecation.middleware.ts
import type { Request, Response, NextFunction } from "express";

export function deprecateV1(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", "Sat, 01 Jan 2026 00:00:00 GMT"); // removal date
  res.setHeader("Link", '</v2>; rel="successor-version"');
  next();
}
```

Apply it in `index.ts`:

```typescript
import { deprecateV1 } from "./middlewares/deprecation.middleware.js";

app.use("/v1", deprecateV1, v1Router); // every v1 response includes deprecation headers
app.use("/v2", v2Router);
```

When the sunset date arrives, return 410 Gone for all v1 requests:

```typescript
app.use("/v1", (req, res) => {
  res.status(410).json({
    error: "API v1 has been discontinued. Please migrate to /v2.",
  });
});
```

410 Gone is the correct status — it means the resource existed but has been permanently removed.

---

## What is Deployment?

So far everything has run on your local machine. **Deployment** means putting your app on a server that's accessible on the internet — so real users can use it 24/7.

When you deploy, your app runs on someone else's computer (a cloud server) instead of yours. That server has a public IP address and a domain name, so anyone in the world can reach it.

```
Local machine (only you)         Cloud server (everyone)
─────────────────────────        ──────────────────────────
localhost:3000                   https://your-app.railway.app
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
- **Railway** → Project → Variables tab
- **Render** → Service → Environment tab

These are injected into `process.env` when your app starts — exactly like a `.env` file, but secure.

### Production environment variables

```
DATABASE_URL=postgresql://...   ← provided by your hosted DB
JWT_SECRET=<long-random-string> ← generate a strong one, never reuse dev secret
JWT_EXPIRES_IN=7d
PORT=                           ← leave empty, platform sets this automatically
NODE_ENV=production
API_URL=https://your-app.railway.app
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
| **Railway PostgreSQL** | 1GB storage | Easiest — same platform as your app, `DATABASE_URL` auto-configured |
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

**Option 1 — PgBouncer (built into Railway and Supabase)**

Railway and Supabase provide a PgBouncer URL alongside the direct URL. Use the PgBouncer URL for your app:

```env
DATABASE_URL="postgresql://user:pass@host:6543/db?pgbouncer=true&connection_limit=1"
```

**Option 2 — Neon serverless driver**

Neon has a serverless driver that handles pooling automatically — no configuration needed.

---

## Deploying to Railway

Railway is the easiest platform to deploy Node.js + PostgreSQL apps. It detects your project automatically and has a generous free tier.

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

### Step 2 — Create a Railway account

Go to [railway.app](https://railway.app) and sign up with GitHub.

### Step 3 — Create a new project

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Select your repository
4. Railway detects it's a Node.js app automatically

### Step 4 — Add a PostgreSQL database

1. In your project dashboard, click **New** → **Database** → **PostgreSQL**
2. Railway creates a PostgreSQL instance
3. `DATABASE_URL` is automatically added to your app's environment variables — you don't need to copy anything

### Step 5 — Set environment variables

Go to your service → **Variables** tab and add:

```
JWT_SECRET=<generate a strong random string>
JWT_EXPIRES_IN=7d
NODE_ENV=production
API_URL=https://your-app.railway.app
```

Leave `PORT` and `DATABASE_URL` empty — Railway sets these automatically.

### Step 6 — Set build and start commands

Go to your service → **Settings** → **Deploy**:

```
Build Command: npm run build && npx prisma generate && npx prisma migrate deploy
Start Command: npm start
```

### Step 7 — Deploy

Railway automatically deploys every time you push to your main branch. Watch the build logs — you should see migrations running and the server starting.

Your app is live at `https://your-app.railway.app`.

### Subsequent deployments

Every `git push origin main` triggers a new deployment automatically:

```bash
# make changes locally
git add .
git commit -m "add bookings feature"
git push origin main
# Railway detects the push, builds, migrates, and deploys automatically
```

---

## Deploying to Render

Render is another popular platform with a free tier for web services.

### Step 1 — Create a Render account

Go to [render.com](https://render.com) and sign up with GitHub.

### Step 2 — Create a PostgreSQL database

1. Click **New** → **PostgreSQL**
2. Give it a name and select the free plan
3. Click **Create Database**
4. Copy the **Internal Database URL** — you'll need this in the next step

### Step 3 — Create a Web Service

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

### Step 4 — Set environment variables

Go to your web service → **Environment** tab:

```
DATABASE_URL=<paste the Internal Database URL from step 2>
JWT_SECRET=<generate a strong random string>
JWT_EXPIRES_IN=7d
NODE_ENV=production
API_URL=https://your-app.onrender.com
```

### Step 5 — Deploy

Click **Create Web Service**. Render builds and deploys your app. It's live at `https://your-app.onrender.com`.

> On Render's free tier, the service spins down after 15 minutes of inactivity and takes ~30 seconds to wake up on the next request. Upgrade to a paid plan to avoid this in production.

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
Railway / Render detects push
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
App live at https://your-app.railway.app
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
| Railway | Cloud hosting platform — easiest Node.js + PostgreSQL deployment |
| Render | Alternative cloud hosting platform with a free tier |
| Neon | Serverless PostgreSQL — great free tier with branching |
| Health check | Endpoint that returns 200 — hosting platforms use it to verify your app is running |
| Global error handler | Last middleware — catches all unhandled errors, returns generic message |
| PgBouncer | PostgreSQL connection pooler — built into Railway and Supabase |

---

**Resources:**
- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [Neon PostgreSQL](https://neon.tech)
- [Supabase](https://supabase.com)
- [Prisma Deploy Guide](https://www.prisma.io/docs/guides/deployment)
- [Prisma Migrate Deploy](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-deploy)
