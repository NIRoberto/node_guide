# Lesson 3: Authentication, Roles & Authorization

## Table of Contents
1. [What is Authentication?](#what-is-authentication)
2. [Authentication vs Authorization](#authentication-vs-authorization)
3. [How Authentication Works in REST APIs](#how-authentication-works-in-rest-apis)
4. [What is JWT?](#what-is-jwt)
5. [What is Bcrypt?](#what-is-bcrypt)
6. [User Roles](#user-roles)
7. [Updating the Prisma Schema](#updating-the-prisma-schema)
8. [Auth Controller](#auth-controller)
9. [Auth Middleware](#auth-middleware)
10. [Role-Based Access Control](#role-based-access-control)
11. [Protecting Routes](#protecting-routes)
12. [How It All Fits Together](#how-it-all-fits-together)

---

## What is Authentication?

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
- Handled by: login with email + password → JWT token

**Authorization** — verifying what you're allowed to do
- "Is Alice allowed to delete this listing?"
- Handled by: roles, permissions, ownership checks

```
Authentication = Showing your passport at the airport (proving who you are)
Authorization  = Your boarding pass (proving you're allowed on this specific flight)
```

---

## How Authentication Works in REST APIs

Since REST is **stateless** (the server remembers nothing between requests), we can't use traditional sessions. Instead we use **tokens**.

```
1. REGISTER
   Client → POST /auth/register { name, email, password, role }
   Server → hashes password → saves user → responds 201

2. LOGIN
   Client → POST /auth/login { email, password }
   Server → finds user → compares hash → generates JWT
   Server → responds { token, user }

3. ACCESS PROTECTED ROUTE
   Client → GET /auth/me  (Authorization: Bearer <token>)
   Server → reads token → verifies → responds with profile

4. INVALID/MISSING TOKEN
   Client → GET /auth/me  (no token)
   Server → 401 Unauthorized
```

---

## What is JWT?

JWT stands for **JSON Web Token**. A JWT is a string made of three parts separated by dots:

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.abc123xyz
      HEADER              PAYLOAD         SIGNATURE
```

- **Header** — algorithm used to sign the token (e.g. HS256)
- **Payload** — the data stored inside (e.g. `{ userId: 1, role: "HOST" }`)
- **Signature** — proves the token hasn't been tampered with

The signature is created using a **secret key** only your server knows. If anyone modifies the payload, the signature won't match and the server rejects it.

**Important:** The payload is only **encoded**, not **encrypted**. Anyone can decode it. Never store passwords or sensitive data in a JWT payload.

```
Server creates token:
  payload = { userId: 1, role: "HOST" }
  secret  = "my-secret-key"
  token   = sign(payload, secret, { expiresIn: "7d" })

Client stores token and sends it with every request:
  Authorization: Bearer eyJhbGci...

Server verifies:
  decoded = verify(token, secret)
  → valid:   { userId: 1, role: "HOST", iat: ..., exp: ... }
  → invalid: throws error → 401
```

---

## What is Bcrypt?

Bcrypt is a **password hashing library**. It turns a plain text password into a fixed-length string that cannot be reversed.

### Why not store passwords as plain text?

If your database gets hacked and passwords are plain text, every user's account everywhere is compromised. This has happened to LinkedIn, Adobe, and many others.

### How Bcrypt works

```
HASHING (at registration):
  password = "mypassword123"
  hash     = bcrypt.hash(password, 10)
  → generates a random salt
  → runs the algorithm 2^10 = 1,024 times
  → outputs "$2b$10$N9qo8uLOickgx2ZMRZoMye..."
  → store this hash in the database, NEVER the plain password

COMPARING (at login):
  bcrypt.compare("mypassword123", storedHash)
  → extracts the salt from storedHash
  → hashes "mypassword123" with that same salt
  → compares result to storedHash
  → returns true or false
```

The number `10` is the **cost factor** — it controls how slow the hash is. Higher = more secure but slower. 10-12 is standard for production.

---

## User Roles

In an Airbnb-like app, not all users are equal:

- **HOST** — can create, update, and delete listings
- **GUEST** — can browse listings and make bookings

This is **role-based access control (RBAC)**. Instead of checking individual permissions, you assign a role to each user and check the role on protected routes.

```
POST /listings   → HOST only
PUT  /listings/:id → HOST only (and must be the owner)
POST /bookings   → GUEST only
DELETE /bookings/:id → GUEST only (and must be the owner)
```

The role is stored in the database and embedded in the JWT payload so middleware can check it without a database query on every request.

---

## Updating the Prisma Schema

Add a `Role` enum, role field, and auth-related fields to the User model.

**prisma/schema.prisma:**
```prisma
enum Role {
  HOST
  GUEST
}

model User {
  id               Int       @id @default(autoincrement())
  name             String
  email            String    @unique
  username         String    @unique
  password         String
  role             Role      @default(GUEST)
  resetToken       String?
  resetTokenExpiry DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  listings         Listing[]
}
```

Run the migration:
```bash
npx prisma migrate dev --name add_roles_and_auth_fields
```

---

## Auth Controller

**src/controllers/auth.controller.ts:**

### Register

```typescript
export async function register(req: Request, res: Response) {
  const { name, email, username, password, role } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return res.status(409).json({ error: "Email or username already in use" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, username, password: hashedPassword, role: role ?? "GUEST" },
  });

  const { password: _, ...userWithoutPassword } = user;
  res.status(201).json(userWithoutPassword);
}
```

### Login

```typescript
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Same error message whether email or password is wrong
  // Never tell the client which one failed — that leaks information
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Include role in the token so middleware can check it without a DB query
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  const { password: _, ...userWithoutPassword } = user;
  res.json({ token, user: userWithoutPassword });
}
```

### Get Profile (GET /auth/me)

Returns the logged-in user's profile. Requires authentication.

```typescript
export async function getMe(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      // If HOST — include their listings
      // If GUEST — include their bookings
      listings: req.role === "HOST",
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  const { password: _, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
}
```

### Change Password (POST /auth/change-password)

Requires authentication. User must provide their current password.

```typescript
export async function changePassword(req: AuthRequest, res: Response) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: req.userId },
    data: { password: hashedPassword },
  });

  res.json({ message: "Password changed successfully" });
}
```

### Forgot Password (POST /auth/forgot-password)

Generates a reset token and would send it via email. Always returns 200 regardless of whether the email exists — never confirm if an email is registered.

```typescript
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;

  // Always return the same response — don't reveal if the email is registered
  const successResponse = { message: "If that email is registered, a reset link has been sent" };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json(successResponse);

  // Generate a raw random token — this goes in the email link
  const rawToken = crypto.randomBytes(32).toString("hex");

  // Hash before storing — if DB is compromised, raw tokens are not exposed
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: hashedToken,
      resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  // In a real app: send email with link containing rawToken
  // e.g. http://localhost:3000/auth/reset-password/<rawToken>
  console.log(`Reset token for ${email}: ${rawToken}`);

  res.json(successResponse);
}
```

### Reset Password (POST /auth/reset-password/:token)

```typescript
export async function resetPassword(req: Request, res: Response) {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  // Hash the raw token from the URL to compare against the stored hash
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      resetToken: hashedToken,
      resetTokenExpiry: { gt: new Date() }, // token must not be expired
    },
  });

  // Same error for both invalid token and expired token — don't reveal which
  if (!user) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,        // clear token after use — one-time use only
      resetTokenExpiry: null,
    },
  });

  res.json({ message: "Password reset successfully" });
}
```

---

## Auth Middleware

**src/middlewares/auth.middleware.ts:**

```typescript
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] as string;

// Extend Request to carry userId and role after authentication
export interface AuthRequest extends Request {
  userId?: number;
  role?: string;
}

// ─── authenticate ─────────────────────────────────────────────────────────────
// Verifies the JWT token from the Authorization header.
// Attaches userId and role to the request for downstream handlers.
// Returns 401 if token is missing, invalid, or expired.

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
    req.userId = decoded.userId;
    req.role = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── requireHost ──────────────────────────────────────────────────────────────
// Must run after authenticate.
// Returns 403 if the user's role is not HOST.

export function requireHost(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.role !== "HOST") {
    return res.status(403).json({ error: "Only hosts can perform this action" });
  }
  next();
}

// ─── requireGuest ─────────────────────────────────────────────────────────────
// Must run after authenticate.
// Returns 403 if the user's role is not GUEST.

export function requireGuest(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.role !== "GUEST") {
    return res.status(403).json({ error: "Only guests can perform this action" });
  }
  next();
}
```

> **401 vs 403:**
> - `401 Unauthorized` — not authenticated (missing or invalid token)
> - `403 Forbidden` — authenticated but not permitted (wrong role or not the owner)
>
> Despite the name, 401 is about authentication, not authorization. Do not mix them up.

---

## Role-Based Access Control

### Protecting listing routes

```typescript
// src/routes/listings.routes.ts

router.get("/", getAllListings);                              // public
router.get("/:id", getListingById);                          // public
router.post("/", authenticate, requireHost, createListing);  // HOST only
router.put("/:id", authenticate, updateListing);             // HOST + owner check in controller
router.delete("/:id", authenticate, deleteListing);          // HOST + owner check in controller
```

### Ownership check in controller

Being a HOST is not enough — you can only edit **your own** listings:

```typescript
export async function updateListing(req: AuthRequest, res: Response) {
  const id = parseInt(req.params["id"]);
  const listing = await prisma.listing.findUnique({ where: { id } });

  if (!listing) return res.status(404).json({ error: "Listing not found" });

  // Check the listing belongs to the authenticated user
  if (listing.hostId !== req.userId) {
    return res.status(403).json({ error: "You can only edit your own listings" });
  }

  const updated = await prisma.listing.update({ where: { id }, data: req.body });
  res.json(updated);
}
```

---

## Auth Routes

**src/routes/auth.routes.ts:**

```typescript
import { Router } from "express";
import {
  register,
  login,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", register);                          // public
router.post("/login", login);                                // public
router.get("/me", authenticate, getMe);                      // protected
router.post("/change-password", authenticate, changePassword); // protected
router.post("/forgot-password", forgotPassword);             // public
router.post("/reset-password/:token", resetPassword);        // public

export default router;
```

---

## Protecting Routes

**src/index.ts:**

```typescript
import "dotenv/config";
import express from "express";
import authRouter from "./routes/auth.routes.js";
import usersRouter from "./routes/users.routes.js";
import listingsRouter from "./routes/listings.routes.js";
import { authenticate } from "./middlewares/auth.middleware.js";

const app = express();
app.use(express.json());

// Public
app.use("/auth", authRouter);

// Protected — token required for all /users routes
app.use("/users", authenticate, usersRouter);

// Mixed — some listing routes are public, some protected (handled in the router)
app.use("/listings", listingsRouter);
```

---

## How It All Fits Together

### All auth endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create account (role: HOST or GUEST) |
| POST | `/auth/login` | No | Login and receive JWT token |
| GET | `/auth/me` | Yes | Get your own profile |
| POST | `/auth/change-password` | Yes | Change your password |
| POST | `/auth/forgot-password` | No | Request a password reset link |
| POST | `/auth/reset-password/:token` | No | Reset password using token from email |

### Role-based access summary

| Route | Who can access |
|-------|---------------|
| `GET /listings` | Everyone |
| `POST /listings` | HOST only |
| `PUT /listings/:id` | HOST + must be the owner |
| `DELETE /listings/:id` | HOST + must be the owner |
| `POST /bookings` | GUEST only |
| `DELETE /bookings/:id` | GUEST + must be the owner |

### Full request flow

```
POST /auth/register { role: "HOST" }
  ↓
bcrypt.hash(password) → prisma.user.create({ role: "HOST" })
  ↓
201 + user (without password)

─────────────────────────────────────────────

POST /auth/login { email, password }
  ↓
prisma.user.findUnique() → bcrypt.compare()
  ↓
jwt.sign({ userId, role: "HOST" }) → 200 + { token, user }

─────────────────────────────────────────────

POST /listings  (Authorization: Bearer <token>)
  ↓
authenticate → decodes token → req.userId = 1, req.role = "HOST"
  ↓
requireHost → role is HOST → next()
  ↓
createListing() → prisma.listing.create({ hostId: req.userId })
  ↓
201 + listing

─────────────────────────────────────────────

POST /listings  (role: "GUEST")
  ↓
authenticate → req.role = "GUEST"
  ↓
requireHost → role is not HOST → 403 Forbidden

─────────────────────────────────────────────

POST /auth/forgot-password { email }
  ↓
find user → generate rawToken → hash it → save hash + expiry
  ↓
send email with rawToken in link (email step covered in lesson 4)
  ↓
200 (same response whether email exists or not)

─────────────────────────────────────────────

POST /auth/reset-password/<rawToken> { password }
  ↓
hash rawToken → find user where resetToken matches AND expiry > now
  ↓
bcrypt.hash(newPassword) → update user → clear resetToken
  ↓
200 Password reset successfully
```

### Testing with Postman

**Register as HOST:**
```json
POST /auth/register
{
  "name": "Alice",
  "email": "alice@example.com",
  "username": "alice",
  "password": "secret123",
  "role": "HOST"
}
```

**Register as GUEST:**
```json
POST /auth/register
{
  "name": "Bob",
  "email": "bob@example.com",
  "username": "bob",
  "password": "secret123",
  "role": "GUEST"
}
```

**Login:**
```json
POST /auth/login
{
  "email": "alice@example.com",
  "password": "secret123"
}
→ { "token": "eyJhbGci...", "user": { ... } }
```

**Get profile:**
```
GET /auth/me
Authorization: Bearer eyJhbGci...
```

**Change password:**
```json
POST /auth/change-password
Authorization: Bearer eyJhbGci...
{
  "currentPassword": "secret123",
  "newPassword": "newpassword456"
}
```

**Create listing (HOST token required):**
```json
POST /listings
Authorization: Bearer eyJhbGci...  ← must be a HOST token
{
  "title": "Cozy Apartment",
  "description": "...",
  "location": "Paris",
  "pricePerNight": 120,
  "guests": 2,
  "type": "APARTMENT",
  "amenities": ["WiFi", "Kitchen"]
}
```

---

## Summary

| Concept | What it is |
|---------|------------|
| Authentication | Verifying who the user is |
| Authorization | Verifying what the user is allowed to do |
| JWT | Signed token storing user identity — sent with every request |
| JWT Payload | Data inside the token (`userId`, `role`) — encoded, not encrypted |
| JWT Secret | Private key used to sign tokens — never expose it |
| Bcrypt | Password hashing — one-way, salted, intentionally slow |
| Salt Rounds | Controls bcrypt speed — 10-12 is standard |
| Role | `HOST` or `GUEST` — determines what actions a user can perform |
| RBAC | Role-Based Access Control — restrict routes by role |
| `authenticate` | Middleware that verifies the JWT and attaches `userId` + `role` to the request |
| `requireHost` | Middleware that blocks non-HOST users with 403 |
| `requireGuest` | Middleware that blocks non-GUEST users with 403 |
| Ownership check | Verifying `resource.ownerId === req.userId` — role alone is not enough |
| `GET /auth/me` | Returns the logged-in user's profile using `req.userId` from the token |
| `change-password` | Requires current password verification before allowing the change |
| `forgot-password` | Generates a hashed reset token — always returns 200 regardless of email |
| `reset-password` | Validates raw token against stored hash, checks expiry, clears token after use |
| 401 Unauthorized | Not authenticated — missing or invalid token |
| 403 Forbidden | Authenticated but not permitted — wrong role or not the owner |

---

**Resources:**
- [JWT.io](https://jwt.io/) — decode and inspect JWT tokens
- [jsonwebtoken Docs](https://github.com/auth0/node-jsonwebtoken)
- [bcrypt Docs](https://github.com/kelektiv/node.bcrypt.js)
- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
