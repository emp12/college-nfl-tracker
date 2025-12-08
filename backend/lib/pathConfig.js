/**
 * lib/pathConfig.js
 *
 * Central place to define where our data lives on disk.
 * This makes it easy to change later (for example, if Render mounts a disk
 * at a specific path) without editing every file.
 */

const path = require("path");

// __dirname here is the folder that this file is in: /lib
// We want to locate the /data directory relative to the project root.
const ROOT_DIR = path.resolve(__dirname, "..");

// This assumes you will have a "data" folder at the root of the backend project.
// e.g. /nfl-college-tracker-backend/data
const DATA_DIR = path.join(ROOT_DIR, "data");

// Inside /data, we will have subfolders and files for different purposes.
const PLAYERS_DIR = path.join(DATA_DIR, "players");
const INDICES_DIR = path.join(DATA_DIR, "indices");
const AGGREGATES_DIR = path.join(DATA_DIR, "aggregates");

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  PLAYERS_DIR,
  INDICES_DIR,
  AGGREGATES_DIR,
};