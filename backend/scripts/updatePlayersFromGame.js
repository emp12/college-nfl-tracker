// backend/scripts/updatePlayersFromGame.js

/**
 * Given an NFL gameId (ESPN event id), fetch the ESPN summary/boxscore,
 * extract player stats, and update our per-player JSON files in data/players.
 *
 * This script is used by updateAll.js, but you can also run it directly:
 *   node scripts/updatePlayersFromGame.js 401772790
 */

const fs = require("fs");
const path = require("path");

// Paths
const DATA_DIR = path.join(__dirname, "..", "data");
const ALL_PLAYERS_PATH = path.join(DATA_DIR, "allPlayers.json");
const PLAYERS_DIR = path.join(DATA_DIR, "players");

/**
 * Load allPlayers.json into a map: espnId -> basic player info
 */
function loadAllPlayersMap() {
  const raw = fs.readFileSync(ALL_PLAYERS_PATH, "utf8");
  const arr = JSON.parse(raw);

  const map = new Map();
  for (const p of arr) {
    if (!p.id) continue;
    map.set(String(p.id), p);
  }
  return map;
}

/**
 * Fetch ESPN summary JSON for a given gameId.
 * This is the same structure as your boxscoreResponse file.
 */
async function fetchGameSummary(gameId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`;
  console.log("Fetching:", url);

  const res = await fetch(url);

  console.log("Status:", res.status);

  const text = await res.text();

  // TEMP: Log the full ESPN response so we see what is inside
  console.log("RAW ESPN RESPONSE FOR", gameId, ":\n", text.slice(0, 1000));

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse ESPN JSON:", err);
    console.error("Raw text was:", text);
    throw err;
  }
}

/**
 * Build a lookup of teamId -> { teamId, abbrev, score, homeAway }
 * from gamepackageJSON.header.competitions[0].
 */
function buildTeamMeta(headerComp) {
  const teams = {};

  const competitors = headerComp.competitors || [];
  if (competitors.length !== 2) {
    return teams;
  }

  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");

  for (const comp of competitors) {
    const team = comp.team || {};
    const id = String(team.id);
    teams[id] = {
      teamId: id,
      abbrev: team.abbreviation,
      score: Number(comp.score || 0),
      homeAway: comp.homeAway, // "home" or "away"
      // opponent info will be set after we know both
      opponentAbbrev: undefined,
      opponentScore: undefined,
    };
  }

  // Fill opponent info
  if (home && away) {
    const homeId = String(home.team.id);
    const awayId = String(away.team.id);

    teams[homeId].opponentAbbrev = away.team.abbreviation;
    teams[homeId].opponentScore = Number(away.score || 0);

    teams[awayId].opponentAbbrev = home.team.abbreviation;
    teams[awayId].opponentScore = Number(home.score || 0);
  }

  return teams;
}

/**
 * From team meta, build a result text for a given team.
 * e.g., "W 34–10" or "L 17–20"
 */
function buildResultText(teamMeta) {
  if (
    teamMeta == null ||
    teamMeta.score == null ||
    teamMeta.opponentScore == null
  ) {
    return "";
  }

  const s = teamMeta.score;
  const o = teamMeta.opponentScore;

  if (s > o) return `W ${s}–${o}`;
  if (s < o) return `L ${s}–${o}`;
  return `T ${s}–${o}`;
}

/**
 * Parse all player stats from the boxscore.players array into:
 *   map: athleteId -> { passing, rushing, receiving, defense, ... }
 *
 * We only keep the core things your UI cares about.
 */
function extractPlayerStatsFromBoxscore(boxPlayers) {
  const perPlayer = new Map();

  // Helper to ensure we have an entry for this athlete
  function ensure(athleteId) {
    if (!perPlayer.has(athleteId)) {
      perPlayer.set(athleteId, {});
    }
    return perPlayer.get(athleteId);
  }

  for (const teamBlock of boxPlayers) {
    const teamInfo = teamBlock.team || {};
    const teamId = String(teamInfo.id);

    for (const statGroup of teamBlock.statistics || []) {
      const groupName = statGroup.name; // "passing", "rushing", "receiving", "defensive", etc.
      const keys = statGroup.keys || [];
      const athletes = statGroup.athletes || [];

      for (const ath of athletes) {
        const athlete = ath.athlete || {};
        const statsArray = ath.stats || [];
        const athleteId = String(athlete.id);

        if (!athleteId) continue;

        const playerObj = ensure(athleteId);
        playerObj.teamId = teamId;

        // Turn the stats array into an object keyed by statGroup.keys
        const statObj = {};
        keys.forEach((key, idx) => {
          statObj[key] = statsArray[idx];
        });

        // Normalize a few key groups into shapes your UI expects
        if (groupName === "passing") {
          const compAtt = (statObj["completions/passingAttempts"] || "0/0")
            .split("/");
          const completions = Number(compAtt[0] || 0);
          const attempts = Number(compAtt[1] || 0);
          playerObj.passing = {
            completions,
            attempts,
            yards: Number(statObj["passingYards"] || 0),
            td: Number(statObj["passingTouchdowns"] || 0),
            int: Number(statObj["interceptions"] || 0),
          };
        } else if (groupName === "rushing") {
          playerObj.rushing = {
            carries: Number(statObj["rushingAttempts"] || 0),
            yards: Number(statObj["rushingYards"] || 0),
            td: Number(statObj["rushingTouchdowns"] || 0),
          };
        } else if (groupName === "receiving") {
          playerObj.receiving = {
            receptions: Number(statObj["receptions"] || 0),
            yards: Number(statObj["receivingYards"] || 0),
            td: Number(statObj["receivingTouchdowns"] || 0),
          };
        } else if (groupName === "defensive") {
          playerObj.defense = {
            tackles: Number(statObj["totalTackles"] || 0),
            sacks: Number(statObj["sacks"] || 0),
            interceptions: 0, // interceptions category handled below
          };
        } else if (groupName === "interceptions") {
          const ints = Number(statObj["interceptions"] || 0);
          if (!playerObj.defense) {
            playerObj.defense = { tackles: 0, sacks: 0, interceptions: ints };
          } else {
            playerObj.defense.interceptions = ints;
          }
        }

        // You could add more categories here (kicking, punting, returns, etc.)
      }
    }
  }

  return perPlayer;
}

/**
 * Core function: update player JSON files for a single game.
 * Returns how many players were updated.
 */
async function updatePlayersFromGame(gameId) {
  console.log(`Fetching boxscore for game ${gameId} from ESPN...`);

  const allPlayersMap = loadAllPlayersMap();
  const summary = await fetchGameSummary(gameId);

  // ESPN sometimes wraps everything in `gamepackageJSON`,
  // other times it puts `header` and `boxscore` at the top level.
  const gp = summary.gamepackageJSON || summary;

  const header = gp.header || {};
  const boxscore = gp.boxscore || {};

  const comp = (header.competitions || [])[0];
  if (!comp) {
    console.warn(`No competitions data for game ${gameId}`);
    return 0;
  }

  const teamMeta = buildTeamMeta(comp);
  const gameDate = comp.date ? new Date(comp.date) : new Date();

  const boxPlayers = boxscore.players || [];
  const perPlayerStats = extractPlayerStatsFromBoxscore(boxPlayers);

  let updatedCount = 0;

  for (const [athleteId, stats] of perPlayerStats.entries()) {
    // Only care about athletes that are in our allPlayers list
    const playerMeta = allPlayersMap.get(athleteId);
    if (!playerMeta) continue;

    const tmId = stats.teamId;
    const tmMeta = teamMeta[tmId];
    const opponentAbbrev = tmMeta?.opponentAbbrev || "";
    const homeAway =
      tmMeta?.homeAway === "home"
        ? "HOME"
        : tmMeta?.homeAway === "away"
        ? "AWAY"
        : "";

    const resultText = buildResultText(tmMeta);

    // Build lastGame object to store in the player file
    const lastGame = {
      gameId,
      date: gameDate.toISOString(),
      opponent: opponentAbbrev,
      homeAway,
      resultText,
      passing: stats.passing || null,
      rushing: stats.rushing || null,
      receiving: stats.receiving || null,
      defense: stats.defense || null,
    };

    // Load existing player JSON (if it exists)
    const playerFilePath = path.join(PLAYERS_DIR, `${athleteId}.json`);
    let existing = {};
    if (fs.existsSync(playerFilePath)) {
      try {
        const raw = fs.readFileSync(playerFilePath, "utf8");
        existing = JSON.parse(raw);
      } catch {
        existing = {};
      }
    }

    const updated = {
      id: athleteId,
      name: playerMeta.name || existing.name,
      position: playerMeta.position || existing.position,
      nfl_team: playerMeta.nfl_team || existing.nfl_team,
      college: playerMeta.college || existing.college,
      lastGame,
    };

    fs.writeFileSync(playerFilePath, JSON.stringify(updated, null, 2), "utf8");
    updatedCount++;
  }

  console.log(`Finished game ${gameId}. Updated ${updatedCount} players.`);
  return updatedCount;
}

module.exports = { updatePlayersFromGame };

// Allow direct usage: `node scripts/updatePlayersFromGame.js 401772790`
if (require.main === module) {
  const gameId = process.argv[2];
  if (!gameId) {
    console.error("Usage: node scripts/updatePlayersFromGame.js <gameId>");
    process.exit(1);
  }

  updatePlayersFromGame(gameId)
    .then((count) => {
      console.log(`Done. Updated ${count} players.`);
    })
    .catch((err) => {
      console.error("updatePlayersFromGame failed:", err);
      process.exit(1);
    });
}