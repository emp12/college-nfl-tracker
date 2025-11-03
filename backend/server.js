import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Define data directory
const DATA_DIR = path.join(__dirname, "data");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Verify data directory
if (fs.existsSync(DATA_DIR)) {
  console.log("📂 Attempting to serve data folder from:", DATA_DIR);
  console.log("✅ Found data directory with files:", fs.readdirSync(DATA_DIR));
} else {
  console.error("❌ Data directory not found:", DATA_DIR);
}

// ---------- ROUTES ----------

// Simple health check
app.get("/", (req, res) => {
  res.send("✅ Backend is running and ready!");
});

// Serve raw JSON files (like /data/players.json)
app.use("/data", express.static(DATA_DIR));

// ---------- MERGED STATS ----------
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

        // ESPN data sometimes nests stats twice (stats.stats)
        const seasonStats = season[id]?.stats || season[id] || {};
        const liveStats = current[id]?.stats || current[id] || {};
        const flatStats = { ...seasonStats, ...liveStats };

        // Build readable summary
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

// ---------- START SERVER ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});