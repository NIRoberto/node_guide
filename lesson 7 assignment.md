# Lesson 7 Assignment: Deploy Airbnb API to Production

## Overview

Deploy your Airbnb API to a live production server with a hosted PostgreSQL database. Migrate all your local database schema and data to production. By the end, your API is publicly accessible on the internet with full functionality.

---

## Part 1 — Prepare for Production

### 1. Update package.json scripts

```json
"scripts": {
  "dev": "nodemon --exec tsx src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "migrate": "prisma migrate deploy"
}
```

### 2. Make PORT dynamic

Update `index.ts`:
```typescript
const PORT = Number(process.env["PORT"]) || 3000;
```

### 3. Add health check endpoint

Add to `index.ts` before other routes:
```typescript
app.get("/health", (req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    uptime: process.uptime(), 
    timestamp: new Date() 
  });
});
```

### 4. Add global error handler

Add as the **last middleware** in `index.ts`:
```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong" });
});
```

### 5. Add 404 handler

Add just **before** the global error handler:
```typescript
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});
```

### 6. Add request logging

Install:
```bash
npm install morgan
npm install -D @types/morgan
```

Add as the **first middleware** in `index.ts`:
```typescript
import morgan from "morgan";

app.use(process.env["NODE_ENV"] === "production" ? morgan("combined") : morgan("dev"));
```

### 7. Create .env.example

Create a file with all variable names but no values:
```env
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
PORT=
NODE_ENV=
API_URL=
```

### 8. Test the build locally

```bash
npm run build    # should compile without errors
npm start        # should start the server from dist/
```

Visit `http://localhost:3000/health` — should return `{ status: "ok", ... }`

If it works locally, it will work in production.

---

## Part 2 — Verify Migrations

### 1. Check all migrations are committed

```bash
git status
```

All files in `prisma/migrations/` should be committed. If not:
```bash
git add prisma/migrations/
git commit -m "add migrations"
```

### 2. Verify migration files

```bash
ls prisma/migrations/
```

You should see folders like:
```
20240101_init/
20240115_add_listings/
20240120_add_bookings/
```

Each folder contains a `migration.sql` file.

### 3. Test migrations on a fresh database

Create a test database locally:
```bash
psql postgres
CREATE DATABASE test_deploy;
\q
```

Update `.env` temporarily:
```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/test_deploy"
```

Run migrations:
```bash
npx prisma migrate deploy
```

Should apply all migrations successfully. If any fail, fix them before deploying.

Restore your original `DATABASE_URL` after testing.

---

## Part 3 — Deploy to Railway

### 1. Push to GitHub

```bash
git add .
git commit -m "prepare for deployment"
git push origin main
```

Verify `.env` is NOT in the repository:
```bash
git status   # .env must not appear
```

### 2. Create Railway project

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your repository

### 3. Add PostgreSQL database

1. In your project, click **New** → **Database** → **PostgreSQL**
2. Railway creates a PostgreSQL instance
3. `DATABASE_URL` is automatically added to your app's environment variables

### 4. Set environment variables

Go to your service → **Variables** tab:

```
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=7d
NODE_ENV=production
API_URL=https://your-app.railway.app
```

Leave `PORT` and `DATABASE_URL` empty — Railway sets these automatically.

### 5. Configure build and start commands

Go to **Settings** → **Deploy**:

```
Build Command: npm run build && npx prisma generate && npx prisma migrate deploy
Start Command: npm start
```

### 6. Deploy

Railway automatically deploys. Watch the build logs — you should see:

```
> npm run build
> npx prisma generate
> npx prisma migrate deploy
Applying migration `20240101_init`
Applying migration `20240115_add_listings`
...
> npm start
Database connected successfully
Server running on http://localhost:PORT
```

Your app is live at `https://your-app.railway.app`.

---

## Part 4 — Verify Deployment

Test every critical endpoint in production:

### 1. Health check
```
GET https://your-app.railway.app/health
```
Should return `{ status: "ok", ... }`

### 2. Swagger UI
```
https://your-app.railway.app/api-docs
```
Should load the interactive documentation

### 3. Register a user
```
POST https://your-app.railway.app/auth/register
{
  "name": "Test User",
  "email": "test@example.com",
  "username": "testuser",
  "phone": "1234567890",
  "password": "password123",
  "role": "guest"
}
```
Should return `201` with the created user

### 4. Login
```
POST https://your-app.railway.app/auth/login
{
  "email": "test@example.com",
  "password": "password123"
}
```
Should return `200` with a token

### 5. Test protected route

Copy the token from step 4, then:
```
GET https://your-app.railway.app/users
Authorization: Bearer <your-token>
```
Should return `200` with a list of users

### 6. Create a listing (as host)

First register a host user, login, then:
```
POST https://your-app.railway.app/listings
Authorization: Bearer <host-token>
{
  "title": "Cozy Apartment",
  "description": "Beautiful place in downtown",
  "location": "New York",
  "pricePerNight": 120,
  "guests": 2,
  "type": "apartment",
  "amenities": ["wifi", "kitchen"]
}
```
Should return `201` with the created listing

### 7. Test pagination
```
GET https://your-app.railway.app/listings?page=1&limit=5
```
Should return paginated listings with `meta` object

### 8. Test search
```
GET https://your-app.railway.app/listings/search?location=New York&type=apartment
```
Should return filtered listings

---

## Part 5 — Database Verification

### 1. Check migrations ran

In Railway, go to your service → **Deployments** → click the latest deployment → **View Logs**

Search for:
```
Applying migration
```

You should see all your migrations applied.

### 2. Connect to production database

Railway provides a way to connect to your database directly. Go to your PostgreSQL service → **Connect** → copy the connection command.

Run it locally:
```bash
psql <connection-string>
```

Check tables exist:
```sql
\dt
```

Should show: `User`, `Listing`, `Booking`, `Review`, `_prisma_migrations`

Check data:
```sql
SELECT * FROM "User";
SELECT * FROM "Listing";
```

Should show the test data you created in Part 4.

---

## Part 6 — Continuous Deployment

Now that your app is deployed, every `git push` triggers a new deployment automatically.

### Test the workflow

1. Make a small change locally (e.g., update a response message)
2. Commit and push:
   ```bash
   git add .
   git commit -m "update response message"
   git push origin main
   ```
3. Go to Railway → watch the build logs
4. Once deployed, verify the change is live

### Add a new feature with a migration

1. Update `schema.prisma` (e.g., add a `verified` field to User)
2. Run migration locally:
   ```bash
   npx prisma migrate dev --name add_verified_field
   ```
3. Commit and push:
   ```bash
   git add .
   git commit -m "add verified field to users"
   git push origin main
   ```
4. Railway automatically runs `prisma migrate deploy` during build
5. The new field is now in production

---

## Part 7 — Alternative: Deploy to Render

If you prefer Render over Railway, follow these steps instead of Part 3.

### 1. Create Render account

Go to [render.com](https://render.com) and sign up with GitHub.

### 2. Create PostgreSQL database

1. Click **New** → **PostgreSQL**
2. Name: `airbnb-db`
3. Select free plan
4. Click **Create Database**
5. Copy the **Internal Database URL**

### 3. Create Web Service

1. Click **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:

```
Name:          airbnb-api
Environment:   Node
Build Command: npm install && npm run build && npx prisma generate && npx prisma migrate deploy
Start Command: npm start
```

### 4. Set environment variables

Go to **Environment** tab:

```
DATABASE_URL=<paste Internal Database URL from step 2>
JWT_SECRET=<generate a strong random string>
JWT_EXPIRES_IN=7d
NODE_ENV=production
API_URL=https://your-app.onrender.com
```

### 5. Deploy

Click **Create Web Service**. Render builds and deploys. Your app is live at `https://your-app.onrender.com`.

Follow Part 4 to verify deployment (replace `railway.app` with `onrender.com`).

---

## Troubleshooting

### Build fails with TypeScript errors

Run `npm run build` locally — fix all errors before pushing.

### Migrations fail in production

Check the logs for the specific error. Common issues:
- Migration tries to add a non-nullable column to a table with existing data — add a default value
- Migration conflicts with existing data — fix locally, test on a fresh DB, then redeploy

### App crashes on startup

Check the logs. Common issues:
- Missing environment variable — verify all variables are set in the platform
- Database connection fails — verify `DATABASE_URL` is correct
- Port binding fails — verify you're using `process.env["PORT"]`

### 404 on all routes

Check the logs — the server might not be starting. Verify `npm start` works locally.

### Database connection limit reached

You have too many connections open. Add connection pooling:
```env
DATABASE_URL="postgresql://...?connection_limit=5"
```

Or use Railway's PgBouncer URL instead of the direct URL.

---

## Final Checklist

- [ ] `npm run build` compiles without errors locally
- [ ] `npm start` runs the compiled output locally
- [ ] All migrations are committed to Git
- [ ] `.env` is NOT committed (in `.gitignore`)
- [ ] `.env.example` exists with all variable names
- [ ] Health check at `/health` returns 200
- [ ] Global error handler is the last middleware
- [ ] 404 handler catches unknown routes
- [ ] `PORT` reads from `process.env["PORT"]`
- [ ] `NODE_ENV=production` is set in the platform
- [ ] All environment variables are set in the platform
- [ ] App is accessible at the public URL
- [ ] Swagger UI works in production
- [ ] Can register, login, and access protected routes
- [ ] Database migrations ran successfully
- [ ] Continuous deployment works (push triggers redeploy)

---

## What You Should Practice

- Preparing a Node.js app for production deployment
- Understanding the difference between development and production environments
- Managing environment variables securely across environments
- Using Prisma migrations to sync schema changes from local to production
- Deploying to cloud platforms (Railway, Render)
- Verifying deployments with health checks and endpoint testing
- Setting up continuous deployment from GitHub
- Troubleshooting deployment issues using platform logs
- Connecting to production databases for verification
