// backend/scripts/seedPlayersFromAllPlayers.js

/**
 * This script reads data/allPlayers.json (a flat list of all NFL players)
 * and creates one JSON file per player in data/players/{id}.json.
 *
 * It only sets up static info and empty stats. The regular updateAll.js
 * script will later fill in real game logs and totals from ESPN boxscores.
 */

const fs = require("fs");
const path = require("path");

// Root data directory (adjust if your structure is different)
const DATA_DIR = path.join(__dirname, "..", "data");
const ALL_PLAYERS_PATH = path.join(DATA_DIR, "allPlayers.json");
const PLAYERS_DIR = path.join(DATA_DIR, "players");

// --- Helper: ensure a directory exists ------------------------------------
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// --- Helper: naive slugify for colleges -----------------------------------
// You can later replace this with your own mapping for BYU, Ole Miss, etc.
function slugifyCollege(collegeName) {
  if (!collegeName) return "unknown";

  return collegeName
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// --- Main ------------------------------------------------------------------
function main() {
  console.log("=== Seeding player files from allPlayers.json ===");

  // 1) Ensure the players directory exists
  ensureDirExists(PLAYERS_DIR);

  // 2) Load allPlayers.json
  if (!fs.existsSync(ALL_PLAYERS_PATH)) {
    console.error(`❌ Cannot find ${ALL_PLAYERS_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(ALL_PLAYERS_PATH, "utf8");
  let allPlayers;

  try {
    allPlayers = JSON.parse(raw);
  } catch (err) {
    console.error("❌ Failed to parse allPlayers.json:", err);
    process.exit(1);
  }

  if (!Array.isArray(allPlayers)) {
    console.error("❌ allPlayers.json must be an array of players.");
    process.exit(1);
  }

  console.log(`Found ${allPlayers.length} players in allPlayers.json`);

  let created = 0;
  let skippedExisting = 0;

  for (const p of allPlayers) {
    const id = String(p.id).trim();

    if (!id) {
      console.warn("⚠️ Skipping player with missing id:", p);
      continue;
    }

    const playerPath = path.join(PLAYERS_DIR, `${id}.json`);

    // If you want to avoid overwriting any existing players (for safety)
    if (fs.existsSync(playerPath)) {
      skippedExisting++;
      continue;
    }

    // Build the base player object
    const collegeName = p.college || "Unknown";
    const collegeSlug = slugifyCollege(collegeName);

    const playerObj = {
      // Core identity
      id,
      espnId: id, // keeping espnId explicit in case you ever change internal IDs
      name: p.name || "Unknown Player",
      position: p.position || "UNK",

      // School + team info
      college: collegeName,
      collegeSlug, // used for grouping by college
      nfl_team: p.nfl_team || "Free Agent",

      // Game logs (will be populated by updateAll.js)
      games: [],

      // Cumulative totals (will be recomputed as games are added)
      totals: {
        gamesPlayed: 0,
        passing: { att: 0, cmp: 0, yds: 0, td: 0, int: 0 },
        rushing: { att: 0, yds: 0, td: 0 },
        receiving: { rec: 0, yds: 0, td: 0 },
        defense: { tackles: 0, sacks: 0, interceptions: 0 },
        kicking: { fgMade: 0, fgAtt: 0, xpMade: 0, xpAtt: 0 },
        punting: { punts: 0, yds: 0 }
      },

      lastUpdated: null
    };

    fs.writeFileSync(playerPath, JSON.stringify(playerObj, null, 2), "utf8");
    created++;
  }

  console.log(`✅ Created ${created} player files in data/players/`);
  console.log(`↩️  Skipped ${skippedExisting} players because files already existed`);

  console.log("Done. You can now run your update script to fetch stats.");
}

main();