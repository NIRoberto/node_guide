# Lesson 1: Node.js, NPM & Express Basics

## Table of Contents
1. [What is Node.js?](#what-is-nodejs)
2. [How Node.js Works](#how-nodejs-works)
3. [Installing Node.js & NPM](#installing-nodejs--npm)
4. [NPM Basics](#npm-basics)
5. [Node.js Modules](#nodejs-modules)
6. [Your First Node.js App](#your-first-nodejs-app)
7. [What is REST?](#what-is-rest)
8. [Introduction to Express](#introduction-to-express)
9. [Routing in Express](#routing-in-express)
10. [Middleware](#middleware)
11. [Project Structure](#project-structure)
12. [Common Project Structures](#common-project-structures)

---

## What is Node.js?

Before Node.js existed, JavaScript could **only run inside a web browser**. That meant JavaScript was limited to making websites interactive — things like button clicks, form validation, animations.

**Node.js changed that.** It took JavaScript out of the browser and let it run directly on your computer or a server. This means you can now use JavaScript to:

- Build web servers that respond to requests
- Read and write files on your computer
- Connect to databases
- Build APIs that mobile apps talk to
- Create command-line tools

**Think of it this way:**
```
Before Node.js:  JavaScript = only for browsers (frontend)
After Node.js:   JavaScript = browsers + servers + anywhere (fullstack)
```

This is a big deal because it means you only need to learn **one language** to build both the frontend (what users see) and the backend (the server, database logic).

**Who uses Node.js in production:** Netflix, Uber, PayPal, LinkedIn, NASA

---

## How Node.js Works

Understanding this will save you a lot of confusion later.

### The V8 Engine

Node.js is built on top of **V8**, the same JavaScript engine that powers Google Chrome. V8 takes your JavaScript code and compiles it into machine code that your computer can execute directly — which makes it very fast.

### Single-Threaded but Non-Blocking

Most traditional servers (like those built with Java or PHP) create a **new thread** for every incoming request. A thread is like a worker — if you have 100 requests, you spin up 100 workers. This uses a lot of memory.

Node.js works differently. It uses a **single thread** (one worker) but handles many requests at the same time using something called the **Event Loop**.

**Analogy — a waiter at a restaurant:**

A bad waiter takes one order, goes to the kitchen, waits for the food, brings it back, then takes the next order. Everything is blocked while they wait.

A good waiter takes all the orders, submits them to the kitchen, and while the kitchen is cooking, they keep taking more orders. When food is ready, they deliver it. Nothing is blocked.

Node.js is the good waiter. When it sends a request to a database or reads a file, it doesn't sit and wait — it moves on to handle other things and comes back when the result is ready. This is called **non-blocking I/O**.

### When NOT to use Node.js

Node.js is great for tasks that involve a lot of waiting (reading files, database queries, network requests). It is **not** great for tasks that require heavy computation like:

- Video encoding
- Image processing
- Machine learning
- Complex math calculations

For those, languages like Python, Go, or Java are better choices.

---

## Installing Node.js & NPM

### Step 1: Download

Go to [nodejs.org](https://nodejs.org) and download the **LTS version** (Long Term Support). LTS means it's stable and recommended for most projects.

Run the installer and follow the steps. NPM gets installed automatically alongside Node.js — you don't need to install it separately.

### Step 2: Verify

Open your terminal and run:

```bash
node --version   # should show v18.x.x or higher
npm --version    # should show 9.x.x or higher
```

If you see version numbers, you're ready to go.

---

## NPM Basics

### What is NPM?

NPM stands for **Node Package Manager**. It's two things at once:

1. A **command-line tool** that comes with Node.js, used to install packages
2. An **online registry** at [npmjs.com](https://npmjs.com) with over 2 million free packages

A **package** is just code someone else wrote and published so others can reuse it. Instead of writing everything from scratch, you install a package and use it in your project.

For example:
- Need to build a web server? Install `express`
- Need to work with environment variables? Install `dotenv`
- Need to hash passwords? Install `bcrypt`

### What is package.json?

Every Node.js project has a `package.json` file at its root. This file is the **identity card** of your project. It stores:

- The project name and version
- All the packages your project depends on
- Scripts (shortcuts for commands you run often)

You create it by running:

```bash
npm init -y
```

The `-y` flag skips all the questions and fills in default values. You can always edit the file manually later.

Here's what a typical `package.json` looks like:

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### dependencies vs devDependencies

This is a common source of confusion for beginners.

**dependencies** are packages your app needs to actually run — in development AND in production. If you remove them, your app breaks.

**devDependencies** are packages you only need while you're developing. They're tools that help you write code faster or better, but they're not needed when the app is deployed.

```bash
# Install as a production dependency
npm install express

# Install as a dev dependency (the -D flag)
npm install -D typescript tsx @types/node @types/express
```

Examples:
- `express` → dependency (your server needs it to run)
- `typescript`, `tsx`, `@types/*` → devDependencies (only needed during development)

### What is node_modules?

When you install a package, npm downloads it into a folder called `node_modules`. This folder can get very large (thousands of files). You should **never commit it to Git** — always add it to your `.gitignore`.

When someone else clones your project, they just run `npm install` and npm reads `package.json` to download all the required packages automatically.

```bash
# Install all packages listed in package.json
npm install
```

### Scripts

The `scripts` section in `package.json` lets you define shortcuts for commands you run often.

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

You run them like this:

```bash
npm run dev      # runs TypeScript directly with hot reload
npm run build    # compiles TypeScript to JavaScript
npm start        # runs the compiled output
```

Note: `start` and `test` are special — you can run them without the `run` keyword. All other custom scripts need `npm run`.

### Common NPM Commands

```bash
npm init -y                  # Create package.json
npm install <package>        # Install a production package
npm install -D <package>     # Install a dev package
npm install                  # Install all packages from package.json
npm uninstall <package>      # Remove a package
npm run <script>             # Run a script from package.json
npm start                    # Run the start script
```

### Commonly Used Packages

Here are the most popular packages you'll encounter in real Node.js projects:

#### Web Frameworks
| Package | Install | What it does |
|---------|---------|-------------|
| `express` | `npm install express` | Minimal web framework for building servers and APIs |
| `fastify` | `npm install fastify` | Faster alternative to Express |

#### Environment Variables
| Package | Install | What it does |
|---------|---------|-------------|
| `dotenv` | `npm install dotenv` | Loads variables from a `.env` file into `process.env` |

#### Database
| Package | Install | What it does |
|---------|---------|-------------|
| `mongoose` | `npm install mongoose` | Connect and work with MongoDB |
| `pg` | `npm install pg` | Connect to PostgreSQL |
| `mysql2` | `npm install mysql2` | Connect to MySQL |
| `prisma` | `npm install -D prisma` | Modern ORM for SQL databases |

#### Authentication & Security
| Package | Install | What it does |
|---------|---------|-------------|
| `bcrypt` | `npm install bcrypt` | Hash passwords securely |
| `jsonwebtoken` | `npm install jsonwebtoken` | Create and verify JWT tokens |
| `cors` | `npm install cors` | Allow/restrict cross-origin requests |
| `helmet` | `npm install helmet` | Sets secure HTTP headers |

#### Validation
| Package | Install | What it does |
|---------|---------|-------------|
| `zod` | `npm install zod` | Schema validation for request data |
| `joi` | `npm install joi` | Alternative schema validation library |

#### Development Tools
| Package | Install | What it does |
|---------|---------|-------------|
| `nodemon` | `npm install -D nodemon` | Auto-restarts server on file changes |
| `tsx` | `npm install -D tsx` | Run TypeScript files directly (fast) |
| `ts-node` | `npm install -D ts-node` | Run TypeScript files directly |
| `typescript` | `npm install -D typescript` | TypeScript compiler |
| `@types/node` | `npm install -D @types/node` | TypeScript types for Node.js built-ins |
| `@types/express` | `npm install -D @types/express` | TypeScript types for Express |

#### HTTP Requests (calling other APIs)
| Package | Install | What it does |
|---------|---------|-------------|
| `axios` | `npm install axios` | Make HTTP requests to external APIs |
| `node-fetch` | `npm install node-fetch` | Fetch API for Node.js |

#### Utilities
| Package | Install | What it does |
|---------|---------|-------------|
| `lodash` | `npm install lodash` | Utility functions for arrays, objects, strings |
| `uuid` | `npm install uuid` | Generate unique IDs |
| `dayjs` | `npm install dayjs` | Parse and format dates (lightweight) |
| `morgan` | `npm install morgan` | HTTP request logger middleware for Express |

---

## Node.js Modules

### What is a Module?

A module is just a file. In Node.js, every file is its own module. This helps you organize your code into separate files instead of putting everything in one giant file.

Node.js has three types of modules:

**1. Built-in modules** — come with Node.js, no installation needed

```typescript
import fs from 'fs';       // file system
import path from 'path';   // file paths
import http from 'http';   // HTTP server
```

**2. Third-party modules** — installed via npm

```typescript
import express from 'express';
```

**3. Your own modules** — files you create yourself

```typescript
// utils.ts
export function add(a: number, b: number): number {
  return a + b;
}

// index.ts
import { add } from './utils';
```

### import vs require

With TypeScript, you always use `import`/`export` (ES Module syntax). This is cleaner and gives you full type support.

```typescript
// TypeScript — always use this
import express from 'express';
import { Router, Request, Response } from 'express';
```

The old `require()` syntax is CommonJS (plain JavaScript). TypeScript compiles your `import` statements down to `require()` behind the scenes when targeting Node.js, so you don't need to worry about it.

---

## Your First Node.js App

Let's build a simple HTTP server using only Node.js built-in modules — no Express yet.

```bash
mkdir my-app && cd my-app
npm init -y
npm install -D typescript tsx @types/node
npx tsc --init
mkdir src
touch src/index.ts
```

**src/index.ts:**
```typescript
import http, { IncomingMessage, ServerResponse } from 'http';

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Node.js!');
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

Run it:
```bash
npx tsx src/index.ts
```

Open your browser and go to `http://localhost:3000`. You'll see "Hello from Node.js!".

This works, but notice how much manual work is involved — setting headers, handling routes, parsing request bodies. This is exactly the problem Express solves.

---

## What is REST?

Before jumping into Express and building APIs, you need to understand REST — because almost every API you'll build or consume follows it.

### REST stands for Representational State Transfer

That sounds complicated, but the idea is simple. REST is a **set of rules** for how a client (like a mobile app or browser) and a server should communicate over the internet.

It's not a library or a framework — it's just a convention. A way of agreeing on how requests and responses should be structured so that any client can talk to any server.

### The Client-Server Model

REST is built on the idea that there are two separate sides:

- **Client** — the one making requests (browser, mobile app, Postman)
- **Server** — the one responding with data

They communicate over **HTTP**, the same protocol your browser uses to load websites.

```
Client                        Server
  |                              |
  |  GET /listings               |
  | ---------------------------> |
  |                              |
  |  200 OK + JSON data          |
  | <--------------------------- |
  |                              |
```

### Resources

In REST, everything is a **resource**. A resource is just a thing your API manages — a user, a listing, a product, an order.

Each resource has its own URL:

```
/users          → the users resource
/listings       → the listings resource
/orders         → the orders resource
/users/42       → a specific user with id 42
```

The URL tells you **what** you're working with. The HTTP method tells you **what action** you're performing on it.

### HTTP Methods — The Actions

REST uses HTTP methods to describe what you want to do with a resource:

| Method | Action | Example |
|--------|--------|---------|
| GET | Read / retrieve data | Get all listings |
| POST | Create new data | Create a new listing |
| PUT | Replace / update data | Update a listing fully |
| PATCH | Partially update data | Update only the price |
| DELETE | Delete data | Delete a listing |

This combination of URL + method is what makes REST predictable. Any developer looking at `DELETE /users/5` immediately knows what it does — no documentation needed.

### REST is Stateless

This is one of the core rules of REST. **Stateless** means the server does not remember anything about previous requests.

Every request must contain all the information the server needs to process it. The server doesn't store session data between requests.

**Analogy:** Think of a vending machine. Every time you use it, you insert money and make a selection. The machine doesn't remember you from last time. Each interaction is completely independent.

This is why APIs use things like **tokens** (JWT) — because the client has to send its identity with every single request since the server doesn't remember who you are.

### What is JSON?

REST APIs almost always send and receive data in **JSON** (JavaScript Object Notation). It's a lightweight text format that's easy for both humans and machines to read.

```json
{
  "id": "1",
  "title": "Cozy apartment in downtown",
  "location": "New York, NY",
  "pricePerNight": 120,
  "guests": 2
}
```

When a client sends a POST request to create a listing, it sends JSON in the request body. When the server responds, it sends JSON back. Express makes this easy with `express.json()` middleware and `res.json()`.

### RESTful URL Design

Good REST API URLs follow a consistent pattern. Here are the rules:

- Use **nouns**, not verbs — the method already describes the action
- Use **plural** names for collections
- Use **lowercase** and hyphens, not camelCase

```
✅ Good
GET    /listings          → get all listings
GET    /listings/1        → get listing with id 1
POST   /listings          → create a new listing
PUT    /listings/1        → update listing with id 1
DELETE /listings/1        → delete listing with id 1

❌ Bad
GET    /getListings
POST   /createNewListing
GET    /listing/get/1
```

### HTTP Status Codes

The server always responds with a **status code** that tells the client what happened. You've already seen these in browsers — 404 means page not found, 500 means something crashed.

| Code | Meaning | When to use |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | New resource was created (POST) |
| 204 | No Content | Success but nothing to return (DELETE) |
| 400 | Bad Request | Client sent invalid data |
| 401 | Unauthorized | Not logged in |
| 403 | Forbidden | Logged in but not allowed |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Something broke on the server |

Using the right status code matters. It tells the client exactly what happened so it can react accordingly — show an error message, redirect, retry, etc.

### Putting It Together

Here's what a full REST interaction looks like for creating a listing:

```
Client sends:
  POST /listings
  Content-Type: application/json

  {
    "title": "Studio in Brooklyn",
    "location": "Brooklyn, NY",
    "pricePerNight": 95,
    "guests": 1
  }

Server responds:
  201 Created
  Content-Type: application/json

  {
    "id": "4",
    "title": "Studio in Brooklyn",
    "location": "Brooklyn, NY",
    "pricePerNight": 95,
    "guests": 1
  }
```

This is exactly the pattern you'll follow when building Express APIs.

---

## Introduction to Express

### What is Express?

Express is a **web framework** built on top of Node.js. It doesn't replace Node.js — it sits on top of it and gives you a cleaner, simpler way to build servers and APIs.

Without Express, you'd have to manually:
- Parse the URL to figure out which route was requested
- Parse the request body to read incoming data
- Set response headers every time
- Handle different HTTP methods (GET, POST, etc.) yourself

Express handles all of that for you with a clean API.

### What is a Framework?

A framework is a set of tools and conventions that gives your project structure and handles common tasks so you don't have to reinvent the wheel every time.

Think of it like building a house:
- Without a framework = you make your own bricks, mix your own cement, design everything from scratch
- With a framework = you get pre-made materials and a blueprint, you just assemble

### Installing Express

```bash
npm install express
npm install -D typescript tsx @types/node @types/express
```

### Basic Express Server

```typescript
import express, { Request, Response } from 'express';

const app = express();
const PORT = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Define a route
app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Express!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

Let's break this down line by line:

- `import express from 'express'` — imports the Express package
- `Request, Response` — TypeScript types for `req` and `res`, imported from Express
- `express()` — creates an Express application
- `app.use(express.json())` — tells Express to automatically parse incoming JSON data
- `app.get('/', ...)` — defines what happens when someone visits the `/` route with a GET request
- `req: Request` — the incoming request (typed so your editor knows all available properties)
- `res: Response` — the response you send back to the client
- `app.listen(PORT, ...)` — starts the server on port 3000

### What is a Port?

A port is like a door number on a building. Your computer has one IP address, but thousands of ports. Different services run on different ports:

- Port 80 → HTTP (websites)
- Port 443 → HTTPS (secure websites)
- Port 3000, 8000, 8080 → commonly used for local development

When you visit `http://localhost:3000`, you're saying: "connect to my own machine (`localhost`) through door number `3000`".

### tsx — Run TypeScript with Hot Reload

Instead of `nodemon`, we use `tsx` which runs TypeScript files directly and watches for changes — no manual compilation needed.

```bash
npm install -D tsx
```

Add to `package.json`:
```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

Now run:
```bash
npm run dev
```

---

## Routing in Express

### What is a Route?

A route is a combination of a **URL path** and an **HTTP method**. It defines what your server does when a specific request comes in.

HTTP methods you'll use most:
- `GET` — retrieve data (e.g. get a list of users)
- `POST` — create new data (e.g. create a new user)
- `PUT` — update existing data (e.g. update a user's name)
- `DELETE` — delete data (e.g. delete a user)

### Defining Routes

```typescript
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

// GET /users — return a list of users
app.get('/users', (req: Request, res: Response) => {
  res.json({ users: [] });
});

// POST /users — create a new user
app.post('/users', (req: Request, res: Response) => {
  const body = req.body;
  res.status(201).json({ created: body });
});

// GET /users/:id — get a specific user by ID
app.get('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ id });
});
```

### req and res

These two objects are available in every route handler:

**req (request)** — contains everything about the incoming request:
- `req.params` — URL parameters like `:id`
- `req.query` — query string values like `?page=2`
- `req.body` — the request body (for POST/PUT requests)

**res (response)** — used to send a response back:
- `res.send()` — send plain text or HTML
- `res.json()` — send JSON data
- `res.status(404).json(...)` — send a response with a specific status code

### HTTP Status Codes

Status codes tell the client what happened:

| Code | Meaning |
|------|---------|
| 200 | OK — request succeeded |
| 201 | Created — new resource was created |
| 400 | Bad Request — something wrong with the request |
| 404 | Not Found — resource doesn't exist |
| 500 | Internal Server Error — something broke on the server |

---

## Middleware

### What is Middleware?

Middleware is a function that runs **between** the incoming request and the final route handler. It has access to `req`, `res`, and a `next` function.

Think of it like a security checkpoint at an airport. Before you reach your gate (the route), you pass through multiple checkpoints (middleware) — ID check, bag scan, boarding pass check. Each checkpoint either lets you through (calls `next()`) or stops you.

```
Request → Middleware 1 → Middleware 2 → Route Handler → Response
```

### How Middleware Works

```typescript
import { Request, Response, NextFunction } from 'express';

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url}`);
  next(); // IMPORTANT: call next() to move to the next step
});
```

If you forget to call `next()`, the request gets stuck and the client never gets a response.

`NextFunction` is the TypeScript type for the `next` parameter — always import it from `express`.

### Built-in Express Middleware

```typescript
app.use(express.json());            // parses JSON request bodies
app.use(express.urlencoded());      // parses form data
app.use(express.static('public'));  // serves static files (HTML, CSS, images)
```

### Middleware Order Matters

Middleware runs in the order you define it. Always put your middleware **before** your routes.

```typescript
import express, { Request, Response, NextFunction } from 'express';

const app = express();

// Middleware first
app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Routes after
app.get('/', (req: Request, res: Response) => {
  res.send('Hello!');
});
```
---

## Project Structure

As your app grows, putting everything in one file becomes messy. Here's a clean structure for a beginner Express project:

```
my-app/
├── src/
│   ├── routes/
│   │   └── users.ts      # user-related routes
│   └── index.ts          # entry point
├── package.json
├── tsconfig.json
└── .gitignore
```

**src/routes/users.ts** — group related routes using `express.Router()`:

```typescript
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({ users: [] });
});

router.post('/', (req: Request, res: Response) => {
  res.status(201).json({ created: req.body });
});

export default router;
```

**src/index.ts** — import and mount the router:

```typescript
import express from 'express';
import usersRouter from './routes/users';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/users', usersRouter);

app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
```

Now `GET /users` and `POST /users` are handled by `usersRouter`, keeping your `index.js` clean.

### .gitignore

Always create a `.gitignore` file to avoid committing files that shouldn't be in version control:

```
node_modules/
.env
*.log
```

---

## Common Project Structures

As projects grow, you need a consistent way to organize your code. Here are the most common folder structures used in real-world Node.js/Express applications.

### Small Projects (Beginner)

For learning or small APIs with just a few routes:

```
my-app/
├── src/
│   ├── routes/
│   │   ├── users.ts
│   │   └── products.ts
│   └── index.ts
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

**When to use:** Learning, prototypes, APIs with 2-5 routes

### Medium Projects (MVC Pattern)

MVC stands for Model-View-Controller. It separates your code into three layers:

- **Models** — data structure and database logic
- **Views** — what the user sees (not needed for APIs)
- **Controllers** — business logic (what happens when a route is hit)

```
my-app/
├── src/
│   ├── controllers/
│   │   ├── userController.ts      # business logic for users
│   │   └── productController.ts
│   ├── models/
│   │   ├── User.ts                # user data structure
│   │   └── Product.ts
│   ├── routes/
│   │   ├── userRoutes.ts          # just route definitions
│   │   └── productRoutes.ts
│   ├── middlewares/
│   │   ├── auth.ts                # authentication middleware
│   │   └── errorHandler.ts        # error handling middleware
│   ├── config/
│   │   └── database.ts            # database connection
│   └── index.ts
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

**When to use:** Most production apps, teams of 2-10 developers

**How it works:**

1. **Route** receives the request → calls a **Controller** function
2. **Controller** contains the logic → talks to the **Model** if needed
3. **Model** handles database operations → returns data to Controller
4. **Controller** sends response back to client

**Example flow:**

```
GET /users/42
  ↓
routes/userRoutes.js → calls userController.getUser()
  ↓
controllers/userController.js → calls User.findById(42)
  ↓
models/User.js → queries database
  ↓
returns user data → controller sends response
```

### Large Projects (Feature-Based)

For large teams or complex apps, organize by **feature** instead of by type:

```
my-app/
├── src/
│   ├── features/
│   │   ├── users/
│   │   │   ├── user.model.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.routes.ts
│   │   │   └── user.service.ts     # reusable business logic
│   │   ├── products/
│   │   │   ├── product.model.ts
│   │   │   ├── product.controller.ts
│   │   │   ├── product.routes.ts
│   │   │   └── product.service.ts
│   │   └── orders/
│   │       ├── order.model.ts
│   │       ├── order.controller.ts
│   │       ├── order.routes.ts
│   │       └── order.service.ts
│   ├── shared/
│   │   ├── middlewares/
│   │   │   ├── auth.ts
│   │   │   └── errorHandler.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   └── validator.ts
│   │   └── config/
│   │       ├── database.ts
│   │       └── env.ts
│   └── index.ts
├── tests/
│   ├── users.test.ts
│   └── products.test.ts
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

**When to use:** Large teams (10+ developers), microservices, apps with 20+ features

**Benefits:**
- Everything related to "users" is in one folder
- Easy to find and modify features
- Teams can work on different features without conflicts
- Easy to extract a feature into its own microservice later

### Folder Explanations

| Folder | What goes here |
|--------|----------------|
| `routes/` | Route definitions only — no logic, just map URLs to controllers |
| `controllers/` | Business logic — what happens when a route is hit |
| `models/` | Data structure and database queries |
| `services/` | Reusable business logic that multiple controllers might need |
| `middlewares/` | Functions that run before routes (auth, logging, validation) |
| `config/` | Configuration files (database, environment variables) |
| `utils/` or `helpers/` | Utility functions (date formatting, string manipulation) |
| `tests/` | Test files |
| `public/` | Static files (images, CSS, HTML) if serving a frontend |

### Which Structure Should You Use?

| Project Size | Structure | Why |
|--------------|-----------|-----|
| Learning / Small API | Simple (routes + index) | Easy to understand, no overhead |
| Medium API (5-20 routes) | MVC Pattern | Industry standard, scales well |
| Large API (20+ routes) | Feature-Based | Easier to navigate, team-friendly |
| Microservices | Feature-Based | Each feature can become its own service |

### Key Principles (Apply to All Structures)

1. **Separation of Concerns** — routes don't contain logic, controllers don't query databases directly
2. **DRY (Don't Repeat Yourself)** — reusable code goes in services or utils
3. **Single Responsibility** — each file does one thing well
4. **Consistent Naming** — use plural for routes (`users.js`), singular for models (`User.js`)

---

## Summary

| Concept | What it is |
|--------|------------|
| Node.js | JavaScript runtime that runs outside the browser |
| V8 Engine | Compiles JavaScript to machine code |
| Event Loop | Lets Node.js handle many requests without blocking |
| NPM | Package manager — installs and manages third-party code |
| package.json | Config file that tracks your project's packages and scripts |
| node_modules | Folder where installed packages live (don't commit to Git) |
| REST | A set of rules for how clients and servers communicate over HTTP |
| Resource | A thing your API manages (user, listing, order) — represented by a URL |
| HTTP Methods | GET, POST, PUT, PATCH, DELETE — describe the action on a resource |
| Stateless | Every request must carry all info the server needs — server remembers nothing |
| JSON | Data format used to send and receive data in REST APIs |
| Status Codes | Numbers that tell the client what happened (200, 201, 404, 500) |
| Express | Web framework that simplifies building servers and APIs |
| Route | A URL + HTTP method combination that triggers a handler |
| Middleware | Functions that run between request and response |
| req / res | Request and response objects available in every route |

---

**Resources:**
- [Node.js Docs](https://nodejs.org/docs)
- [NPM Docs](https://docs.npmjs.com/)
- [Express Docs](https://expressjs.com/)
