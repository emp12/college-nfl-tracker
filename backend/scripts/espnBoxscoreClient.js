/**
 * scripts/espnBoxscoreClient.js
 *
 * Responsible for talking to ESPN's boxscore API and returning raw JSON.
 *
 * For each NFL game, we can call:
 *  - https://cdn.espn.com/core/nfl/boxscore?xhr=1&gameId={gameId}
 *
 * This returns a JSON object with a field called "gamepackageJSON"
 * which contains:
 *  - header: game info (teams, scores, status)
 *  - boxscore: teams + player stats
 *
 * In a later step, we will add helper functions that:
 *  - Extract game-level info into a clean object
 *  - Extract stats for specific players into our playerStats structure
 */

 /**
  * Fetches the boxscore JSON for a given NFL game.
  *
  * @param {string} gameId - ESPN game ID, e.g. "401772790"
  * @returns {Promise<any>} - Parsed JSON response from ESPN
  */
async function fetchBoxscore(gameId) {
  const url = `https://cdn.espn.com/core/nfl/boxscore?xhr=1&gameId=${gameId}`;

  console.log(`Fetching boxscore for game ${gameId} from ESPN...`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `ESPN boxscore request failed for game ${gameId}: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  // Basic sanity check: make sure gamepackageJSON exists.
  if (!data.gamepackageJSON) {
    throw new Error(
      `Unexpected ESPN response for game ${gameId}: missing gamepackageJSON`
    );
  }

  return data;
}

module.exports = {
  fetchBoxscore,
};