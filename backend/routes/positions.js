// backend/routes/positions.js

const express = require("express");
const fs = require("fs");
const path = require("path");
const { mapPositionToGroup } = require("../utils/positionGroups");

const router = express.Router();

/**
 * GET /api/positions/:group
 *
 * Example: /api/positions/DB
 *
 * Returns:
 * {
 *   group: "DB",
 *   colleges: [
 *     {
 *       college: "Alabama",
 *       slug: "ala",
 *       players: [ { id, name, position, nfl_team, lastGame, ... }, ... ]
 *     },
 *     ...
 *   ]
 * }
 */
router.get("/:group", (req, res) => {
  const group = String(req.params.group || "").toUpperCase();

  const aggregatesDir = path.join(__dirname, "..", "data", "aggregates");

  let colleges = [];

  try {
    const files = fs
      .readdirSync(aggregatesDir)
      .filter(
        (f) => f.startsWith("collegePage_") && f.endsWith(".json")
      );

    for (const file of files) {
      const fullPath = path.join(aggregatesDir, file);
      const raw = fs.readFileSync(fullPath, "utf8");
      const data = JSON.parse(raw);

      const collegeName = data.college || data.slug;
      const slug = data.slug;

      // Filter players where their *group* (derived from position) matches
      const players = (data.players || []).filter((p) => {
        const grp = mapPositionToGroup(p.position);
        return grp === group;
      });

      if (players.length > 0) {
        colleges.push({
          college: collegeName,
          slug,
          players,
        });
      }
    }

    // Sort colleges alphabetically
    colleges.sort((a, b) => a.college.localeCompare(b.college));

    return res.json({
      group,
      colleges,
    });
  } catch (err) {
    console.error("Error in /api/positions:", err);
    return res.status(500).json({
      error: "Failed to load position data",
      details: err.message,
    });
  }
});

module.exports = router;