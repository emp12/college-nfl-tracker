// backend/scripts/buildHomeSummary.js

/**
 * Build the JSON used by the homepage (/api/home).
 *
 * This script:
 *  1) Loads all data/aggregates/collegePage_*.json files
 *  2) Builds:
 *      - conferenceGroups: colleges grouped by conference (group)
 *      - topSchoolsThisWeek: simple "score" per college for this week
 *      - positionLeaders: schools with the most NFL players at each position group
 *  3) Writes data/homeSummary.json
 */

const fs = require("fs");
const path = require("path");

// ------------------------------------------------------------
// Load all collegePage_*.json
// ------------------------------------------------------------

function loadAllCollegePages() {
  const aggregatesDir = path.join(__dirname, "..", "data", "aggregates");

  const files = fs
    .readdirSync(aggregatesDir)
    .filter((f) => f.startsWith("collegePage_") && f.endsWith(".json"));

  const colleges = [];

  for (const file of files) {
    const fullPath = path.join(aggregatesDir, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const data = JSON.parse(raw);

    const slugFromFilename = file
      .replace("collegePage_", "")
      .replace(".json", "")
      .toLowerCase();

    if (!data.slug) {
      data.slug = slugFromFilename;
    }

    colleges.push(data);
  }

  return colleges;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function computeCurrentWeekLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;
  return `${year}-M${month}-W${weekOfMonth}`;
}

/**
 * Build conferenceGroups structure.
 *
 * Requirements:
 *  - Group by conference/group name (e.g., "SEC", "Big Ten", "AAC", "FCS / Other")
 *  - Within each group, sort schools by numPlayers (desc), then name
 *  - Order conferences in a logical football-centric order on the homepage
 */
function buildConferenceGroups(collegePages) {
  const groups = {};

  for (const college of collegePages) {
    const collegeName = college.college || college.slug;
    const groupKey = college.group || college.conference || "FCS / Other";
    const numPlayers = (college.players || []).length;

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    groups[groupKey].push({
      college: collegeName,
      slug: college.slug,
      numPlayers,
    });
  }

  // Within each conference: sort by numPlayers (desc), then name
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => {
      if (b.numPlayers !== a.numPlayers) {
        return b.numPlayers - a.numPlayers;
      }
      return a.college.localeCompare(b.college);
    });
  }

  // Conference display order on homepage:
  // 1) Power 4
  // 2) Group of 5
  // 3) Independents
  // 4) FCS / Other
  const desiredOrder = [
    "SEC",
    "Big Ten",
    "Big 12",
    "ACC",
    "AAC",
    "Mountain West",
    "Sun Belt",
    "MAC",
    "C-USA",
    "Independent",
    "FCS / Other",
  ];

  const ordered = {};

  // Add conferences in our desired order (if present)
  for (const key of desiredOrder) {
    if (groups[key]) {
      ordered[key] = groups[key];
      delete groups[key];
    }
  }

  // Append any extra/unknown groups alphabetically at the end
  const remainingKeys = Object.keys(groups).sort();
  for (const key of remainingKeys) {
    ordered[key] = groups[key];
  }

  return ordered;
}

/**
 * Build "top schools this week" list.
 * (Same logic as before – you can customize productionScore later.)
 */
function buildTopSchools(collegePages, maxCount = 10) {
  const rows = [];

  for (const college of collegePages) {
    const collegeName = college.college || college.slug;
    const players = college.players || [];

    let totalProduction = 0;
    let latestGameDate = null;

    for (const player of players) {
      const lg = player.lastGame;
      if (!lg) continue;

      const score =
        typeof lg.productionScore === "number" ? lg.productionScore : 0;
      totalProduction += score;

      if (lg.date) {
        const d = new Date(lg.date);
        if (!latestGameDate || d > latestGameDate) {
          latestGameDate = d;
        }
      }
    }

    rows.push({
      college: collegeName,
      slug: college.slug,
      totalProduction,
      latestGameDate: latestGameDate ? latestGameDate.toISOString() : null,
    });
  }

  rows.sort((a, b) => b.totalProduction - a.totalProduction);
  return rows.slice(0, maxCount);
}

// ------------------------------------------------------------
// Position grouping and leaders
// ------------------------------------------------------------

/**
 * Map raw ESPN / roster positions into broader groups for the homepage.
 *
 * You can tweak these lists as needed.
 */
const POSITION_GROUPS = {
  QB: ["QB"],
  RB: ["RB", "HB", "FB"],
  WR: ["WR"],
  TE: ["TE"],
  OL: ["C", "G", "OG", "OT", "T", "LT", "RT", "OL"],
  DL: ["DE", "DT", "DL", "NT", "EDGE"],
  LB: ["LB", "ILB", "OLB", "MLB"],
  DB: ["DB", "CB", "S", "FS", "SS", "NB", "SAF"],
  ST: ["K", "P", "PK", "LS"],
};

/**
 * Given a raw position string (e.g., "CB", "FS"), return a group like "DB".
 * Falls back to "Other" if no group matches.
 */
function mapPositionToGroup(posRaw) {
  if (!posRaw) return null;
  const pos = String(posRaw).toUpperCase().trim();

  for (const [group, codes] of Object.entries(POSITION_GROUPS)) {
    if (codes.includes(pos)) {
      return group;
    }
  }

  return "Other";
}

/**
 * Build position leaders based on position *groups*.
 *
 * Result shape:
 * {
 *   "QB": [{ college, slug, count }, ...],
 *   "RB": [...],
 *   "DB": [...],
 *   ...
 * }
 */
function buildPositionLeaders(collegePages) {
  const byPositionGroup = {};

  for (const college of collegePages) {
    const collegeName = college.college || college.slug;
    const players = college.players || [];

    for (const player of players) {
      const group = mapPositionToGroup(player.position);
      if (!group) continue;

      if (!byPositionGroup[group]) {
        byPositionGroup[group] = new Map();
      }

      const map = byPositionGroup[group];

      const existing = map.get(college.slug) || {
        college: collegeName,
        slug: college.slug,
        count: 0,
      };

      existing.count += 1;
      map.set(college.slug, existing);
    }
  }

  const result = {};

  for (const [group, map] of Object.entries(byPositionGroup)) {
    const arr = Array.from(map.values()).sort((a, b) => b.count - a.count);
    result[group] = arr;
  }

  return result;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

async function buildHomePageSummary() {
  console.log("buildHomePageSummary: starting...");

  const collegePages = loadAllCollegePages();

  const conferenceGroups = buildConferenceGroups(collegePages);
  const topSchoolsThisWeek = buildTopSchools(collegePages);
  const positionLeaders = buildPositionLeaders(collegePages);

  const now = new Date();

  const summary = {
    week: computeCurrentWeekLabel(now),
    lastUpdated: now.toISOString(),
    conferenceGroups,
    topSchoolsThisWeek,
    positionLeaders,
  };

  const outPath = path.join(__dirname, "..", "data", "homeSummary.json");
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log("buildHomePageSummary: completed.");
}

module.exports = {
  buildHomePageSummary,
};

// Allow running directly
if (require.main === module) {
  buildHomePageSummary().catch((err) => {
    console.error("buildHomePageSummary failed:", err);
    process.exit(1);
  });
}