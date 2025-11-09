// backend/server.js
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 10000;
const DATA_DIR = path.join(__dirname, "data");

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Confirm data directory exists
console.log(`📂 Serving data directory from: ${DATA_DIR}`);
if (!fs.existsSync(DATA_DIR)) {
  console.error("❌ DATA_DIR does not exist!");
} else {
  console.log("✅ Found files:", fs.readdirSync(DATA_DIR));
}

// ✅ Utility function to safely read JSON
function readJSON(fileName) {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${fileName}`);
      return {};
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`❌ Failed to read ${fileName}:`, err);
    return {};
  }
}

// ✅ Serve all data files directly (e.g., /data/players.json)
app.use("/data", express.static(DATA_DIR));

// ✅ Explicit route for /data/lastGameStats
app.get("/data/lastGameStats", (req, res) => {
  const filePath = path.join(DATA_DIR, "lastGameStats.json");
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "lastGameStats.json not found" });
  }
});

// ✅ Endpoint: /api/colleges — returns list of all colleges
app.get("/api/colleges", (req, res) => {
  const players = readJSON("players.json");
  const colleges = Object.keys(players);
  res.json({ colleges });
});

// ✅ Endpoint: /api/college/:college — returns players and merged stats
app.get("/api/college/:college", (req, res) => {
  const college = decodeURIComponent(req.params.college);
  try {
    const playersData = readJSON("players.json");
    const lastGameStats = readJSON("lastGameStats.json");

    if (!playersData[college]) {
      return res.status(404).json({ error: `No data for ${college}` });
    }

    const players = playersData[college].map((player) => {
      const pid = String(player.id);
      const stats = lastGameStats.players?.[pid] || null;

      let summary = "No stats recorded";
      if (stats) {
        const parts = [];
        if (stats.yards > 0) parts.push(`${stats.yards} yds`);
        if (stats.touchdowns > 0) parts.push(`${stats.touchdowns} TD`);
        if (stats.tackles > 0) parts.push(`${stats.tackles} tackles`);
        if (stats.sacks > 0) parts.push(`${stats.sacks} sacks`);
        if (stats.interceptions > 0) parts.push(`${stats.interceptions} INT`);
        if (parts.length > 0) summary = parts.join(", ");
      }

      return {
        ...player,
        summary,
        stats,
      };
    });

    res.json({ college, players });
  } catch (err) {
    console.error("❌ Error merging stats:", err);
    res.status(500).json({ error: "Failed to merge stats" });
  }
});

// ✅ Root route (for sanity check)
app.get("/", (req, res) => {
  res.json({
    message: "🏈 NFL College Tracker Backend Running",
    endpoints: [
      "/api/colleges",
      "/api/college/{college}",
      "/data/players.json",
      "/data/lastGameStats",
    ],
  });
});

// ✅ Catch-all for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.path });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`👉 Live at https://college-nfl-tracker.onrender.com`);
});