// frontend/src/components/PlayerCard.jsx

/**
 * PlayerCard
 * ----------
 * Renders a single NFL player for a given college, including:
 *  - ESPN headshot (with a safe fallback if not found)
 *  - Name
 *  - Position and team
 *  - Last game summary + basic stats (if we have them)
 *
 * Expects `player` in the shape produced by collegePage_*.json:
 *  {
 *    id: "12345",
 *    name: "Tua Tagovailoa",
 *    position: "QB",
 *    nfl_team: "Miami Dolphins (MIA)",
 *    lastGame: {
 *      opponent: "NYJ",
 *      date: "2025-12-07T00:00:00.000Z",
 *      homeAway: "@",
 *      resultText: "W 34–10",
 *      passing: {...},
 *      rushing: {...},
 *      receiving: {...},
 *      defense: {...},
 *      // etc.
 *    }
 *  }
 */

const DEFAULT_HEADSHOT =
  "https://a.espncdn.com/combiner/i?img=/i/headshots/unknown/players/full/unknown.png";

export default function PlayerCard({ player }) {
  // Build ESPN headshot URL using the player's NFL ESPN id.
  // If we don't have an id, we'll fall back to the generic silhouette.
  const headshot =
    player?.id
      ? `https://a.espncdn.com/i/headshots/nfl/players/full/${player.id}.png`
      : DEFAULT_HEADSHOT;

  // Basic last game info (if present)
  const lg = player?.lastGame || null;

  let gameLine = "No recent game recorded.";
  if (lg) {
    const dateStr = lg.date
      ? new Date(lg.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

    const where =
      lg.homeAway === "HOME"
        ? "vs"
        : lg.homeAway === "AWAY" || lg.homeAway === "@"
        ? "@"
        : "";

    const opponent = lg.opponent || "";
    const result = lg.resultText || "";

    gameLine = [dateStr, where, opponent, result]
      .filter(Boolean)
      .join(" ");
  }

  // Simple stat line builder – pulls out whatever we have.
  const statParts = [];
  if (lg?.passing && (lg.passing.attempts || lg.passing.yards)) {
    statParts.push(
      `Passing: ${lg.passing.completions || 0}/${lg.passing.attempts || 0} for ${
        lg.passing.yards || 0
      } yds, ${lg.passing.td || 0} TD, ${lg.passing.int || 0} INT`
    );
  }
  if (lg?.rushing && (lg.rushing.carries || lg.rushing.yards)) {
    statParts.push(
      `Rushing: ${lg.rushing.carries || 0} carries, ${lg.rushing.yards || 0} yds, ${
        lg.rushing.td || 0
      } TD`
    );
  }
  if (lg?.receiving && (lg.receiving.receptions || lg.receiving.yards)) {
    statParts.push(
      `Receiving: ${lg.receiving.receptions || 0} rec, ${
        lg.receiving.yards || 0
      } yds, ${lg.receiving.td || 0} TD`
    );
  }
  if (
    lg?.defense &&
    (lg.defense.tackles || lg.defense.sacks || lg.defense.interceptions)
  ) {
    statParts.push(
      `Defense: ${lg.defense.tackles || 0} TKL, ${lg.defense.sacks || 0} SCK, ${
        lg.defense.interceptions || 0
      } INT`
    );
  }

  const statsLine =
    statParts.length > 0 ? statParts.join(" • ") : "No stats recorded.";

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex gap-4 items-stretch">
      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0">
        <img
          src={headshot}
          alt={player?.name || "Player headshot"}
          className="w-full h-full object-cover"
          onError={(e) => {
            // If ESPN headshot 404s, swap to a safe generic silhouette.
            e.currentTarget.onerror = null;
            e.currentTarget.src = DEFAULT_HEADSHOT;
          }}
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        {/* Name + position */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-50 truncate">
              {player?.name || "Unknown Player"}
            </h3>
            <p className="text-xs text-slate-400 truncate">
              {player?.nfl_team || ""}
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-100 shrink-0">
            {player?.position || "UNK"}
          </span>
        </div>

        {/* Game + stats */}
        <div className="mt-2 text-xs text-slate-300 space-y-1">
          <p className="text-slate-400">{gameLine}</p>
          <p className="italic text-slate-300">{statsLine}</p>
        </div>
      </div>
    </div>
  );
}