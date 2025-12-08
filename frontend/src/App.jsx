// src/App.jsx

import { useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import CollegePage from "./pages/CollegePage.jsx";

/**
 * App
 *
 * We intentionally do NOT use react-router-dom here.
 * Navigation is handled by simple React state:
 *
 *   - view: "home" | "college"
 *   - selectedCollegeSlug: "ala", "byu", etc.
 *
 * HomePage calls onSelectCollege(slug) when the user clicks a school.
 * CollegePage calls onBack() when the user clicks "Back to home".
 */
export default function App() {
  const [view, setView] = useState("home");
  const [selectedCollegeSlug, setSelectedCollegeSlug] = useState(null);

  function handleSelectCollege(slug) {
    setSelectedCollegeSlug(slug);
    setView("college");
  }

  function handleBackToHome() {
    setView("home");
    setSelectedCollegeSlug(null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Simple header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setView("home")}
            className="text-lg font-semibold tracking-tight hover:text-emerald-300"
          >
            College NFL Tracker
          </button>
          <div className="text-xs text-slate-400">
            Live NFL production by college
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {view === "home" ? (
            <HomePage onSelectCollege={handleSelectCollege} />
          ) : (
            <CollegePage
              slug={selectedCollegeSlug}
              onBack={handleBackToHome}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/80 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 py-3">
          Data from ESPN | Built for college fans
        </div>
      </footer>
    </div>
  );
}