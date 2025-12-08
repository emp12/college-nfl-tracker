// backend/server.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const routes = require("./routes"); // Loads routes/index.js

const app = express();

// -------------------------------------------------------------
// Middleware
// -------------------------------------------------------------

app.use(express.json());

// Allow frontend (Vite dev server) to access API
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// Simple request logger
app.use((req, res, next) => {
  console.log(`→ [${req.method}] ${req.url}`);
  next();
});

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// All API endpoints begin with /api
app.use("/api", routes);

// -------------------------------------------------------------
// Static file serving (optional, for production on Render)
// -------------------------------------------------------------
// If you later build the frontend and want to serve it from backend,
// uncomment the following:

// const frontendPath = path.join(__dirname, "..", "frontend", "dist");
// app.use(express.static(frontendPath));

// app.get("*", (req, res) => {
//   res.sendFile(path.join(frontendPath, "index.html"));
// });

// -------------------------------------------------------------
// Start server
// -------------------------------------------------------------

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend API listening on port ${PORT}`);
});