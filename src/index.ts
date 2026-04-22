import express from "express";
import type { Request, Response } from "express";
import type { User } from "./model/users.model.js";

// ─── App Setup ───────────────────────────────────────────────────────────────

const app = express();
const PORT = 3000;

// Middleware: parse incoming JSON request bodies
// Without this, req.body will be undefined on POST/PUT requests
app.use(express.json());

// ─── In-Memory Data ───────────────────────────────────────────────────────────
// We're using a plain array instead of a database for now.
// This means data resets every time the server restarts — fine for learning.
// In a real app, this would be replaced by a database call (MongoDB, PostgreSQL, etc.)

const users: User[] = [
  { id: 1, name: "lakshmi", email: "lakshmi@gmail.com", username: "lakshminarayana" },
  { id: 2, name: "narayana", email: "narayana@gmail.com", username: "narayana123" },
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check — useful to confirm the server is running
app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Airbnb application");
});

// GET /users
// Returns the full list of users
// In a real app: User.find() or db.query("SELECT * FROM users")
app.get("/users", (req: Request, res: Response) => {
  res.json(users);
});

// GET /users/:id
// :id is a route parameter — it captures whatever is in that part of the URL
// e.g. GET /users/1 → id = "1" (always a string, so we parseInt it)
app.get("/users/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);

  const user = users.find((u) => u.id === id);

  // Guard clause: return early if user doesn't exist
  // Always check before trying to use the data
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
});

// POST /users
// Creates a new user from the request body
// req.body contains the JSON data sent by the client
// In a real app: new User(req.body).save() or db.query("INSERT INTO users ...")
app.post("/users", (req: Request, res: Response) => {
  const { name, email, username } = req.body as User;

  const newUser: User = {
    // Auto-generate ID based on current array length
    // In a real app, the database handles ID generation automatically
    id: users.length + 1,
    name,
    email,
    username,
  };

  users.push(newUser);

  // 201 Created — the correct status code when a new resource is created
  res.status(201).json(newUser);
});

// PUT /users/:id
// Replaces an existing user's data with the data from req.body
// PUT means full replacement — all fields should be provided
// PATCH would be used for partial updates (only the fields you want to change)
app.put("/users/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);

  const index = users.findIndex((u) => u.id === id);

  // findIndex returns -1 if no match is found
  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  // Merge existing user with new data from req.body
  // The spread operator (...) keeps existing fields and overwrites only what's sent
  users[index] = { ...users[index], ...(req.body as Partial<User>) } as User;

  res.json(users[index]);
});

// DELETE /users/:id
// Removes a user from the array by their ID
// In a real app: User.findByIdAndDelete(id) or db.query("DELETE FROM users WHERE id = ?")
app.delete("/users/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);

  const index = users.findIndex((u) => u.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  // splice(index, 1) removes exactly 1 item at the found index
  // This is different from splice(-1, 1) which always removes the last item
  users.splice(index, 1);

  // 200 OK with a message — some APIs return 204 No Content with no body
  res.json({ message: "User deleted successfully" });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
