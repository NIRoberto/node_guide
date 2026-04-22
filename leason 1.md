# Lesson 1: Node.js, NPM & Express Basics

## Table of Contents
1. [What is Node.js?](#what-is-nodejs)
2. [How Node.js Works](#how-nodejs-works)
3. [Installing Node.js & NPM](#installing-nodejs--npm)
4. [NPM Basics](#npm-basics)
5. [Node.js Modules](#nodejs-modules)
6. [Your First Node.js App](#your-first-nodejs-app)
7. [Introduction to Express](#introduction-to-express)
8. [Routing in Express](#routing-in-express)
9. [Middleware](#middleware)
10. [Project Structure](#project-structure)

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
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.11"
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
npm install -D nodemon
```

Examples:
- `express` → dependency (your server needs it to run)
- `nodemon` → devDependency (just a tool to auto-restart during development)

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
  "start": "node src/index.js",
  "dev": "nodemon src/index.js"
}
```

You run them like this:

```bash
npm start        # runs "node src/index.js"
npm run dev      # runs "nodemon src/index.js"
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

```javascript
const fs = require('fs');       // file system
const path = require('path');   // file paths
const http = require('http');   // HTTP server
```

**2. Third-party modules** — installed via npm

```javascript
const express = require('express');
```

**3. Your own modules** — files you create yourself

```javascript
// utils.js
function add(a, b) {
  return a + b;
}
module.exports = { add };

// index.js
const { add } = require('./utils');
```

### require vs import

You'll see two ways to import modules in Node.js:

```javascript
// CommonJS (older, default in Node.js)
const express = require('express');

// ES Modules (newer, used in modern JS)
import express from 'express';
```

For beginners, stick with `require`. It's the default in Node.js and you'll see it in most tutorials and documentation.

---

## Your First Node.js App

Let's build a simple HTTP server using only Node.js built-in modules — no Express yet.

```bash
mkdir my-app && cd my-app
npm init -y
mkdir src
touch src/index.js
```

**src/index.js:**
```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Node.js!');
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

Run it:
```bash
node src/index.js
```

Open your browser and go to `http://localhost:3000`. You'll see "Hello from Node.js!".

This works, but notice how much manual work is involved — setting headers, handling routes, parsing request bodies. This is exactly the problem Express solves.

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
```

### Basic Express Server

```javascript
const express = require('express');
const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// Define a route
app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

Let's break this down line by line:

- `require('express')` — imports the Express package
- `express()` — creates an Express application
- `app.use(express.json())` — tells Express to automatically parse incoming JSON data
- `app.get('/', ...)` — defines what happens when someone visits the `/` route with a GET request
- `req` — the incoming request (contains URL, headers, body, etc.)
- `res` — the response you send back to the client
- `app.listen(3000, ...)` — starts the server on port 3000

### What is a Port?

A port is like a door number on a building. Your computer has one IP address, but thousands of ports. Different services run on different ports:

- Port 80 → HTTP (websites)
- Port 443 → HTTPS (secure websites)
- Port 3000, 8000, 8080 → commonly used for local development

When you visit `http://localhost:3000`, you're saying: "connect to my own machine (`localhost`) through door number `3000`".

### nodemon — Auto-restart on Save

Every time you change your code, you'd have to stop and restart the server manually. `nodemon` watches your files and restarts the server automatically when you save.

```bash
npm install -D nodemon
```

Add to `package.json`:
```json
"scripts": {
  "dev": "nodemon src/index.js",
  "start": "node src/index.js"
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

```javascript
// GET /users — return a list of users
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// POST /users — create a new user
app.post('/users', (req, res) => {
  const body = req.body; // the data sent in the request
  res.status(201).json({ created: body });
});

// GET /users/:id — get a specific user by ID
app.get('/users/:id', (req, res) => {
  const id = req.params.id; // grab the :id from the URL
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

```javascript
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`); // log every request
  next(); // IMPORTANT: call next() to move to the next step
});
```

If you forget to call `next()`, the request gets stuck and the client never gets a response.

### Built-in Express Middleware

```javascript
app.use(express.json());       // parses JSON request bodies
app.use(express.urlencoded()); // parses form data
app.use(express.static('public')); // serves static files (HTML, CSS, images)
```

### Middleware Order Matters

Middleware runs in the order you define it. Always put your middleware **before** your routes.

```javascript
const express = require('express');
const app = express();

// Middleware first
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Routes after
app.get('/', (req, res) => {
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
│   │   └── users.js      # user-related routes
│   └── index.js          # entry point
├── package.json
└── .gitignore
```

**src/routes/users.js** — group related routes using `express.Router()`:

```javascript
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ users: [] });
});

router.post('/', (req, res) => {
  res.status(201).json({ created: req.body });
});

module.exports = router;
```

**src/index.js** — import and mount the router:

```javascript
const express = require('express');
const usersRouter = require('./routes/users');

const app = express();
app.use(express.json());

app.use('/users', usersRouter); // all routes in usersRouter are prefixed with /users

app.listen(3000, () => console.log('Server on http://localhost:3000'));
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

## Summary

| Concept | What it is |
|--------|------------|
| Node.js | JavaScript runtime that runs outside the browser |
| V8 Engine | Compiles JavaScript to machine code |
| Event Loop | Lets Node.js handle many requests without blocking |
| NPM | Package manager — installs and manages third-party code |
| package.json | Config file that tracks your project's packages and scripts |
| node_modules | Folder where installed packages live (don't commit to Git) |
| Express | Web framework that simplifies building servers and APIs |
| Route | A URL + HTTP method combination that triggers a handler |
| Middleware | Functions that run between request and response |
| req / res | Request and response objects available in every route |

---

**Resources:**
- [Node.js Docs](https://nodejs.org/docs)
- [NPM Docs](https://docs.npmjs.com/)
- [Express Docs](https://expressjs.com/)
