import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (like players.json and lastGameStats.json)
app.use("/data", express.static(path.join(__dirname, "data")));

// ----------------------------
// 🏈 Root route for sanity check
// ----------------------------
app.get("/", (req, res) => {
  res.json({
    message: "🏈 NFL College Tracker Backend Running",
    endpoints: [
      "/api/colleges",
      "/api/college/{college}",
      "/data/players.json",
      "/data/lastGameStats",
      "/api/lastGameStats",
    ],
  });
});

// ----------------------------
// ✅ API: Get all colleges list
// ----------------------------
app.get("/api/colleges", (req, res) => {
  const file = path.join(__dirname, "data", "players.json");
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  res.json(Object.keys(data).sort());
});

// ----------------------------
// ✅ API: Get players for college
// ----------------------------
app.get("/api/college/:college", (req, res) => {
  const college = req.params.college;
  const file = path.join(__dirname, "data", "players.json");
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  const players = data[college] || [];
  res.json(players);
});

// ----------------------------
// ✅ API: Get last game stats
// ----------------------------
app.get("/api/lastGameStats", (req, res) => {
  try {
    const statsFile = path.join(__dirname, "data", "lastGameStats.json");
    if (!fs.existsSync(statsFile)) {
      return res.status(404).json({ error: "Stats file not found" });
    }
    const stats = JSON.parse(fs.readFileSync(statsFile, "utf8"));
    res.json(stats);
  } catch (error) {
    console.error("Error reading lastGameStats.json:", error);
    res.status(500).json({ error: "Failed to load last game stats" });
  }
});

// ----------------------------
// ✅ Start server
// ----------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});