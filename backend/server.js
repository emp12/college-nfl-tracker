// backend/server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 10000;

// ✅ CORS: Allow frontend (mishelper.com) + local dev
app.use(
  cors({
    origin: [
      "https://mishelper.com",
      "https://www.mishelper.com",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

const DATA_DIR = path.join(__dirname, "data");
const PLAYERS_PATH = path.join(DATA_DIR, "players.json");
const LAST_GAME_STATS_PATH = path.join(DATA_DIR, "lastGameStats.json");

// ✅ Root route: shows API info
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

// ✅ Serve static data files
app.use("/data", express.static(DATA_DIR));

// ✅ Get list of colleges
app.get("/api/colleges", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(PLAYERS_PATH, "utf8"));
    res.json(Object.keys(data));
  } catch (err) {
    console.error("❌ Error loading colleges:", err);
    res.status(500).json({ error: "Failed to load colleges" });
  }
});

// ✅ Get players for a given college
app.get("/api/college/:college", (req, res) => {
  try {
    const college = decodeURIComponent(req.params.college);
    const playersData = JSON.parse(fs.readFileSync(PLAYERS_PATH, "utf8"));
    const lastGameData = JSON.parse(fs.readFileSync(LAST_GAME_STATS_PATH, "utf8"));

    const players = playersData[college] || [];

    const enriched = players.map((p) => {
      const stats = lastGameData.players?.[p.id] || {};
      const hasStats =
        stats &&
        (stats.receivingYards ||
          stats.rushingYards ||
          stats.passingYards ||
          stats.tackles ||
          stats.sacks ||
          stats.interceptions);

      return {
        ...p,
        live: stats.live || false,
        gameInfo: stats.gameInfo || null,
        summary: stats.summary || "No recent game found",
        stats: hasStats ? stats : {},
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("❌ Error fetching college players:", err);
    res.status(500).json({ error: "Failed to load players" });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});