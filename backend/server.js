import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { updateStats } from "./liveUpdater.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Allow only your production frontend
app.use(
  cors({
    origin: ["https://mishelper.com", "https://www.mishelper.com"],
  })
);

// ✅ Determine data folder path
const dataDir = path.join(__dirname, "data");

// ✅ Diagnostic: log what Render sees
console.log("📂 Attempting to serve data folder from:", dataDir);
try {
  const files = fs.readdirSync(dataDir);
  console.log("✅ Found data directory with files:", files);
} catch (err) {
  console.error("❌ Could not read data directory:", err.message);
}

// ✅ Serve static JSON files (e.g., /data/players.json)
app.use("/data", express.static(dataDir));

// ✅ Allow access to /data/filename (no .json extension)
app.get("/data/:file", (req, res, next) => {
  const filePath = path.join(dataDir, `${req.params.file}.json`);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else next();
});

// ✅ Merge live stats (currentGame.json) + seasonStats.json
app.get("/data/mergedStats", (req, res) => {
  try {
    const seasonPath = path.join(dataDir, "seasonStats.json");
    const currentPath = path.join(dataDir, "currentGame.json");
    const playersPath = path.join(dataDir, "players.json");

    // Parse files
    const season = JSON.parse(fs.readFileSync(seasonPath, "utf-8"));
    const current = JSON.parse(fs.readFileSync(currentPath, "utf-8"));
    const players = JSON.parse(fs.readFileSync(playersPath, "utf-8"));

    const merged = {};

    // Flatten the players.json data (college -> array of players)
    const allPlayers = Object.values(players).flat();

    for (const player of allPlayers) {
      const playerId = player.id;

      // Start with season stats (if any)
      const seasonStats = season[playerId] || {};

      // Check if their NFL team is currently playing
      const liveTeam = Array.isArray(current)
        ? current.find((g) => g.team === player.nfl_team)
        : null;

      let statSummary = null;
      let live = false;

      if (liveTeam) {
        statSummary = liveTeam.stats
          ?.map((s) => `${s.name}: ${s.value}`)
          .join(", ");
        live = true;
      }

      const mergedPlayer = {
        ...player,
        stats: statSummary || seasonStats || {},
        live,
      };

      // Group by college
      if (!merged[player.college]) merged[player.college] = [];
      merged[player.college].push(mergedPlayer);
    }

    res.json(merged);
  } catch (err) {
    console.error("❌ Detailed merge error:", err);
    res.status(500).json({ error: "Failed to merge stats", message: err.message });
  }
});

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("College NFL Tracker backend is running ✅");
});

// ✅ Catch-all 404 route
app.use((req, res) => {
  res.status(404).send(`Route not found: ${req.originalUrl}`);
});

// ✅ Auto-update live stats every 10 minutes
const TEN_MIN = 10 * 60 * 1000;
updateStats(); // Run once on startup
setInterval(updateStats, TEN_MIN);

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));