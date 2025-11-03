import fs from "fs";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "data", "currentGame.json");

const SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

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

async function getLiveGames() {
  const data = await safeFetch(SCOREBOARD_URL);
  if (!data || !data.events) return [];
  return data.events.filter((g) => g.status?.type?.state === "in");
}

async function getLiveStats(games) {
  const results = [];
  for (const game of games) {
    const { id, shortName } = game;
    const boxUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${id}`;
    const summary = await safeFetch(boxUrl);
    if (!summary) continue;
    const teams = summary?.boxscore?.teams || [];
    for (const t of teams) {
      results.push({
        game: shortName,
        team: t.team.displayName,
        stats: t.statistics?.map((s) => ({
          name: s.name,
          value: s.displayValue,
        })),
      });
    }
  }
  return results;
}

export async function updateStats() {
  const games = await getLiveGames();
  if (games.length === 0) {
    console.log("⏸️ No active games — skipping update");
    return;
  }
  const stats = await getLiveStats(games);
  fs.writeFileSync(dataPath, JSON.stringify(stats, null, 2));
  console.log(`✅ Updated ${stats.length} team entries in currentGame.json`);
}