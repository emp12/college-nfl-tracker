/**
 * scripts/metaUpdater.js
 *
 * Writes data/meta.json with summary information about the last updater run.
 */

const path = require("path");
const { DATA_DIR } = require("../lib/pathConfig");
const { writeJsonAtomic } = require("../lib/fileUtils");

/**
 * Writes meta.json with the given payload.
 *
 * @param {Object} meta - e.g. { lastSuccessfulRun, gamesUpdated, playersUpdated }
 */
async function writeMeta(meta) {
  const outPath = path.join(DATA_DIR, "meta.json");

  const payload = {
    ...meta,
  };

  await writeJsonAtomic(outPath, payload);
}

module.exports = {
  writeMeta,
};