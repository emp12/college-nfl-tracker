import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;
const DATA_DIR = path.join(__dirname, "data");

// --- Utility ---
function loadJSON(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  return {};
}

// --- Root route ---
app.get("/", (req, res) => {
  res.json({
    message: "🏈 NFL College Tracker Backend Running",
    endpoints: [
      "/api/colleges",
      "/api/college/{college}",
      "/data/players.json",
      "/data/lastGameStats.json",
      "/data/scoreboard.json"
    ],
  });
});

// --- Serve raw JSON files ---
app.get("/data/:file", (req, res) => {
  const filePath = path.join(DATA_DIR, req.params.file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.sendFile(filePath);
});

// --- Colleges list ---
app.get("/api/colleges", (req, res) => {
  try {
    const players = loadJSON("players.json");
    const colleges = Object.keys(players).sort();
    res.json(colleges);
  } catch (err) {
    console.error("❌ Error loading colleges:", err);
    res.status(500).json({ error: "Failed to load colleges" });
  }
});

// --- Merge player + game data ---
app.get("/api/college/:college", (req, res) => {
  const college = decodeURIComponent(req.params.college);
  try {
    const playersFile = loadJSON("players.json");
    const lastGameStats = loadJSON("lastGameStats.json");
    const scoreboard = loadJSON("scoreboard.json");

    const collegePlayers = playersFile[college] || [];

    const enriched = collegePlayers.map((p) => {
      const pid = String(p.id);
      const stats = lastGameStats.players?.[pid] || {};
      const teamData = Object.values(scoreboard.teams || {}).find(
        (t) => t.name === p.nfl_team
      );

      let summary = "No stats recorded";
      let live = false;

      if (teamData) {
        const { status, score, opponent, detail } = teamData;
        const oppLabel = teamData.homeAway === "away" ? "AWAY" : "HOME";
if (status === "in-progress") {
  live = true;
  summary = `${score} vs ${opponent} (${oppLabel}, ${detail})`;
} else {
  summary = `${score} vs ${opponent} (${oppLabel}, ${detail})`;
}
      }

      return {
        ...p,
        live,
        summary,
        stats,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("❌ Error merging stats:", err);
    res.status(500).json({ error: "Failed to merge stats" });
  }
});

// --- Serve frontend build ---
const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(FRONTEND_DIST));

// --- Fallback for React Router ---
app.get(/^\/(?!api\/|data\/).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});