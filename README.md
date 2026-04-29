# Node.js Backend Course

A complete backend development course using **Node.js**, **TypeScript**, **Express**, **PostgreSQL**, and **Prisma**. All lessons are built around a single real-world project — an **Airbnb-like API** — that grows from a simple in-memory server to a fully deployed, documented, and versioned production API.

---

## Course Structure

| Lesson | Topic | Assignment |
|--------|-------|-----------|
| [Lesson 1](./leason%201.md) | Node.js, NPM, REST & Express Basics | [Assignment](./lesson%201%20assignment.md) |
| [Lesson 2](./lesson%202.md) | Databases, PostgreSQL & Prisma | [Assignment](./lesson%202%20assignment.md) |
| [Lesson 2B](./lesson%202b.md) | Relationships, Validation & Error Handling | [Assignment](./lesson%202b%20assignment.md) |
| [Lesson 2C](./lesson%202c.md) | Seeding, Scripts & Database Workflow | [Assignment](./lesson%202c%20assignment.md) |
| [Lesson 3](./lesson%203.md) | Authentication & Authorization (JWT + Bcrypt) | [Assignment](./lesson%203%20assignment.md) |
| [Lesson 4](./lesson%204.md) | Email, File Handling & Cloudinary | [Assignment](./lesson%204%20assignment.md) |
| [Lesson 5](./lesson%205.md) | Swagger API Documentation | [Assignment](./lesson%205%20assignment.md) |
| [Lesson 6](./lesson%206.md) | Deployment & Database Migration | [Assignment](./lesson%206%20assignment.md) |
| [Lesson 7](./lesson%207.md) | API Versioning & Deployment | [Assignment](./lesson%207%20assignment.md) |
| [Lesson 8](./lesson%208.md) | AI-Powered Features with LangChain | [Assignment](./lesson%208%20assignment.md) |

---

## What You Build

Every lesson extends the same **Airbnb API** project. By the end of the course you have a fully working production API with:

- User registration and login with JWT authentication
- Role-based access control (HOST / GUEST)
- Listings, bookings, and user management backed by PostgreSQL
- Password reset via email
- Profile picture and listing photo uploads via Cloudinary
- Interactive API documentation with Swagger UI
- API versioning (v1 / v2)
- Live deployment on Render with a hosted database
- AI-powered features with LangChain (natural language search, description generator, chatbot)

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | JavaScript runtime |
| TypeScript | Type safety |
| Express | Web framework |
| PostgreSQL | Relational database |
| Prisma | ORM — type-safe database queries |
| bcrypt | Password hashing |
| jsonwebtoken | JWT authentication |
| Zod | Request validation |
| Nodemailer | Email sending |
| Multer | File upload parsing |
| Cloudinary | Cloud image storage |
| Swagger / OpenAPI | API documentation |
| LangChain | AI chains, prompts, and memory |
| Groq | Free LLM API for AI features |

---

## Project Setup

### Prerequisites

- Node.js v18 or higher
- PostgreSQL installed locally
- A Cloudinary account (free)
- A Gmail account with App Password enabled

### Install dependencies

```bash
npm install
```

### Environment variables

Copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/airbnb_db
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Airbnb <your-email@gmail.com>
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
PORT=3000
NODE_ENV=development
API_URL=http://localhost:3000
```

### Database setup

```bash
# Create and apply migrations
npm run db:migrate -- --name init

# Seed with sample data
npm run db:seed

# Open visual database browser
npm run db:studio
```

### Run the development server

```bash
npm run dev
```

Server runs at `http://localhost:3000`
Swagger UI at `http://localhost:3000/api-docs`

---

## Database Scripts

| Script | What it does |
|--------|-------------|
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:migrate:prod` | Apply migrations in production |
| `npm run db:reset` | Wipe database and re-run all migrations |
| `npm run db:seed` | Run the seed file |
| `npm run db:studio` | Open Prisma Studio at localhost:5555 |
| `npm run db:generate` | Regenerate Prisma Client after schema changes |
| `npm run db:push` | Push schema without creating a migration |
| `npm run db:status` | Check which migrations have been applied |
| `npm run db:fresh` | Wipe + migrate + seed in one command |

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | No | Register a new account |
| POST | `/api/v1/auth/login` | No | Login and receive a JWT token |
| GET | `/api/v1/auth/me` | Yes | Get the logged-in user's profile |
| POST | `/api/v1/auth/change-password` | Yes | Change password |
| POST | `/api/v1/auth/forgot-password` | No | Request a password reset email |
| POST | `/api/v1/auth/reset-password/:token` | No | Reset password using token |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/users` | Yes | Get all users |
| GET | `/api/v1/users/:id` | Yes | Get a user with their listings or bookings |
| PUT | `/api/v1/users/:id` | Yes | Update a user |
| DELETE | `/api/v1/users/:id` | Yes | Delete a user |
| POST | `/api/v1/users/:id/avatar` | Yes | Upload profile picture |
| DELETE | `/api/v1/users/:id/avatar` | Yes | Remove profile picture |

### Listings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/listings` | No | Get all listings (filter, paginate, sort) |
| GET | `/api/v1/listings/:id` | No | Get a single listing |
| POST | `/api/v1/listings` | Yes (HOST) | Create a listing |
| PUT | `/api/v1/listings/:id` | Yes (owner) | Update a listing |
| DELETE | `/api/v1/listings/:id` | Yes (owner) | Delete a listing |
| POST | `/api/v1/listings/:id/photos` | Yes (owner) | Upload listing photos |
| DELETE | `/api/v1/listings/:id/photos/:photoId` | Yes (owner) | Delete a listing photo |
| GET | `/api/v1/listings/stats` | No | Get listing statistics by location |

### Bookings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/bookings` | Yes | Get all bookings |
| GET | `/api/v1/bookings/:id` | Yes | Get a single booking |
| POST | `/api/v1/bookings` | Yes (GUEST) | Create a booking |
| DELETE | `/api/v1/bookings/:id` | Yes (owner) | Cancel a booking |
| PATCH | `/api/v1/bookings/:id/status` | Yes | Update booking status |

---

## Project Structure

```
airbnb-api/
├── prisma/
│   ├── migrations/          # committed to Git — applied on deploy
│   ├── seed.ts              # seed file
│   └── schema.prisma        # database models
├── src/
│   ├── config/
│   │   ├── cloudinary.ts    # Cloudinary upload/delete
│   │   ├── email.ts         # Nodemailer transporter
│   │   ├── multer.ts        # file upload middleware
│   │   ├── prisma.ts        # Prisma client
│   │   └── swagger.ts       # Swagger setup
│   ├── controllers/
│   │   ├── v1/
│   │   │   ├── auth.controller.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── listings.controller.ts
│   │   │   └── bookings.controller.ts
│   │   └── upload.controller.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts       # JWT verification
│   │   ├── deprecation.middleware.ts # v1 deprecation headers
│   │   └── errorHandler.ts          # global error handler
│   ├── routes/
│   │   └── v1/
│   │       ├── index.ts
│   │       ├── auth.routes.ts
│   │       ├── users.routes.ts
│   │       ├── listings.routes.ts
│   │       └── bookings.routes.ts
│   ├── services/
│   │   ├── listings.service.ts
│   │   ├── users.service.ts
│   │   └── bookings.service.ts
│   ├── templates/
│   │   └── emails.ts        # email HTML templates
│   ├── validators/
│   │   ├── listings.validator.ts
│   │   ├── users.validator.ts
│   │   └── bookings.validator.ts
│   └── index.ts
├── generated/
│   └── prisma/              # auto-generated Prisma client (gitignored)
├── prisma.config.ts         # Prisma configuration
├── .env                     # local only — never commit
├── .env.example             # variable names — safe to commit
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Deployment

The API is deployed on **Railway** with a hosted PostgreSQL database.

### Deploy steps

1. Push to GitHub — make sure `.env` is NOT committed
2. Connect repository to Railway
3. Add a PostgreSQL database service
4. Set all environment variables in Railway's Variables tab
5. Set build and start commands:
   - Build: `npm run build && npx prisma generate && npx prisma migrate deploy`
   - Start: `npm start`

Every `git push origin main` triggers an automatic redeploy.

---

## Resources

- [Node.js Docs](https://nodejs.org/docs)
- [Express Docs](https://expressjs.com)
- [Prisma Docs](https://www.prisma.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs)
- [Zod Docs](https://zod.dev)
- [Cloudinary Node.js SDK](https://cloudinary.com/documentation/node_integration)
- [Nodemailer Docs](https://nodemailer.com)
- [Swagger / OpenAPI Docs](https://swagger.io/docs)
- [Railway Docs](https://docs.railway.app)
- [JWT.io](https://jwt.io)
