# Lesson 1 Assignment: Airbnb Listings API

## Overview

Build a REST API that mimics a simplified version of Airbnb — where users can list, view, create, update, and delete property listings.

Use only in-memory data (a plain array) — no database needed. Focus on applying what you learned about Node.js, NPM, Express, and REST.

---

## What You're Building

A REST API for property listings with the following endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/listings` | Get all listings |
| GET | `/listings/:id` | Get a single listing by ID |
| POST | `/listings` | Create a new listing |
| PUT | `/listings/:id` | Update an existing listing |
| DELETE | `/listings/:id` | Delete a listing |

---

## Project Setup

1. Create a new folder called `airbnb-api` and initialize it with NPM
2. Install `express` as a production dependency
3. Install `nodemon` as a dev dependency
4. Add `dev` and `start` scripts to `package.json`
5. Create a `src/` folder with the following structure:

```
airbnb-api/
├── src/
│   ├── routes/
│   │   └── listings.js
│   ├── data.js
│   └── index.js
├── package.json
└── .gitignore
```

---

## Requirements

### data.js

- Create an array of at least 3 listing objects
- Each listing should have: `id`, `title`, `location`, `pricePerNight`, `guests`
- Export the array so other files can use it

### routes/listings.js

- Create an Express Router
- Implement all 5 endpoints listed above
- For GET by ID, PUT, and DELETE — return a `404` if the listing doesn't exist
- For POST — return a `400` if any required field is missing
- For POST — respond with `201` status and the newly created listing
- Export the router

### index.js

- Create the Express app
- Apply the JSON middleware so the server can read request bodies
- Mount the listings router under `/listings`
- Add a catch-all `404` handler for routes that don't exist
- Start the server on port `3000`

### .gitignore

- Ignore `node_modules/`, `.env`, and log files

---

## Listing Fields

| Field | Type | Required |
|-------|------|----------|
| id | string | yes (auto-generated) |
| title | string | yes |
| location | string | yes |
| pricePerNight | number | yes |
| guests | number | yes |

---

## Testing

Test all your endpoints using [Postman](https://www.postman.com/) or any REST client. Make sure each endpoint:

- Returns the correct data
- Returns the correct HTTP status code
- Handles the case where a listing is not found
- Handles missing fields on POST

---

## What You Should Practice

- Setting up an Express project from scratch
- Organizing code into separate files (routes, data, entry point)
- Handling all HTTP methods: GET, POST, PUT, DELETE
- Reading from `req.params` and `req.body`
- Returning proper HTTP status codes
- Using guard clauses to handle errors early
- Using `express.Router()` to keep routes modular
