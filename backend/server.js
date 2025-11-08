// backend/server.js
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");

const app = express();
app.use(cors());
app.use(express.json());

// Safe JSON loader — prevents crashes when file missing or empty
function loadJSON(filename) {
  const fullPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  Missing ${filename}, returning empty object`);
    return {};
  }
  try {
    const data = fs.readFileSync(fullPath, "utf8");
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.error(`❌ Error reading ${filename}:`, err.message);
    return {};
  }
}

// Startup check
console.log("📂 Checking data directory:", DATA_DIR);
const files = fs.readdirSync(DATA_DIR);
console.log("✅ Found data files:", files);

// Health check
app.get("/", (req, res) => res.send("✅ College NFL Tracker backend running"));

// Serve static /data files
app.use("/data", express.static(DATA_DIR));

// === MAIN ROUTE: /api/college/:college ===
app.get("/api/college/:college", (req, res) => {
  try {
    const college = decodeURIComponent(req.params.college);
    const allPlayers = loadJSON("players.json");
    const playersByCollege = allPlayers[college];
    if (!playersByCollege) {
      return res.status(404).json({ error: `No players found for ${college}` });
    }

    const scoreboard = loadJSON("scoreboard.json");
    const current = loadJSON("currentGame.json");
    const lastGame = loadJSON("lastGameStats.json");

    const merged = playersByCollege.map((p) => {
      const liveStats = current[p.id] || {};
      const lastStats = lastGame[p.id] || {};
      const sb = Object.entries(scoreboard).find(([abbr]) =>
        p.nfl_team.includes(abbr)
      );
      const inGame = sb && sb[1]?.inProgress;

      const stats = inGame ? liveStats : lastStats;
      let summary = "No stats recorded";

      if (Object.keys(stats).length > 0) {
        if (stats.PassingYards) {
          summary = `${stats.PassingYards} yds passing, ${stats.PassingTouchdowns || 0} TD, ${stats.Interceptions || 0} INT`;
        } else if (stats.RushingYards) {
          summary = `${stats.RushingYards} yds rushing, ${stats.RushingTouchdowns || 0} TD`;
        } else if (stats.ReceivingYards) {
          summary = `${stats.Receptions || 0} rec, ${stats.ReceivingYards} yds, ${stats.ReceivingTouchdowns || 0} TD`;
        } else if (stats.Tackles) {
          summary = `${stats.Tackles} tackles${stats.Sacks ? `, ${stats.Sacks} sacks` : ""}${stats.Interceptions ? `, ${stats.Interceptions} INT` : ""}`;
        }
      }

      return {
        id: p.id,
        name: p.name,
        position: p.position,
        nfl_team: p.nfl_team,
        summary,
        opponent: sb?.[1]?.opponent || lastStats.Opponent || "",
        score: sb?.[1]?.score || lastStats.Score || "",
        time: sb?.[1]?.time || lastStats.GameTime || "",
        inProgress: sb?.[1]?.inProgress || false,
      };
    });

    res.json({ college, players: merged });
  } catch (err) {
    console.error("❌ Error in /api/college route:", err);
    res.status(500).json({ error: "Failed to build college data" });
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log("📡 Routes loaded: /api/college/:college  /data/*");
});