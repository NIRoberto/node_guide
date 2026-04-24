# Lesson 3 Assignment: Airbnb API — Authentication & Authorization

## Overview

Add a full authentication and authorization system to the Airbnb API. Users must register and log in to get a JWT token. Protected routes require that token. Hosts can only manage their own listings, guests can only cancel their own bookings. Users who forget their password can reset it via email.

---

## Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register as a guest or host |
| POST | `/auth/login` | No | Login and receive a JWT token |
| GET | `/auth/me` | Yes | Get the logged-in user's profile |
| POST | `/auth/change-password` | Yes | Change your password |
| POST | `/auth/forgot-password` | No | Request a password reset email |
| POST | `/auth/reset-password/:token` | No | Reset password using token from email |
| POST | `/listings` | Yes (HOST only) | Only hosts can create listings |
| PUT | `/listings/:id` | Yes (owner only) | Only the listing's host can update it |
| DELETE | `/listings/:id` | Yes (owner only) | Only the listing's host can delete it |
| POST | `/bookings` | Yes (GUEST only) | Only guests can make bookings |
| DELETE | `/bookings/:id` | Yes (owner only) | Only the booking's guest can cancel it |

---

## Part 1 — Update the Prisma Schema

Add a `Role` enum and update the User model:

```prisma
enum Role {
  ADMIN
  HOST
  GUEST
}
```

Add these fields to the User model:
- `role` — `Role`, default `GUEST` — determines what the user can do
- `password` — String (stores the bcrypt hash — never the plain password)
- `updatedAt` — DateTime, `@updatedAt`
- `resetToken` — String? (hashed reset token — stored as a hash, not raw)
- `resetTokenExpiry` — DateTime? (1 hour from creation — tokens must expire)

Run a migration named `add_auth_fields`.

> The `ADMIN` role is never assigned through the API — set it manually in the database or Prisma Studio. Never let users assign themselves as ADMIN.

---

## Part 2 — Register & Login

Install:
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
- Accept `name`, `email`, `username`, `password`, `role` (`HOST` or `GUEST` only — never `ADMIN`)
- Validate all fields are present — return 400 if missing
- Validate password is at least 8 characters — return 400 if too short
- Check email or username is not already taken — use `findFirst` with `OR` — return 409 if taken
- Hash password: `bcrypt.hash(password, 10)`
- Create user with hashed password, default role to `GUEST` if not provided: `role: role ?? "GUEST"`
- Return user without `password` field: `const { password: _, ...userWithoutPassword } = user`

**login:**
- Accept `email` and `password`
- Find user by email — return 401 with `"Invalid credentials"` if not found. Do NOT say "email not found" — that tells attackers which emails are registered
- Compare password: `bcrypt.compare(password, user.password)` — return 401 with `"Invalid credentials"` if wrong. Same message for both cases
- Sign JWT: `jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })` — include `role` so middleware can check permissions without a database query
- Return `{ token, user }` — user without password

### Research Task
Go to [jwt.io](https://jwt.io) and paste a token you generated. The payload is base64 encoded — anyone can read it. This is why you never put passwords or sensitive data in the JWT payload.

---

## Part 3 — Auth Middleware

Create `src/middlewares/auth.middleware.ts`:

First extend the Request type so TypeScript knows about `userId` and `role`:
```typescript
export interface AuthRequest extends Request {
  userId?: number;
  role?: string;
}
```

**authenticate:**
- Read `req.headers["authorization"]`
- Check it exists and starts with `"Bearer "` — return 401 if not
- Extract token: `authHeader.split(" ")[1]`
- Verify: `jwt.verify(token, JWT_SECRET)` — wrap in try/catch, it throws on invalid/expired tokens
- Attach `userId` and `role` to the request object
- Call `next()` on success — return 401 with `"Invalid or expired token"` on failure

**requireHost:**
- Runs after `authenticate`
- Allow if `req.role === "HOST"` OR `req.role === "ADMIN"` — ADMIN can do everything a HOST can
- Return 403 if neither, call `next()` if yes

**requireGuest:**
- Runs after `authenticate`
- Allow if `req.role === "GUEST"` OR `req.role === "ADMIN"`
- Return 403 if neither

**requireAdmin:**
- Runs after `authenticate`
- Check `req.role === "ADMIN"` — return 403 if not
- Use this to protect admin-only routes like managing all users

> 401 = not authenticated (missing/invalid token). 403 = authenticated but not permitted (wrong role). These are different — do not mix them up

### Research Task
Research the exact difference between **401 Unauthorized** and **403 Forbidden**. Despite the name, 401 is about authentication, not authorization.

---

## Part 4 — Protect Listing Routes

Update `src/routes/listings.routes.ts`:
- `POST /listings` — add `authenticate`, `requireHost` before controller
- `PUT /listings/:id` — add `authenticate` before controller
- `DELETE /listings/:id` — add `authenticate` before controller

Update `listings.controller.ts`:

**createListing:**
- Remove `hostId` from request body — never accept it from the client
- Use `req.userId` as `hostId` — always derived from the verified token, not user input

**updateListing:**
- After fetching the listing, check `listing.hostId === req.userId`
- ADMIN bypasses this check — `if (listing.hostId !== req.userId && req.role !== "ADMIN")`
- Return 403 with `"You can only edit your own listings"` if not the owner and not ADMIN

**deleteListing:**
- Same ownership + ADMIN bypass check — return 403 if not the owner and not ADMIN

---

## Part 5 — Protect Booking Routes

Update `src/routes/bookings.routes.ts`:
- `POST /bookings` — add `authenticate`, `requireGuest`
- `DELETE /bookings/:id` — add `authenticate`

Update `bookings.controller.ts`:

**createBooking:**
- Use `req.userId` as `guestId` — never from request body
- Validate `listingId`, `checkIn`, `checkOut` are present
- Parse `checkIn` and `checkOut` as Date objects
- Validate `checkIn` is before `checkOut` — return 400 if not
- Validate `checkIn` is in the future — return 400 if in the past
- Verify listing exists — return 404 if not
- Check for booking conflicts: find any existing `CONFIRMED` booking on this listing where `existingCheckIn < newCheckOut AND existingCheckOut > newCheckIn` — return 409 if conflict found
- Calculate `totalPrice` server-side: `(checkOut - checkIn in days) × listing.pricePerNight`
- Create booking with status `PENDING`

**deleteBooking (cancel):**
- Find booking — return 404 if not found
- Check `booking.guestId === req.userId` — return 403 if not the guest
- Check `booking.status !== "CANCELLED"` — return 400 with `"Booking is already cancelled"`
- Update status to `CANCELLED` — do not delete the record, keep it for history

### Research Task
Research how to check **overlapping date ranges** in Prisma using `lt` and `gt` filters. Implement the conflict check as a single `findFirst` query.

---

## Part 6 — Profile & Password Management

Add to `src/controllers/auth.controller.ts`:

**GET /auth/me:**
- Require `authenticate`
- Fetch user by `req.userId`
- Include listings if HOST, bookings with listing details if GUEST
- Return user without `password`

**POST /auth/change-password:**
- Require `authenticate`
- Accept `currentPassword` and `newPassword`
- Validate both fields present
- Fetch user by `req.userId`
- Verify `currentPassword` with `bcrypt.compare` — return 401 if wrong
- Validate `newPassword` is at least 8 characters
- Hash new password and update user
- Return success message

---

## Part 7 — Forgot Password & Reset Password

Add to `src/controllers/auth.controller.ts`:

**POST /auth/forgot-password:**
- Accept `email`
- Find user by email
- Always return 200 with `"If that email is registered, a reset link has been sent"` — whether user exists or not. Never confirm if an email is registered
- If user exists:
  - Generate raw token: `crypto.randomBytes(32).toString("hex")`
  - Hash before storing: `crypto.createHash("sha256").update(rawToken).digest("hex")` — raw tokens in the database are a security risk if the DB is compromised
  - Set `resetTokenExpiry`: `new Date(Date.now() + 60 * 60 * 1000)` (1 hour)
  - Save hashed token and expiry to user
  - Send reset email with the **raw token** in the link: `http://localhost:3000/auth/reset-password/<rawToken>` — the email gets the raw token, the DB stores the hash

**POST /auth/reset-password/:token:**
- Read raw token from `req.params["token"]`
- Hash it: `crypto.createHash("sha256").update(rawToken).digest("hex")`
- Find user where `resetToken` matches the hash AND `resetTokenExpiry > new Date()`
- Return 400 with `"Invalid or expired reset token"` if not found or expired — same message for both, do not reveal which
- Validate new password is at least 8 characters
- Hash new password with bcrypt
- Update user: set new password, set `resetToken` to `null`, set `resetTokenExpiry` to `null` — one-time use only
- Return 200

### Research Task
Research `crypto.randomBytes` vs `Math.random()`. Understand why `Math.random()` is not cryptographically secure and must never be used for security tokens.

---

## Project Structure

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

- [ ] `Role` enum added to schema with `ADMIN`, `HOST`, `GUEST`
- [ ] User model has `role` field defaulting to `GUEST`
- [ ] Password hashed with bcrypt before saving
- [ ] Register accepts `role` of `HOST` or `GUEST` only — defaults to `GUEST`
- [ ] Login returns JWT with `userId` and `role`
- [ ] Protected routes return 401 without valid token
- [ ] Expired tokens return 401
- [ ] Only HOST (and ADMIN) can create listings
- [ ] Only GUEST (and ADMIN) can make bookings
- [ ] Hosts can only edit/delete their own listings — ADMIN can edit/delete any
- [ ] Guests can only cancel their own bookings — ADMIN can cancel any
- [ ] `requireAdmin` middleware exists and blocks non-ADMIN users
- [ ] Date validation rejects past check-in and invalid ranges
- [ ] Booking conflict check returns 409 on overlap
- [ ] Cancelled bookings update status, not deleted
- [ ] GET /auth/me returns user without password
- [ ] GET /auth/me includes listings for HOST, bookings for GUEST
- [ ] Change password requires current password — 401 if wrong
- [ ] Forgot password returns same response regardless of email existence
- [ ] Reset token hashed before storing
- [ ] Reset token expires after 1 hour
- [ ] Reset token cleared after use
- [ ] Password never returned in any response

---

## Further Research

- **Rate limiting** — look up `express-rate-limit`. Add it to `/auth/login` and `/auth/forgot-password` to prevent brute-force attacks
- **OWASP Top 10** — read about broken authentication vulnerabilities. It is consistently in the top 3
- **Refresh tokens** — understand why short-lived access tokens (15 min) + long-lived refresh tokens (7 days) are more secure than a single long-lived token
- **httpOnly cookies vs localStorage** — understand the XSS and CSRF tradeoffs for storing JWT tokens on the frontend
