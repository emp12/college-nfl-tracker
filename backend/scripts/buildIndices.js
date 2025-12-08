/**
 * scripts/buildIndices.js
 *
 * Responsible for building:
 *  - data/indices/playersByCollege.json
 *
 * For now, we just write a very simple version derived from trackedPlayers.
 */

const path = require("path");
const { INDICES_DIR } = require("../lib/pathConfig");
const { writeJsonAtomic } = require("../lib/fileUtils");

/**
 * Rebuilds playersByCollege.json using the trackedPlayers list.
 *
 * @param {Array} trackedPlayers - array of player config objects
 */
async function rebuildPlayersByCollege(trackedPlayers) {
  const byCollege = {};

  for (const player of trackedPlayers) {
    const slug = player.collegeSlug;

    if (!byCollege[slug]) {
      byCollege[slug] = [];
    }

    byCollege[slug].push(player.playerId);
  }

  const outPath = path.join(INDICES_DIR, "playersByCollege.json");

  await writeJsonAtomic(outPath, byCollege);
}

module.exports = {
  rebuildPlayersByCollege,
};