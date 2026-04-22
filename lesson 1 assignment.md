# node_guide

## Mini Project: Airbnb Listings API

After covering the fundamentals of Node.js, NPM, and Express, let's put it all together by building a small REST API that mimics a simplified version of Airbnb — where you can list, view, create, update, and delete property listings.

This project uses only in-memory data (no database), so you can focus purely on Express concepts.

---

## What We're Building

A REST API for property listings with the following endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/listings` | Get all listings |
| GET | `/listings/:id` | Get a single listing |
| POST | `/listings` | Create a new listing |
| PUT | `/listings/:id` | Update a listing |
| DELETE | `/listings/:id` | Delete a listing |

---

## Project Setup

```bash
mkdir airbnb-api && cd airbnb-api
npm init -y
npm install express
npm install -D nodemon
```

Update `package.json` scripts:

```json
"scripts": {
  "dev": "nodemon src/index.js",
  "start": "node src/index.js"
}
```

Create the folder structure:

```bash
mkdir src
mkdir src/routes
touch src/index.js src/routes/listings.js src/data.js
```

Final structure:

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

## Step 1 — The Data (src/data.js)

Since we're not using a database yet, we'll store listings in an array in memory. This means data resets every time the server restarts — that's fine for learning.

```javascript
const listings = [
  {
    id: '1',
    title: 'Cozy apartment in downtown',
    location: 'New York, NY',
    pricePerNight: 120,
    guests: 2,
  },
  {
    id: '2',
    title: 'Beach house with ocean view',
    location: 'Miami, FL',
    pricePerNight: 250,
    guests: 6,
  },
  {
    id: '3',
    title: 'Mountain cabin retreat',
    location: 'Denver, CO',
    pricePerNight: 180,
    guests: 4,
  },
];

module.exports = listings;
```

---

## Step 2 — The Routes (src/routes/listings.js)

This is where all the logic lives. Each route handles one action on the listings data.

```javascript
const express = require('express');

const router = express.Router();
const listings = require('../data');

// GET /listings — return all listings
router.get('/', (req, res) => {
  res.json(listings);
});

// GET /listings/:id — return a single listing
router.get('/:id', (req, res) => {
  const listing = listings.find((l) => l.id === req.params.id);

  if (!listing) {
    return res.status(404).json({ message: 'Listing not found' });
  }

  res.json(listing);
});

// POST /listings — create a new listing
router.post('/', (req, res) => {
  const { title, location, pricePerNight, guests } = req.body;

  if (!title || !location || !pricePerNight || !guests) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const newListing = {
    id: String(listings.length + 1),
    title,
    location,
    pricePerNight,
    guests,
  };

  listings.push(newListing);
  res.status(201).json(newListing);
});

// PUT /listings/:id — update an existing listing
router.put('/:id', (req, res) => {
  const index = listings.findIndex((l) => l.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: 'Listing not found' });
  }

  listings[index] = { ...listings[index], ...req.body };
  res.json(listings[index]);
});

// DELETE /listings/:id — delete a listing
router.delete('/:id', (req, res) => {
  const index = listings.findIndex((l) => l.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: 'Listing not found' });
  }

  listings.splice(index, 1);
  res.json({ message: 'Listing deleted' });
});

module.exports = router;
```

**What's happening here:**

- `listings.find()` — searches the array and returns the first match, or `undefined` if nothing found
- `listings.findIndex()` — same but returns the index (position) instead of the item
- `...listings[index], ...req.body` — spread operator merges the existing listing with the new data, so only the fields you send get updated
- `listings.splice(index, 1)` — removes 1 item at the given index from the array
- We always check if the listing exists first and return a `404` if not — this is called a **guard clause**

---

## Step 3 — The Entry Point (src/index.js)

This is where the Express app is created, middleware is applied, and routes are mounted.

```javascript
const express = require('express');
const listingsRouter = require('./routes/listings');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/listings', listingsRouter);

// 404 handler — catches any route that doesn't exist
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

---

## Step 4 — Run It

```bash
npm run dev
```

You should see:
```
Server running on http://localhost:3000
```

---

## Testing the API

You can test the endpoints using [Postman](https://www.postman.com/) or `curl` in your terminal.

### Get all listings
```bash
curl http://localhost:3000/listings
```

### Get a single listing
```bash
curl http://localhost:3000/listings/1
```

### Create a new listing
```bash
curl -X POST http://localhost:3000/listings \
  -H "Content-Type: application/json" \
  -d '{"title": "Studio in Brooklyn", "location": "Brooklyn, NY", "pricePerNight": 95, "guests": 1}'
```

### Update a listing
```bash
curl -X PUT http://localhost:3000/listings/1 \
  -H "Content-Type: application/json" \
  -d '{"pricePerNight": 150}'
```

### Delete a listing
```bash
curl -X DELETE http://localhost:3000/listings/1
```

---

## What You Practiced

- Setting up an Express project from scratch
- Organizing code into separate files (routes, data, entry point)
- Handling all 4 HTTP methods: GET, POST, PUT, DELETE
- Reading from `req.params`, `req.body`
- Returning proper HTTP status codes (200, 201, 400, 404)
- Using guard clauses to handle errors early
- Using `express.Router()` to keep routes modular
