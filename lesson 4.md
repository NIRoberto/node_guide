# Lesson 4: Email, File Handling & Cloudinary

## Table of Contents
1. [What is Email in Backend Apps?](#what-is-email-in-backend-apps)
2. [How Email Sending Works](#how-email-sending-works)
3. [What is Nodemailer?](#what-is-nodemailer)
4. [Setting Up Nodemailer](#setting-up-nodemailer)
5. [Email Templates](#email-templates)
6. [What is File Handling?](#what-is-file-handling)
7. [How File Uploads Work in REST APIs](#how-file-uploads-work-in-rest-apis)
8. [What is Multer?](#what-is-multer)
9. [Setting Up Multer](#setting-up-multer)
10. [What is Cloudinary?](#what-is-cloudinary)
11. [How Cloudinary Works](#how-cloudinary-works)
12. [Setting Up Cloudinary](#setting-up-cloudinary)
13. [Connecting Multer and Cloudinary](#connecting-multer-and-cloudinary)
14. [Updating the Prisma Schema](#updating-the-prisma-schema)
15. [Upload Controller](#upload-controller)
16. [How It All Fits Together](#how-it-all-fits-together)

---

## What is Email in Backend Apps?

In lesson 3 we added authentication. A natural next step is sending emails — for things like:

- **Welcome emails** — when a user registers
- **Email verification** — confirm the user owns the email address
- **Password reset** — send a link to reset a forgotten password
- **Notifications** — booking confirmations, payment receipts, alerts

Your Node.js server doesn't send emails directly. It connects to an **email service** (like Gmail, SendGrid, or Mailgun) and tells it to send the email on your behalf. The email service handles the actual delivery.

**Think of it like a post office:**
- You (the server) write a letter and hand it to the post office (email service)
- The post office delivers it to the recipient
- You don't need to know how delivery works — that's the post office's job

---

## How Email Sending Works

Understanding the underlying protocol helps you debug issues later.

### SMTP

**SMTP** (Simple Mail Transfer Protocol) is the standard protocol for sending emails. It's been around since 1982 and is still how virtually all email is sent today.

When your server sends an email:

```
Your Server
    ↓
SMTP connection (host, port, credentials)
    ↓
Email Service (Gmail, SendGrid, Mailgun)
    ↓
Recipient's Email Server
    ↓
Recipient's Inbox
```

### Key SMTP concepts

**Host** — the SMTP server address of your email provider
- Gmail: `smtp.gmail.com`
- SendGrid: `smtp.sendgrid.net`
- Mailgun: `smtp.mailgun.org`

**Port** — the port used for the SMTP connection
- Port `587` — TLS (recommended, most common)
- Port `465` — SSL (older, still used)
- Port `25` — unencrypted (never use in production)

**Auth** — your credentials to authenticate with the email service
- Username: usually your email address
- Password: your email password or an **app password** (for Gmail)

### Transactional vs Marketing Emails

| Type | What it is | Examples |
|------|-----------|---------|
| Transactional | Triggered by user actions | Welcome, password reset, receipts |
| Marketing | Sent in bulk to many users | Newsletters, promotions |

For transactional emails, **Nodemailer** is the standard Node.js tool. For marketing emails at scale, dedicated services like SendGrid or Mailgun are better.

---

## What is Nodemailer?

Nodemailer is the most popular Node.js library for sending emails. It abstracts away the complexity of SMTP and gives you a clean API to compose and send emails.

It supports:
- Plain text and HTML emails
- Attachments
- Multiple email providers (Gmail, SendGrid, custom SMTP)
- Email templates

---

## Setting Up Nodemailer

### Install

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

### Gmail App Password

If you're using Gmail, you can't use your regular password. Google requires an **App Password** — a special password generated specifically for third-party apps.

To generate one:
1. Go to your Google Account → Security
2. Enable 2-Step Verification (required)
3. Go to Security → App Passwords
4. Select "Mail" and your device → Generate
5. Copy the 16-character password

### Add credentials to .env

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/your_db"
JWT_SECRET="your-super-secret-key"
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-16-char-app-password"
EMAIL_FROM="Your App <your-email@gmail.com>"
```

### Create the email config

**src/config/email.ts:**
```typescript
import nodemailer from "nodemailer";

// A transporter is the connection to your email service
// It holds the SMTP credentials and reuses the connection for all emails
const transporter = nodemailer.createTransport({
  host: process.env["EMAIL_HOST"],
  port: Number(process.env["EMAIL_PORT"]),

  // secure: true uses SSL (port 465)
  // secure: false uses TLS (port 587) — more common
  secure: false,

  auth: {
    user: process.env["EMAIL_USER"],
    pass: process.env["EMAIL_PASS"],
  },
});

// sendEmail is a reusable function that wraps nodemailer's sendMail
// to: recipient email address
// subject: email subject line
// html: the email body as HTML
export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: process.env["EMAIL_FROM"],
    to,
    subject,
    html,
  });
}

export default transporter;
```

### Send a welcome email after registration

In your auth controller, call `sendEmail` after creating the user:

```typescript
import { sendEmail } from "../config/email.js";

// inside register():
await sendEmail(
  email,
  "Welcome to Airbnb!",
  `<h1>Welcome, ${name}!</h1><p>Your account has been created successfully.</p>`
);
```

---

## Email Templates

Hardcoding HTML strings in your controller gets messy fast. A better approach is to keep email templates as separate functions that return HTML strings.

**src/templates/emails.ts:**
```typescript
// Each function takes the dynamic data and returns a complete HTML string
// In a real app you might use a templating engine like Handlebars or MJML
// for more complex designs

export function welcomeEmail(name: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #FF5A5F;">Welcome to Airbnb, ${name}!</h1>
      <p>Your account has been created successfully.</p>
      <p>Start exploring listings and book your next stay.</p>
      <a href="http://localhost:3000" style="background: #FF5A5F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
        Explore Listings
      </a>
    </div>
  `;
}

export function passwordResetEmail(name: string, resetLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Password Reset Request</h1>
      <p>Hi ${name}, we received a request to reset your password.</p>
      <p>Click the button below. This link expires in 1 hour.</p>
      <a href="${resetLink}" style="background: #FF5A5F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
        Reset Password
      </a>
      <p style="color: #999; font-size: 12px;">If you didn't request this, ignore this email.</p>
    </div>
  `;
}
```

---

## What is File Handling?

File handling in a backend API means accepting files uploaded by users — profile pictures, listing photos, documents, etc.

In a REST API, files are sent differently from regular JSON data. Instead of `Content-Type: application/json`, file uploads use `Content-Type: multipart/form-data`.

**Why multipart/form-data?**

JSON can only represent text. Files are binary data (bytes). `multipart/form-data` is a format that can carry both text fields and binary file data in the same request, split into multiple "parts" — hence the name.

```
Regular JSON request:
  Content-Type: application/json
  Body: { "name": "Alice" }

File upload request:
  Content-Type: multipart/form-data; boundary=----boundary123
  Body:
    ----boundary123
    Content-Disposition: form-data; name="name"
    Alice
    ----boundary123
    Content-Disposition: form-data; name="avatar"; filename="photo.jpg"
    Content-Type: image/jpeg
    [binary file data]
    ----boundary123--
```

Express's built-in `express.json()` middleware cannot parse this format. You need a dedicated library — **Multer**.

---

## How File Uploads Work in REST APIs

Here's the full flow of a file upload:

```
1. Client sends multipart/form-data request with file
   ↓
2. Multer middleware intercepts the request
   ↓
3. Multer parses the file from the request
   ↓
4. File is either:
   a) Stored on disk (local storage) — for development
   b) Uploaded to Cloudinary — for production
   ↓
5. Cloudinary returns a URL for the uploaded file
   ↓
6. Controller saves the URL to the database
   ↓
7. Response sent back to client with the file URL
```

### Where NOT to store files

**Never store files directly in your database** as binary data (BLOBs). It makes your database huge, slow, and expensive to back up.

**Never store files on your server's local disk in production.** If you deploy to multiple servers, each server has its own disk — a file uploaded to server A won't be accessible from server B.

**Always use a dedicated file storage service** like Cloudinary, AWS S3, or Google Cloud Storage. They handle storage, CDN delivery, and scaling for you.

---

## What is Multer?

Multer is a Node.js middleware for handling `multipart/form-data` — the format used for file uploads. It parses the incoming request and makes the file available on `req.file` (single file) or `req.files` (multiple files).

Multer supports two storage modes:
- **DiskStorage** — saves files to your local filesystem (good for development)
- **MemoryStorage** — keeps files in memory as a Buffer (needed for Cloudinary uploads)

---

## Setting Up Multer

### Install

```bash
npm install multer
npm install -D @types/multer
```

### Memory storage (for Cloudinary)

When uploading to Cloudinary, we use **memory storage** — the file is kept in RAM as a Buffer and passed directly to Cloudinary without touching the disk.

**src/config/multer.ts:**
```typescript
import multer from "multer";

// memoryStorage keeps the file in memory as req.file.buffer
// This is what we need to stream the file directly to Cloudinary
// DiskStorage would save to disk first — unnecessary extra step
const storage = multer.memoryStorage();

// File filter — only allow image files
// This runs before the file is stored, rejecting non-image uploads early
function fileFilter(
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // accept the file
  } else {
    cb(new Error("Only image files are allowed (jpeg, png, webp, gif)"));
  }
}

const upload = multer({
  storage,
  fileFilter,

  // Limit file size to 5MB
  // Without this, users could upload huge files and crash your server
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default upload;
```

### How to use Multer as middleware

```typescript
// Single file upload — field name must match what the client sends
router.post("/upload", upload.single("image"), uploadImage);

// Multiple files
router.post("/upload", upload.array("images", 5), uploadImages);
```

After Multer runs, the file is available on `req.file`:
- `req.file.buffer` — the file data as a Buffer (with memoryStorage)
- `req.file.originalname` — original filename
- `req.file.mimetype` — file type (e.g. `image/jpeg`)
- `req.file.size` — file size in bytes

---

## What is Cloudinary?

Cloudinary is a **cloud-based media management service**. It stores your images and videos, delivers them through a global CDN, and provides powerful transformations (resize, crop, compress, convert format) on the fly via URL parameters.

**Why Cloudinary over storing files yourself?**

| Feature | Self-hosted | Cloudinary |
|---------|------------|-----------|
| Storage | Your server disk | Cloud (unlimited) |
| CDN delivery | ❌ You set it up | ✅ Built-in global CDN |
| Image transformations | ❌ You code it | ✅ URL-based (free) |
| Backups | ❌ You manage | ✅ Automatic |
| Scaling | ❌ Manual | ✅ Automatic |
| Free tier | N/A | 25GB storage, 25GB bandwidth/month |

### Cloudinary URL transformations

One of Cloudinary's best features — you can transform images just by changing the URL:

```
Original:
https://res.cloudinary.com/demo/image/upload/sample.jpg

Resize to 300x300:
https://res.cloudinary.com/demo/image/upload/w_300,h_300/sample.jpg

Crop to face:
https://res.cloudinary.com/demo/image/upload/w_300,h_300,c_face/sample.jpg

Convert to WebP:
https://res.cloudinary.com/demo/image/upload/f_webp/sample.jpg

Compress quality to 80%:
https://res.cloudinary.com/demo/image/upload/q_80/sample.jpg
```

No code changes needed — just modify the URL. This is extremely useful for serving different image sizes to mobile vs desktop.

---

## How Cloudinary Works

```
Your Server
    ↓
Upload file buffer via Cloudinary SDK (or REST API)
    ↓
Cloudinary stores the file and returns:
  {
    public_id: "airbnb/listings/abc123",
    secure_url: "https://res.cloudinary.com/your-cloud/image/upload/airbnb/listings/abc123.jpg",
    width: 1920,
    height: 1080,
    format: "jpg",
    bytes: 245000
  }
    ↓
You save secure_url to your database
    ↓
Client requests the image directly from Cloudinary's CDN
(your server is not involved in serving the image)
```

Your server only handles the upload. After that, the client fetches images directly from Cloudinary's CDN — fast, globally distributed, and zero load on your server.

---

## Setting Up Cloudinary

### Create a Cloudinary account

1. Go to [cloudinary.com](https://cloudinary.com) and sign up (free)
2. Go to your Dashboard
3. Copy your **Cloud Name**, **API Key**, and **API Secret**

### Install

```bash
npm install cloudinary
```

### Add credentials to .env

```env
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

### Create the Cloudinary config

**src/config/cloudinary.ts:**
```typescript
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary with your account credentials
// This must run before any upload calls
cloudinary.config({
  cloud_name: process.env["CLOUDINARY_CLOUD_NAME"],
  api_key: process.env["CLOUDINARY_API_KEY"],
  api_secret: process.env["CLOUDINARY_API_SECRET"],
});

// uploadToCloudinary takes a file buffer and uploads it to Cloudinary
// folder: organizes files in your Cloudinary media library
// Returns the upload result which includes secure_url and public_id
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    // upload_stream is used when you have a buffer (not a file path)
    // It opens a writable stream that Cloudinary reads from
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        // resource_type: "auto" detects whether it's an image or video
        resource_type: "auto",
      },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    // Write the buffer into the stream and close it
    stream.end(buffer);
  });
}

// deleteFromCloudinary removes a file from Cloudinary by its public_id
// Call this when a user deletes their profile picture or a listing photo
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

export default cloudinary;
```

---

## Connecting Multer and Cloudinary

Now we connect the two — Multer parses the file from the request, then we pass the buffer to Cloudinary.

**src/controllers/upload.controller.ts:**
```typescript
import type { Request, Response } from "express";
import { uploadToCloudinary } from "../config/cloudinary.js";
import prisma from "../config/prisma.js";

// POST /users/:id/avatar
// Uploads a profile picture for a user
// Multer middleware runs first and puts the file on req.file
// Then we upload the buffer to Cloudinary and save the URL to the database

export async function uploadAvatar(req: Request, res: Response) {
  const id = parseInt(req.params["id"] as string);

  // req.file is set by Multer — if it's missing, no file was sent
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Upload the buffer to Cloudinary under the "airbnb/avatars" folder
  const { url, publicId } = await uploadToCloudinary(
    req.file.buffer,
    "airbnb/avatars"
  );

  // Save the Cloudinary URL to the user's record in the database
  const updated = await prisma.user.update({
    where: { id },
    data: { avatar: url },
  });

  res.json({ message: "Avatar uploaded successfully", avatar: url });
}
```

---

## Updating the Prisma Schema

Add an `avatar` field to the User model to store the Cloudinary URL.

**prisma/schema.prisma:**
```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  username  String   @unique
  password  String
  avatar    String?             // optional — not all users have a profile picture
  createdAt DateTime @default(now())
}
```

Run the migration:
```bash
npx prisma migrate dev --name add_avatar_to_user
```

---

## How It All Fits Together

### Updated project structure

```
src/
├── config/
│   ├── cloudinary.ts      ← new
│   ├── email.ts           ← new
│   ├── multer.ts          ← new
│   └── prisma.ts
├── controllers/
│   ├── auth.controller.ts
│   ├── upload.controller.ts  ← new
│   └── users.controller.ts
├── middlewares/
│   └── auth.middleware.ts
├── routes/
│   ├── auth.routes.ts
│   ├── upload.routes.ts   ← new
│   └── users.routes.ts
├── templates/
│   └── emails.ts          ← new
└── index.ts
```

### Upload routes

**src/routes/upload.routes.ts:**
```typescript
import { Router } from "express";
import upload from "../config/multer.js";
import { uploadAvatar } from "../controllers/upload.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// upload.single("image") — Multer middleware runs first
// "image" must match the field name in the multipart form
// authenticate — user must be logged in to upload
router.post("/:id/avatar", authenticate, upload.single("image"), uploadAvatar);

export default router;
```

### Mount in index.ts

```typescript
import uploadRouter from "./routes/upload.routes.js";

app.use("/users", uploadRouter);
```

### Full request flow

```
POST /users/1/avatar  (multipart/form-data with image file)
  ↓
authenticate middleware → verifies JWT token
  ↓
upload.single("image") → Multer parses the file → req.file.buffer
  ↓
uploadAvatar controller
  ↓
uploadToCloudinary(req.file.buffer, "airbnb/avatars")
  ↓
Cloudinary stores file → returns { url, publicId }
  ↓
prisma.user.update({ data: { avatar: url } })
  ↓
200 + { message, avatar: "https://res.cloudinary.com/..." }

─────────────────────────────────────────────────────

POST /auth/register
  ↓
register controller → creates user
  ↓
sendEmail(email, "Welcome!", welcomeEmail(name))
  ↓
Nodemailer → SMTP → Gmail → user's inbox
  ↓
201 + user data
```

### Testing with Postman

**Upload an avatar:**
```
POST http://localhost:3000/users/1/avatar
Authorization: Bearer eyJhbGci...
Content-Type: multipart/form-data

Body → form-data:
  Key: image  (type: File)
  Value: [select an image file]
```

**Send a welcome email (triggered on register):**
```
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "name": "Alice",
  "email": "alice@gmail.com",
  "username": "alice123",
  "password": "secret123"
}
→ Email sent to alice@gmail.com automatically
```

---

## Summary

| Concept | What it is |
|---------|------------|
| SMTP | Protocol for sending emails — your server connects to an email service via SMTP |
| Transporter | Nodemailer's connection to the email service — reused for all emails |
| App Password | A Gmail-specific password for third-party apps — required when 2FA is on |
| `sendMail()` | Nodemailer method to send an email with from, to, subject, and html |
| Email Template | A function that returns an HTML string — keeps email HTML out of controllers |
| `multipart/form-data` | HTTP content type for file uploads — carries both text and binary data |
| Multer | Middleware that parses `multipart/form-data` and puts the file on `req.file` |
| `memoryStorage` | Multer storage mode that keeps the file as a Buffer in RAM |
| `req.file` | The uploaded file object set by Multer — contains buffer, mimetype, size |
| `fileFilter` | Multer option to reject files that don't match allowed types |
| Cloudinary | Cloud media storage with built-in CDN and URL-based image transformations |
| `upload_stream` | Cloudinary method to upload a Buffer (not a file path) |
| `secure_url` | The HTTPS URL Cloudinary returns after a successful upload |
| `public_id` | Cloudinary's identifier for a file — used to delete or transform it |
| CDN | Content Delivery Network — serves files from servers closest to the user |
| `deleteFromCloudinary` | Removes a file from Cloudinary using its public_id |

---

**Resources:**
- [Nodemailer Docs](https://nodemailer.com)
- [Multer Docs](https://github.com/expressjs/multer)
- [Cloudinary Node.js SDK](https://cloudinary.com/documentation/node_integration)
- [Cloudinary Transformations](https://cloudinary.com/documentation/image_transformations)
