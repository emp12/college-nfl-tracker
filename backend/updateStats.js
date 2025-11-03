import fs from "fs";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "data", "currentGame.json");

// ESPN's unofficial API endpoint for scoreboard
const SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

/**
 * Utility: fetch JSON safely
 */
async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error("❌ Fetch failed:", url, err.message);
    return null;
  }
}

/**
 * Step 1: Check if there are any live NFL games right now
 */
async function getLiveGames() {
  const data = await safeFetch(SCOREBOARD_URL);
  if (!data || !data.events) return [];

  const liveGames = data.events.filter(
    (game) => game.status?.type?.state === "in"
  );

  console.log(`🏈 Found ${liveGames.length} live game(s)`);
  return liveGames;
}

/**
 * Step 2: Fetch box score data for each live game
 */
async function getLiveStats(games) {
  const results = [];

  for (const game of games) {
    const { id, name, shortName } = game;
    const boxscoreUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${id}`;
    const summary = await safeFetch(boxscoreUrl);
    if (!summary) continue;

    const teams = summary?.boxscore?.teams || [];
    for (const t of teams) {
      const teamName = t.team.displayName;
      const stats = t.statistics?.map((s) => ({
        name: s.name,
        value: s.displayValue,
      }));
      results.push({ game: shortName, team: teamName, stats });
    }
  }

  return results;
}

/**
 * Step 3: Write results to currentGame.json
 */
async function updateLiveStats() {
  const games = await getLiveGames();

  if (games.length === 0) {
    console.log("⏸️ No active games right now. Skipping update.");
    return;
  }

  const stats = await getLiveStats(games);
  fs.writeFileSync(dataPath, JSON.stringify(stats, null, 2));
  console.log(`✅ Updated ${stats.length} team entries in currentGame.json`);
}

updateLiveStats();