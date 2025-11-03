import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const dataDir = path.join(__dirname, "data");
const playersPath = path.join(dataDir, "players.json");
const outputPath = path.join(dataDir, "seasonStats.json");

async function fetchPlayerStats(playerId) {
  // Primary endpoint (newer)
  const coreUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/${playerId}/statistics`;
  // Legacy fallback (older)
  const siteUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${playerId}/stats`;

  // Helper to handle both formats
  async function tryFetch(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  }

  try {
    let data;
    try {
      data = await tryFetch(coreUrl);
    } catch (err) {
      // fallback if core API 404s
      console.warn(`⚠️ Core API failed for ${playerId}, trying legacy...`);
      data = await tryFetch(siteUrl);
    }

    // Parse based on which endpoint responded
    const stats = {};

    // Core API structure
    if (data?.splits?.categories) {
      for (const cat of data.splits.categories) {
        for (const stat of cat.stats) {
          if (stat.name && stat.value !== undefined) {
            stats[stat.name] = stat.value;
          }
        }
      }
    }
    // Legacy format (different path)
    else if (data?.categories) {
      for (const cat of data.categories) {
        for (const stat of cat.stats) {
          if (stat.name && stat.value !== undefined) {
            stats[stat.name] = stat.value;
          }
        }
      }
    }

    return stats;
  } catch (err) {
    console.warn(`⚠️ Failed to fetch stats for ${playerId}: ${err.message}`);
    return {};
  }
}

async function updateSeasonStats() {
  console.log("📊 Starting season stats update...");

  if (!fs.existsSync(playersPath)) {
    console.error("❌ players.json not found!");
    return;
  }

  const players = JSON.parse(fs.readFileSync(playersPath, "utf-8"));
  const allPlayers = Object.values(players).flat();

  const seasonStats = {};

  // Process each player sequentially to avoid rate limits
  for (const player of allPlayers) {
    const { id, name, college, nfl_team, position } = player;
    console.log(`→ Fetching stats for ${name} (${id})...`);

    const stats = await fetchPlayerStats(id);

    seasonStats[id] = {
      id,
      name,
      college,
      nfl_team,
      position,
      stats,
      last_updated: new Date().toISOString(),
    };

    // Save partial progress every 10 players
    if (Object.keys(seasonStats).length % 10 === 0) {
      fs.writeFileSync(outputPath, JSON.stringify(seasonStats, null, 2));
      console.log(`💾 Progress saved (${Object.keys(seasonStats).length} players)`);
    }

    // polite delay to avoid rate-limiting
    await new Promise((res) => setTimeout(res, 600));
  }

  fs.writeFileSync(outputPath, JSON.stringify(seasonStats, null, 2));
  console.log(`✅ Finished updating season stats (${Object.keys(seasonStats).length} players)`);
}

// Run the updater
updateSeasonStats();