import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const __dirname = path.resolve();
const DATA_DIR = path.join(__dirname, "data");

async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (err) {
    console.error("Fetch failed:", url, err.message);
    return null;
  }
}

// --- Get all NFL teams ---
async function getAllTeams() {
  const url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
  const data = await safeFetch(url);
  if (!data?.sports?.[0]?.leagues?.[0]?.teams) return [];
  return data.sports[0].leagues[0].teams.map(t => ({
    id: t.team.id,
    name: t.team.displayName,
  }));
}

// --- Get roster for one team ---
async function getTeamRoster(teamId, teamName) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`;
  const data = await safeFetch(url);
  if (!data?.athletes) return [];

  const players = [];
  for (const group of data.athletes) {
    for (const p of group.items) {
      players.push({
        id: p.id,
        name: p.displayName,
        position: p.position?.abbreviation || null,
        college: p.college?.text || p.college?.name || p.college || "Unknown",
        nfl_team: teamName,
      });
    }
  }
  return players;
}

// --- Build both grouped and flat files ---
async function buildRoster() {
  console.log("Fetching all NFL teams...");
  const teams = await getAllTeams();
  const allPlayers = [];

  for (const team of teams) {
    console.log(`→ ${team.name}`);
    const roster = await getTeamRoster(team.id, team.name);
    allPlayers.push(...roster);
  }

  // --- Group by college ---
  const grouped = {};
  for (const p of allPlayers) {
    if (!p.college || p.college === "Unknown") continue;
    if (!grouped[p.college]) grouped[p.college] = [];
    grouped[p.college].push(p);
  }

  // --- Write grouped version ---
  const playersPath = path.join(DATA_DIR, "players.json");
  fs.writeFileSync(playersPath, JSON.stringify(grouped, null, 2));

  // --- Write flat version ---
  const flatPath = path.join(DATA_DIR, "allPlayers.json");
  fs.writeFileSync(flatPath, JSON.stringify(allPlayers, null, 2));

  console.log(
    `✅ Saved ${Object.keys(grouped).length} colleges, ${allPlayers.length} total players`
  );
  console.log(`   • Grouped: ${playersPath}`);
  console.log(`   • Flat:    ${flatPath}`);
}

buildRoster();