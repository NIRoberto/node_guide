# Lesson 4 Assignment: Airbnb API — Email, File Handling & Cloudinary

## Overview

Add email notifications and image uploads to the Airbnb API. Users receive emails on registration, booking confirmation, cancellation, and password reset. Hosts can upload listing photos. Users can upload profile pictures.

---

## Endpoints

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

Install:
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
1. Google Account → Security → Enable 2-Step Verification
2. Security → App Passwords → Select "Mail" → Generate
3. Copy the 16-character password into `EMAIL_PASS`

Create `src/config/email.ts`:
- Create a Nodemailer transporter using env variables, `secure: false`, port 587
- Export `sendEmail(to: string, subject: string, html: string): Promise<void>` — calls `transporter.sendMail()`
- The transporter is created once at module load — never inside the function

> Always wrap `sendEmail` calls in try/catch in controllers — a failed email must never crash the server or block the response. Send the HTTP response first, then fire the email

---

## Part 2 — Email Templates

Create `src/templates/emails.ts` with these four functions:

**welcomeEmail(name: string, role: string): string**
- Welcome the user by name
- If `role === "HOST"` — encourage them to create their first listing
- If `role === "GUEST"` — encourage them to explore listings
- Use Airbnb brand color `#FF5A5F` for buttons and headings

**bookingConfirmationEmail(guestName: string, listingTitle: string, location: string, checkIn: string, checkOut: string, totalPrice: number): string**
- Show listing title, location, check-in, check-out, and total price clearly
- Include a note about the cancellation policy

**bookingCancellationEmail(guestName: string, listingTitle: string, checkIn: string, checkOut: string): string**
- Show which listing and dates were cancelled
- Encourage the guest to find another listing

**passwordResetEmail(name: string, resetLink: string): string**
- Show the reset link as a prominent button
- State clearly the link expires in 1 hour
- Include: "If you did not request this, ignore this email"

---

## Part 3 — Welcome Email on Registration

Update `register` in `auth.controller.ts`:
- After `prisma.user.create()` succeeds, call `sendEmail` with the welcome template
- Pass `name` and `role` to the template
- Wrap in try/catch — if email fails, log the error but still return 201
- Registration succeeds independently of whether the email sends

---

## Part 4 — Booking Emails

Update `bookings.controller.ts`:

**createBooking — after booking is created:**
- Get guest's email and name using `req.userId`
- Format `checkIn` and `checkOut` as readable date strings
- Send booking confirmation email — wrap in try/catch

**deleteBooking (cancel) — after status updated to CANCELLED:**
- Get guest's email, name, listing title, and booking dates
- Send cancellation email — wrap in try/catch

---

## Part 5 — Password Reset Email

Update `forgotPassword` in `auth.controller.ts`:
- After saving the hashed token, build the reset link: `${process.env["API_URL"] || "http://localhost:3000"}/auth/reset-password/${rawToken}`
- Call `sendEmail` with the `passwordResetEmail` template
- Wrap in try/catch — always return 200 regardless of whether the email sent

---

## Part 6 — Cloudinary Setup

Install:
```bash
npm install cloudinary
```

Add to `.env`:
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Getting credentials:** Sign up at [cloudinary.com](https://cloudinary.com) → Dashboard → copy Cloud Name, API Key, API Secret

Create `src/config/cloudinary.ts`:
- Configure Cloudinary with env variables using `cloudinary.config()`
- Export `uploadToCloudinary(buffer: Buffer, folder: string): Promise<{ url: string; publicId: string }>`:
  - Use `cloudinary.uploader.upload_stream()` with `resource_type: "auto"` and the folder
  - Wrap in `new Promise()` — `upload_stream` uses callbacks
  - Call `stream.end(buffer)` to write the buffer
  - Resolve with `{ url: result.secure_url, publicId: result.public_id }` — always use `secure_url` (HTTPS)
- Export `deleteFromCloudinary(publicId: string): Promise<void>` — calls `cloudinary.uploader.destroy(publicId)`

> Always store `publicId` alongside the URL — the URL is for displaying, the publicId is for deleting. Without it you cannot clean up old files

---

## Part 7 — Multer Setup

Install:
```bash
npm install multer
npm install -D @types/multer
```

Create `src/config/multer.ts`:
- Use `multer.memoryStorage()` — files stay as Buffers in RAM, no disk writes needed before uploading to Cloudinary
- `fileFilter` — accept only `image/jpeg`, `image/png`, `image/webp`. Call `cb(null, true)` to accept, `cb(new Error("Only jpeg, png, webp allowed"))` to reject — always check MIME type, not file extension
- `limits: { fileSize: 5 * 1024 * 1024 }` — 5MB max. Without this, large uploads can exhaust RAM
- Export the configured `upload` instance

---

## Part 8 — User Avatar Upload

Update Prisma schema — add to User:
- `avatar` — String? (Cloudinary URL)
- `avatarPublicId` — String? (needed to delete the old file before uploading a new one)

Run migration: `add_avatar_to_user`

Create `src/controllers/upload.controller.ts`:

**uploadAvatar (POST /users/:id/avatar):**
- Require `authenticate`
- Check `req.userId === id` — return 403 if not. Users can only change their own avatar
- Check `req.file` exists — return 400 with `"No file uploaded"`
- Find user — return 404 if not found
- If user has `avatarPublicId`, call `deleteFromCloudinary(user.avatarPublicId)` first — always clean up the old file before uploading a new one
- Upload `req.file.buffer` to Cloudinary under `"airbnb/avatars"`
- Update user with new `avatar` URL and `avatarPublicId`
- Return updated user without `password`

**deleteAvatar (DELETE /users/:id/avatar):**
- Require `authenticate` and ownership check
- Find user — return 404 if not found
- If `user.avatar` is null — return 400 with `"No avatar to remove"`
- Call `deleteFromCloudinary(user.avatarPublicId)`
- Set `avatar` and `avatarPublicId` to `null` in database
- Return success message

Create `src/routes/upload.routes.ts`:
- `POST /users/:id/avatar` — `authenticate`, `upload.single("image")`, `uploadAvatar`
- `DELETE /users/:id/avatar` — `authenticate`, `deleteAvatar`

Mount in `index.ts` under `/users`.

---

## Part 9 — Listing Photos Upload

Update Prisma schema — add new model `ListingPhoto`:
- `id` — Int, `@id @default(autoincrement())`
- `url` — String (Cloudinary URL)
- `publicId` — String (Cloudinary public_id)
- `listing` — relation to Listing
- `listingId` — Int, foreign key

Add `photos ListingPhoto[]` to the Listing model.

Run migration: `add_listing_photos`

Add to `upload.controller.ts`:

**uploadListingPhotos (POST /listings/:id/photos):**
- Require `authenticate`
- Find listing — return 404 if not found
- Check `listing.hostId === req.userId` — return 403 if not the host
- Count existing photos: `prisma.listingPhoto.count({ where: { listingId: id } })`
- If count is already 5 — return 400 with `"Maximum of 5 photos allowed per listing"`
- Check `req.files` exists and is not empty — return 400 if no files
- Calculate remaining slots: `5 - existingCount` — only process up to that many files
- For each file: upload to Cloudinary under `"airbnb/listings"`, create a `ListingPhoto` record
- Return updated listing with all photos

**deleteListingPhoto (DELETE /listings/:id/photos/:photoId):**
- Require `authenticate`
- Find listing — return 404 if not found
- Check `listing.hostId === req.userId` — return 403 if not the host
- Find photo by `photoId` — return 404 if not found
- Verify `photo.listingId === id` — return 403 if photo does not belong to this listing. Prevents hosts from deleting other listings' photos
- Call `deleteFromCloudinary(photo.publicId)`
- Delete `ListingPhoto` record from database
- Return success message

Update `upload.routes.ts`:
- `POST /listings/:id/photos` — `authenticate`, `upload.array("photos", 5)`, `uploadListingPhotos`
- `DELETE /listings/:id/photos/:photoId` — `authenticate`, `deleteListingPhoto`

### Research Task
Research Cloudinary's **URL transformations**. Write a utility function `getOptimizedUrl(url: string, width: number, height: number): string` that inserts `w_{width},h_{height},c_fill,f_auto,q_auto` into a Cloudinary URL. Use it when returning listing photos — serve appropriately sized images instead of full resolution.

---

## Project Structure

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

- [ ] Welcome email sent on registration with role-specific message
- [ ] Booking confirmation email sent on booking creation
- [ ] Booking cancellation email sent on cancellation
- [ ] Forgot password sends reset email with raw token in link
- [ ] Reset password validates token, checks expiry, clears token after use
- [ ] Email failures do not crash server or block responses
- [ ] Avatar upload works — old avatar deleted from Cloudinary before new upload
- [ ] Avatar delete removes from Cloudinary and database
- [ ] Listing photos upload works — up to 5 per listing
- [ ] Listing photo delete removes from Cloudinary and database
- [ ] Photo belongs-to-listing check prevents cross-listing deletion
- [ ] File type validation rejects non-image files
- [ ] File size limit enforced (5MB)
- [ ] Ownership checks on all upload and delete operations

---

## Further Research

- **Background jobs** — look up **BullMQ** for Node.js. In production, emails and image processing run in background queues so they don't slow down API responses
- **AWS S3** — understand when you'd choose S3 over Cloudinary (more control, cheaper at scale)
- **sharp package** — how to resize and compress images before uploading to save storage costs
- **MIME type spoofing** — a user can rename a `.exe` to `.jpg`. Research validating file content using magic bytes instead of just the MIME type
