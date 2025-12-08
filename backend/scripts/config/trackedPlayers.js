/**
 * scripts/config/trackedPlayers.js
 *
 * This file defines the list of players your site is tracking.
 *
 * Each entry links:
 *  - ESPN athlete ID (used in the boxscore JSON)
 *  - Player name
 *  - College name and slug
 *  - NFL team name and abbreviation
 *  - Primary position
 *
 * Later, you will fill this list with ALL players you want to track,
 * probably by copying from your existing data source.
 */

const trackedPlayers = [
  {
    playerId: "4241479",
    name: "Tua Tagovailoa",
    college: "Alabama",
    collegeSlug: "ala",
    nflTeam: "Miami Dolphins",
    nflTeamAbbr: "MIA",
    position: "QB",
    headshotId: "4241479" // optional; used for the ESPN headshot URL
  },

  // add more players here later...
];

module.exports = {
  trackedPlayers,
};