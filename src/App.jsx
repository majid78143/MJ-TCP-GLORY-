import React, { createContext, useContext, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";
import { config } from "./config.js";
import Auth from "./Auth.jsx";
import Quiz from "./Quiz.jsx";
import Events from "./Events.jsx";
import Rooms from "./Rooms.jsx";
import Admin from "./Admin.jsx";

const app = initializeApp(config.firebase);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function NavBar() {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const handleSignOut = async () => { await signOut(auth); navigate("/"); };
  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">
        {config.logo && config.logo !== "YOUR_LOGO_URL_HERE"
          ? <img src={config.logo} alt={config.siteName} className="logo-img" />
          : <span className="logo-text">{config.siteName}</span>}
      </Link>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      <div className={`nav-links ${menuOpen ? "open" : ""}`}>
        <Link to="/quiz" onClick={() => setMenuOpen(false)}>Quiz</Link>
        <Link to="/events" onClick={() => setMenuOpen(false)}>Events {!isPremium && <span className="premium-badge">💎</span>}</Link>
        <Link to="/rooms" onClick={() => setMenuOpen(false)}>Rooms</Link>
        {user?.isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>}
        {user
          ? <div className="nav-user">
              <span className="user-name">{isPremium ? "💎" : ""} {user.displayName || user.email?.split("@")[0]}</span>
              <button className="btn-outline" onClick={handleSignOut}>Logout</button>
            </div>
          : <Link to="/auth" className="btn-primary" onClick={() => setMenuOpen(false)}>Login</Link>}
      </div>
    </nav>
  );
}

function Home() {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="home">
      <div className="hero">
        <div className="hero-content">
          <h1>India Ka Sabse Smart<br /><span className="accent">AI Quiz Game</span></h1>
          <p>AI se naye questions, events, rooms — sab ek jagah. Khelo aur jeeto!</p>
          <div className="hero-btns">
            <button className="btn-primary btn-lg" onClick={() => navigate("/quiz")}>🎯 Abhi Khelo — Free!</button>
            {!isPremium && <button className="btn-outline btn-lg" onClick={() => navigate("/auth")}>💎 Premium Join Karo</button>}
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><span className="stat-num">∞</span><span className="stat-label">AI Questions</span></div>
          <div className="stat-card"><span className="stat-num">5</span><span className="stat-label">Event Types</span></div>
          <div className="stat-card"><span className="stat-num">₹1Cr</span><span className="stat-label">Prize Level</span></div>
        </div>
      </div>
      <div className="features-grid">
        {[
          { icon: "🤖", title: "AI Questions", desc: "Har baar naya, fresh question. Kabhi repeat nahi." },
          { icon: "🚪", title: "Room Mode", desc: "Dosto ke saath room banao, saath khelo." },
          { icon: "🎪", title: "Live Events", desc: "Daily events join karo aur cash prizes jeeto." },
          { icon: "🏆", title: "Leaderboard", desc: "India mein apna rank dekhao." },
        ].map(f => (
          <div key={f.title} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>
      {!isPremium && (
        <div className="premium-cta">
          <h2>💎 Premium Mein Upgrade Karo</h2>
          <p>Events, unlimited lifelines, room create, leaderboard aur zyada!</p>
          <div className="pricing-cards">
            {Object.values(config.premium).map(p => (
              <div key={p.label} className="price-card">
                <div className="price-label">{p.label}</div>
                <div className="price-amount">₹{p.price / 100}</div>
                <button className="btn-primary" onClick={() => navigate("/auth")}>Choose</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PremiumGuard({ children }) {
  const { isPremium, user } = useAuth();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/auth" replace />;
  if (!isPremium) return (
    <div className="premium-wall">
      <div className="wall-card">
        <div className="wall-icon">💎</div>
        <h2>Premium Feature</h2>
        <p>Yeh feature sirf Premium users ke liye hai.</p>
        <button className="btn-primary btn-lg" onClick={() => navigate("/auth?upgrade=1")}>Upgrade to Premium</button>
        <button className="btn-ghost" onClick={() => navigate(-1)}>Wapas Jao</button>
      </div>
    </div>
  );
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await get(ref(db, `users/${u.uid}`));
        const data = snap.val() || {};
        const premiumExpiry = data.premiumExpiry || 0;
        const premium = premiumExpiry === -1 || premiumExpiry > Date.now();
        setUser({ ...u, isAdmin: u.email === config.adminEmail, premiumData: data });
        setIsPremium(premium);
      } else { setUser(null); setIsPremium(false); }
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <AuthCtx.Provider value={{ user, isPremium, setIsPremium }}>
      <BrowserRouter>
        <NavBar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/events" element={<PremiumGuard><Events /></PremiumGuard>} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/admin" element={user?.isAdmin ? <Admin /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthCtx.Provider>
  );
}
