import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

// ---------------------------------------
// Express app setup
// ---------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------
// Resolve data path correctly for Render
// ---------------------------------------
const __dirname = process.cwd();
const DATA_PATH = path.join(__dirname, "data", "players.json");

// ---------------------------------------
// Health check route
// ---------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ---------------------------------------
// Get all players
// ---------------------------------------
app.get("/api/players", (req, res) => {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const players = JSON.parse(raw);
    res.json(players);
  } catch (err) {
    console.error("Error reading players file:", err);
    res.status(500).json({ error: "Failed to read player data" });
  }
});

// ---------------------------------------
// Get players by college
// ---------------------------------------
app.get("/api/players/:college", (req, res) => {
  const college = req.params.college;
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const players = JSON.parse(raw);
    const filtered = players.filter(
      (p) => p.college.toLowerCase() === college.toLowerCase()
    );

    if (filtered.length === 0) {
      res.status(404).json({ message: `No players found for ${college}` });
    } else {
      res.json(filtered);
    }
  } catch (err) {
    console.error("Error reading data file:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------
// Root route (optional, friendly message)
// ---------------------------------------
app.get("/", (req, res) => {
  res.send("<h2>College Gridiron Tracker API is running 🏈</h2>");
});

// ---------------------------------------
// Start the server
// ---------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});