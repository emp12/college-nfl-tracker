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

app.use(cors());
app.use(express.json());

// Helper: safely load JSON
function loadJSON(file) {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`⚠️ Error parsing ${file}:`, err);
    return {};
  }
}

// GET /api/college/:college
app.get("/api/college/:college", (req, res) => {
  const college = req.params.college;
  const players = loadJSON("players.json");
  const lastGameStats = loadJSON("lastGameStats.json");
  const scoreboard = loadJSON("scoreboard.json");

  if (!players[college]) {
    return res.status(404).json({ error: `No players found for ${college}` });
  }

  const results = players[college].map((p) => {
    const stats = lastGameStats[p.id] || {};
    const teamGame = scoreboard[p.nfl_team] || {};

    // Determine status
    let statusText = "Idle";
    if (teamGame.status?.includes("Q") || teamGame.status === "1st Half" || teamGame.status === "2nd Half") {
      statusText = `🟢 Live — ${teamGame.opponent} ${teamGame.score} (${teamGame.status})`;
    } else if (teamGame.status?.includes("Final")) {
      statusText = `Final — ${teamGame.opponent} ${teamGame.score}`;
    }

    // Build summary from available stats
    let summary = "No stats recorded";
    if (Object.keys(stats).length > 0) {
      if (p.position.startsWith("QB")) {
        summary = `${stats.completions || 0}/${stats.attempts || 0}, ${stats.yards || 0} yds, ${stats.touchdowns || 0} TD, ${stats.interceptions || 0} INT`;
      } else if (["RB", "FB"].includes(p.position)) {
        summary = `${stats.rushYds || 0} yds, ${stats.rushTD || 0} TD`;
      } else if (["WR", "TE"].includes(p.position)) {
        summary = `${stats.recYds || 0} yds, ${stats.recTD || 0} TD`;
      } else {
        // defensive stats
        summary = `${stats.tackles || 0} TKL, ${stats.sacks || 0} SCK, ${stats.interceptions || 0} INT`;
      }
    }

    return {
      id: p.id,
      name: p.name,
      nfl_team: p.nfl_team,
      position: p.position,
      status: statusText,
      summary,
    };
  });

  res.json({ college, players: results });
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});