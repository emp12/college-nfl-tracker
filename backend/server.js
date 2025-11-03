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
    const playersPath = path.join(DATA_DIR, "players.json");
    const seasonPath = path.join(DATA_DIR, "seasonStats.json");
    const currentPath = path.join(DATA_DIR, "currentGame.json");

    const players = JSON.parse(fs.readFileSync(playersPath, "utf8"));
    const season = JSON.parse(fs.readFileSync(seasonPath, "utf8"));
    const current = JSON.parse(fs.readFileSync(currentPath, "utf8"));

    const merged = {};

    for (const college in players) {
      merged[college] = players[college].map((player) => {
        const id = player.id;
        const seasonStats = season[id]?.stats || season[id] || {};
        const liveStats = current[id]?.stats || current[id] || {};

        // Flatten any nested `stats.stats`
        const flatStats = { ...seasonStats, ...liveStats };

        // Build a readable summary
        let summary = "";
        if (flatStats.passingYards > 0) {
          summary = `QB — ${flatStats.passingYards} yds, ${flatStats.passingTouchdowns || 0} TD, ${flatStats.interceptions || 0} INT`;
        } else if (flatStats.rushingYards > 0) {
          summary = `RB — ${flatStats.rushingYards} yds, ${flatStats.rushingTouchdowns || 0} TD`;
        } else if (flatStats.receivingYards > 0) {
          summary = `WR — ${flatStats.receptions || 0} rec, ${flatStats.receivingYards} yds, ${flatStats.receivingTouchdowns || 0} TD`;
        } else {
          summary = "No season stats";
        }

        return {
          ...player,
          summary,
          live: Object.keys(liveStats).length > 0,
          last_updated:
            flatStats.last_updated || player.last_updated || null,
        };
      });
    }

    res.json(merged);
  } catch (err) {
    console.error("❌ Error merging stats:", err);
    res.status(500).json({ error: "Failed to merge stats" });
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