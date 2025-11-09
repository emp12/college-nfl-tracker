import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

const PLAYERS_FILE = path.join(DATA_DIR, "players.json");
const OUT_FILE = path.join(DATA_DIR, "lastGameStats.json");

async function safeFetch(url) {
  try {
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("json")) throw new Error("Non-JSON response");
    return await res.json();
  } catch (err) {
    console.warn(`⚠️ ${url.split("?")[0]} — ${err.message}`);
    return null;
  }
}

async function updateFromBoxscores() {
  console.log("🏈 Fetching all NFL boxscores for current week...");

  // Load all players in memory (flattened map by name)
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, "utf8"));
  const nameMap = new Map();
  for (const college of Object.keys(players)) {
    for (const p of players[college]) {
      nameMap.set(p.name.toLowerCase(), p);
    }
  }

  const scoreboard = await safeFetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  );
  if (!scoreboard?.events) throw new Error("No events from scoreboard");

  const allStats = {};

  for (const e of scoreboard.events) {
    const eventId = e.id;
    console.log(`→ Fetching boxscore for game ${eventId}...`);
    const summary = await safeFetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`
    );
    if (!summary?.boxscore?.players) continue;

    for (const group of summary.boxscore.players) {
      for (const team of group.statistics || []) {
        for (const player of team.athletes || []) {
          const name = player?.athlete?.displayName?.toLowerCase?.();
          if (!name || !nameMap.has(name)) continue;

          // Flatten the player stats into key:value pairs
          const statsObj = {};
          for (const stat of player.stats || []) {
            if (stat.displayName && stat.displayValue) {
              statsObj[stat.displayName] = stat.displayValue;
            }
          }

          const match = nameMap.get(name);
          allStats[match.id] = {
            yards:
              parseInt(
                statsObj["YDS"] || statsObj["RUSH YDS"] || statsObj["REC YDS"] || 0
              ) || 0,
            touchdowns:
              parseInt(
                statsObj["TD"] || statsObj["RUSH TD"] || statsObj["REC TD"] || 0
              ) || 0,
            tackles: parseInt(statsObj["TOT"] || 0) || 0,
            sacks: parseFloat(statsObj["SACKS"] || 0) || 0,
            interceptions: parseInt(statsObj["INT"] || 0) || 0,
            sourceGame: eventId,
          };
        }
      }
    }
  }

  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        last_updated: new Date().toISOString(),
        players: allStats,
      },
      null,
      2
    )
  );

  console.log(
    `✅ Updated ${Object.keys(allStats).length} players with boxscore stats`
  );
}

updateFromBoxscores().catch((e) => console.error("❌ Fatal error:", e));