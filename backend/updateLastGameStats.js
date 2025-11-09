import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

const PLAYERS_FILE = path.join(DATA_DIR, "players.json");
const OUT_FILE = path.join(DATA_DIR, "lastGameStats.json");

async function updateLastGameStats() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, "utf8"));
  const allStats = {};

  for (const college of Object.keys(players)) {
    for (const p of players[college]) {
      try {
        const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/${p.id}/events?limit=1`;
        const r = await fetch(url);
        const d = await r.json();
        const lastEvent = d.items?.[0]?.$ref;
        if (!lastEvent) continue;

        const statsUrl = lastEvent.replace("/events/", "/summary/");
        const s = await fetch(statsUrl);
        const stats = await s.json();

        const playerStats = {};
        for (const cat of stats?.boxscore?.players || []) {
          for (const team of cat?.statistics || []) {
            for (const g of team.stats || []) {
              if (g.displayName && g.displayValue) {
                playerStats[g.displayName] = g.displayValue;
              }
            }
          }
        }

        allStats[p.id] = {
          yards: playerStats["YDS"] || 0,
          touchdowns: playerStats["TD"] || 0,
          interceptions: playerStats["INT"] || 0,
          tackles: playerStats["TACKLES"] || 0,
          sacks: playerStats["SACKS"] || 0,
        };
        console.log(`✅ ${p.name} (${p.nfl_team})`);
      } catch (err) {
        console.error(`⚠️ ${p.name}: ${err.message}`);
      }
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(allStats, null, 2));
  console.log(`✅ lastGameStats.json updated (${Object.keys(allStats).length} players)`);
}

updateLastGameStats();