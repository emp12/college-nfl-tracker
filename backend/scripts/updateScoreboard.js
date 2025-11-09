import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");
const OUT_FILE = path.join(DATA_DIR, "scoreboard.json");

async function updateScoreboard() {
  console.log("🏈 Updating NFL scoreboard...");
  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
    const data = await res.json();

    const games = {};
    for (const e of data.events || []) {
      const comp = e.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors.find((c) => c.homeAway === "home");
      const away = comp.competitors.find((c) => c.homeAway === "away");
      const status = comp.status?.type?.shortDetail || "";
      const score = `${away.score}-${home.score}`;

      games[home.team.displayName] = {
        opponent: away.team.displayName,
        score,
        status,
      };
      games[away.team.displayName] = {
        opponent: home.team.displayName,
        score,
        status,
      };
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(games, null, 2));
    console.log(`✅ Scoreboard updated: ${Object.keys(games).length} teams`);
  } catch (err) {
    console.error("❌ Error updating scoreboard:", err);
  }
}

updateScoreboard();