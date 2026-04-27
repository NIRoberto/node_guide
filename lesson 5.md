# Lesson 5: API Documentation with Swagger

## Table of Contents
1. [What is API Documentation?](#what-is-api-documentation)
2. [What is Swagger / OpenAPI?](#what-is-swagger--openapi)
3. [How Swagger Works](#how-swagger-works)
4. [Setting Up Swagger](#setting-up-swagger)
5. [Documenting Routes](#documenting-routes)
6. [Documenting Schemas](#documenting-schemas)
7. [Documenting Authentication](#documenting-authentication)
8. [Advanced Documentation](#advanced-documentation)
9. [Testing with Swagger UI](#testing-with-swagger-ui)

---

## What is API Documentation?

Throughout this course we've been testing our API with Postman — manually typing URLs, headers, and request bodies. That works for you as the developer, but what about:

- A frontend developer who needs to know what endpoints exist
- A mobile developer who needs to know what fields to send
- A teammate who joins the project later
- You, 6 months from now, trying to remember how your own API works

**API documentation** solves this. It's a description of every endpoint in your API — what URL it uses, what method, what data it expects, what it returns, and what errors it can produce.

Without documentation, your API is a black box. With documentation, anyone can understand and use it without reading your source code.

---

## What is Swagger / OpenAPI?

**OpenAPI** is a standard specification for describing REST APIs. It defines a format (JSON or YAML) for documenting every aspect of your API.

**Swagger** is the toolset built around the OpenAPI specification. The most useful tool is **Swagger UI** — an interactive web page that reads your OpenAPI spec and renders it as a beautiful, clickable documentation page where you can read and test your API directly in the browser.

```
Your code + JSDoc comments
        ↓
swagger-jsdoc reads comments → generates OpenAPI spec (JSON)
        ↓
swagger-ui-express serves the spec as an interactive UI
        ↓
http://localhost:3000/api-docs → anyone can read and test your API
```

### Why Swagger over writing docs manually?

- Documentation lives **next to the code** — easier to keep in sync
- **Interactive** — developers can test endpoints directly from the docs page
- **Industry standard** — most companies use OpenAPI
- Auto-generates client SDKs in many languages
- Postman can import OpenAPI specs directly

---

## How Swagger Works

Swagger UI reads an **OpenAPI spec** — a JSON or YAML document that describes your API. You can write this spec manually, but the easier approach is to use **swagger-jsdoc** which generates it automatically from JSDoc comments in your code.

### OpenAPI spec structure

```yaml
openapi: 3.0.0
info:
  title: Airbnb API
  version: 1.0.0

paths:
  /users:
    get:
      summary: Get all users
      responses:
        200:
          description: List of users

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
```

You write this as JSDoc comments directly above your route handlers, and swagger-jsdoc compiles them into the full spec automatically.

---

## Setting Up Swagger

### Install

```bash
npm install swagger-jsdoc swagger-ui-express
npm install -D @types/swagger-jsdoc @types/swagger-ui-express
```

| Package | What it does |
|---------|-------------|
| `swagger-jsdoc` | Reads JSDoc comments and generates an OpenAPI spec |
| `swagger-ui-express` | Serves the Swagger UI as an Express route |
| `@types/swagger-jsdoc` | TypeScript types |
| `@types/swagger-ui-express` | TypeScript types |

### Create the Swagger config

**src/config/swagger.ts:**
```typescript
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Airbnb API",
      version: "1.0.0",
      description: "REST API for Airbnb listings, users, and authentication",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      // Define the Bearer token security scheme
      // This adds an "Authorize" button to the Swagger UI
      // where you can paste your JWT token once and it's sent with all requests
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  // Tell swagger-jsdoc where to find the JSDoc comments
  // It scans these files for @swagger annotations
  apis: ["./src/routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

// setupSwagger mounts the Swagger UI at /api-docs
// Call this in index.ts after setting up middleware
export function setupSwagger(app: Express) {
  // Serve the interactive Swagger UI
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Also expose the raw OpenAPI JSON spec
  // Useful for importing into Postman or generating client SDKs
  app.get("/api-docs.json", (req, res) => {
    res.json(swaggerSpec);
  });

  console.log("Swagger docs available at http://localhost:3000/api-docs");
}
```

### Mount in index.ts

```typescript
import { setupSwagger } from "./config/swagger.js";

// Call after middleware, before routes
setupSwagger(app);
```

---

## Documenting Routes

JSDoc comments for Swagger go directly above the route definitions in your route files. They use the `@swagger` tag.

**src/routes/users.routes.ts:**
```typescript
import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/users.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Returns a list of all registered users. Requires authentication.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: No token provided or token is invalid
 */
router.get("/", authenticate, getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.get("/:id", authenticate, getUserById);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserInput'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required fields
 */
router.post("/", createUser);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserInput'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.put("/:id", authenticate, updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/:id", authenticate, deleteUser);

export default router;
```

**src/routes/auth.routes.ts:**
```typescript
import { Router } from "express";
import { register, login } from "../controllers/auth.controller.js";

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Email already in use
 */
router.post("/register", register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and receive a JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiJ9...
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", login);

export default router;
```

---

## Documenting Schemas

Schemas define the shape of your data — what fields a User has, what a request body looks like. Define them once and reference them with `$ref` across all your route docs.

Add schema definitions to your route files or a dedicated schemas file:

**src/routes/users.routes.ts** (add at the top, before the router):
```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Alice
 *         email:
 *           type: string
 *           example: alice@gmail.com
 *         username:
 *           type: string
 *           example: alice123
 *         avatar:
 *           type: string
 *           nullable: true
 *           example: https://res.cloudinary.com/demo/image/upload/sample.jpg
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2024-01-15T10:30:00.000Z
 *
 *     CreateUserInput:
 *       type: object
 *       required: [name, email, username]
 *       properties:
 *         name:
 *           type: string
 *           example: Alice
 *         email:
 *           type: string
 *           example: alice@gmail.com
 *         username:
 *           type: string
 *           example: alice123
 *
 *     UpdateUserInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         username:
 *           type: string
 *
 *     RegisterInput:
 *       type: object
 *       required: [name, email, username, password]
 *       properties:
 *         name:
 *           type: string
 *           example: Alice
 *         email:
 *           type: string
 *           example: alice@gmail.com
 *         username:
 *           type: string
 *           example: alice123
 *         password:
 *           type: string
 *           example: secret123
 *
 *     LoginInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           example: alice@gmail.com
 *         password:
 *           type: string
 *           example: secret123
 */
```

---

## Documenting Authentication

The `securitySchemes` we defined in the Swagger config adds an **Authorize** button to the Swagger UI. Here's how to use it:

1. Open `http://localhost:3000/api-docs`
2. Click the **Authorize** button (top right)
3. Paste your JWT token (without "Bearer " prefix — Swagger adds it)
4. Click **Authorize** → **Close**
5. Now all requests with `security: - bearerAuth: []` will include the token automatically

Any route that has `security: - bearerAuth: []` in its docs will show a lock icon — indicating it requires authentication.

---

## Advanced Documentation

### Query Parameters

For endpoints with query parameters like pagination or filtering:

```typescript
/**
 * @swagger
 * /listings:
 *   get:
 *     summary: Get all listings
 *     tags: [Listings]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *     responses:
 *       200:
 *         description: List of listings
 */
```

### File Uploads

For endpoints that accept file uploads:

```typescript
/**
 * @swagger
 * /users/{id}/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture (jpeg, png, webp — max 5MB)
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *       400:
 *         description: Invalid file format or size
 *       401:
 *         description: Unauthorized
 */
```

### Enums

For fields with specific allowed values:

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     Listing:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [apartment, house, villa, cabin]
 *           example: apartment
 *         status:
 *           type: string
 *           enum: [pending, confirmed, cancelled]
 *           example: confirmed
 */
```

### Nested Objects

For responses that include related data:

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     Listing:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         host:
 *           $ref: '#/components/schemas/User'
 *         bookings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Booking'
 */
```

---

## Testing with Swagger UI

Once your documentation is set up, Swagger UI becomes a powerful testing tool:

### 1. View all endpoints

Open `http://localhost:3000/api-docs` — all your endpoints are organized by tags (Users, Auth, Listings, etc.)

### 2. Test without authentication

Click on any endpoint without a lock icon → **Try it out** → fill in parameters → **Execute**

The response appears below with status code, headers, and body.

### 3. Test with authentication

1. Call `POST /auth/login` with valid credentials
2. Copy the token from the response
3. Click **Authorize** (top right)
4. Paste the token
5. Now all protected endpoints work

### 4. Import into Postman

Go to `http://localhost:3000/api-docs.json` → copy the URL → Postman → Import → paste URL

All your endpoints are now in Postman with full documentation.

---

## Summary

| Concept | What it is |
|---------|------------|
| API Documentation | A description of every endpoint — what it expects and returns |
| OpenAPI | Industry standard specification format for describing REST APIs |
| Swagger UI | Interactive web page that renders your OpenAPI spec — test endpoints in browser |
| swagger-jsdoc | Reads JSDoc `@swagger` comments and generates the OpenAPI spec |
| swagger-ui-express | Serves the Swagger UI as an Express route |
| `@swagger` | JSDoc tag used to annotate routes with OpenAPI documentation |
| `$ref` | Reference to a reusable schema defined in `components/schemas` |
| `security: bearerAuth` | Marks a route as requiring JWT authentication in Swagger UI |
| `tags` | Groups related endpoints together in the UI |
| `parameters` | Defines path params, query params, or headers |
| `requestBody` | Defines what data the endpoint expects |
| `responses` | Defines all possible responses with status codes |

---

**Resources:**
- [Swagger / OpenAPI Docs](https://swagger.io/docs/)
- [swagger-jsdoc Docs](https://github.com/Surnet/swagger-jsdoc)
- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.0)
- [Swagger UI Demo](https://petstore.swagger.io/)
