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
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Safe loader so missing/empty files don't crash the app
function loadJSON(filename) {
  const full = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(full)) {
      console.warn(`⚠️  Missing ${filename} in ${DATA_DIR}`);
      return {};
    }
    const txt = fs.readFileSync(full, "utf8");
    return txt ? JSON.parse(txt) : {};
  } catch (e) {
    console.error(`❌ Error reading ${filename}:`, e.message);
    return {};
  }
}

// Log what Render actually sees
try {
  if (!fs.existsSync(DATA_DIR)) {
    console.warn(`⚠️  DATA_DIR does not exist: ${DATA_DIR}`);
  } else {
    const files = fs.readdirSync(DATA_DIR);
    console.log(`📂 DATA_DIR: ${DATA_DIR}`);
    console.log(`✅ Files: ${JSON.stringify(files)}`);
  }
} catch (e) {
  console.error("❌ Could not read DATA_DIR:", e.message);
}

// Health & debug
app.get("/health", (req, res) =>
  res.json({ ok: true, dataDir: DATA_DIR, time: new Date().toISOString() })
);
app.get("/debug/files", (req, res) => {
  try {
    const files = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [];
    res.json({ dataDir: DATA_DIR, files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve static JSONs (players.json, lastGameStats.json, etc.)
app.use("/data", express.static(DATA_DIR, { index: false }));

// Main API: /api/college/:college
app.get("/api/college/:college", (req, res) => {
  try {
    const college = decodeURIComponent(req.params.college);
    const playersByCollege = loadJSON("players.json")[college];
    if (!playersByCollege) {
      return res.status(404).json({ error: `No players found for ${college}` });
    }

    // Optional files; may be empty on first run
    const lastGame = loadJSON("lastGameStats.json");
    const lastPlayers = lastGame.players || lastGame || {}; // support both formats
    const scoreboard = loadJSON("scoreboard.json");

    const merged = playersByCollege.map((p) => {
      const lg = lastPlayers[p.id] || {};
      const sb = scoreboard[p.nfl_team] || {};

      // Build status line
      let status = "Idle";
      if (sb.status?.includes("Q") || sb.status === "1st Half" || sb.status === "2nd Half") {
        status = `🟢 Live — ${sb.opponent ?? ""} ${sb.score ?? ""} (${sb.status})`;
      } else if (sb.status?.includes("Final")) {
        status = `Final — ${sb.opponent ?? ""} ${sb.score ?? ""}`;
      } else if (sb.opponent || sb.score || sb.status) {
        status = `${sb.opponent ?? ""} ${sb.score ?? ""} ${sb.status ?? ""}`.trim();
      }

      // Summary from lastGame stats (offense/defense fallback)
      let summary = "No stats recorded";
      if (Object.keys(lg).length) {
        if (p.position.startsWith("QB")) {
          const c = lg.completions ?? lg.CMP ?? 0;
          const a = lg.attempts ?? lg.ATT ?? 0;
          const y = lg.yards ?? lg.PYDS ?? lg["YDS"] ?? 0;
          const td = lg.touchdowns ?? lg.PTD ?? lg["TD"] ?? 0;
          const intc = lg.interceptions ?? lg.INT ?? 0;
          summary = `${c}/${a}, ${y} yds, ${td} TD, ${intc} INT`;
        } else if (["RB", "FB"].includes(p.position)) {
          const y = lg.rushYds ?? lg.RYDS ?? lg["RUSH YDS"] ?? 0;
          const td = lg.rushTD ?? lg["RUSH TD"] ?? 0;
          summary = `${y} yds, ${td} TD`;
        } else if (["WR", "TE"].includes(p.position)) {
          const y = lg.recYds ?? lg.RECYDS ?? lg["REC YDS"] ?? 0;
          const td = lg.recTD ?? lg["REC TD"] ?? 0;
          summary = `${y} yds, ${td} TD`;
        } else {
          const t = lg.tackles ?? lg.TOT ?? 0;
          const s = lg.sacks ?? lg.SACKS ?? 0;
          const i = lg.interceptions ?? lg.INT ?? 0;
          summary = `${t} TKL, ${s} SCK, ${i} INT`;
        }
      }

      return {
        id: p.id,
        name: p.name,
        nfl_team: p.nfl_team,
        position: p.position,
        status,
        summary,
      };
    });

    res.json({ college, players: merged });
  } catch (e) {
    console.error("❌ /api/college error:", e);
    res.status(500).json({ error: "Failed to build college data" });
  }
});

// 404 fallback for unknown routes (helps in logs)
app.use((req, res) => res.status(404).json({ error: "Route not found", path: req.path }));

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log("📡 Routes: /data/*  /api/college/:college  /health  /debug/files");
});