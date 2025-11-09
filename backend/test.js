import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const file = path.join(__dirname, "data", "players.json");

const players = JSON.parse(fs.readFileSync(file, "utf8"));
const all = Object.values(players).flat();

console.log("✅ Total players:", all.length);
console.log("🧩 Sample names:");
for (const p of all.slice(0, 15)) {
  console.log(`- ${p.name} (${p.college}, ${p.nfl_team})`);
}