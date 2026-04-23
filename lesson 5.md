# Lesson 5: Swagger Documentation & Deployment

## Table of Contents
1. [What is API Documentation?](#what-is-api-documentation)
2. [What is Swagger / OpenAPI?](#what-is-swagger--openapi)
3. [How Swagger Works](#how-swagger-works)
4. [Setting Up Swagger](#setting-up-swagger)
5. [Documenting Routes](#documenting-routes)
6. [Documenting Schemas](#documenting-schemas)
7. [Documenting Authentication](#documenting-authentication)
8. [What is Deployment?](#what-is-deployment)
9. [Preparing for Production](#preparing-for-production)
10. [Environment Variables in Production](#environment-variables-in-production)
11. [Deploying to Railway](#deploying-to-railway)
12. [Deploying to Render](#deploying-to-render)
13. [Deploying the Database](#deploying-the-database)
14. [How It All Fits Together](#how-it-all-fits-together)

---

## What is API Documentation?

Throughout this course we've been testing our API with Postman — manually typing URLs, headers, and request bodies. That works for you as the developer, but what about:

- A frontend developer who needs to know what endpoints exist
- A mobile developer who needs to know what fields to send
- A teammate who joins the project later
- You, 6 months from now, trying to remember how your own API works

**API documentation** solves this. It's a description of every endpoint in your API — what URL it uses, what method, what data it expects, what it returns, and what errors it can produce.

Without documentation, your API is a black box. With documentation, anyone can understand and use it without reading your source code.

---

## What is Swagger / OpenAPI?

**OpenAPI** is a standard specification for describing REST APIs. It defines a format (JSON or YAML) for documenting every aspect of your API.

**Swagger** is the toolset built around the OpenAPI specification. The most useful tool is **Swagger UI** — an interactive web page that reads your OpenAPI spec and renders it as a beautiful, clickable documentation page where you can read and test your API directly in the browser.

```
Your code + JSDoc comments
        ↓
swagger-jsdoc reads comments → generates OpenAPI spec (JSON)
        ↓
swagger-ui-express serves the spec as an interactive UI
        ↓
http://localhost:3000/api-docs → anyone can read and test your API
```

### Why Swagger over writing docs manually?

- Documentation lives **next to the code** — easier to keep in sync
- **Interactive** — developers can test endpoints directly from the docs page
- **Industry standard** — most companies use OpenAPI
- Auto-generates client SDKs in many languages
- Postman can import OpenAPI specs directly

---

## How Swagger Works

Swagger UI reads an **OpenAPI spec** — a JSON or YAML document that describes your API. You can write this spec manually, but the easier approach is to use **swagger-jsdoc** which generates it automatically from JSDoc comments in your code.

### OpenAPI spec structure

```yaml
openapi: 3.0.0
info:
  title: Airbnb API
  version: 1.0.0

paths:
  /users:
    get:
      summary: Get all users
      responses:
        200:
          description: List of users

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
```

You write this as JSDoc comments directly above your route handlers, and swagger-jsdoc compiles them into the full spec automatically.

---

## Setting Up Swagger

### Install

```bash
npm install swagger-jsdoc swagger-ui-express
npm install -D @types/swagger-jsdoc @types/swagger-ui-express
```

| Package | What it does |
|---------|-------------|
| `swagger-jsdoc` | Reads JSDoc comments and generates an OpenAPI spec |
| `swagger-ui-express` | Serves the Swagger UI as an Express route |
| `@types/swagger-jsdoc` | TypeScript types |
| `@types/swagger-ui-express` | TypeScript types |

### Create the Swagger config

**src/config/swagger.ts:**
```typescript
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Airbnb API",
      version: "1.0.0",
      description: "REST API for Airbnb listings, users, and authentication",
    },
    servers: [
      {
        // In development, the server runs locally
        // In production, this would be your deployed URL
        url: process.env["NODE_ENV"] === "production"
          ? process.env["API_URL"] as string
          : "http://localhost:3000",
        description: process.env["NODE_ENV"] === "production" ? "Production" : "Development",
      },
    ],
    components: {
      // Define the Bearer token security scheme
      // This adds an "Authorize" button to the Swagger UI
      // where you can paste your JWT token once and it's sent with all requests
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  // Tell swagger-jsdoc where to find the JSDoc comments
  // It scans these files for @swagger annotations
  apis: ["./src/routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

// setupSwagger mounts the Swagger UI at /api-docs
// Call this in index.ts after setting up middleware
export function setupSwagger(app: Express) {
  // Serve the interactive Swagger UI
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Also expose the raw OpenAPI JSON spec
  // Useful for importing into Postman or generating client SDKs
  app.get("/api-docs.json", (req, res) => {
    res.json(swaggerSpec);
  });

  console.log("Swagger docs available at http://localhost:3000/api-docs");
}
```

### Mount in index.ts

```typescript
import { setupSwagger } from "./config/swagger.js";

// Call before app.listen — after middleware, before routes
setupSwagger(app);
```

---

## Documenting Routes

JSDoc comments for Swagger go directly above the route definitions in your route files. They use the `@swagger` tag.

**src/routes/users.routes.ts:**
```typescript
import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/users.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Returns a list of all registered users. Requires authentication.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: No token provided or token is invalid
 */
router.get("/", authenticate, getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.get("/:id", authenticate, getUserById);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserInput'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required fields
 */
router.post("/", createUser);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserInput'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.put("/:id", authenticate, updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/:id", authenticate, deleteUser);

export default router;
```

**src/routes/auth.routes.ts:**
```typescript
import { Router } from "express";
import { register, login } from "../controllers/auth.controller.js";

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Email already in use
 */
router.post("/register", register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and receive a JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiJ9...
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", login);

export default router;
```

---

## Documenting Schemas

Schemas define the shape of your data — what fields a User has, what a request body looks like. Define them once and reference them with `$ref` across all your route docs.

Add schema definitions to your route files or a dedicated schemas file:

**src/routes/users.routes.ts** (add at the top, before the router):
```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Alice
 *         email:
 *           type: string
 *           example: alice@gmail.com
 *         username:
 *           type: string
 *           example: alice123
 *         avatar:
 *           type: string
 *           nullable: true
 *           example: https://res.cloudinary.com/demo/image/upload/sample.jpg
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2024-01-15T10:30:00.000Z
 *
 *     CreateUserInput:
 *       type: object
 *       required: [name, email, username]
 *       properties:
 *         name:
 *           type: string
 *           example: Alice
 *         email:
 *           type: string
 *           example: alice@gmail.com
 *         username:
 *           type: string
 *           example: alice123
 *
 *     UpdateUserInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         username:
 *           type: string
 *
 *     RegisterInput:
 *       type: object
 *       required: [name, email, username, password]
 *       properties:
 *         name:
 *           type: string
 *           example: Alice
 *         email:
 *           type: string
 *           example: alice@gmail.com
 *         username:
 *           type: string
 *           example: alice123
 *         password:
 *           type: string
 *           example: secret123
 *
 *     LoginInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           example: alice@gmail.com
 *         password:
 *           type: string
 *           example: secret123
 */
```

---

## Documenting Authentication

The `securitySchemes` we defined in the Swagger config adds an **Authorize** button to the Swagger UI. Here's how to use it:

1. Open `http://localhost:3000/api-docs`
2. Click the **Authorize** button (top right)
3. Paste your JWT token (without "Bearer " prefix — Swagger adds it)
4. Click **Authorize** → **Close**
5. Now all requests with `security: - bearerAuth: []` will include the token automatically

Any route that has `security: - bearerAuth: []` in its docs will show a lock icon — indicating it requires authentication.

---

## What is Deployment?

So far everything has run on your local machine. **Deployment** means putting your app on a server that's accessible on the internet — so real users can use it 24/7.

When you deploy, your app runs on someone else's computer (a cloud server) instead of yours. That server has a public IP address and a domain name, so anyone in the world can reach it.

### Development vs Production

| | Development | Production |
|--|------------|-----------|
| Where it runs | Your laptop | Cloud server |
| Who can access | Only you | Anyone on the internet |
| Database | Local PostgreSQL | Hosted PostgreSQL (Railway, Supabase, Neon) |
| Environment variables | `.env` file | Set in the hosting platform's dashboard |
| Restarts | Manual | Automatic (if the server crashes) |
| Logs | Your terminal | Platform's log viewer |

### What happens during deployment

```
1. You push your code to GitHub
   ↓
2. Hosting platform detects the push
   ↓
3. Platform pulls your code
   ↓
4. Platform runs npm install
   ↓
5. Platform runs your build command (if any)
   ↓
6. Platform starts your app with npm start
   ↓
7. Your app is live at https://your-app.railway.app
```

---

## Preparing for Production

Before deploying, there are a few things to set up.

### 1. Add a build script

TypeScript needs to be compiled to JavaScript before running in production. Add a build script to `package.json`:

```json
"scripts": {
  "dev": "nodemon --exec tsx src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

- `npm run build` — compiles TypeScript to `dist/`
- `npm start` — runs the compiled JavaScript

### 2. Update tsconfig.json for production output

Make sure your `tsconfig.json` has the output directory set:

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "nodenext",
    "target": "esnext"
  }
}
```

### 3. Add a .env.example file

Never commit your `.env` file. Instead, create a `.env.example` with all the variable names but no values. This tells other developers (and your hosting platform) what variables are needed:

```env
DATABASE_URL=
JWT_SECRET=
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

### 4. Handle the PORT dynamically

Hosting platforms assign a port dynamically — you can't hardcode `3000`. Always read from `process.env.PORT`:

```typescript
const PORT = Number(process.env["PORT"]) || 3000;
```

### 5. Run Prisma migrations on deploy

After deploying, your database needs the latest migrations applied. Add a `postinstall` or `migrate` script:

```json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "migrate": "prisma migrate deploy"
}
```

`prisma migrate deploy` (not `dev`) runs existing migrations without creating new ones — safe for production.

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
- **Heroku** → Settings → Config Vars

These are injected into `process.env` when your app starts — exactly like a `.env` file, but secure.

---

## Deploying to Railway

Railway is one of the easiest platforms to deploy Node.js apps. It supports PostgreSQL, automatic deploys from GitHub, and has a generous free tier.

### Step 1 — Push your code to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### Step 2 — Create a Railway account

Go to [railway.app](https://railway.app) and sign up with GitHub.

### Step 3 — Create a new project

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Select your repository
4. Railway detects it's a Node.js app automatically

### Step 4 — Add a PostgreSQL database

1. In your project, click **New** → **Database** → **PostgreSQL**
2. Railway creates a PostgreSQL instance and adds `DATABASE_URL` to your environment variables automatically

### Step 5 — Set environment variables

Go to your service → **Variables** tab and add all your variables:

```
JWT_SECRET=your-production-secret
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Your App <your-email@gmail.com>
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
NODE_ENV=production
API_URL=https://your-app.railway.app
```

`DATABASE_URL` is already set by Railway from the PostgreSQL service.

### Step 6 — Set the start command

Railway needs to know how to start your app. Go to **Settings** → **Deploy** and set:

```
Build Command: npm run build && npx prisma migrate deploy
Start Command: npm start
```

### Step 7 — Deploy

Railway automatically deploys every time you push to your main branch. Your app will be live at `https://your-app.railway.app`.

---

## Deploying to Render

Render is another popular platform with a free tier for web services.

### Step 1 — Create a Render account

Go to [render.com](https://render.com) and sign up with GitHub.

### Step 2 — Create a Web Service

1. Click **New** → **Web Service**
2. Connect your GitHub repository
3. Configure the service:

```
Name:          airbnb-api
Environment:   Node
Build Command: npm install && npm run build && npx prisma migrate deploy
Start Command: npm start
```

### Step 3 — Add a PostgreSQL database

1. Click **New** → **PostgreSQL**
2. Create the database
3. Copy the **Internal Database URL**
4. Add it as `DATABASE_URL` in your web service's environment variables

### Step 4 — Set environment variables

Go to your web service → **Environment** tab and add all variables (same as Railway step 5).

### Step 5 — Deploy

Click **Create Web Service**. Render builds and deploys your app. It's live at `https://your-app.onrender.com`.

**Note:** On Render's free tier, the service spins down after 15 minutes of inactivity and takes ~30 seconds to wake up on the next request. Upgrade to a paid plan to avoid this.

---

## Deploying the Database

Your local PostgreSQL database is only on your machine. In production you need a **hosted database** — a PostgreSQL instance running on a cloud server.

### Options

| Service | Free Tier | Notes |
|---------|----------|-------|
| Railway PostgreSQL | 1GB storage | Easiest — same platform as your app |
| Supabase | 500MB storage | Also has auth, storage, realtime |
| Neon | 512MB storage | Serverless PostgreSQL, great free tier |
| Render PostgreSQL | 1GB (90 days free) | Same platform as your app |

### Running migrations in production

Never run `prisma migrate dev` in production — it's for development only. Use:

```bash
npx prisma migrate deploy
```

This applies all pending migrations without creating new ones or resetting the database. Run it as part of your build/deploy command.

### Connection pooling

In production, your app might receive many simultaneous requests, each opening a database connection. PostgreSQL has a limit on concurrent connections. Use **connection pooling** to reuse connections efficiently.

Prisma recommends using **PgBouncer** (built into Railway and Supabase) or the `?pgbouncer=true` parameter in your connection string:

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=1"
```

---

## How It All Fits Together

### Final project structure

```
my-app/
├── src/
│   ├── config/
│   │   ├── cloudinary.ts
│   │   ├── email.ts
│   │   ├── multer.ts
│   │   ├── prisma.ts
│   │   └── swagger.ts       ← new
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── upload.controller.ts
│   │   └── users.controller.ts
│   ├── middlewares/
│   │   └── auth.middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── upload.routes.ts
│   │   └── users.routes.ts
│   ├── templates/
│   │   └── emails.ts
│   └── index.ts
├── prisma/
│   └── schema.prisma
├── .env                  ← local only, never commit
├── .env.example          ← commit this — shows what vars are needed
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### Full deployment flow

```
Local Development
  ↓
git push origin main
  ↓
Railway / Render detects push
  ↓
npm install
  ↓
npm run build  (tsc → compiles to dist/)
  ↓
npx prisma migrate deploy  (applies migrations to production DB)
  ↓
npm start  (node dist/index.js)
  ↓
App live at https://your-app.railway.app

Swagger UI: https://your-app.railway.app/api-docs
```

### Checklist before deploying

- [ ] `PORT` reads from `process.env["PORT"]` with a fallback
- [ ] All secrets are in `.env` and `.env` is in `.gitignore`
- [ ] `.env.example` exists with all variable names
- [ ] `npm run build` compiles without errors
- [ ] `npm start` runs the compiled output
- [ ] `prisma migrate deploy` is in the build/start command
- [ ] All environment variables are set in the hosting platform
- [ ] Swagger UI works at `/api-docs`

---

## Summary

| Concept | What it is |
|---------|------------|
| API Documentation | A description of every endpoint — what it expects and returns |
| OpenAPI | Industry standard specification format for describing REST APIs |
| Swagger UI | Interactive web page that renders your OpenAPI spec — test endpoints in browser |
| swagger-jsdoc | Reads JSDoc `@swagger` comments and generates the OpenAPI spec |
| swagger-ui-express | Serves the Swagger UI as an Express route |
| `@swagger` | JSDoc tag used to annotate routes with OpenAPI documentation |
| `$ref` | Reference to a reusable schema defined in `components/schemas` |
| `security: bearerAuth` | Marks a route as requiring JWT authentication in Swagger UI |
| Deployment | Running your app on a cloud server accessible on the internet |
| Railway | Cloud hosting platform — easy Node.js + PostgreSQL deployment |
| Render | Alternative cloud hosting platform with a free tier |
| `npm run build` | Compiles TypeScript to JavaScript for production |
| `npm start` | Runs the compiled JavaScript in production |
| `prisma migrate deploy` | Applies pending migrations in production — safe, no resets |
| Environment Variables | Secrets set in the hosting platform dashboard — never in code |
| `.env.example` | Template showing what variables are needed — safe to commit |
| Connection Pooling | Reuses database connections to handle many simultaneous requests |
| PgBouncer | PostgreSQL connection pooler — built into Railway and Supabase |

---

**Resources:**
- [Swagger / OpenAPI Docs](https://swagger.io/docs/)
- [swagger-jsdoc Docs](https://github.com/Surnet/swagger-jsdoc)
- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.0)
- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [Prisma Deploy Guide](https://www.prisma.io/docs/guides/deployment)
- [Neon PostgreSQL](https://neon.tech)
- [Supabase](https://supabase.com)
