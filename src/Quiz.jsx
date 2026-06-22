import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ref, push, get, update } from "firebase/database";
import { db, useAuth } from "./App.jsx";
import { config } from "./config.js";

const LIFELINE_LABELS = { "50-50": "50:50", phone: "📞 Phone", audience: "👥 Audience" };

export default function Quiz() {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState("home");
  const [category, setCategory] = useState(null);
  const [difficulty, setDifficulty] = useState("medium");
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(0);
  const [usedQs, setUsedQs] = useState([]);
  const [lifelines, setLifelines] = useState({ "50-50": true, phone: true, audience: true });
  const [removedOptions, setRemovedOptions] = useState([]);
  const [audiencePoll, setAudiencePoll] = useState(null);
  const [phoneTip, setPhoneTip] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [showLadder, setShowLadder] = useState(false);
  const timerRef = useRef(null);
  const maxLifelines = isPremium ? 3 : 1;
  const lifelineCount = Object.values(lifelines).filter(Boolean).length;

  const clearTimer = () => { clearInterval(timerRef.current); setTimerActive(false); };

  const fetchQuestion = useCallback(async (cat = category, diff = difficulty) => {
    setLoading(true); setSelected(null); setResult(null); setRemovedOptions([]); setAudiencePoll(null); setPhoneTip(null);
    const catConfig = config.categories.find(c => c.id === cat);
    try {
      const res = await fetch(`${config.apiUrl}/api/question`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: catConfig.prompt, usedQuestions: usedQs, difficulty: diff }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setQuestion(data); setUsedQs(prev => [...prev, data.question.substring(0, 50)]);
      setTimer(diff === "hard" ? 15 : diff === "easy" ? 30 : 20); setTimerActive(true);
    } catch (e) { alert("Question load nahi hua: " + e.message); setScreen("home"); }
    setLoading(false);
  }, [category, difficulty, usedQs]);

  useEffect(() => {
    if (!timerActive || timer <= 0) { if (timer === 0 && timerActive) handleTimeUp(); return; }
    timerRef.current = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [timerActive, timer]);

  const handleTimeUp = () => {
    clearTimer();
    setResult({ isCorrect: false, correct: question?.correct, explanation: "Waqt khatam! Sahi jawab tha: " + question?.options[question?.correct] });
    if (level === 0) { setGameOver(true); }
  };

  const handleAnswer = async (opt) => {
    if (selected || result || !question) return;
    clearTimer(); setSelected(opt); setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/api/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.question, selected: opt, correct: question.correct, explanation: question.explanation }),
      });
      const data = await res.json();
      setResult(data);
      if (data.isCorrect) {
        const newLevel = level + 1;
        const newScore = config.moneyLadder[level] || 0;
        setLevel(newLevel); setScore(newScore);
        if (user) await update(ref(db, `users/${user.uid}`), { bestScore: Math.max(newScore, 0), totalGames: (user.premiumData?.totalGames || 0) + (level === 0 ? 1 : 0) });
        if (newLevel >= config.moneyLadder.length) { setGameOver(true); }
      } else {
        const safe = [4, 9].includes(level) ? config.moneyLadder[Math.max(0, [4,9].find(s => s < level) || 0)] : 0;
        setScore(safe); setGameOver(true);
      }
    } catch (e) { alert("Verify karne mein dikkat: " + e.message); }
    setLoading(false);
  };

  const useLifeline = async (type) => {
    if (!lifelines[type] || !question) return;
    const usedCount = Object.values(lifelines).filter(v => !v).length;
    if (usedCount >= maxLifelines) { alert(`Aapke paas sirf ${maxLifelines} lifeline hai! ${!isPremium ? "Premium mein 3 milti hain 💎" : ""}`); return; }
    setLifelines(prev => ({ ...prev, [type]: false }));
    if (type === "50-50") {
      const res = await fetch(`${config.apiUrl}/api/lifeline/fifty-fifty`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options: question.options, correct: question.correct }) });
      const data = await res.json();
      setRemovedOptions(data.removed);
    } else if (type === "audience") {
      const res = await fetch(`${config.apiUrl}/api/lifeline/audience`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correct: question.correct }) });
      const data = await res.json();
      setAudiencePoll(data.poll);
    } else if (type === "phone") {
      const correctOpt = question.options[question.correct];
      setPhoneTip(`"Mere hisaab se jawab '${question.correct}) ${correctOpt}' hai, lekin main 80% sure hoon!"`);
    }
  };

  const startGame = (cat) => {
    setCategory(cat); setLevel(0); setScore(0); setGameOver(false);
    setUsedQs([]); setLifelines({ "50-50": true, phone: true, audience: true });
    setScreen("quiz"); fetchQuestion(cat, difficulty);
  };

  const formatMoney = (n) => n >= 10000000 ? "₹1 Crore" : n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(0)}K` : `₹${n}`;

  if (screen === "home") return (
    <div className="quiz-home">
      <div className="quiz-intro">
        <h2>🎯 Category Chuno</h2>
        <p>AI aapke liye fresh questions banega!</p>
        <div className="diff-select">
          {["easy","medium","hard"].map(d => (
            <button key={d} className={`diff-btn ${difficulty === d ? "active" : ""}`} onClick={() => setDifficulty(d)}>{d === "easy" ? "🟢 Easy" : d === "medium" ? "🟡 Medium" : "🔴 Hard"}</button>
          ))}
        </div>
      </div>
      <div className="category-grid">
        {config.categories.map(cat => (
          <button key={cat.id} className="cat-card" onClick={() => startGame(cat.id)}>
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-label">{cat.label}</span>
          </button>
        ))}
      </div>
      {!user && <div className="guest-banner">👤 Guest Mode — Login karo score save karne ke liye! <button className="btn-link" onClick={() => navigate("/auth")}>Login</button></div>}
    </div>
  );

  if (gameOver) return (
    <div className="game-over-screen">
      <div className="game-over-card">
        <div className="game-over-icon">{score > 0 ? "🎉" : "😢"}</div>
        <h2>{score > 0 ? "Badiya khela!" : "Game Over!"}</h2>
        <div className="final-score">{formatMoney(score)}</div>
        <p>Level {level} tak pahunche</p>
        {!isPremium && score > 0 && <div className="upsell-box">💎 Premium mein 3x points aur events access milta hai! <button className="btn-primary" onClick={() => navigate("/auth?upgrade=1")}>Upgrade</button></div>}
        <div className="game-over-btns">
          <button className="btn-primary" onClick={() => { setScreen("home"); setGameOver(false); }}>Dubara Khelo</button>
          {isPremium && <button className="btn-outline" onClick={() => navigate("/events")}>Events Join Karo</button>}
        </div>
      </div>
    </div>
  );

  const timerPct = timer / (difficulty === "hard" ? 15 : difficulty === "easy" ? 30 : 20) * 100;

  return (
    <div className="quiz-page">
      <div className="quiz-sidebar">
        <div className="money-ladder">
          {[...config.moneyLadder].reverse().map((m, i) => {
            const lvl = config.moneyLadder.length - 1 - i;
            return <div key={m} className={`ladder-row ${lvl === level ? "current" : ""} ${lvl < level ? "passed" : ""}`}><span>{lvl + 1}</span><span>{formatMoney(m)}</span></div>;
          })}
        </div>
        <button className="show-ladder-btn" onClick={() => setShowLadder(!showLadder)}>💰 Prize Ladder</button>
      </div>
      {showLadder && <div className="ladder-modal" onClick={() => setShowLadder(false)}><div className="ladder-modal-inner" onClick={e => e.stopPropagation()}><h3>Prize Ladder</h3>{config.moneyLadder.map((m, i) => <div key={m} className={`ladder-row ${i === level ? "current" : i < level ? "passed" : ""}`}><span>{i + 1}</span><span>{formatMoney(m)}</span></div>)}</div></div>}
      <div className="quiz-container">
        <div className="quiz-header">
          <div className="quiz-meta">
            <span className="cat-tag">{config.categories.find(c => c.id === category)?.icon} {config.categories.find(c => c.id === category)?.label}</span>
            <span className="level-tag">Level {level + 1}</span>
            {score > 0 && <span className="score-tag">{formatMoney(score)}</span>}
          </div>
          <div className="timer-bar-wrap">
            <div className="timer-num" style={{ color: timer <= 5 ? "#ef4444" : timer <= 10 ? "#f59e0b" : "inherit" }}>{timer}s</div>
            <div className="timer-bar"><div className="timer-fill" style={{ width: `${timerPct}%`, background: timer <= 5 ? "#ef4444" : timer <= 10 ? "#f59e0b" : "#2563eb" }} /></div>
          </div>
        </div>

        {loading && !question ? (
          <div className="question-loading"><div className="spinner" /><p>AI question bana raha hai...</p></div>
        ) : question && (
          <>
            <div className="question-bubble"><p className="question-text">{question.question}</p></div>
            {audiencePoll && (
              <div className="audience-poll">
                <p>👥 Audience Poll:</p>
                {Object.entries(audiencePoll).map(([k, v]) => (
                  <div key={k} className="poll-row"><span>{k}</span><div className="poll-bar"><div style={{ width: `${v}%` }} /><span>{v}%</span></div></div>
                ))}
              </div>
            )}
            {phoneTip && <div className="phone-tip">📞 Dost ka jawab: <em>{phoneTip}</em></div>}
            <div className="options-grid">
              {Object.entries(question.options).map(([key, val]) => {
                const isRemoved = removedOptions.includes(key);
                const isSelected = selected === key;
                const isCorrect = result?.correct === key;
                const isWrong = isSelected && !result?.isCorrect;
                return (
                  <button key={key} className={`option-btn ${isRemoved ? "removed" : ""} ${isSelected && result?.isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""} ${!isSelected && result && isCorrect ? "reveal-correct" : ""}`}
                    onClick={() => !isRemoved && handleAnswer(key)} disabled={!!selected || isRemoved || loading}>
                    <span className="opt-key">{key}</span>
                    <span className="opt-val">{isRemoved ? "—" : val}</span>
                    {isSelected && result?.isCorrect && <span className="result-icon">✅</span>}
                    {isWrong && <span className="result-icon">❌</span>}
                  </button>
                );
              })}
            </div>
            {result && (
              <div className={`result-banner ${result.isCorrect ? "correct" : "wrong"}`}>
                <p>{result.isCorrect ? "✅ Bilkul Sahi!" : "❌ Galat!"} {result.explanation}</p>
                {result.isCorrect && !gameOver && <button className="btn-primary" onClick={() => fetchQuestion()}>Agla Question ➜</button>}
              </div>
            )}
            <div className="lifelines-row">
              {Object.entries(lifelines).map(([key, available], idx) => {
                const usedCount = Object.values(lifelines).filter(v => !v).length;
                const locked = !available || (usedCount >= maxLifelines && available);
                return (
                  <button key={key} className={`lifeline-btn ${!available ? "used" : ""} ${locked && available ? "locked" : ""}`}
                    onClick={() => useLifeline(key)} disabled={!available || !!selected || loading}>
                    {LIFELINE_LABELS[key]}
                    {!available && <span className="used-tag">Used</span>}
                  </button>
                );
              })}
              {!isPremium && <span className="lifeline-note">💎 Premium: 3 lifelines</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
