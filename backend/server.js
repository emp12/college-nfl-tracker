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

    // Read and parse season + current safely
    const season = JSON.parse(fs.readFileSync(seasonPath, "utf-8"));
    let current;
    try {
      current = JSON.parse(fs.readFileSync(currentPath, "utf-8"));
      if (!Array.isArray(current)) current = [];
    } catch (err) {
      console.warn("⚠️ Could not parse currentGame.json:", err.message);
      current = [];
    }

    const merged = {};

    for (const college in season) {
      const players = season[college];

      if (!Array.isArray(players)) {
        console.warn(
          `⚠️ Skipping ${college}: not an array (type ${typeof players})`
        );
        continue;
      }

      merged[college] = players.map((player) => {
        const liveTeam = current.find((g) => g.team === player.nfl_team);
        if (liveTeam) {
          const statSummary = liveTeam.stats
            ?.map((s) => `${s.name}: ${s.value}`)
            .join(", ");
          return {
            ...player,
            stats: statSummary || player.stats,
            live: true,
          };
        }
        return { ...player, live: false };
      });
    }

    res.json(merged);
  } catch (err) {
    console.error("❌ Detailed merge error:", err);
    res
      .status(500)
      .json({ error: "Failed to merge stats", message: err.message });
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