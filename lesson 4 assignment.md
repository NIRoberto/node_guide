# Lesson 4 Assignment: Airbnb API — Email, File Handling & Cloudinary

## Overview

Your Airbnb API now has authentication and a real database. But it is still missing two things that every real application needs — **email notifications** and **image uploads**.

Think about the real Airbnb experience. When you register, you get a welcome email. When you book a place, you get a confirmation email. When you forget your password, you get a reset link. When a host creates a listing, they upload photos. Without these features, your API feels incomplete.

In this assignment you will add:
- Email notifications for registration, booking confirmation, booking cancellation, and password reset
- Profile picture uploads for users
- Listing photo uploads for hosts (up to 5 photos per listing)

You are continuing the same `airbnb-api` project.

---

## Why Email Matters in a Real App

Your server does not send emails directly. It connects to an **email service** (like Gmail) via SMTP and tells it to send the email on your behalf. Think of it like handing a letter to a post office — you write the letter, the post office delivers it.

**Why emails should never block your response:** Sending an email takes time — it involves a network request to an external service. If you `await` the email before responding, the user waits for the email to be sent before getting their response. If the email service is slow or down, your API becomes slow or broken. Always send the response first, then send the email — or send it without awaiting.

**Why email failures should not crash your server:** Email delivery is not guaranteed. SMTP servers go down, rate limits get hit, addresses bounce. Wrap every email call in try/catch. A failed email should be logged, not thrown.

---

## Why File Storage Needs a Cloud Service

You might think: why not just save uploaded files to a folder on the server? Three reasons:

1. **Restarts wipe the disk** — on most cloud platforms (Railway, Render), the server's filesystem is ephemeral. Files saved to disk disappear when the server restarts or redeploys
2. **Multiple servers** — if your app scales to multiple server instances, a file uploaded to server A is not accessible from server B
3. **No CDN** — serving images from your Express server is slow. A CDN (Content Delivery Network) serves files from servers physically close to the user, making images load much faster

Cloudinary solves all three. It stores files permanently in the cloud, serves them through a global CDN, and gives you URL-based image transformations for free.

---

## What You're Adding

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register + send welcome email |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password/:token` | Reset password using token from email |
| POST | `/users/:id/avatar` | Upload profile picture |
| DELETE | `/users/:id/avatar` | Remove profile picture |
| POST | `/listings/:id/photos` | Upload listing photos (up to 5) |
| DELETE | `/listings/:id/photos/:photoId` | Delete a specific listing photo |

---

## Part 1 — Email Setup

### Why this step exists

Before you can send any emails, you need a configured connection to an email service. Nodemailer's `transporter` is that connection — it holds your SMTP credentials and reuses the connection for every email you send. Creating a new connection for every email would be slow and wasteful.

The `sendEmail` utility function wraps `transporter.sendMail()` so every controller can send emails with a single line instead of repeating the full configuration every time.

### Tasks

Install Nodemailer:
```bash
npm install nodemailer
npm install -D @types/nodemailer
```

Add to `.env`:
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
EMAIL_FROM=Airbnb <your-email@gmail.com>
```

**Getting a Gmail App Password:**
Gmail does not allow your regular password for third-party apps. You need an App Password:
1. Go to your Google Account → Security
2. Enable 2-Step Verification (required)
3. Go to Security → App Passwords
4. Select "Mail" → Generate
5. Copy the 16-character password — this goes in `EMAIL_PASS`

Create `src/config/email.ts`:
- Create a Nodemailer transporter using the env variables
- Set `secure: false` and `port: 587` for TLS (the most common setup)
- Export a reusable `sendEmail(to: string, subject: string, html: string): Promise<void>` function
- The function should `await transporter.sendMail()` with `from`, `to`, `subject`, and `html`

### Best Practices

- The transporter is created once at module load time and reused — never create it inside the `sendEmail` function
- Always wrap `sendEmail` calls in try/catch in your controllers — email failures must not crash the server
- Never `await` the email call if you do not need to — send the response first, then fire the email

---

## Part 2 — Email Templates

### Why this step exists

Hardcoding HTML strings inside controllers is messy, hard to maintain, and impossible to reuse. Templates are functions that take dynamic data and return a complete HTML string. They live in one place, they are easy to update, and they keep your controllers clean.

Each template is Airbnb-themed — the emails should feel like they come from a real product, not a generic system.

### Tasks

Create `src/templates/emails.ts` with these four template functions:

**welcomeEmail(name: string, role: string): string**
- Welcome the user by name
- If `role === "HOST"`: encourage them to create their first listing with a call-to-action button
- If `role === "GUEST"`: encourage them to explore listings and make their first booking
- Use Airbnb's brand color `#FF5A5F` for buttons and headings

**bookingConfirmationEmail(guestName: string, listingTitle: string, location: string, checkIn: string, checkOut: string, totalPrice: number): string**
- Confirm the booking with all details
- Show listing title, location, check-in date, check-out date, and total price clearly
- Include a note about the cancellation policy

**bookingCancellationEmail(guestName: string, listingTitle: string, checkIn: string, checkOut: string): string**
- Notify the guest their booking was cancelled
- Show which listing and which dates were cancelled
- Include a message encouraging them to find another listing

**passwordResetEmail(name: string, resetLink: string): string**
- Tell the user they requested a password reset
- Show the reset link as a prominent button
- Include a clear warning that the link expires in 1 hour
- Include a note: "If you did not request this, ignore this email and your password will remain unchanged"

### Best Practices

- Keep all email HTML in templates — never write HTML strings in controllers
- Always include a plain text message alongside HTML in production emails — some email clients do not render HTML. Add a `text` field to `sendMail()` with a plain text version
- Test your email templates by sending them to yourself before integrating them into controllers

---

## Part 3 — Welcome Email on Registration

### Why this step exists

A welcome email is the first impression your product makes after registration. It confirms the account was created, sets expectations, and guides the user to their first action — creating a listing (host) or exploring listings (guest).

The key lesson here is **non-blocking email sending**. The user should not wait for the email to be delivered before getting their 201 response. Registration succeeds or fails independently of whether the email sends.

### Tasks

Update the `register` function in `auth.controller.ts`:
- After `prisma.user.create()` succeeds, call `sendEmail` with the welcome template
- Pass the user's `name` and `role` to the template
- Wrap the email call in try/catch — if it fails, log the error but do not change the response
- Return 201 with the user data regardless of whether the email succeeded

---

## Part 4 — Booking Emails

### Why this step exists

Booking confirmation and cancellation emails are critical for trust. When a guest books a place, they need written confirmation with all the details — dates, location, price. When a booking is cancelled, they need to know immediately so they can make other arrangements.

### Tasks

Update `bookings.controller.ts`:

**createBooking — after successfully creating the booking:**
- Fetch the listing title and location (you may already have this from the conflict check)
- Get the guest's email and name from the database using `req.userId`
- Send a booking confirmation email to the guest's email address
- Format `checkIn` and `checkOut` as readable date strings before passing to the template
- Wrap in try/catch — the booking was created successfully regardless of the email

**deleteBooking (cancel) — after updating status to CANCELLED:**
- Get the guest's email and name
- Get the listing title and the booking's check-in/check-out dates
- Send a booking cancellation email to the guest
- Wrap in try/catch

---

## Part 5 — Password Reset Email

### Why this step exists

In lesson 3 you built the forgot-password and reset-password logic but without actually sending any email — the reset link existed only in your code. Now you will connect it to Nodemailer so the reset link is actually delivered to the user's inbox.

This is the most security-sensitive email in your app. The reset link is a temporary credential — it grants the ability to change someone's password. It must be delivered securely and expire quickly.

### Tasks

Update the `forgotPassword` function in `auth.controller.ts`:
- After generating the raw token and saving the hashed token to the database, call `sendEmail`
- Build the reset link: `${process.env["API_URL"] || "http://localhost:3000"}/auth/reset-password/${rawToken}`
- Use the `passwordResetEmail` template with the user's name and the reset link
- Wrap in try/catch — always return 200 regardless of whether the email sent

---

## Part 6 — Cloudinary Setup

### Why this step exists

Cloudinary is where your images will actually live. Before you can upload anything, you need to configure the SDK with your account credentials and create reusable upload/delete functions.

**Why `upload_stream` instead of a file path:** Multer (which you will set up next) keeps uploaded files in memory as a Buffer — not saved to disk. Cloudinary's `upload_stream` accepts a Buffer directly, which means you can upload without ever writing to disk. This is faster and avoids disk I/O entirely.

**Why you store `publicId` alongside the URL:** The URL is what you display to users. The `publicId` is what you use to delete the file from Cloudinary. If you only store the URL, you can never delete the file — it stays in your Cloudinary account forever, wasting storage.

### Tasks

Install Cloudinary:
```bash
npm install cloudinary
```

Add to `.env`:
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Getting Cloudinary credentials:**
1. Go to [cloudinary.com](https://cloudinary.com) and sign up (free)
2. Go to your Dashboard
3. Copy Cloud Name, API Key, and API Secret

Create `src/config/cloudinary.ts`:
- Configure Cloudinary with env variables using `cloudinary.config()`
- Export `uploadToCloudinary(buffer: Buffer, folder: string): Promise<{ url: string; publicId: string }>`:
  - Use `cloudinary.uploader.upload_stream()` with `resource_type: "auto"` and the folder name
  - Wrap in a `new Promise()` — `upload_stream` uses callbacks, not promises
  - Call `stream.end(buffer)` to write the buffer into the stream
  - Resolve with `{ url: result.secure_url, publicId: result.public_id }`
  - Reject on error
- Export `deleteFromCloudinary(publicId: string): Promise<void>`:
  - Call `cloudinary.uploader.destroy(publicId)`
  - This permanently removes the file from Cloudinary

### Best Practices

- Always use `secure_url` (HTTPS), never `url` (HTTP) — all production traffic must be encrypted
- Organize uploads into folders: `"airbnb/avatars"` and `"airbnb/listings"` — keeps your Cloudinary media library manageable
- Always store `publicId` — without it you cannot delete files and your storage fills up with orphaned images

---

## Part 7 — Multer Setup

### Why this step exists

Express's built-in `express.json()` middleware cannot parse file uploads. Files are sent as `multipart/form-data` — a completely different format that carries binary data. Multer is the middleware that parses this format and makes the file available on `req.file`.

**Why `memoryStorage`:** Multer has two storage modes. `diskStorage` saves the file to your server's disk first. `memoryStorage` keeps it in RAM as a Buffer. Since you are uploading directly to Cloudinary, you do not need the file on disk — `memoryStorage` is faster and avoids unnecessary disk writes.

**Why you validate file type:** A user could rename a `.exe` file to `.jpg` and upload it. The `fileFilter` checks the actual MIME type reported by the browser — not the file extension. This prevents non-image files from being uploaded.

**Why you set a file size limit:** Without a limit, a user could upload a 2GB video file and crash your server by exhausting RAM (since you are using `memoryStorage`). 5MB is a reasonable limit for listing photos.

### Tasks

Install Multer:
```bash
npm install multer
npm install -D @types/multer
```

Create `src/config/multer.ts`:
- Use `multer.memoryStorage()` — files stay as Buffers in RAM
- Create a `fileFilter` function that:
  - Accepts `image/jpeg`, `image/png`, `image/webp` only
  - Calls `cb(null, true)` to accept the file
  - Calls `cb(new Error("Only jpeg, png, and webp images are allowed"))` to reject
- Set `limits: { fileSize: 5 * 1024 * 1024 }` — 5MB maximum
- Export the configured `upload` instance

### Best Practices

- Always validate MIME type in `fileFilter` — never trust the file extension
- Always set a file size limit — without it users can crash your server with large files
- Use `memoryStorage` when uploading to a cloud service — no need to write to disk first

---

## Part 8 — User Avatar Upload

### Why this step exists

Every Airbnb user has a profile photo. Hosts use it to build trust with guests. Guests use it to introduce themselves to hosts. Without avatar support, your user profiles feel incomplete.

**Why you delete the old avatar before uploading a new one:** If you just upload a new avatar without deleting the old one, the old file stays in Cloudinary forever. Over time, your storage fills up with orphaned images that cost money. Always clean up before replacing.

**Why you check ownership:** A user should only be able to change their own avatar. Without this check, any authenticated user could change any other user's profile picture.

### Tasks

Update the Prisma schema — add to User:
- `avatar` — optional string (Cloudinary URL for displaying)
- `avatarPublicId` — optional string (Cloudinary public_id for deleting)

Run a migration named `add_avatar_to_user`.

Create `src/controllers/upload.controller.ts`:

**uploadAvatar (POST /users/:id/avatar):**
- Require `authenticate` middleware
- Parse the id from `req.params["id"]`
- Check `req.userId === id` — users can only upload their own avatar. Return 403 if not
- Check `req.file` exists — return 400 with `"No file uploaded"` if missing
- Find the user — return 404 if not found
- If the user already has an `avatarPublicId`, call `deleteFromCloudinary(user.avatarPublicId)` first — clean up the old file
- Upload `req.file.buffer` to Cloudinary under `"airbnb/avatars"`
- Update the user record with the new `avatar` URL and `avatarPublicId`
- Return the updated user without the `password` field

**deleteAvatar (DELETE /users/:id/avatar):**
- Require `authenticate` and ownership check
- Find the user — return 404 if not found
- If `user.avatar` is null, return 400 with `"No avatar to remove"`
- Call `deleteFromCloudinary(user.avatarPublicId)` to remove from Cloudinary
- Update the user: set `avatar` and `avatarPublicId` to `null`
- Return a success message

Create `src/routes/upload.routes.ts`:
- `POST /users/:id/avatar` — chain `authenticate`, then `upload.single("image")`, then `uploadAvatar`
- `DELETE /users/:id/avatar` — chain `authenticate`, then `deleteAvatar`

Mount in `index.ts` under `/users`.

### Best Practices

- Always delete the old Cloudinary file before uploading a new one — orphaned files waste storage and cost money
- Store both `avatar` (URL) and `avatarPublicId` — the URL is for displaying, the publicId is for deleting. You need both
- The field name in `upload.single("image")` must match the key the client sends in the form-data

---

## Part 9 — Listing Photos Upload

### Why this step exists

A listing without photos gets almost no bookings. Photos are the most important part of any Airbnb listing — guests decide whether to book based almost entirely on photos. Supporting multiple photos per listing is essential.

**Why a 5-photo limit:** Unlimited uploads would fill your Cloudinary storage quickly. A limit of 5 photos per listing is a reasonable constraint that forces hosts to choose their best photos.

**Why a separate `ListingPhoto` model:** A listing can have multiple photos. You cannot store multiple Cloudinary URLs in a single string field. A separate model with a foreign key to `Listing` is the correct relational approach — each photo is its own record.

**Why you verify the photo belongs to the listing before deleting:** Without this check, a host could delete photos from other hosts' listings by guessing photo IDs. Always verify ownership at every level.

### Tasks

Update the Prisma schema — add a new `ListingPhoto` model:
- `id` — auto-incrementing integer, primary key
- `url` — required string (Cloudinary URL)
- `publicId` — required string (Cloudinary public_id)
- `listing` — relation to Listing
- `listingId` — integer, foreign key

Add `photos ListingPhoto[]` relation to the Listing model.

Run a migration named `add_listing_photos`.

Add to `upload.controller.ts`:

**uploadListingPhotos (POST /listings/:id/photos):**
- Require `authenticate`
- Find the listing — return 404 if not found
- Check `listing.hostId === req.userId` — only the host can upload photos. Return 403 if not
- Count existing photos: `prisma.listingPhoto.count({ where: { listingId: id } })`
- If count is already 5, return 400 with `"Maximum of 5 photos allowed per listing"`
- Check `req.files` exists and is not empty — return 400 if no files uploaded
- Calculate how many more photos can be added: `5 - existingCount`
- Only process up to that many files — ignore extras
- For each file in `req.files`, upload to Cloudinary under `"airbnb/listings"` and create a `ListingPhoto` record
- Return the updated listing with all photos included

**deleteListingPhoto (DELETE /listings/:id/photos/:photoId):**
- Require `authenticate`
- Find the listing — return 404 if not found
- Check `listing.hostId === req.userId` — return 403 if not the host
- Find the photo by `photoId` — return 404 if not found
- Verify `photo.listingId === id` — the photo must belong to this listing. Return 403 if not
- Call `deleteFromCloudinary(photo.publicId)`
- Delete the `ListingPhoto` record from the database
- Return a success message

Update `src/routes/upload.routes.ts`:
- `POST /listings/:id/photos` — chain `authenticate`, then `upload.array("photos", 5)`, then `uploadListingPhotos`
- `DELETE /listings/:id/photos/:photoId` — chain `authenticate`, then `deleteListingPhoto`

### Best Practices

- Limit photos per listing — unlimited uploads waste storage and cost money
- Always verify the photo belongs to the listing before deleting — prevents cross-listing photo deletion
- Use `upload.array("photos", 5)` for multiple files — `req.files` will be an array
- Loop through `req.files` and upload each one — do not assume a single file

### Research Task

Research Cloudinary's **URL transformations**. Write a utility function `getOptimizedUrl(url: string, width: number, height: number): string` that inserts `w_{width},h_{height},c_fill,f_auto,q_auto` into a Cloudinary URL. Use this when returning listing photos — serve appropriately sized images instead of full resolution. `f_auto` serves WebP to browsers that support it, `q_auto` compresses automatically.

---

## Updated Project Structure

```
airbnb-api/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   ├── cloudinary.ts       ← new
│   │   ├── email.ts            ← new
│   │   ├── multer.ts           ← new
│   │   └── prisma.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── upload.controller.ts  ← new
│   │   ├── users.controller.ts
│   │   ├── listings.controller.ts
│   │   └── bookings.controller.ts
│   ├── middlewares/
│   │   └── auth.middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── upload.routes.ts    ← new
│   │   ├── users.routes.ts
│   │   ├── listings.routes.ts
│   │   └── bookings.routes.ts
│   ├── templates/
│   │   └── emails.ts           ← new
│   └── index.ts
```

---

## Checklist

- [ ] Welcome email sent on registration with role-specific message (host vs guest)
- [ ] Booking confirmation email sent when a booking is created
- [ ] Booking cancellation email sent when a booking is cancelled
- [ ] Forgot password sends a reset email with the raw token in the link
- [ ] Reset password validates the token, checks expiry, updates password, clears token
- [ ] Email failures do not crash the server or block responses
- [ ] Avatar upload works — old avatar deleted from Cloudinary before new upload
- [ ] Avatar delete removes from both Cloudinary and database
- [ ] Listing photos upload works — up to 5 photos per listing
- [ ] Listing photo delete removes from both Cloudinary and database
- [ ] Photo belongs-to-listing check prevents cross-listing deletion
- [ ] File type validation rejects non-image files
- [ ] File size limit enforced (5MB)
- [ ] Ownership checks on all upload and delete operations

---

## Further Research

- Research **background jobs and queues** — in production, emails and image processing are handled in background queues so they do not slow down API responses. Look up **BullMQ** for Node.js and understand how a job queue works
- Look up **AWS S3** as an alternative to Cloudinary for file storage. Understand when you would choose S3 (more control, cheaper at scale) over Cloudinary (easier, built-in transformations)
- Research the `sharp` package for Node.js — how to resize and compress images before uploading to save Cloudinary storage costs
- Read about **MIME type spoofing** — a user can rename a `.exe` file to `.jpg`. Research how to validate file content using magic bytes (the first few bytes of a file that identify its type) instead of just the MIME type reported by the browser
