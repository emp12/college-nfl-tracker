// frontend/src/pages/CollegePage.jsx

import { useEffect, useState } from "react";

const DEFAULT_HEADSHOT =
  "https://a.espncdn.com/combiner/i?img=/i/headshots/unknown/players/full/unknown.png";

/**
 * PlayerCard
 * ----------
 * Renders a single NFL player for a given college, including:
 *  - ESPN headshot (with a safe fallback if not found)
 *  - Name, position, team
 *  - Last game summary + basic stats (if we have them)
 *
 * Expects `player` in the shape produced by collegePage_*.json:
 *  {
 *    id: "12345",
 *    name: "Tua Tagovailoa",
 *    position: "QB",
 *    nfl_team: "Miami Dolphins (MIA)",
 *    lastGame: {
 *      date: "...",
 *      opponent: "NYJ",
 *      homeAway: "@",
 *      resultText: "W 34–10",
 *      passing: {...},
 *      rushing: {...},
 *      receiving: {...},
 *      defense: {...}
 *    }
 *  }
 */
function PlayerCard({ player }) {
  // Build ESPN headshot URL. If we don’t have a usable id, use the generic silhouette.
  const headshot =
    player?.id
      ? `https://a.espncdn.com/i/headshots/nfl/players/full/${player.id}.png`
      : DEFAULT_HEADSHOT;

  const lg = player?.lastGame || null;

  // Build human-readable last-game line
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

  // Build stat line from whatever we have
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
      `Rushing: ${lg.rushing.carries || 0} carries, ${
        lg.rushing.yards || 0
      } yds, ${lg.rushing.td || 0} TD`
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
      {/* Headshot */}
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

      {/* Text/content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        {/* Name + team + position pill */}
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

        {/* Last game + stats */}
        <div className="mt-2 text-xs text-slate-300 space-y-1">
          <p className="text-slate-400">{gameLine}</p>
          <p className="italic text-slate-300">{statsLine}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * CollegePage
 * -----------
 * Props:
 *  - slug: college slug (e.g., "ohio-state" or "ala")
 *  - onBack: function to call when "Back to home" is clicked
 */
export default function CollegePage({ slug, onBack }) {
  const [college, setCollege] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;

    async function loadCollege() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `http://localhost:4000/api/college/${slug}`
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        setCollege(json);
      } catch (err) {
        console.error("Failed to load college page:", err);
        setError("Failed to load college data.");
      } finally {
        setLoading(false);
      }
    }

    loadCollege();
  }, [slug]);

  const numPlayers = college?.players?.length || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-emerald-300 hover:text-emerald-200"
            >
              &larr; Back to home
            </button>
            <span className="text-sm font-semibold text-emerald-300">
              College NFL Tracker
            </span>
          </div>
          <div className="text-xs text-slate-400">
            Live NFL production by college
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading && (
          <p className="text-slate-400 text-sm">Loading college…</p>
        )}

        {error && !loading && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {!loading && !error && college && (
          <>
            {/* College header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-50">
                  {college.college || college.slug}
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  {college.conference || "FCS / Other"} • Group:{" "}
                  {college.group || college.conference || "FCS / Other"}
                </p>
              </div>
              <div className="text-sm text-slate-400 text-right">
                {numPlayers} active NFL players tracked
              </div>
            </div>

            {/* Player grid: 2 cards per row on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {college.players?.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Data from ESPN | Built for college fans
            </p>
          </>
        )}
      </main>
    </div>
  );
}