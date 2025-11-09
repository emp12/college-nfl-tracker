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
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("json")) throw new Error("Non-JSON response");
    return await res.json();
  } catch (err) {
    console.warn(`⚠️ ${url.split("?")[0]} — ${err.message}`);
    return null;
  }
}

const toNum = (v) => {
  if (v == null) return 0;
  if (typeof v === "string") {
    if (v.includes("/")) {
      const [a] = v.split("/");
      return parseFloat(a) || 0;
    }
    if (v.includes("-")) {
      const [a] = v.split("-");
      return parseFloat(a) || 0;
    }
    const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  return typeof v === "number" ? v : 0;
};

function mapKeysToValues(statGroup, athlete) {
  const out = {};
  const keys = statGroup.keys || [];
  const vals = athlete.stats || [];
  const len = Math.min(keys.length, vals.length);
  for (let i = 0; i < len; i++) {
    const k = (keys[i] || "").toString().toLowerCase();
    out[k] = toNum(vals[i]);
  }
  return out;
}

function accumulateCategory(agg, catName, kv) {
  const name = (catName || "").toLowerCase();

  if (name.includes("passing")) {
    agg.yards += kv["passingyards"] ?? kv["yardspass"] ?? kv["yds"] ?? 0;
    agg.touchdowns += kv["passingtouchdowns"] ?? kv["td"] ?? 0;
  } else if (name.includes("rushing")) {
    agg.yards += kv["rushingyards"] ?? kv["yardsrush"] ?? kv["yds"] ?? 0;
    agg.touchdowns += kv["rushingtouchdowns"] ?? kv["td"] ?? 0;
  } else if (name.includes("receiving")) {
    agg.yards += kv["receivingyards"] ?? kv["yardsrec"] ?? kv["yds"] ?? 0;
    agg.touchdowns += kv["receivingtouchdowns"] ?? kv["td"] ?? 0;
  } else if (name.includes("defense") || name.includes("defensive")) {
    agg.tackles += kv["totaltackles"] ?? kv["tackles"] ?? 0;
    agg.sacks += kv["sacks"] ?? 0;
    agg.interceptions += kv["interceptions"] ?? 0;
  }
}

async function updateFromBoxscores() {
  console.log("🏈 Fetching NFL boxscores (summary + live)…");

  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, "utf8"));
  const idMap = new Map();
  for (const college of Object.keys(players)) {
    for (const p of players[college]) {
      idMap.set(String(p.id), p);
    }
  }

  const scoreboard = await safeFetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  );
  if (!scoreboard?.events) throw new Error("No events from scoreboard");

  const allStats = {};
  let matched = 0;

  for (const e of scoreboard.events) {
    const eventId = e.id;
    const status = e.status?.type?.name || "";
    const url =
      status === "in"
        ? `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${eventId}/competitions/${eventId}/boxscore`
        : `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`;

    console.log(`→ ${eventId} [${status}]`);

    const data = await safeFetch(url);
    const groups =
      status === "in"
        ? data?.players || data?.boxscore?.players || []
        : data?.boxscore?.players || [];

    for (const group of groups) {
      const statGroups = group.statistics || [];
      for (const sg of statGroups) {
        for (const athlete of sg.athletes || []) {
          const pid = String(athlete?.athlete?.id || "");
          if (!pid || !idMap.has(pid)) continue;

          const kv = mapKeysToValues(sg, athlete);
          if (!allStats[pid]) {
            allStats[pid] = {
              yards: 0,
              touchdowns: 0,
              tackles: 0,
              sacks: 0,
              interceptions: 0,
              sourceGame: eventId,
            };
          }
          accumulateCategory(allStats[pid], sg.name, kv);
          matched++;
        }
      }
    }
  }

  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      { last_updated: new Date().toISOString(), players: allStats },
      null,
      2
    )
  );

  console.log(
    `✅ Updated ${Object.keys(allStats).length} players, matched ${matched} stat-rows`
  );
}

updateFromBoxscores().catch((e) => console.error("❌ Fatal error:", e));