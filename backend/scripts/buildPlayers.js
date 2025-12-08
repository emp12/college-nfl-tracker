/**
 * scripts/buildPlayers.js
 *
 * This module is responsible for updating per-player JSON files
 * based on a list of NFL game IDs and your list of tracked players.
 *
 * High-level flow for updatePlayersFromGames():
 *  1. For each gameId:
 *      a. Fetch the ESPN boxscore JSON.
 *      b. Extract game-level info (date, status, scores, home/away).
 *      c. Extract per-player stats for that game.
 *  2. For each tracked player whose NFL team played in that game:
 *      a. Find that player's stats in the extracted map (if any).
 *      b. Update data/players/<playerId>.json:
 *          - Add/overwrite the game log entry for this game.
 *          - Update lastGameId to this gameId.
 *  3. Return how many games and players were updated.
 */

const path = require("path");
const { PLAYERS_DIR } = require("../lib/pathConfig");
const { readJson, writeJsonAtomic } = require("../lib/fileUtils");
const { fetchBoxscore } = require("./espnBoxscoreClient");

/**
 * Helper: safe integer parsing.
 * ESPN stats come as strings ("127", "0", "13/21").
 * This returns a number or 0 if the value is empty or invalid.
 */
function toInt(value) {
  if (value === null || value === undefined) return 0;
  if (value === "") return 0;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Helper: parse a "made/attempts" style string like "13/21" or "0/0".
 *
 * @param {string} value - e.g. "13/21"
 * @returns {{made: number, attempts: number}}
 */
function parseMadeAttempts(value) {
  if (!value || typeof value !== "string") {
    return { made: 0, attempts: 0 };
  }
  const parts = value.split("/");
  if (parts.length !== 2) {
    return { made: 0, attempts: 0 };
  }
  return {
    made: toInt(parts[0]),
    attempts: toInt(parts[1]),
  };
}

/**
 * Extracts game-level info (date, status, scores, home/away) from the
 * ESPN "gamepackageJSON.header" object.
 *
 * Returns an object:
 *  {
 *    gameId: string,
 *    date: "YYYY-MM-DD",
 *    status: "final" | "in_progress" | "scheduled",
 *    clockText: string | null,
 *    teams: {
 *      [teamAbbr]: {
 *        teamAbbr,
 *        teamName,
 *        isHome,
 *        teamScore,
 *        opponentAbbr,
 *        opponentName,
 *        opponentScore
 *      },
 *      ...
 *    }
 *  }
 */
function extractGameMeta(gamepackageJSON) {
  const header = gamepackageJSON.header;
  const competition = header.competitions[0];

  // Raw ISO date string from ESPN, e.g. "2025-12-07T18:00Z"
  const rawDate = competition.date;
  // Convert to YYYY-MM-DD using JS Date and toISOString().
  const date = new Date(rawDate).toISOString().slice(0, 10);

  const statusObj = competition.status;
  const statusType = statusObj.type || {};

  let status = "scheduled";
  if (statusType.state === "in") {
    status = "in_progress";
  } else if (statusType.completed) {
    status = "final";
  }

  // For live games, we can show something like "2:00 - 4th".
  // For non-live games, we can keep this null or use shortDetail.
  const clockText =
    status === "in_progress" ? statusType.shortDetail || null : null;

  // Build team-level info keyed by team abbreviation
  const teams = {};
  const competitors = competition.competitors;

  // First, collect basic info for each competitor.
  const temp = competitors.map((comp) => {
    const team = comp.team;
    return {
      teamAbbr: team.abbreviation, // e.g., "MIA"
      teamName: team.displayName,  // e.g., "Miami Dolphins"
      isHome: comp.homeAway === "home",
      teamScore: toInt(comp.score),
      // We'll fill opponent info in a second pass.
      opponentAbbr: "",
      opponentName: "",
      opponentScore: 0,
    };
  });

  // Now, for each team, set its opponent info.
  if (temp.length === 2) {
    const a = temp[0];
    const b = temp[1];

    a.opponentAbbr = b.teamAbbr;
    a.opponentName = b.teamName;
    a.opponentScore = b.teamScore;

    b.opponentAbbr = a.teamAbbr;
    b.opponentName = a.teamName;
    b.opponentScore = a.teamScore;
  }

  // Store in a map keyed by team abbreviation (e.g., "MIA", "NYJ").
  for (const teamInfo of temp) {
    teams[teamInfo.teamAbbr] = teamInfo;
  }

  return {
    gameId: String(header.id), // game ID string, e.g. "401772790"
    date,
    status,
    clockText,
    teams,
  };
}

/**
 * Extracts per-player stats from the ESPN "gamepackageJSON.boxscore.players" data.
 *
 * Returns an object:
 *  {
 *    [playerId]: {
 *      teamAbbr: string,
 *      stats: {
 *        passing:   { cmp, att, yds, td, int } | null,
 *        rushing:   { att, yds, td } | null,
 *        receiving: { rec, yds, td } | null,
 *        defense:   { tackles, sacks, interceptions } | null,
 *        kicking:   { fgm, fga, xpm, xpa } | null,
 *        returns:   { returns, yards, td } | null
 *      }
 *    },
 *    ...
 *  }
 *
 * IMPORTANT:
 *  - We only populate categories that actually appear for a player.
 *  - Players who never show up in any category will NOT be in this map.
 *    For those players, we will treat them as "no stats recorded" later.
 */
function extractPlayerStatsForGame(gamepackageJSON) {
  const result = {}; // map of playerId -> { teamAbbr, stats: {...} }

  const boxscore = gamepackageJSON.boxscore;
  const teamBlocks = boxscore.players; // one entry per team

  for (const teamBlock of teamBlocks) {
    const teamAbbr = teamBlock.team.abbreviation; // e.g., "MIA"

    // Each teamBlock.statistics entry is one category:
    // passing, rushing, receiving, defensive, interceptions, kickReturns, puntReturns, kicking, etc.
    for (const statGroup of teamBlock.statistics) {
      const categoryName = statGroup.name;  // e.g., "passing", "rushing", "defensive"
      const keys = statGroup.keys;          // describes what each value in stats[] means
      const athletes = statGroup.athletes;  // stats for individual players

      for (const athleteEntry of athletes) {
        const athlete = athleteEntry.athlete;
        const statsArray = athleteEntry.stats;

        const playerId = String(athlete.id); // ESPN athlete id, e.g. "4241479"

        // Ensure there is an entry in result for this player.
        if (!result[playerId]) {
          result[playerId] = {
            teamAbbr,
            stats: {
              passing: null,
              rushing: null,
              receiving: null,
              defense: null,
              kicking: null,
              returns: null,
            },
          };
        }

        const playerStats = result[playerId].stats;

        // ---- PASSING ----
        if (categoryName === "passing") {
          // keys example: [
          //   "completions/passingAttempts",
          //   "passingYards",
          //   "yardsPerPassAttempt",
          //   "passingTouchdowns",
          //   "interceptions",
          //   "sacks-sackYardsLost",
          //   ...
          // ]
          const map = {};
          keys.forEach((keyName, idx) => {
            map[keyName] = statsArray[idx];
          });

          const cmpAtt = parseMadeAttempts(map["completions/passingAttempts"]);
          const yds = toInt(map["passingYards"]);
          const td = toInt(map["passingTouchdowns"]);
          const ints = toInt(map["interceptions"]);

          playerStats.passing = {
            cmp: cmpAtt.made,
            att: cmpAtt.attempts,
            yds,
            td,
            int: ints,
          };
        }

        // ---- RUSHING ----
        if (categoryName === "rushing") {
          // keys example: [
          //   "rushingAttempts",
          //   "rushingYards",
          //   "yardsPerRushAttempt",
          //   "rushingTouchdowns",
          //   "longRushing"
          // ]
          const map = {};
          keys.forEach((keyName, idx) => {
            map[keyName] = statsArray[idx];
          });

          const att = toInt(map["rushingAttempts"]);
          const yds = toInt(map["rushingYards"]);
          const td = toInt(map["rushingTouchdowns"]);

          playerStats.rushing = {
            att,
            yds,
            td,
          };
        }

        // ---- RECEIVING ----
        if (categoryName === "receiving") {
          // keys example: [
          //   "receptions",
          //   "receivingYards",
          //   "yardsPerReception",
          //   "receivingTouchdowns",
          //   "longReception",
          //   "receivingTargets"
          // ]
          const map = {};
          keys.forEach((keyName, idx) => {
            map[keyName] = statsArray[idx];
          });

          const rec = toInt(map["receptions"]);
          const yds = toInt(map["receivingYards"]);
          const td = toInt(map["receivingTouchdowns"]);

          playerStats.receiving = {
            rec,
            yds,
            td,
          };
        }

        // ---- DEFENSE (tackles + sacks) ----
        if (categoryName === "defensive") {
          // keys example: [
          //   "totalTackles",
          //   "soloTackles",
          //   "sacks",
          //   "tacklesForLoss",
          //   "passesDefended",
          //   "QBHits",
          //   "defensiveTouchdowns"
          // ]
          const map = {};
          keys.forEach((keyName, idx) => {
            map[keyName] = statsArray[idx];
          });

          const tackles = toInt(map["totalTackles"]);
          const sacks = map["sacks"] ? parseFloat(map["sacks"]) || 0 : 0;

          if (!playerStats.defense) {
            playerStats.defense = {
              tackles: 0,
              sacks: 0,
              interceptions: 0,
            };
          }

          playerStats.defense.tackles = tackles;
          playerStats.defense.sacks = sacks;
        }

        // ---- DEFENSE (interceptions) ----
        if (categoryName === "interceptions") {
          // keys example: [
          //   "interceptions",
          //   "interceptionYards",
          //   "interceptionTouchdowns"
          // ]
          const map = {};
          keys.forEach((keyName, idx) => {
            map[keyName] = statsArray[idx];
          });

          const interceptions = toInt(map["interceptions"]);

          if (!playerStats.defense) {
            playerStats.defense = {
              tackles: 0,
              sacks: 0,
              interceptions: 0,
            };
          }

          playerStats.defense.interceptions = interceptions;
        }

        // ---- KICKING ----
        if (categoryName === "kicking") {
          // keys example: [
          //   "fieldGoalsMade/fieldGoalAttempts",
          //   "fieldGoalPct",
          //   "longFieldGoalMade",
          //   "extraPointsMade/extraPointAttempts",
          //   "totalKickingPoints"
          // ]
          const map = {};
          keys.forEach((keyName, idx) => {
            map[keyName] = statsArray[idx];
          });

          const fg = parseMadeAttempts(
            map["fieldGoalsMade/fieldGoalAttempts"]
          );
          const xp = parseMadeAttempts(
            map["extraPointsMade/extraPointAttempts"]
          );

          playerStats.kicking = {
            fgm: fg.made,
            fga: fg.attempts,
            xpm: xp.made,
            xpa: xp.attempts,
          };
        }

        // ---- KICK RETURNS ----
        if (categoryName === "kickReturns") {
          // keys example: [
          //   "kickReturns",
          //   "kickReturnYards",
          //   "yardsPerKickReturn",
          //   "longKickReturn",
          //   "kickReturnTouchdowns"
          // ]
          const map = {};
          keys.forEach((keyName, idx) => {
            map[keyName] = statsArray[idx];
          });

          const returns = toInt(map["kickReturns"]);
          const yards = toInt(map["kickReturnYards"]);
          const td = toInt(map["kickReturnTouchdowns"]);

          if (!playerStats.returns) {
            playerStats.returns = {
              returns: 0,
              yards: 0,
              td: 0,
            };
          }

          playerStats.returns.returns += returns;
          playerStats.returns.yards += yards;
          playerStats.returns.td += td;
        }

        // ---- PUNT RETURNS ----
        if (categoryName === "puntReturns") {
          // keys example: [
          //   "puntReturns",
          //   "puntReturnYards",
          //   "yardsPerPuntReturn",
          //   "longPuntReturn",
          //   "puntReturnTouchdowns"
          // ]
          const map = {};
          keys.forEach((keyName, idx) => {
            map[keyName] = statsArray[idx];
          });

          const returns = toInt(map["puntReturns"]);
          const yards = toInt(map["puntReturnYards"]);
          const td = toInt(map["puntReturnTouchdowns"]);

          if (!playerStats.returns) {
            playerStats.returns = {
              returns: 0,
              yards: 0,
              td: 0,
            };
          }

          playerStats.returns.returns += returns;
          playerStats.returns.yards += yards;
          playerStats.returns.td += td;
        }
      } // end for each athlete
    } // end for each statGroup
  } // end for each teamBlock

  return result;
}

/**
 * Loads or initializes a per-player JSON file.
 *
 * File path: data/players/<playerId>.json
 *
 * The structure of the file:
 *  {
 *    playerId,
 *    name,
 *    college,
 *    collegeSlug,
 *    position,
 *    nflTeam,
 *    teamAbbr,
 *    headshotId: string | null,
 *    lastGameId: string | null,
 *    gameLogs: {
 *      [gameId]: {
 *        gameId,
 *        date,
 *        teamAbbr,
 *        opponentAbbr,
 *        opponentName,
 *        isHome,
 *        teamScore,
 *        opponentScore,
 *        status,
 *        clockText,
 *        playerStats: { ... }  // same structure we built above
 *      },
 *      ...
 *    }
 *  }
 */
async function loadOrInitPlayerFile(playerConfig) {
  const filePath = path.join(PLAYERS_DIR, `${playerConfig.playerId}.json`);

  try {
    // Try to read existing JSON file.
    const existing = await readJson(filePath);
    return { filePath, doc: existing };
  } catch (err) {
    // If the file does not exist, we create a new baseline object.
    // Any other I/O errors will still throw.
    if (!err.message.includes("no such file or directory")) {
      throw err;
    }

    const doc = {
      playerId: String(playerConfig.playerId),
      name: playerConfig.name,
      college: playerConfig.college,
      collegeSlug: playerConfig.collegeSlug,
      position: playerConfig.position,
      nflTeam: playerConfig.nflTeam,
      teamAbbr: playerConfig.nflTeamAbbr,
      headshotId: playerConfig.headshotId || null,
      lastGameId: null,
      gameLogs: {},
    };

    return { filePath, doc };
  }
}

/**
 * Updates a single player's JSON file for a specific game.
 *
 * @param {Object} playerConfig     - entry from trackedPlayers[]
 * @param {Object} gameMeta         - result of extractGameMeta()
 * @param {string} teamAbbr         - the player's team abbreviation in this game
 * @param {Object|null} statsEntry  - from extractPlayerStatsForGame()[playerId], or null if no stats
 * @param {string} gameId           - ESPN game ID
 */
async function updateSinglePlayerForGame(
  playerConfig,
  gameMeta,
  teamAbbr,
  statsEntry,
  gameId
) {
  const { filePath, doc } = await loadOrInitPlayerFile(playerConfig);

  // Find the team-level info for this player's team.
  const teamInfo = gameMeta.teams[teamAbbr];

  if (!teamInfo) {
    // This should not normally happen if we've matched teamAbbr correctly.
    console.warn(
      `No teamInfo found for teamAbbr=${teamAbbr} in game ${gameId} for player ${playerConfig.playerId}`
    );
    return;
  }

  // If statsEntry is null, it means this player appeared in no stat category.
  // We still record a game log, but with all categories set to null.
  const playerStats =
    statsEntry && statsEntry.stats
      ? statsEntry.stats
      : {
          passing: null,
          rushing: null,
          receiving: null,
          defense: null,
          kicking: null,
          returns: null,
        };

  const gameLogEntry = {
    gameId: gameMeta.gameId,
    date: gameMeta.date,
    teamAbbr: teamInfo.teamAbbr,
    opponentAbbr: teamInfo.opponentAbbr,
    opponentName: teamInfo.opponentName,
    isHome: teamInfo.isHome,
    teamScore: teamInfo.teamScore,
    opponentScore: teamInfo.opponentScore,
    status: gameMeta.status,
    clockText: gameMeta.clockText,
    playerStats,
  };

  // Store or overwrite the log for this game.
  doc.gameLogs[gameMeta.gameId] = gameLogEntry;

  // Update lastGameId to this game.
  // (In the future, if you process multiple weeks out of order,
  //  you might want to compare dates before overriding.)
  doc.lastGameId = gameMeta.gameId;

  // Finally, write back to disk atomically.
  await writeJsonAtomic(filePath, doc);
}

/**
 * MAIN ENTRY:
 *
 * Called by scripts/updateAll.js.
 *
 * @param {string[]} gameIds - list of ESPN game IDs to process
 * @param {Array} trackedPlayers - list from config/trackedPlayers.js
 * @returns {Promise<{gamesUpdated: number, playersUpdated: number}>}
 */
async function updatePlayersFromGames(gameIds, trackedPlayers) {
  // Quick exit if nothing to do.
  if (!gameIds || gameIds.length === 0) {
    console.log("updatePlayersFromGames: no games to process.");
    return { gamesUpdated: 0, playersUpdated: 0 };
  }

  // Build a map from team abbreviation -> list of tracked players on that team.
  const playersByTeamAbbr = new Map();
  for (const p of trackedPlayers) {
    const abbr = p.nflTeamAbbr;
    if (!playersByTeamAbbr.has(abbr)) {
      playersByTeamAbbr.set(abbr, []);
    }
    playersByTeamAbbr.get(abbr).push(p);
  }

  // We'll count unique players updated using a Set.
  const updatedPlayerIds = new Set();
  let gamesUpdated = 0;

  for (const gameId of gameIds) {
    try {
      console.log(`\n=== Processing game ${gameId} ===`);

      // 1) Fetch ESPN boxscore JSON for this game.
      const boxscoreData = await fetchBoxscore(gameId);
      const gamepackageJSON = boxscoreData.gamepackageJSON;

      // 2) Extract game-level metadata (date, status, teams).
      const gameMeta = extractGameMeta(gamepackageJSON);

      // 3) Extract per-player stats for this game.
      const perGameStats = extractPlayerStatsForGame(gamepackageJSON);

      // 4) Determine which two NFL teams played in this game and
      //    update all tracked players on those teams.
      const header = gamepackageJSON.header;
      const competition = header.competitions[0];
      const competitors = competition.competitors;

      for (const comp of competitors) {
        const teamAbbr = comp.team.abbreviation; // e.g., "MIA"
        const trackedOnThisTeam = playersByTeamAbbr.get(teamAbbr) || [];

        // For each tracked player on this team, update their file.
        for (const playerConfig of trackedOnThisTeam) {
          const statsEntry = perGameStats[playerConfig.playerId] || null;

          await updateSinglePlayerForGame(
            playerConfig,
            gameMeta,
            teamAbbr,
            statsEntry,
            gameId
          );

          updatedPlayerIds.add(String(playerConfig.playerId));
        }
      }

      gamesUpdated += 1;
      console.log(`Finished game ${gameId}.`);

    } catch (err) {
      // We log the error but do NOT crash the entire update process.
      console.error(`Error while processing game ${gameId}:`, err.message);
      // You may choose to continue or abort. Here we continue to the next game.
    }
  }

  return {
    gamesUpdated,
    playersUpdated: updatedPlayerIds.size,
  };
}

module.exports = {
  updatePlayersFromGames,
};