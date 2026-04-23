# Lesson 3: Authentication with JWT & Bcrypt

## Table of Contents
1. [What is Authentication?](#what-is-authentication)
2. [Authentication vs Authorization](#authentication-vs-authorization)
3. [How Authentication Works in REST APIs](#how-authentication-works-in-rest-apis)
4. [What is JWT?](#what-is-jwt)
5. [What is Bcrypt?](#what-is-bcrypt)
6. [Setting Up Authentication](#setting-up-authentication)
7. [Updating the Prisma Schema](#updating-the-prisma-schema)
8. [Auth Controller](#auth-controller)
9. [Auth Middleware](#auth-middleware)
10. [Auth Routes](#auth-routes)
11. [Protecting Routes](#protecting-routes)
12. [How It All Fits Together](#how-it-all-fits-together)

---

## What is Authentication?

In lesson 2 we built a users API — anyone could create, read, update, or delete users with no restrictions. In a real app, that's a serious problem.

**Authentication** is the process of verifying **who you are**.

Think of it like a hotel:
- You walk up to the front desk and show your ID
- The hotel verifies your identity and gives you a **key card**
- Every time you want to enter your room, you use that key card
- The door doesn't ask for your ID again — it just checks the key card

In APIs:
- User sends their email and password → server verifies → server gives a **token**
- Every protected request includes that token → server checks the token → allows or denies

---

## Authentication vs Authorization

These two words are often confused. They are different things.

**Authentication** — verifying who you are
- "Are you really Alice?"
- Handled by: login with email + password

**Authorization** — verifying what you're allowed to do
- "Is Alice allowed to delete this listing?"
- Handled by: roles, permissions, ownership checks

**Real-world analogy:**
```
Authentication = Showing your passport at the airport (proving who you are)
Authorization  = Your boarding pass (proving you're allowed on this specific flight)
```

In this lesson we focus on **authentication**. Authorization (roles, permissions) comes later.

---

## How Authentication Works in REST APIs

Since REST is **stateless** (the server remembers nothing between requests), we can't use traditional sessions. Instead we use **tokens**.

Here's the full flow:

```
1. REGISTER
   Client → POST /auth/register { name, email, password }
   Server → hashes password → saves user to DB → responds 201

2. LOGIN
   Client → POST /auth/login { email, password }
   Server → finds user → compares password hash → generates JWT token
   Server → responds with { token }

3. ACCESS PROTECTED ROUTE
   Client → GET /users (with Authorization: Bearer <token> header)
   Server → reads token from header → verifies token → allows request
   Server → responds with data

4. INVALID/MISSING TOKEN
   Client → GET /users (no token or wrong token)
   Server → responds 401 Unauthorized
```

The token is like the hotel key card — the client stores it and sends it with every request that needs authentication.

---

## What is JWT?

JWT stands for **JSON Web Token**. It's the most common way to handle authentication in REST APIs.

A JWT is a string made of three parts separated by dots:

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.abc123xyz
      HEADER              PAYLOAD         SIGNATURE
```

- **Header** — algorithm used to sign the token (e.g. HS256)
- **Payload** — the data stored inside the token (e.g. `{ userId: 1 }`)
- **Signature** — a hash that proves the token hasn't been tampered with

### Why is JWT secure?

The signature is created using a **secret key** that only your server knows. If anyone tries to modify the payload (e.g. change `userId: 1` to `userId: 99`), the signature won't match and the server will reject it.

**Important:** The payload is only **encoded**, not **encrypted**. Anyone can decode it and read the data. Never store sensitive information (passwords, credit cards) in a JWT payload.

### JWT Lifecycle

```
Server creates token:
  payload = { userId: 1 }
  secret  = "my-secret-key"
  token   = sign(payload, secret, { expiresIn: "7d" })

Client stores token (localStorage, cookie, memory)

Client sends token with every request:
  Authorization: Bearer eyJhbGci...

Server verifies token:
  decoded = verify(token, secret)
  → if valid: decoded = { userId: 1, iat: ..., exp: ... }
  → if invalid/expired: throws error → respond 401
```

---

## What is Bcrypt?

Bcrypt is a **password hashing library**. It takes a plain text password and turns it into a fixed-length string that cannot be reversed.

### Why not store passwords as plain text?

If your database gets hacked and passwords are stored as plain text, every user's account on every website they use is compromised. This happens more often than you'd think — major companies like LinkedIn, Adobe, and RockYou have all had plain text or weakly hashed password leaks.

Hashing means even if someone steals your database, they can't read the passwords.

### What is Hashing?

Hashing is a **one-way transformation**. You put a password in, you get a fixed-length string out. There is no way to reverse it back to the original password.

```
"mypassword123"  →  hash()  →  "$2b$10$N9qo8uLO..."
"$2b$10$N9qo8uLO..."  →  reverse?  →  ❌ impossible
```

This is different from **encryption**, which is two-way (you can decrypt it back). Hashing is intentionally irreversible.

### Why not use MD5 or SHA256?

MD5 and SHA256 are general-purpose hashing algorithms — they were designed to be **fast**. Fast is great for checksums and file verification, but terrible for passwords.

Why? Because attackers use **brute force** — they hash millions of common passwords and compare the results against your stolen hashes.

```
Attacker has stolen hash: "5f4dcc3b5aa765d61d8327deb882cf99"
Attacker knows: MD5("password") = "5f4dcc3b5aa765d61d8327deb882cf99"
Attacker cracks it in milliseconds.
```

With modern GPUs, attackers can try **billions of MD5/SHA256 hashes per second**.

Bcrypt is intentionally **slow** — designed specifically for password hashing. It takes milliseconds per hash, which is fine for a login, but makes brute force attacks take years instead of seconds.

### What is a Rainbow Table Attack?

A rainbow table is a pre-computed list of hashes for common passwords:

```
"password"   → 5f4dcc3b5aa765d61d8327deb882cf99
"123456"     → e10adc3949ba59abbe56e057f20f883e
"qwerty"     → d8578edf8458ce06fbc5bb76a58c5ca4
... millions more
```

An attacker just looks up your hash in the table — no computation needed.

### What is a Salt?

A **salt** is a random string that bcrypt generates and adds to your password before hashing. Every user gets a unique salt.

```
password = "mypassword123"
salt     = "$2b$10$N9qo8uLOickgx2ZMRZoMye"  (random, generated by bcrypt)
hash     = bcrypt(password + salt)
```

Because every hash has a unique salt, two users with the same password will have completely different hashes:

```
User A: "mypassword123" → "$2b$10$abc...xyz"
User B: "mypassword123" → "$2b$10$def...uvw"  ← completely different!
```

This defeats rainbow table attacks entirely — the attacker would need a separate table for every possible salt, which is computationally impossible.

**The salt is stored inside the hash itself** — bcrypt embeds it in the output string, so you never need to store it separately. When you call `bcrypt.compare()`, it extracts the salt from the stored hash automatically.

### Reading a Bcrypt Hash

A bcrypt hash looks like this:

```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

Breaking it down:

| Part | Value | Meaning |
|------|-------|---------|
| `$2b$` | version | bcrypt algorithm version |
| `10` | cost factor | salt rounds — how slow the hash is |
| next 22 chars | salt | the random salt used for this hash |
| remaining chars | hash | the actual hashed password |

### Salt Rounds (Cost Factor)

The number `10` in `bcrypt.hash(password, 10)` is the **cost factor** (also called salt rounds). It controls how many times the hashing algorithm runs internally.

```
Salt rounds = 10  →  2^10  = 1,024 iterations
Salt rounds = 12  →  2^12  = 4,096 iterations
Salt rounds = 14  →  2^14  = 16,384 iterations
```

Each increase by 1 doubles the time it takes to hash:

| Salt Rounds | Time per hash | Security |
|-------------|--------------|----------|
| 8 | ~1ms | Too fast, not recommended |
| 10 | ~100ms | Good for most apps |
| 12 | ~400ms | High security apps |
| 14 | ~1.5s | Very high security (slow for users) |

**10-12 is the standard** for most production apps. As hardware gets faster over time, you can increase this number.

### How Bcrypt works

```
HASHING (at registration):
  password = "mypassword123"
  hash     = bcrypt.hash(password, 10)
  → bcrypt generates a random salt
  → runs the algorithm 2^10 = 1,024 times
  → outputs "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
  → store this hash in the database, NEVER the plain password

COMPARING (at login):
  bcrypt.compare("mypassword123", storedHash)
  → extracts the salt from storedHash
  → hashes "mypassword123" with that same salt
  → compares the result to storedHash
  → returns true if they match, false if not
```

`bcrypt.compare()` is **timing-safe** — it always takes the same amount of time regardless of whether the password matches or not. This prevents **timing attacks** where an attacker could figure out partial matches by measuring response times.

---

## Setting Up Authentication

### Install packages

```bash
npm install bcrypt jsonwebtoken
npm install -D @types/bcrypt @types/jsonwebtoken
```

| Package | What it does |
|---------|-------------|
| `bcrypt` | Hash and compare passwords |
| `jsonwebtoken` | Create and verify JWT tokens |
| `@types/bcrypt` | TypeScript types for bcrypt |
| `@types/jsonwebtoken` | TypeScript types for jsonwebtoken |

### Add JWT secret to .env

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/your_db"
JWT_SECRET="your-super-secret-key-change-this-in-production"
PORT=3000
```

The `JWT_SECRET` is used to sign and verify tokens. It should be a long random string. Never commit it to Git.

---

## Updating the Prisma Schema

We need to add a `password` field to the User model to store the hashed password.

**prisma/schema.prisma:**
```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  username  String   @unique
  password  String                    // stores the bcrypt hash
  createdAt DateTime @default(now())
}
```

Run the migration:
```bash
npx prisma migrate dev --name add_password_to_user
```

This updates the database table and regenerates the Prisma Client with the new `password` field.

---

## Auth Controller

Create a new controller specifically for authentication — register and login.

**src/controllers/auth.controller.ts:**
```typescript
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env["JWT_SECRET"] as string;

// ─── Register ─────────────────────────────────────────────────────────────────
// Creates a new user account
// Password is hashed before saving — never store plain text passwords

export async function register(req: Request, res: Response) {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Check if email is already taken
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already in use" });
  }

  // Hash the password before saving
  // bcrypt.hash(password, saltRounds) — saltRounds controls how slow the hash is
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, username, password: hashedPassword },
  });

  // Never return the password in the response — even the hashed version
  const { password: _, ...userWithoutPassword } = user;

  res.status(201).json(userWithoutPassword);
}

// ─── Login ────────────────────────────────────────────────────────────────────
// Verifies credentials and returns a JWT token
// The client stores this token and sends it with every protected request

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // Find user by email
  const user = await prisma.user.findUnique({ where: { email } });

  // Use a generic error message — don't tell the client whether the email
  // or password was wrong, as that leaks information to attackers
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Compare the plain password against the stored hash
  // bcrypt.compare handles the salt automatically
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Sign a JWT token with the user's id in the payload
  // The token expires in 7 days — after that the user must log in again
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

  res.json({ token });
}
```

---

## Auth Middleware

Middleware that runs before protected routes to verify the JWT token.

**src/middlewares/auth.middleware.ts:**
```typescript
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] as string;

// Extend the Express Request type to include the authenticated user's id
// This lets us access req.userId in any route handler after this middleware runs
export interface AuthRequest extends Request {
  userId?: number;
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
// Reads the JWT from the Authorization header, verifies it, and attaches
// the userId to the request so route handlers know who is making the request.
//
// Expected header format:
//   Authorization: Bearer eyJhbGci...
//
// If the token is missing or invalid, the request is rejected with 401.
// If valid, next() is called and the request continues to the route handler.

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];

  // The header must exist and start with "Bearer "
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  // Extract the token part after "Bearer "
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // verify() throws if the token is invalid or expired
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };

    // Attach userId to the request so downstream handlers can use it
    req.userId = decoded.userId;

    next();
  } catch {
    // Token is invalid, expired, or tampered with
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
```

---

## Auth Routes

**src/routes/auth.routes.ts:**
```typescript
import { Router } from "express";
import { register, login } from "../controllers/auth.controller.js";

const router = Router();

// POST /auth/register — create a new account
router.post("/register", register);

// POST /auth/login — login and receive a token
router.post("/login", login);

export default router;
```

---

## Protecting Routes

Now mount the auth routes and protect the users routes with the `authenticate` middleware.

**src/index.ts:**
```typescript
import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { connectDB } from "./config/prisma.js";
import usersRouter from "./routes/users.routes.js";
import authRouter from "./routes/auth.routes.js";
import { authenticate } from "./middlewares/auth.middleware.js";

const app = express();
const PORT = 3000;

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Airbnb application");
});

// Public routes — no token required
app.use("/auth", authRouter);

// Protected routes — authenticate middleware runs before every /users route
// If the token is missing or invalid, the request never reaches the controller
app.use("/users", authenticate, usersRouter);

// ─── Start Server ─────────────────────────────────────────────────────────────

async function main() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
```

---

## How It All Fits Together

### Updated project structure

```
src/
├── config/
│   └── prisma.ts
├── controllers/
│   ├── auth.controller.ts     ← new
│   └── users.controller.ts
├── middlewares/
│   └── auth.middleware.ts     ← new
├── routes/
│   ├── auth.routes.ts         ← new
│   └── users.routes.ts
└── index.ts
```

### Full request flow

```
POST /auth/register
  ↓
auth.routes.ts → register()
  ↓
bcrypt.hash(password) → prisma.user.create()
  ↓
201 + user (without password)

─────────────────────────────────────

POST /auth/login
  ↓
auth.routes.ts → login()
  ↓
prisma.user.findUnique() → bcrypt.compare()
  ↓
jwt.sign({ userId }) → 200 + { token }

─────────────────────────────────────

GET /users  (with Authorization: Bearer <token>)
  ↓
authenticate middleware
  ↓
jwt.verify(token) → attaches req.userId
  ↓
users.routes.ts → getAllUsers()
  ↓
prisma.user.findMany() → 200 + users

─────────────────────────────────────

GET /users  (no token)
  ↓
authenticate middleware
  ↓
401 Unauthorized — request never reaches the controller
```

### Testing with Postman

**1. Register**
```
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "name": "Alice",
  "email": "alice@gmail.com",
  "username": "alice123",
  "password": "secret123"
}
```

**2. Login**
```
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "alice@gmail.com",
  "password": "secret123"
}

Response: { "token": "eyJhbGci..." }
```

**3. Access protected route**
```
GET http://localhost:3000/users
Authorization: Bearer eyJhbGci...
```

**4. Access without token**
```
GET http://localhost:3000/users
→ 401 { "error": "No token provided" }
```

---

## Summary

| Concept | What it is |
|---------|------------|
| Authentication | Verifying who the user is |
| Authorization | Verifying what the user is allowed to do |
| JWT | A signed token that stores user identity — sent with every request |
| JWT Payload | Data inside the token (e.g. `userId`) — encoded, not encrypted |
| JWT Secret | A private key used to sign and verify tokens — never expose it |
| Bcrypt | Password hashing library — turns plain passwords into irreversible hashes |
| Salt Rounds | Controls how slow bcrypt is — higher = more secure, 10-12 is standard |
| `bcrypt.hash()` | Hashes a plain password before saving to the database |
| `bcrypt.compare()` | Compares a plain password against a stored hash |
| `jwt.sign()` | Creates a new token with a payload and expiry |
| `jwt.verify()` | Verifies a token and returns the decoded payload |
| Auth Middleware | Runs before protected routes — rejects requests with invalid tokens |
| `AuthRequest` | Extended Request type that includes `userId` after authentication |
| Bearer Token | The format for sending JWTs in the Authorization header |
| 401 Unauthorized | Status code for missing or invalid authentication |
| 409 Conflict | Status code when a resource already exists (e.g. duplicate email) |

---

**Resources:**
- [JWT.io](https://jwt.io/) — decode and inspect JWT tokens
- [jsonwebtoken Docs](https://github.com/auth0/node-jsonwebtoken)
- [bcrypt Docs](https://github.com/kelektiv/node.bcrypt.js)
- [Prisma Docs](https://www.prisma.io/docs)
