// backend/utils/positionGroups.js

// Map raw positions (from ESPN / roster) to broader groups used on the site.
const POSITION_GROUPS = {
  QB: ["QB"],
  RB: ["RB", "HB", "FB"],
  WR: ["WR"],
  TE: ["TE"],
  OL: ["C", "G", "OG", "OT", "T", "LT", "RT", "OL"],
  DL: ["DE", "DT", "DL", "NT", "EDGE"],
  LB: ["LB", "ILB", "OLB", "MLB"],
  DB: ["DB", "CB", "S", "FS", "SS", "NB", "SAF"],
  ST: ["K", "P", "PK", "LS"],
};

function mapPositionToGroup(posRaw) {
  if (!posRaw) return "Other";
  const pos = String(posRaw).toUpperCase().trim();

  for (const [group, codes] of Object.entries(POSITION_GROUPS)) {
    if (codes.includes(pos)) {
      return group;
    }
  }

  return "Other";
}

module.exports = {
  POSITION_GROUPS,
  mapPositionToGroup,
};