// backend/routes/home.js

/**
 * Home route:
 * GET /api/home
 *
 * Returns the prebuilt homeSummary.json file containing:
 *  - conferenceGroups
 *  - topSchoolsThisWeek
 *  - positionLeaders
 *  - week / lastUpdated
 */

const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// GET /api/home → load backend/data/homeSummary.json
router.get("/", (req, res) => {
  try {
    const summaryPath = path.join(__dirname, "..", "data", "homeSummary.json");

    if (!fs.existsSync(summaryPath)) {
      return res.status(500).json({
        error: "homeSummary.json not found",
      });
    }

    const raw = fs.readFileSync(summaryPath, "utf8");
    const json = JSON.parse(raw);

    return res.json(json);
  } catch (err) {
    console.error("❌ Failed to read or parse homeSummary.json:", err);
    return res.status(500).json({
      error: "Failed to load home summary",
      details: err.message,
    });
  }
});

module.exports = router;