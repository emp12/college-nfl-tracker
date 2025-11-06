// backend/updateScoreboard.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const OUT_PATH = path.join(DATA_DIR, "scoreboard.json");

async function fetchScoreboard() {
  const url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const games = {};
  for (const ev of json.events || []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const teams = comp.competitors;
    const home = teams.find((t) => t.homeAway === "home");
    const away = teams.find((t) => t.homeAway === "away");
    const status = comp.status?.type?.detail || "";
    const clock = comp.status?.displayClock || "";
    const period = comp.status?.period || 0;

    games[home.team.abbreviation] = {
      opponent: away.team.abbreviation,
      score: `${home.score}-${away.score}`,
      quarter: period ? `Q${period}` : "",
      time: clock || status,
      inProgress: comp.status?.type?.state === "in"
    };
    games[away.team.abbreviation] = {
      opponent: home.team.abbreviation,
      score: `${away.score}-${home.score}`,
      quarter: period ? `Q${period}` : "",
      time: clock || status,
      inProgress: comp.status?.type?.state === "in"
    };
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(games, null, 2));
  console.log(`✅ Updated scoreboard with ${Object.keys(games).length} team entries`);
}

fetchScoreboard().catch((e) => console.error("❌ Scoreboard update failed:", e.message));