/**
 * routes/college.js
 *
 * Defines routes related to college-specific pages.
 * For now we only need a read-only endpoint that returns the precomputed
 * JSON for a given college.
 */

const express = require("express");
const path = require("path");
const { AGGREGATES_DIR } = require("../lib/pathConfig");
const { readJson } = require("../lib/fileUtils");

const router = express.Router();

/**
 * Helper: converts a slug (e.g., "byu") into the file suffix (e.g., "BYU").
 *
 * You can adjust this logic if your filenaming convention changes.
 * Right now we assume:
 *  - Slug is lower-case, no spaces (e.g., "byu", "ala")
 *  - File is named "collegePage_<UPPERCASE>.json" (e.g., "collegePage_BYU.json")
 */
function slugToFileSuffix(slug) {
  return slug.toUpperCase();
}

/**
 * GET /api/college/:slug
 *
 * Example:
 *  - GET /api/college/byu
 *  - GET /api/college/ala
 *
 * Returns the precomputed JSON file for that college, produced by the updater.
 */
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const suffix = slugToFileSuffix(slug);

    // Build the expected file name, e.g. "collegePage_BYU.json"
    const filename = `collegePage_${suffix}.json`;

    // Construct the full path to that aggregate file.
    const filePath = path.join(AGGREGATES_DIR, filename);

    // Read and return the JSON data.
    const collegeData = await readJson(filePath);

    res.json(collegeData);
  } catch (err) {
    console.error(`Error in GET /api/college/${req.params.slug}:`, err.message);

    // If the file doesn't exist, treat it as "college not found".
    if (err.message && err.message.includes("no such file or directory")) {
      return res.status(404).json({
        error: "College not found or no data available yet",
      });
    }

    res.status(500).json({
      error: "Failed to load college data",
    });
  }
});

module.exports = router;