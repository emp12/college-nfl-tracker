import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const __dirname = path.resolve();
const DATA_DIR = path.join(__dirname, "data");

// helper for safe fetch
async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (err) {
    console.error("Fetch failed:", url, err.message);
    return null;
  }
}

// read static player list
const players = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "players.json"), "utf8"));

// base files to update
let seasonStats = {};
let currentGame = {};

const now = new Date().toISOString();

// get live games
async function getScoreboard() {
  const url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
  const data = await safeFetch(url);
  return data?.events || [];
}

// get season totals
async function getSeasonStats(playerId) {
  const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/${playerId}/statistics`;
  const data = await safeFetch(url);
  if (!data) return {};

  const stats = {};
  try {
    const cats = data.splits?.categories || [];
    cats.forEach(cat => {
      cat.stats?.forEach(stat => {
        stats[stat.name] = stat.displayValue;
      });
    });
  } catch (e) {
    console.warn("Parse failed for", playerId);
  }
  return stats;
}

// get current-game stats
async function getCurrentGameStats(playerId) {
  const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/${playerId}/events`;
  const data = await safeFetch(url);
  if (!data?.items?.length) return null;

  // first (most recent) event = current or last game
  const event = data.items[0];
  const eventData = await safeFetch(event.$ref);
  if (!eventData) return null;

  const opponent = eventData?.competitions?.[0]?.competitors?.find(
    c => c.type === "opponent"
  )?.team?.displayName || "Unknown";

  const status = eventData?.status?.type?.shortDetail || "N/A";

  return {
    opponent,
    status,
    week: eventData?.week?.number || null
  };
}

// main updater
async function updateStats() {
  const events = await getScoreboard();

  for (const p of players) {
    console.log(`Updating ${p.name}...`);

    // season totals
    const season = await getSeasonStats(p.id);
    seasonStats[p.id] = { ...season, last_updated: now };

    // current game
    const game = await getCurrentGameStats(p.id);
    if (game) currentGame[p.id] = { ...game, last_updated: now };
  }

  fs.writeFileSync(path.join(DATA_DIR, "seasonStats.json"), JSON.stringify(seasonStats, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "currentGame.json"), JSON.stringify(currentGame, null, 2));

  console.log(`✅ Updated ${players.length} players on ${now}`);
}

updateStats();