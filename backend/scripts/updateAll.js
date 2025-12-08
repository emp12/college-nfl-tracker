// backend/scripts/updateAll.js

/**
 * Master update script for the backend data.
 *
 * Pipeline:
 *  1) Load list of NFL game IDs from data/gameIds.js
 *  2) For each gameId:
 *       - Fetch ESPN summary/boxscore
 *       - Update per-player JSON files in data/players/{id}.json
 *  3) Rebuild per-college aggregate files in data/aggregates/
 *  4) Rebuild data/homeSummary.json (used by homepage)
 */

require("dotenv").config();

const path = require("path");
const { updatePlayersFromGame } = require("./updatePlayersFromGame");
const { buildCollegeAggregates } = require("./buildCollegeAggregates");
const { buildHomePageSummary } = require("./buildHomeSummary");

// Load gameIds.js (this supports comments)
const gameIds = require(path.join(__dirname, "..", "data", "gameIds.js"));

/**
 * Tiny helper for cleaner logs.
 */
function logSection(title) {
  console.log("\n" + "=".repeat(3) + " " + title + " " + "=".repeat(3));
}

/**
 * Main orchestrator.
 */
async function main() {
  logSection("Starting updateAll.js");

  // --- 1) Update players from each game -------------------------------
  console.log("Games to process:", gameIds);

  let totalUpdatedPlayers = 0;

  for (const gameId of gameIds) {
    logSection(`Processing game ${gameId}`);
    try {
      const updatedForGame = await updatePlayersFromGame(String(gameId));
      totalUpdatedPlayers += updatedForGame;
    } catch (err) {
      console.error(`⚠️ Failed to process game ${gameId}:`, err.message || err);
    }
  }

  console.log(
    `Finished processing all games. Updated ${totalUpdatedPlayers} players across ${gameIds.length} games.`
  );

  // --- 2) Rebuild college aggregates ---------------------------------
  logSection("Rebuilding college aggregates");
  await buildCollegeAggregates();
  console.log("Rebuilt all collegePage_*.json files.");

  // --- 3) Rebuild homepage summary -----------------------------------
  logSection("Rebuilding homeSummary.json");
  await buildHomePageSummary();

  logSection("updateAll.js completed successfully");
}

/**
 * Run this file directly:
 *   npm run update-data
 */
main().catch((err) => {
  console.error("❌ updateAll.js failed:", err);
  process.exit(1);
});