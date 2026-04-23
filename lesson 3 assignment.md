# Lesson 3 Assignment: Airbnb API — Authentication & Authorization

## Overview

Right now your Airbnb API has no security at all. Anyone can create listings, make bookings, delete other users' data, and impersonate any host or guest. That is a completely open API — not acceptable for any real application.

In this assignment you will add a full authentication and authorization system:

- **Authentication** — users must prove who they are by registering and logging in
- **Authorization** — users can only do what their role and ownership allows
- **Forgot/Reset Password** — users who forget their password can securely reset it via email

You are continuing the same `airbnb-api` project from lesson 2.

---

## Why Authentication Matters

Without authentication, your API has no concept of identity. Any request can do anything. Consider what that means for Airbnb:

- Anyone can delete any listing — including listings they don't own
- Anyone can cancel any booking — including bookings made by other guests
- Anyone can change any user's data
- There is no way to know who made a booking

Authentication solves this by requiring users to prove their identity before performing sensitive actions. Once authenticated, the server knows exactly who is making each request and can enforce rules accordingly.

---

## What You're Adding

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register as a guest or host |
| POST | `/auth/login` | No | Login and receive a JWT token |
| GET | `/auth/me` | Yes | Get the currently logged-in user's profile |
| POST | `/auth/change-password` | Yes | Change your password |
| POST | `/auth/forgot-password` | No | Request a password reset email |
| POST | `/auth/reset-password/:token` | No | Reset password using the token from email |
| POST | `/listings` | Yes (HOST only) | Only hosts can create listings |
| PUT | `/listings/:id` | Yes (owner only) | Only the listing's host can update it |
| DELETE | `/listings/:id` | Yes (owner only) | Only the listing's host can delete it |
| POST | `/bookings` | Yes (GUEST only) | Only guests can make bookings |
| DELETE | `/bookings/:id` | Yes (owner only) | Only the booking's guest can cancel it |

---

## Part 1 — Update the Prisma Schema

### Why this step exists

You need to store passwords in the database. But you must never store plain text passwords — if your database is ever compromised, every user's password would be exposed immediately.

You also need to store reset tokens for the forgot-password flow. These tokens are temporary credentials — they must be hashed before storing (same reason as passwords) and they must expire so they cannot be used indefinitely.

### Tasks

Add these fields to the User model:
- `password` — required string (will store the bcrypt hash, never the plain password)
- `updatedAt` — DateTime with `@updatedAt` (auto-updates whenever the user record changes)
- `resetToken` — optional string (stores the hashed password reset token)
- `resetTokenExpiry` — optional DateTime (when the reset token expires — 1 hour from creation)

Run a migration named `add_auth_fields`.

### Best Practices

- Never store plain text passwords — only bcrypt hashes. If your database leaks, hashed passwords cannot be reversed
- Store `resetToken` as a hash, not the raw token — same principle as passwords. The raw token only ever exists in the email link and in the user's browser
- `resetTokenExpiry` is critical — without it, a reset token is valid forever. If an attacker intercepts an old email, they could use it months later

---

## Part 2 — Register & Login

### Why this step exists

Registration creates a new user account with a hashed password. Login verifies the password and returns a JWT token that the client uses for all future authenticated requests.

**Why bcrypt:** Bcrypt is a slow hashing algorithm designed specifically for passwords. It is intentionally slow — each hash takes ~100ms. That is fine for a login, but it means an attacker trying to brute-force passwords can only try ~10 per second instead of billions. Salt rounds of 10 is the industry standard.

**Why JWT:** REST APIs are stateless — the server does not remember anything between requests. JWT solves this by giving the client a signed token that contains the user's identity. The client sends this token with every request. The server verifies the signature and knows who is making the request — without any database lookup.

**Why include `role` in the JWT payload:** Your middleware needs to know if the user is a HOST or GUEST to enforce role-based rules. If you only store `userId` in the token, you would need a database query on every request to get the role. Including `role` in the payload means the middleware can check it instantly without hitting the database.

### Tasks

Install packages:
```bash
npm install bcrypt jsonwebtoken
npm install -D @types/bcrypt @types/jsonwebtoken
```

Add to `.env`:
```
JWT_SECRET=your-long-random-secret-key
JWT_EXPIRES_IN=7d
```

Create `src/controllers/auth.controller.ts`:

**register:**
- Accept `name`, `email`, `username`, `phone`, `password`, `role` (`HOST` or `GUEST`)
- Validate all required fields are present — return 400 with a clear message if any are missing
- Validate password is at least 8 characters — return 400 if too short. Weak passwords are a security risk
- Check if email is already registered — return 409 Conflict if it is
- Hash the password with `bcrypt.hash(password, 10)` — the `10` is the salt rounds
- Create the user in the database with the hashed password
- Return the created user — but strip the `password` field before returning. Use destructuring: `const { password: _, ...userWithoutPassword } = user`

**login:**
- Accept `email` and `password`
- Find the user by email
- If not found, return 401 with `"Invalid credentials"` — do NOT say "email not found". Telling the client which field is wrong helps attackers figure out which emails are registered (email enumeration attack)
- Compare the submitted password against the stored hash using `bcrypt.compare(password, user.password)`
- If it does not match, return 401 with `"Invalid credentials"` — same generic message
- Sign a JWT: `jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })`
- Return `{ token, user }` — user without the password field

### Best Practices

- Use the same generic error message for both "email not found" and "wrong password" — different messages for each case allow attackers to enumerate valid email addresses
- Include `role` in the JWT payload — middleware can check permissions without an extra database query on every request
- Never return the `password` field in any response — not even the hash. The hash is sensitive data

### Research Task

Go to [jwt.io](https://jwt.io) and paste a token you generated. Read the decoded payload. Notice that the payload is completely readable — it is only base64 encoded, not encrypted. Anyone who intercepts the token can read `userId` and `role`. This is why you never put sensitive data (passwords, credit card numbers, personal info) in the JWT payload.

---

## Part 3 — Auth Middleware

### Why this step exists

Middleware runs before your route handlers. Auth middleware reads the JWT from the request, verifies it, and attaches the user's identity to the request object. Every protected route uses this middleware — it is the gatekeeper.

**Why separate middleware functions for each role:** Keeping `authenticate`, `requireHost`, and `requireGuest` as separate functions follows the Single Responsibility Principle. Each function does one thing. You can mix and match them — some routes need authentication only, some need a specific role. If you combined them, you would need a different function for every combination.

**Why 401 vs 403:** These are different situations. 401 means "I don't know who you are — you need to authenticate". 403 means "I know who you are, but you are not allowed to do this". Using the wrong one confuses clients and makes debugging harder.

### Tasks

Create `src/middlewares/auth.middleware.ts`:

**authenticate:**
- Read the `Authorization` header from `req.headers["authorization"]`
- Check it exists and starts with `"Bearer "` — return 401 if not. The format is always `Bearer <token>`
- Extract the token by splitting on the space: `authHeader.split(" ")[1]`
- Verify the token with `jwt.verify(token, JWT_SECRET)` — wrap in try/catch because `jwt.verify` throws if the token is invalid or expired
- If verification succeeds, attach `userId` and `role` to the request object
- Call `next()` to pass control to the next middleware or route handler
- If verification fails (expired, tampered, invalid), return 401 with `"Invalid or expired token"`

**requireHost:**
- Must always run after `authenticate` — it depends on `req.role` being set
- Check `req.role === "HOST"` — return 403 Forbidden if not
- Call `next()` if the user is a host

**requireGuest:**
- Must always run after `authenticate`
- Check `req.role === "GUEST"` — return 403 Forbidden if not
- Call `next()` if the user is a guest

Extend the Express `Request` type to include the new fields:
```typescript
export interface AuthRequest extends Request {
  userId?: number;
  role?: string;
}
```

### Best Practices

- Return 401 for missing/invalid/expired token — the client is not authenticated
- Return 403 for wrong role — the client is authenticated but not permitted
- Never combine authentication and role checking in one function — keep them separate and composable

### Research Task

Research the exact difference between **401 Unauthorized** and **403 Forbidden**. Despite the name, 401 is about authentication (not authorization). Many developers use them interchangeably — they are not the same and using the wrong one breaks client-side error handling.

---

## Part 4 — Protect Listing Routes

### Why this step exists

Without protection, any user — guest or anonymous — can create, edit, or delete any listing. That breaks the entire Airbnb model. Only hosts should create listings. Only the listing's own host should be able to edit or delete it.

**Why ownership checks belong in the controller, not middleware:** Middleware runs before the route handler and has no access to the database record. It cannot know who owns a listing without fetching it. The controller fetches the listing anyway — so the ownership check naturally belongs there, after the fetch.

**Why you never trust `hostId` from the request body:** A malicious user could send `{ hostId: 1 }` in the request body to create a listing under someone else's account. Always use `req.userId` from the verified JWT — that value comes from the token the server signed, not from user input.

### Tasks

Update `src/routes/listings.routes.ts`:
- `POST /listings` — chain `authenticate` then `requireHost` as middleware before the controller
- `PUT /listings/:id` — chain `authenticate` before the controller (ownership check is in the controller)
- `DELETE /listings/:id` — chain `authenticate` before the controller

Update `listings.controller.ts`:

**createListing:**
- Remove `hostId` from the request body — never accept it from the client
- Use `req.userId` as the `hostId` — the logged-in user is always the host

**updateListing:**
- After fetching the listing, check `listing.hostId === req.userId`
- If they do not match, return 403 with `"You can only edit your own listings"`

**deleteListing:**
- Same ownership check — `listing.hostId === req.userId`
- Return 403 if the logged-in user is not the listing's host

### Best Practices

- Never trust `hostId` from the request body — always derive it from the verified JWT token
- Ownership checks belong in the controller after fetching the record — middleware cannot do this without an extra database query

---

## Part 5 — Protect Booking Routes

### Why this step exists

Only guests should make bookings — a host booking their own listing makes no sense. Only the guest who made a booking should be able to cancel it. And two guests should never be able to book the same listing for overlapping dates — that is a double booking.

**Why you validate dates server-side:** A client could send `checkIn: "2020-01-01"` (a date in the past) or `checkOut` before `checkIn`. Always validate date logic on the server — never trust the client.

**Why you check for booking conflicts:** Without this check, two guests could book the same listing for the same dates. The database has no built-in constraint for this — you must check it in your code before creating the booking.

### Tasks

Update `src/routes/bookings.routes.ts`:
- `POST /bookings` — chain `authenticate` then `requireGuest`
- `DELETE /bookings/:id` — chain `authenticate`

Update `bookings.controller.ts`:

**createBooking:**
- Use `req.userId` as the `guestId` — never accept it from the request body
- Validate `listingId`, `checkIn`, `checkOut` are all present
- Parse `checkIn` and `checkOut` as Date objects
- Validate `checkIn` is before `checkOut` — return 400 if not
- Validate `checkIn` is in the future — return 400 if it is in the past
- Verify the listing exists — return 404 if not
- Check for booking conflicts: query for any existing booking on this listing where `status` is `CONFIRMED` and the dates overlap. The overlap condition is: `existingCheckIn < newCheckOut AND existingCheckOut > newCheckIn`. Return 409 Conflict if a conflict is found
- Calculate `totalPrice`: get the number of nights by subtracting `checkIn` from `checkOut` in milliseconds, convert to days, multiply by `listing.pricePerNight`
- Create the booking with status `PENDING`

**deleteBooking (cancel):**
- Find the booking — return 404 if not found
- Check `booking.guestId === req.userId` — return 403 if not the booking's guest
- Check `booking.status !== "CANCELLED"` — return 400 with `"Booking is already cancelled"` if it is
- Update the booking status to `CANCELLED` — do not delete the record. Keeping cancelled bookings is important for history and auditing

### Best Practices

- Always validate date logic server-side — never trust the client to send valid dates
- Check for booking conflicts before creating — two guests cannot book the same listing for overlapping dates
- Cancel by updating status to `CANCELLED`, not by deleting the record — you need the history

### Research Task

Research how to check for **overlapping date ranges** in Prisma. The overlap condition is: a conflict exists when `existingCheckIn < newCheckOut AND existingCheckOut > newCheckIn`. Look up Prisma's `lt` and `gt` filters to implement this as a single `findFirst` query.

---

## Part 6 — Profile & Password Management

### Why this step exists

`GET /auth/me` is one of the most important endpoints in any authenticated app. When a frontend app loads, the first thing it does is call `/auth/me` with the stored token to restore the user's session — getting their name, role, avatar, and other profile data without requiring them to log in again.

`POST /auth/change-password` lets users update their password. Requiring the current password before allowing a change is critical — without it, anyone who briefly accesses a logged-in device could permanently change the password and lock the real user out.

### Tasks

Add to `src/controllers/auth.controller.ts`:

**GET /auth/me:**
- Require `authenticate` middleware
- Fetch the user from the database using `req.userId`
- If the user is a HOST, include their listings in the response
- If the user is a GUEST, include their bookings with listing details
- Return the user without the `password` field

**POST /auth/change-password:**
- Require `authenticate` middleware
- Accept `currentPassword` and `newPassword` from the request body
- Validate both fields are present
- Fetch the user from the database using `req.userId`
- Verify `currentPassword` matches the stored hash using `bcrypt.compare` — return 401 if wrong
- Validate `newPassword` is at least 8 characters
- Hash the new password with bcrypt
- Update the user's password in the database
- Return a success message

---

## Part 7 — Forgot Password & Reset Password

### Why this step exists

Users forget passwords. Without a reset flow, they are permanently locked out of their account. This is one of the most important features in any authentication system.

**Why you cannot just email the new password:** You do not know the user's password — it is hashed. You cannot reverse a bcrypt hash. The only option is to let the user set a new one.

**Why you use a token instead of emailing a link with the new password directly:** The reset link must be single-use and time-limited. A token is a temporary credential — it proves the user has access to their email. Once used, it is deleted. If it is not used within 1 hour, it expires.

**Why you hash the token before storing it:** The reset token is a credential. If your database is compromised, an attacker with access to raw tokens could immediately reset any user's password. Hashing the token means the database only contains the hash — the raw token only ever exists in the email and in the user's browser.

**Why you return the same response whether the email exists or not:** If you return `"Email not found"` when the email does not exist, attackers can use your forgot-password endpoint to discover which emails are registered in your system. Always return the same generic response regardless.

### Tasks

**POST /auth/forgot-password:**
- Accept `email` from the request body
- Find the user by email
- Whether or not the user exists, return 200 with `"If that email is registered, a reset link has been sent"` — never confirm or deny
- If the user does exist:
  - Generate a random token using Node's built-in crypto: `crypto.randomBytes(32).toString("hex")`
  - Hash the token before storing: `crypto.createHash("sha256").update(rawToken).digest("hex")`
  - Set `resetTokenExpiry` to exactly 1 hour from now: `new Date(Date.now() + 60 * 60 * 1000)`
  - Save the hashed token and expiry to the user record
  - Send the password reset email with the **raw (unhashed) token** in the link: `http://localhost:3000/auth/reset-password/<rawToken>`
  - The email is sent with the raw token — the database stores the hash. They are different

**POST /auth/reset-password/:token:**
- Read the raw token from `req.params["token"]`
- Hash it the same way: `crypto.createHash("sha256").update(rawToken).digest("hex")`
- Find the user where `resetToken` equals the hash AND `resetTokenExpiry` is greater than `new Date()` (not expired)
- If no user is found or the token is expired, return 400 with `"Invalid or expired reset token"` — same message for both cases, do not reveal which
- Validate the new password is at least 8 characters
- Hash the new password with bcrypt
- Update the user: set the new hashed password, set `resetToken` to `null`, set `resetTokenExpiry` to `null`
- Return 200 with a success message

### Best Practices

- Hash the token before storing — raw tokens in the database are a security risk if the database is compromised
- Set a 1-hour expiry — reset tokens must be time-limited. An old intercepted email should not work forever
- Clear the token after use — one-time use only. Once the password is reset, the token is gone
- Return the same response whether the email exists or not — prevents email enumeration
- Use the same error message for "token not found" and "token expired" — do not reveal which

### Research Task

Research `crypto.randomBytes` vs `Math.random()`. Understand why `Math.random()` is **not** cryptographically secure and must never be used for security tokens. Look up what CSPRNG (Cryptographically Secure Pseudorandom Number Generator) means and why it matters for tokens.

---

## Updated Project Structure

```
airbnb-api/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   └── prisma.ts
│   ├── controllers/
│   │   ├── auth.controller.ts        ← new
│   │   ├── users.controller.ts
│   │   ├── listings.controller.ts
│   │   └── bookings.controller.ts
│   ├── middlewares/
│   │   └── auth.middleware.ts        ← new
│   ├── routes/
│   │   ├── auth.routes.ts            ← new
│   │   ├── users.routes.ts
│   │   ├── listings.routes.ts
│   │   └── bookings.routes.ts
│   └── index.ts
├── .env
├── .env.example
└── .gitignore
```

---

## Checklist

- [ ] Password is hashed with bcrypt before saving — never plain text
- [ ] Login returns a JWT token containing `userId` and `role`
- [ ] Protected routes return 401 without a valid token
- [ ] Expired tokens return 401
- [ ] Only hosts can create listings
- [ ] Only guests can make bookings
- [ ] Hosts can only edit/delete their own listings — 403 for others
- [ ] Guests can only cancel their own bookings — 403 for others
- [ ] Date validation rejects past check-in dates and invalid date ranges
- [ ] Booking conflict check prevents double bookings — 409 on conflict
- [ ] Cancelled bookings update status to CANCELLED, not deleted
- [ ] GET /auth/me returns the logged-in user without the password
- [ ] Change password requires the current password — 401 if wrong
- [ ] Forgot password returns the same response whether email exists or not
- [ ] Reset token is hashed before storing in the database
- [ ] Reset token expires after 1 hour
- [ ] Reset token is cleared after successful password reset
- [ ] Password is never returned in any response

---

## Further Research

- Research **rate limiting** — what happens if someone writes a script to try thousands of passwords against your login endpoint? Look up the `express-rate-limit` package and add it to `/auth/login` and `/auth/forgot-password`
- Read about **OWASP Top 10** — the most common web security vulnerabilities. Broken authentication is consistently in the top 3. Read what specific mistakes developers make
- Research **refresh tokens** — understand why short-lived access tokens (15 minutes) combined with long-lived refresh tokens (7 days) are more secure than a single 7-day token. Understand what happens if an access token is stolen
- Look up **httpOnly cookies vs localStorage** for storing JWT tokens on the frontend — understand the XSS and CSRF tradeoffs of each approach
