// backend/server.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const routes = require("./routes"); // Loads routes/index.js

const app = express();

// -------------------------------------------------------------
// Middleware
// -------------------------------------------------------------

// Allow ALL origins (read-only public API, so this is fine)
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Simple request logger (handy for Render logs)
app.use((req, res, next) => {
  console.log(`→ [${req.method}] ${req.url}`);
  next();
});

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// All API endpoints begin with /api
app.use("/api", routes);

// Optional root route
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "College NFL Tracker backend is running" });
});

// -------------------------------------------------------------
// Start server
// -------------------------------------------------------------

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend API listening on port ${PORT}`);
});