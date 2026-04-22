# Lesson 2: Databases, PostgreSQL & Prisma

## Table of Contents
1. [What is a Database?](#what-is-a-database)
2. [SQL vs NoSQL](#sql-vs-nosql)
3. [What is PostgreSQL?](#what-is-postgresql)
4. [Installing PostgreSQL](#installing-postgresql)
5. [What is an ORM?](#what-is-an-orm)
6. [What is Prisma?](#what-is-prisma)
7. [Setting Up Prisma](#setting-up-prisma)
8. [Prisma Schema & Models](#prisma-schema--models)
9. [Migrations](#migrations)
10. [Prisma Client CRUD](#prisma-client-crud)
11. [Environment Variables](#environment-variables)
12. [Connecting Prisma to Express](#connecting-prisma-to-express)

---

## What is a Database?

In lesson 1, we stored data in a plain array inside our server. That worked fine for learning, but it has one big problem — **every time the server restarts, all data is gone**.

A database solves this. It's a system that stores data **permanently on disk** so it survives restarts, crashes, and deployments.

**Without a database:**
```
Server restarts → users array resets → all data lost
```

**With a database:**
```
Server restarts → data stays in PostgreSQL → nothing lost
```

Databases also give you:
- **Querying** — find exactly the data you need
- **Relationships** — link users to their listings, orders to their products
- **Integrity** — enforce rules like "email must be unique"
- **Performance** — handle millions of records efficiently

---

## SQL vs NoSQL

There are two main types of databases. You'll hear about both constantly.

### SQL (Relational Databases)

Data is stored in **tables** — like spreadsheets with rows and columns. Tables can be linked together through relationships.

Examples: **PostgreSQL**, MySQL, SQLite, SQL Server

```
users table:
| id | name    | email              |
|----|---------|-------------------|
| 1  | Alice   | alice@gmail.com   |
| 2  | Bob     | bob@gmail.com     |

listings table:
| id | title         | userId |
|----|---------------|--------|
| 1  | Cozy Apartment| 1      |
| 2  | Beach House   | 1      |
```

The `userId` column in listings links back to the `users` table — that's a **relationship**.

### NoSQL (Non-Relational Databases)

Data is stored as **documents** (like JSON objects), not tables. More flexible structure.

Examples: MongoDB, Redis, DynamoDB

```json
{
  "_id": "abc123",
  "name": "Alice",
  "email": "alice@gmail.com",
  "listings": [
    { "title": "Cozy Apartment" },
    { "title": "Beach House" }
  ]
}
```

### Which one should you use?

| | SQL | NoSQL |
|--|-----|-------|
| Data structure | Fixed (tables, columns) | Flexible (documents) |
| Relationships | Great | Harder |
| Consistency | Strong | Varies |
| Best for | Most apps, financial data | Real-time apps, unstructured data |

**For most apps — use SQL (PostgreSQL).** It's reliable, well-understood, and handles relationships cleanly. NoSQL has its place but SQL is the safer default.

---

## What is PostgreSQL?

PostgreSQL (often called **Postgres**) is the most popular open-source SQL database. It's free, battle-tested, and used by companies like Instagram, Spotify, and GitHub.

**Why PostgreSQL over MySQL or SQLite?**
- More feature-rich than MySQL
- Better at handling complex queries
- SQLite is great for local dev but not for production
- Prisma works best with PostgreSQL

### Key Concepts

**Database** — a container that holds all your tables. You create one per project.

**Table** — stores one type of data (users, listings, orders). Each table has columns.

**Column** — a field in a table (id, name, email). Each column has a data type.

**Row** — a single record in a table (one user, one listing).

**Primary Key** — a unique identifier for each row, usually `id`. No two rows can have the same primary key.

**Foreign Key** — a column that references the primary key of another table. This is how relationships work.

```
users table          listings table
-----------          --------------
id (PK)  ←───────── userId (FK)
name
email
```

---

## Installing PostgreSQL

### macOS

```bash
brew install postgresql@16
brew services start postgresql@16
```

### Windows

Download the installer from [postgresql.org/download](https://www.postgresql.org/download/) and follow the steps.

### Verify installation

```bash
psql --version   # should show psql (PostgreSQL) 16.x
```

### Create a database

```bash
psql postgres                          # open postgres shell
CREATE DATABASE my_app;                # create a database
\l                                     # list all databases
\q                                     # quit
```

### Connection string format

Every database connection uses a **connection string** — a URL that contains everything needed to connect:

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
```

Example:
```
postgresql://postgres:1234@localhost:5432/my_app
```

- `postgres` — default username
- `1234` — your password
- `localhost` — your machine
- `5432` — default PostgreSQL port
- `my_app` — your database name

---

## What is an ORM?

ORM stands for **Object Relational Mapper**. It's a tool that lets you interact with your database using your programming language instead of writing raw SQL.

**Without ORM — raw SQL:**
```typescript
const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
```

**With ORM (Prisma):**
```typescript
const user = await prisma.user.findUnique({ where: { id } });
```

Both do the same thing. The ORM version is:
- Easier to read and write
- Type-safe — your editor knows the shape of the data
- Less error-prone — no typos in SQL strings
- Database-agnostic — switch databases with minimal changes

---

## What is Prisma?

Prisma is a modern ORM for Node.js and TypeScript. It has three main parts:

**1. Prisma Schema** — a single file where you define your database models (tables)

**2. Prisma Migrate** — generates and runs SQL migrations based on your schema changes

**3. Prisma Client** — an auto-generated, type-safe database client you use in your code

```
schema.prisma  →  prisma migrate  →  database tables
                                          ↓
your code      ←  prisma client   ←  type-safe queries
```

### Why Prisma over other ORMs?

- Full TypeScript support — autocomplete on every query
- Auto-generated types from your schema
- Clean, readable query API
- Great error messages
- Works with PostgreSQL, MySQL, SQLite, MongoDB

---

## Setting Up Prisma

### Step 1 — Install dependencies

```bash
npm install @prisma/client @prisma/adapter-pg pg dotenv
npm install -D prisma @types/pg
```

| Package | Why |
|---------|-----|
| `@prisma/client` | The query client you use in code |
| `@prisma/adapter-pg` | Connects Prisma to PostgreSQL |
| `pg` | PostgreSQL driver for Node.js |
| `dotenv` | Loads `.env` variables |
| `prisma` | CLI tool for migrations and codegen |

### Step 2 — Initialize Prisma

```bash
npx prisma init
```

This creates two files:
- `prisma/schema.prisma` — your schema file
- `.env` — with a `DATABASE_URL` placeholder

### Step 3 — Set your database URL

Open `.env` and update the connection string:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/your_db_name"
```

### Step 4 — Configure prisma.config.ts

Prisma 7+ uses a config file to load environment variables:

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

---

## Prisma Schema & Models

The schema file is the heart of Prisma. It defines your database structure.

**prisma/schema.prisma:**
```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id       Int    @id @default(autoincrement())
  name     String
  email    String @unique
  username String @unique
}
```

### Breaking it down

**generator client** — tells Prisma to generate the TypeScript client

**datasource db** — tells Prisma which database to use

**model User** — defines a `users` table in the database

### Field types

| Prisma Type | PostgreSQL Type | Example |
|-------------|----------------|---------|
| `Int` | INTEGER | `id`, `age` |
| `String` | TEXT | `name`, `email` |
| `Boolean` | BOOLEAN | `isActive` |
| `Float` | DOUBLE PRECISION | `price`, `rating` |
| `DateTime` | TIMESTAMP | `createdAt` |

### Field attributes

| Attribute | What it does |
|-----------|-------------|
| `@id` | Marks this field as the primary key |
| `@default(autoincrement())` | Auto-generates incrementing IDs |
| `@unique` | No two rows can have the same value |
| `@default(now())` | Sets default value to current timestamp |
| `?` after type | Makes the field optional (nullable) |

### Example with more fields

```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  username  String   @unique
  bio       String?              // optional field
  createdAt DateTime @default(now())
}
```

---

## Migrations

A migration is a file that records a change to your database schema. Every time you change your `schema.prisma`, you create a migration to apply that change to the actual database.

**Think of migrations like Git commits for your database** — they track every change over time.

### Create and run a migration

```bash
npx prisma migrate dev --name init
```

- `migrate dev` — creates a migration file and runs it on your database
- `--name init` — gives the migration a descriptive name

This command:
1. Compares your schema to the current database
2. Generates a SQL file with the changes
3. Runs the SQL against your database
4. Regenerates the Prisma Client

### Common Prisma CLI commands

```bash
npx prisma migrate dev --name <name>   # create + run a migration
npx prisma migrate reset               # reset database and re-run all migrations
npx prisma generate                    # regenerate Prisma Client after schema changes
npx prisma studio                      # open a visual database browser in the browser
npx prisma db push                     # push schema changes without creating a migration file (prototyping)
npx prisma migrate status              # check which migrations have been applied
```

### When to run each command

| Situation | Command |
|-----------|---------|
| Added/changed a model | `prisma migrate dev --name <name>` |
| Schema changed but client is outdated | `prisma generate` |
| Want to see your data visually | `prisma studio` |
| Prototyping, don't care about migration history | `prisma db push` |
| Something is broken, start fresh | `prisma migrate reset` |

---

## Prisma Client CRUD

After running migrations and generating the client, you can query your database.

### Setup — create the Prisma client

**src/config/prisma.ts**
```typescript
import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

export async function connectDB() {
  await prisma.$connect();
  console.log("Database connected successfully");
}

export default prisma;
```

### findMany — get all records

```typescript
const users = await prisma.user.findMany();
// SELECT * FROM users
```

With filters:
```typescript
const users = await prisma.user.findMany({
  where: { name: "Alice" },
  orderBy: { createdAt: "desc" },
  take: 10,   // limit to 10 results
  skip: 0,    // offset (for pagination)
});
```

### findUnique — get one record by unique field

```typescript
const user = await prisma.user.findUnique({
  where: { id: 1 },
});
// returns null if not found
```

### create — insert a new record

```typescript
const newUser = await prisma.user.create({
  data: {
    name: "Alice",
    email: "alice@gmail.com",
    username: "alice123",
  },
});
// returns the created user with its auto-generated id
```

### update — update an existing record

```typescript
const updated = await prisma.user.update({
  where: { id: 1 },
  data: { name: "Alice Updated" },
});
```

### delete — delete a record

```typescript
await prisma.user.delete({
  where: { id: 1 },
});
```

### Full CRUD example in a controller

```typescript
import type { Request, Response } from "express";
import prisma from "../config/prisma.js";

// GET /users
export async function getAllUsers(req: Request, res: Response) {
  const users = await prisma.user.findMany();
  res.json(users);
}

// GET /users/:id
export async function getUserById(req: Request, res: Response) {
  const id = parseInt(req.params["id"] as string);
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json(user);
}

// POST /users
export async function createUser(req: Request, res: Response) {
  const { name, email, username } = req.body;

  if (!name || !email || !username) {
    return res.status(400).json({ error: "name, email and username are required" });
  }

  const newUser = await prisma.user.create({ data: { name, email, username } });
  res.status(201).json(newUser);
}

// PUT /users/:id
export async function updateUser(req: Request, res: Response) {
  const id = parseInt(req.params["id"] as string);
  const existing = await prisma.user.findUnique({ where: { id } });

  if (!existing) return res.status(404).json({ error: "User not found" });

  const updated = await prisma.user.update({ where: { id }, data: req.body });
  res.json(updated);
}

// DELETE /users/:id
export async function deleteUser(req: Request, res: Response) {
  const id = parseInt(req.params["id"] as string);
  const existing = await prisma.user.findUnique({ where: { id } });

  if (!existing) return res.status(404).json({ error: "User not found" });

  await prisma.user.delete({ where: { id } });
  res.json({ message: "User deleted successfully" });
}
```

---

## Environment Variables

Never hardcode sensitive values like database passwords in your code. Use environment variables instead.

### .env file

```env
DATABASE_URL="postgresql://postgres:1234@localhost:5432/my_app"
PORT=3000
```

### Load in your app

```bash
npm install dotenv
```

```typescript
import "dotenv/config";  // must be the FIRST import in index.ts

console.log(process.env["DATABASE_URL"]); // works anywhere after this
```

### .gitignore — never commit .env

```
node_modules/
.env
*.log
```

Your `.env` contains passwords. If you push it to GitHub, anyone can access your database. Always add it to `.gitignore`.

---

## Connecting Prisma to Express

Here's how everything fits together in a real Express app.

### Project structure

```
src/
├── config/
│   └── prisma.ts          # Prisma client + connectDB()
├── controllers/
│   └── users.controller.ts
├── routes/
│   └── users.routes.ts
└── index.ts
```

### src/config/prisma.ts

```typescript
import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

export async function connectDB() {
  await prisma.$connect();
  console.log("Database connected successfully");
}

export default prisma;
```

### src/index.ts

```typescript
import "dotenv/config";
import express from "express";
import { connectDB } from "./config/prisma.js";
import usersRouter from "./routes/users.routes.js";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use("/users", usersRouter);

async function main() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
```

The server only starts **after** the database connects. If the connection fails, the server never starts — which is exactly what you want.

### How a request flows end to end

```
POST /users
  ↓
index.ts → app.use('/users', usersRouter)
  ↓
users.routes.ts → router.post('/', createUser)
  ↓
users.controller.ts → prisma.user.create({ data })
  ↓
Prisma Client → SQL INSERT INTO users ...
  ↓
PostgreSQL → saves row, returns new user
  ↓
Response: 201 + new user JSON
```

---

## Summary

| Concept | What it is |
|---------|------------|
| Database | Permanent storage for your app's data |
| SQL | Query language for relational databases |
| PostgreSQL | Most popular open-source SQL database |
| Table | Stores one type of data (like a spreadsheet) |
| Primary Key | Unique ID for each row (`id`) |
| Foreign Key | Links one table to another |
| ORM | Tool to query a database using your language instead of SQL |
| Prisma | Modern TypeScript ORM for Node.js |
| schema.prisma | File where you define your database models |
| Migration | A recorded change to your database schema |
| Prisma Client | Auto-generated type-safe database client |
| `findMany` | Get all records |
| `findUnique` | Get one record by unique field |
| `create` | Insert a new record |
| `update` | Update an existing record |
| `delete` | Delete a record |
| `.env` | File for storing secrets like database passwords |
| `DATABASE_URL` | Connection string that tells Prisma how to connect |

---

**Resources:**
- [Prisma Docs](https://www.prisma.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Prisma Schema Reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
