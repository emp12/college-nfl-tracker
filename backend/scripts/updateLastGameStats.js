import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

const PLAYERS_FILE = path.join(DATA_DIR, "players.json");
const OUT_FILE = path.join(DATA_DIR, "lastGameStats.json");

async function safeFetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!contentType.includes("application/json")) {
      throw new Error("Non-JSON response");
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function fetchPlayerStats(p) {
  try {
    const eventsUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/${p.id}/events?limit=1`;
    const d = await safeFetchJson(eventsUrl);
    const lastEvent = d.items?.[0]?.$ref;
    if (!lastEvent) throw new Error("No recent events");

    const summaryUrl = lastEvent.replace("/events/", "/summary/");
    const stats = await safeFetchJson(summaryUrl);

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

    const clean = {
      yards: playerStats["YDS"] || 0,
      touchdowns: playerStats["TD"] || 0,
      interceptions: playerStats["INT"] || 0,
      tackles: playerStats["TACKLES"] || 0,
      sacks: playerStats["SACKS"] || 0,
    };

    console.log(`✅ ${p.name} (${p.nfl_team})`);
    return { id: p.id, stats: clean };
  } catch (err) {
    console.warn(`⚠️ ${p.name}: ${err.message}`);
    return { id: p.id, stats: {} };
  }
}

async function updateLastGameStats() {
  console.log("🏈 Fetching last-game stats for all players...");
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, "utf8"));
  const allStats = {};

  let processed = 0;
  const all = Object.keys(players).flatMap((c) => players[c]);
  const total = all.length;
  const BATCH_SIZE = 5;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(fetchPlayerStats));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        allStats[r.value.id] = r.value.stats;
      }
    }
    processed += batch.length;
    console.log(`Progress: ${processed}/${total} players`);
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
    `✅ Finished! Updated ${Object.keys(allStats).length} players. Saved to ${OUT_FILE}`
  );
}

updateLastGameStats();