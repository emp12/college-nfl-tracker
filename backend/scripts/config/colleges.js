/**
 * scripts/config/colleges.js
 *
 * Defines metadata about each college your site supports.
 * This is used when:
 *  - Building collegePage_<COLLEGE>.json files
 *  - Building homepage conference group summaries
 */

const colleges = [
  // EXAMPLE ENTRY ONLY.

  {
    slug: "byu",          // used in URLs, e.g. /college/byu
    name: "BYU",
    conference: "Big 12", // or "SEC", "Big Ten", "ACC", etc.
    group: "Others",      // how you group on the homepage (e.g., "SEC", "Power 4", "Others")
  },

  {
    slug: "ala",
    name: "Alabama",
    conference: "SEC",
    group: "SEC",
  },

  // Add more colleges here...
];

/**
 * Helper to quickly look up a college by its slug.
 */
function getCollegeBySlug(slug) {
  return colleges.find((c) => c.slug === slug) || null;
}

module.exports = {
  colleges,
  getCollegeBySlug,
};