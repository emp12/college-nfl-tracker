import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, Link, useParams } from "react-router-dom";

const API_BASE = "https://college-nfl-backend.onrender.com/api";

function CollegePage() {
  const { college } = useParams();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch(`${API_BASE}/players/${college}`);
      const data = await res.json();
      setPlayers(data);
      setLoading(false);
    }
    fetchData();
  }, [college]);

  const query = players.slice(0, 8).map((p) => `"${p.name}"`).join(" OR ");
  const twitterUrl = `https://nitter.net/search?f=tweets&q=(${encodeURIComponent(
    query
  )})%20filter:video&scroll=true`;

  return (
    <div className="container">
      <h2>{college.toUpperCase()} NFL Players</h2>
      {loading ? (
        <p>Loading players...</p>
      ) : (
        players.map((p) => (
          <div key={p.playerId} className="player-card">
            <strong>{p.name}</strong> — {p.position} ({p.team})
          </div>
        ))
      )}
      <h3>Recent Highlights</h3>
      <iframe title="Social Feed" src={twitterUrl} loading="lazy"></iframe>
    </div>
  );
}

function Home() {
  const colleges = ["Alabama", "BYU", "LSU", "Georgia", "Ohio State"];
  return (
    <div className="container">
      <h2>Select a College</h2>
      {colleges.map((c) => (
        <p key={c}>
          <Link to={`/college/${c.toLowerCase()}`}>{c}</Link>
        </p>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <header>
        <h1>College Gridiron Tracker</h1>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/college/:college" element={<CollegePage />} />
      </Routes>
    </Router>
  );
}