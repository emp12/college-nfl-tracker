// backend/scripts/buildCollegeAggregates.js

/**
 * Build per-college aggregate files used by:
 *   - /api/college/:slug
 *   - buildHomeSummary.js
 *
 * Pipeline:
 *  1) Read ALL players from data/allPlayers.json
 *  2) Load each player's individual file from data/players/{id}.json
 *     to get lastGame (stats) if they exist
 *  3) Group players by college slug
 *  4) Determine conference and group (group = conference)
 *  5) Write: data/aggregates/collegePage_{SLUG_UPPER}.json
 */

const fs = require("fs");
const path = require("path");

// ------------------------------------------------------------
// Paths
// ------------------------------------------------------------

const DATA_DIR = path.join(__dirname, "..", "data");
const ALL_PLAYERS_PATH = path.join(DATA_DIR, "allPlayers.json");
const PLAYERS_DIR = path.join(DATA_DIR, "players");
const AGGREGATES_DIR = path.join(DATA_DIR, "aggregates");

// Ensure folder exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ------------------------------------------------------------
// College → Conference Mapping (all 134 FBS teams, 2025 season)
// ------------------------------------------------------------

/**
 * IMPORTANT:
 * The keys in this object must match the `college` field in allPlayers.json.
 * If ESPN uses slightly different names for some schools, we can add
 * aliases later.
 */
const COLLEGE_TO_CONFERENCE = {
  // ACC (17)
  "Boston College": "ACC",
  "California": "ACC",
  "Clemson": "ACC",
  "Duke": "ACC",
  "Florida State": "ACC",
  "Georgia Tech": "ACC",
  "Louisville": "ACC",
  "Miami (FL)": "ACC",
  "North Carolina": "ACC",
  "NC State": "ACC",
  "Pittsburgh": "ACC",
  "SMU": "ACC",
  "Stanford": "ACC",
  "Syracuse": "ACC",
  "Virginia": "ACC",
  "Virginia Tech": "ACC",
  "Wake Forest": "ACC",

  // Big Ten (18)
  "Illinois": "Big Ten",
  "Indiana": "Big Ten",
  "Iowa": "Big Ten",
  "Maryland": "Big Ten",
  "Michigan": "Big Ten",
  "Michigan State": "Big Ten",
  "Minnesota": "Big Ten",
  "Nebraska": "Big Ten",
  "Northwestern": "Big Ten",
  "Ohio State": "Big Ten",
  "Oregon": "Big Ten",
  "Penn State": "Big Ten",
  "Purdue": "Big Ten",
  "Rutgers": "Big Ten",
  "UCLA": "Big Ten",
  "USC": "Big Ten",
  "Washington": "Big Ten",
  "Wisconsin": "Big Ten",

  // Big 12 (16)
  "Arizona": "Big 12",
  "Arizona State": "Big 12",
  "Baylor": "Big 12",
  "BYU": "Big 12",
  "Cincinnati": "Big 12",
  "Colorado": "Big 12",
  "Houston": "Big 12",
  "Iowa State": "Big 12",
  "Kansas": "Big 12",
  "Kansas State": "Big 12",
  "Oklahoma State": "Big 12",
  "TCU": "Big 12",
  "Texas Tech": "Big 12",
  "UCF": "Big 12",
  "Utah": "Big 12",
  "West Virginia": "Big 12",

  // SEC (16)
  "Alabama": "SEC",
  "Arkansas": "SEC",
  "Auburn": "SEC",
  "Florida": "SEC",
  "Georgia": "SEC",
  "Kentucky": "SEC",
  "LSU": "SEC",
  "Mississippi State": "SEC",
  "Missouri": "SEC",
  "Oklahoma": "SEC",
  "Ole Miss": "SEC",
  "South Carolina": "SEC",
  "Tennessee": "SEC",
  "Texas": "SEC",
  "Texas A&M": "SEC",
  "Vanderbilt": "SEC",

  // AAC (14)
  "Army": "AAC",
  "Charlotte": "AAC",
  "East Carolina": "AAC",
  "Florida Atlantic": "AAC",
  "Memphis": "AAC",
  "Navy": "AAC",
  "North Texas": "AAC",
  "Rice": "AAC",
  "South Florida": "AAC",
  "Temple": "AAC",
  "Tulane": "AAC",
  "Tulsa": "AAC",
  "UTSA": "AAC",
  "UAB": "AAC",

  // Conference USA (C-USA) – 12
  "FIU": "C-USA",
  "Jacksonville State": "C-USA",
  "Kennesaw State": "C-USA",
  "Liberty": "C-USA",
  "Louisiana Tech": "C-USA",
  "Middle Tennessee": "C-USA",
  "New Mexico State": "C-USA",
  "Sam Houston": "C-USA",
  "UTEP": "C-USA",
  "Western Kentucky": "C-USA",
  "Delaware": "C-USA",
  "Missouri State": "C-USA",

  // MAC (12)
  "Akron": "MAC",
  "Ball State": "MAC",
  "Bowling Green": "MAC",
  "Buffalo": "MAC",
  "Central Michigan": "MAC",
  "Eastern Michigan": "MAC",
  "Kent State": "MAC",
  "Miami (OH)": "MAC",
  "Northern Illinois": "MAC",
  "Ohio": "MAC",
  "Toledo": "MAC",
  "Western Michigan": "MAC",

  // Mountain West (12)
  "Air Force": "Mountain West",
  "Boise State": "Mountain West",
  "Colorado State": "Mountain West",
  "Fresno State": "Mountain West",
  "Hawai\u2019i": "Mountain West",
  "Nevada": "Mountain West",
  "New Mexico": "Mountain West",
  "San Diego State": "Mountain West",
  "San Jos\u00e9 State": "Mountain West",
  "UNLV": "Mountain West",
  "Utah State": "Mountain West",
  "Wyoming": "Mountain West",

  // Sun Belt (14)
  "Appalachian State": "Sun Belt",
  "Arkansas State": "Sun Belt",
  "Coastal Carolina": "Sun Belt",
  "Georgia Southern": "Sun Belt",
  "Georgia State": "Sun Belt",
  "James Madison": "Sun Belt",
  "Louisiana": "Sun Belt",
  "Marshall": "Sun Belt",
  "Old Dominion": "Sun Belt",
  "South Alabama": "Sun Belt",
  "Southern Miss": "Sun Belt",
  "Texas State": "Sun Belt",
  "Troy": "Sun Belt",
  "ULM": "Sun Belt",

  // Independents (3)
  "UConn": "Independent",
  "UMass": "Independent",
  "Notre Dame": "Independent",
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Convert a college name into a slug.
 * If the school has a special override, place it here.
 */
function collegeSlug(collegeNameRaw) {
  const name = (collegeNameRaw || "Unknown").trim();

  const overrides = {
    "Alabama": "ala",
    "BYU": "byu",
  };

  if (overrides[name]) return overrides[name];

  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Determine the college's conference and homepage group.
 * For this version, group = conference (so homepage shows all conferences).
 */
function conferenceAndGroup(collegeNameRaw) {
  const name = (collegeNameRaw || "Unknown").trim();
  const conference = COLLEGE_TO_CONFERENCE[name] || "FCS / Other";
  const group = conference; // Show each conference separately on homepage
  return { conference, group };
}

/**
 * Load the ALL players flat list.
 */
function loadAllPlayers() {
  if (!fs.existsSync(ALL_PLAYERS_PATH)) {
    throw new Error(`Cannot find allPlayers.json at ${ALL_PLAYERS_PATH}`);
  }

  const raw = fs.readFileSync(ALL_PLAYERS_PATH, "utf8");
  const arr = JSON.parse(raw);

  if (!Array.isArray(arr)) {
    throw new Error("allPlayers.json must be an array");
  }

  return arr;
}

/**
 * Attempt to load per-player stats to fetch lastGame.
 */
function loadLastGameForPlayer(playerId) {
  const fp = path.join(PLAYERS_DIR, `${playerId}.json`);
  if (!fs.existsSync(fp)) return null;

  try {
    const raw = fs.readFileSync(fp, "utf8");
    const obj = JSON.parse(raw);
    return obj.lastGame || null;
  } catch (err) {
    console.warn(`⚠️ Failed parsing player file for ${playerId}:`, err);
    return null;
  }
}

// ------------------------------------------------------------
// Main Builder
// ------------------------------------------------------------

async function buildCollegeAggregates() {
  console.log("buildCollegeAggregates: starting...");

  ensureDir(AGGREGATES_DIR);

  const allPlayers = loadAllPlayers();

  const colleges = {}; // slug → aggregate

  for (const p of allPlayers) {
    const id = String(p.id).trim();
    if (!id) continue;

    const collegeName = p.college || "Unknown";
    const slug = collegeSlug(collegeName);

    if (!colleges[slug]) {
      const { conference, group } = conferenceAndGroup(collegeName);
      colleges[slug] = {
        college: collegeName,
        slug,
        conference,
        group,
        players: [],
      };
    }

    const lastGame = loadLastGameForPlayer(id);

    colleges[slug].players.push({
      id,
      name: p.name || "Unknown Player",
      position: p.position || "UNK",
      nfl_team: p.nfl_team || "Free Agent",
      lastGame: lastGame || null,
    });
  }

  let count = 0;

  for (const [slug, college] of Object.entries(colleges)) {
    const fileName = `collegePage_${slug.toUpperCase()}.json`;
    const fullPath = path.join(AGGREGATES_DIR, fileName);

    fs.writeFileSync(fullPath, JSON.stringify(college, null, 2), "utf8");
    count++;
  }

  console.log(`buildCollegeAggregates: wrote ${count} collegePage files.`);
  console.log("buildCollegeAggregates: completed.");
}

module.exports = { buildCollegeAggregates };

// Allow direct execution with `node scripts/buildCollegeAggregates.js`
if (require.main === module) {
  buildCollegeAggregates().catch((err) => {
    console.error("buildCollegeAggregates failed:", err);
    process.exit(1);
  });
}