/**
 * scripts/config/positions.js
 *
 * Defines:
 *  - A list of canonical positions (QB, RB, WR, etc.)
 *  - Display labels
 *  - Optional aliases to normalize weird ESPN positions (e.g., "HB" → "RB")
 */

const positionLabels = {
  QB: "Quarterback",
  RB: "Running Back",
  WR: "Wide Receiver",
  TE: "Tight End",
  FB: "Fullback",
  OL: "Offensive Line",
  DL: "Defensive Line",
  LB: "Linebacker",
  CB: "Cornerback",
  S: "Safety",
  K: "Kicker",
  P: "Punter",
  LS: "Long Snapper",
};

/**
 * Some players might have positions like "HB" (halfback) or "NT" (nose tackle).
 * You can map those to your canonical codes here.
 */
const positionAliases = {
  HB: "RB",
  TB: "RB",
  NT: "DL",
  DE: "DL",
  DT: "DL",
  SS: "S",
  FS: "S",
};

/**
 * Normalizes a raw position string into one of our canonical codes.
 *
 * @param {string} rawPos - raw position from your data or ESPN
 * @returns {string}      - canonical position code (e.g. "RB", "WR")
 */
function normalizePosition(rawPos) {
  if (!rawPos) return "UNK";

  const upper = rawPos.toUpperCase();

  // If it is already a known canonical label, keep it.
  if (positionLabels[upper]) {
    return upper;
  }

  // Otherwise, try to map via alias.
  if (positionAliases[upper]) {
    return positionAliases[upper];
  }

  // Fallback: just return the uppercase raw string.
  return upper;
}

module.exports = {
  positionLabels,
  normalizePosition,
};