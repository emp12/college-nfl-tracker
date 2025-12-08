// src/pages/HomePage.jsx

import { useEffect, useState } from "react";

/**
 * HomePage
 *
 * Fetches summary data from:
 *   GET http://localhost:4000/api/home
 *
 * Shows:
 *  - Week / last updated
 *  - Conference groups with schools
 *  - Top schools this week (leaderboard)
 *  - Position leaders (schools with most NFL players at each position)
 *
 * Parent passes:
 *  - onSelectCollege(slug: string): called when a school is clicked
 */
export default function HomePage({ onSelectCollege }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch home summary data from backend on mount
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("http://localhost:4000/api/home");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Error loading /api/home:", err);
        setError("Failed to load homepage data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Basic states
  if (loading) {
    return <div className="text-sm text-slate-200">Loading homepage data…</div>;
  }

  if (error) {
    return <div className="text-sm text-red-400">{error}</div>;
  }

  if (!data) {
    return <div className="text-sm text-slate-200">No data available.</div>;
  }

  const {
    week,
    lastUpdated,
    conferenceGroups = {},
    topSchoolsThisWeek = [],
    // NEW: optional position leaders block
    // Shape expected:
    // {
    //   "QB": [{ college, slug, count }, ...],
    //   "RB": [{ college, slug, count }, ...],
    //   ...
    // }
    positionLeaders = {},
  } = data;

  const hasPositionLeaders =
    positionLeaders && Object.keys(positionLeaders).length > 0;

  return (
    <div className="space-y-6">
      {/* Top heading section */}
      <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Weekly College NFL Snapshot
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Showing NFL production by college for {week}.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Last updated:{" "}
          {new Date(lastUpdated).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      </section>

      {/* Conference groups */}
      <section className="border border-slate-800/80 rounded-2xl bg-slate-950/60 shadow-sm shadow-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            Conference Groups
          </h2>
          <span className="text-[11px] text-slate-500">
            Click a school to view its players
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {Object.keys(conferenceGroups).length === 0 && (
            <div className="text-slate-400 text-sm col-span-full">
              No conference data. Run the data updater.
            </div>
          )}

          {Object.entries(conferenceGroups).map(([conf, schools]) => (
            <div
              key={conf}
              className="border border-slate-800/80 rounded-xl p-3 bg-slate-900/40"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  {conf}
                </div>
                <div className="text-[11px] text-slate-500">
                  {schools.reduce((sum, s) => sum + (s.numPlayers || 0), 0)}{" "}
                  total players
                </div>
              </div>

              <ul className="space-y-1">
                {schools.map((school) => (
                  <li
                    key={school.slug}
                    className="flex items-center justify-between gap-2"
                  >
                    <button
                      onClick={() => onSelectCollege(school.slug)}
                      className="text-left text-slate-100 hover:text-emerald-300 text-sm"
                    >
                      {school.college}
                    </button>
                    <span className="text-[11px] text-slate-500">
                      {school.numPlayers} players
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Top schools this week */}
      <section className="border border-slate-800/80 rounded-2xl bg-slate-950/60 shadow-sm shadow-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            Top Schools This Week
          </h2>
          <span className="text-[11px] text-slate-500">
            Ranked by total NFL production
          </span>
        </div>

        <div className="p-4 space-y-2 text-sm">
          {topSchoolsThisWeek.length === 0 && (
            <div className="text-slate-400 text-sm">
              No production data yet. Once games are played and the updater
              runs, schools with active players will appear here.
            </div>
          )}

          {topSchoolsThisWeek.map((row, index) => (
            <button
              key={row.slug}
              onClick={() => onSelectCollege(row.slug)}
              className="w-full text-left border border-slate-800/80 rounded-lg px-3 py-2 bg-slate-900/40 hover:border-emerald-400/70 hover:bg-slate-900 transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-500 w-6 text-right">
                  #{index + 1}
                </div>
                <div>
                  <div className="font-medium">{row.college}</div>
                  {row.latestGameDate && (
                    <div className="text-[11px] text-slate-500">
                      Last game:{" "}
                      {new Date(row.latestGameDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-emerald-300">
                Score: {row.totalProduction.toFixed(1)}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Position leaders (NEW SECTION) */}
      {hasPositionLeaders && (
        <section className="border border-slate-800/80 rounded-2xl bg-slate-950/60 shadow-sm shadow-slate-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Position Leaders
            </h2>
            <span className="text-[11px] text-slate-500">
              Schools with the most active NFL players at each position
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
            {Object.entries(positionLeaders).map(([position, schools]) => (
              <div
                key={position}
                className="border border-slate-800/80 rounded-xl p-3 bg-slate-900/40 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs uppercase tracking-wide text-slate-300">
                    {position}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Top {Math.min(schools.length, 3)} schools
                  </div>
                </div>

                <div className="space-y-1">
                  {schools.slice(0, 3).map((school) => (
                    <button
                      key={school.slug}
                      onClick={() => onSelectCollege(school.slug)}
                      className="w-full flex items-center justify-between text-left text-slate-100 hover:text-emerald-300 text-sm"
                    >
                      <span>{school.college}</span>
                      <span className="text-[11px] text-slate-400">
                        {school.count} players
                      </span>
                    </button>
                  ))}
                  {schools.length === 0 && (
                    <div className="text-[11px] text-slate-500">
                      No players tracked at this position yet.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}