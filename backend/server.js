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

// ✅ Determine where data folder lives
const dataDir = path.join(__dirname, "data");

// ✅ Diagnostic: log what files Render sees
console.log("📂 Attempting to serve data folder from:", dataDir);
try {
  const files = fs.readdirSync(dataDir);
  console.log("✅ Found data directory with files:", files);
} catch (err) {
  console.error("❌ Could not read data directory:", err.message);
}

// ✅ Serve all static JSON files (like /data/players.json)
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

    const season = JSON.parse(fs.readFileSync(seasonPath, "utf-8"));
    const current = JSON.parse(fs.readFileSync(currentPath, "utf-8"));

    const merged = {};

    // Merge by NFL team: live stats take priority
    for (const college in season) {
      merged[college] = season[college].map((player) => {
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
    console.error("❌ Error merging stats:", err);
    res.status(500).json({ error: "Failed to merge stats" });
  }
});

// ✅ Health check
app.get("/", (req, res) => {
  res.send("College NFL Tracker backend is running ✅");
});

// ✅ Catch-all for debugging
app.use((req, res) => {
  res.status(404).send(`Route not found: ${req.originalUrl}`);
});

// ✅ Auto-update live stats every 10 minutes
const TEN_MIN = 10 * 60 * 1000;
updateStats(); // run once on startup
setInterval(updateStats, TEN_MIN);

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));