import React, { useState, useEffect, useRef, useCallback } from "react";
import { ref, get, set, update, push, onValue, off } from "firebase/database";
import { db, useAuth } from "./App.jsx";
import { config } from "./config.js";

function useCountdown(endTime) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const calc = () => Math.max(0, endTime - Date.now());
    setLeft(calc());
    const id = setInterval(() => { const v = calc(); setLeft(v); if (v === 0) clearInterval(id); }, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
  return { left, str: `${h}h ${m}m ${s}s`, done: left === 0 };
}

function EventCard({ event, onJoin }) {
  const type = config.eventTypes.find(t => t.id === event.type) || config.eventTypes[0];
  const { str, done } = useCountdown(event.endTime);
  return (
    <div className="event-card" style={{ borderColor: type.color }}>
      <div className="event-type-badge" style={{ background: type.color }}>{type.icon} {type.label}</div>
      <h3 className="event-name">{event.name}</h3>
      <p className="event-desc">{event.description}</p>
      <div className="event-meta">
        <span>🎁 {type.reward}</span>
        <span>❓ {type.questions} Questions</span>
        <span>⚡ {type.multiplier}x Points</span>
        <span>👥 {event.playerCount || 0} Players</span>
      </div>
      <div className={`event-timer ${done ? "expired" : ""}`}>⏳ {done ? "Event Khatam!" : `Ends in: ${str}`}</div>
      <button className="btn-primary btn-full" onClick={() => onJoin(event)} disabled={done}>{done ? "Event Over" : "Join Event 🚀"}</button>
    </div>
  );
}

function EventGame({ event, onFinish }) {
  const { user } = useAuth();
  const type = config.eventTypes.find(t => t.id === event.type) || config.eventTypes[0];
  const { str, done } = useCountdown(event.endTime);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qNum, setQNum] = useState(1);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(type.timerSec);
  const [timerActive, setTimerActive] = useState(false);
  const [usedQs, setUsedQs] = useState([]);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef(null);

  const fetchQ = useCallback(async () => {
    setLoading(true); setSelected(null); setResult(null);
    const catConfig = config.categories.find(c => c.id === event.category) || config.categories[0];
    const prompt = event.customPrompt || catConfig.prompt;
    try {
      const res = await fetch(`${config.apiUrl}/api/question`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, usedQuestions: usedQs, difficulty: event.difficulty || "medium" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setQuestion(data); setUsedQs(p => [...p, data.question.substring(0, 50)]);
      setTimer(type.timerSec); setTimerActive(true);
    } catch (e) { alert("Question error: " + e.message); }
    setLoading(false);
  }, [usedQs, event, type]);

  useEffect(() => { fetchQ(); }, []);

  useEffect(() => {
    if (!timerActive || timer <= 0) {
      if (timer === 0) { clearInterval(timerRef.current); setTimerActive(false); setResult({ isCorrect: false, correct: question?.correct, explanation: "Time up!" }); }
      return;
    }
    timerRef.current = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [timerActive, timer]);

  const handleAnswer = async (opt) => {
    if (selected || result) return;
    clearInterval(timerRef.current); setTimerActive(false); setSelected(opt);
    const isCorrect = opt === question.correct;
    setResult({ isCorrect, correct: question.correct, explanation: question.explanation });
    if (isCorrect) {
      const pts = (qNum * 100) * type.multiplier;
      const newScore = score + pts;
      setScore(newScore);
      await update(ref(db, `events/${event.id}/players/${user.uid}`), { score: newScore, name: user.displayName || user.email, updatedAt: Date.now() });
    }
    if (qNum >= type.questions || done) { setTimeout(() => setFinished(true), 1500); }
  };

  const nextQ = () => { setQNum(q => q + 1); fetchQ(); };

  if (done || finished) return (
    <div className="event-finished">
      <div className="event-finish-card">
        <h2>🏁 Event Khatam!</h2>
        <div className="final-score">Score: {score.toLocaleString()} pts</div>
        <p>{qNum} questions, {type.multiplier}x multiplier</p>
        <div className="reward-claim">
          <h3>🎁 Reward Claim Karo</h3>
          <RewardClaim eventId={event.id} score={score} reward={type.reward} />
        </div>
        <button className="btn-outline" onClick={onFinish}>Events Pe Wapas</button>
      </div>
    </div>
  );

  return (
    <div className="event-game">
      <div className="event-game-header">
        <span style={{ color: type.color }}>{type.icon} {event.name}</span>
        <span>Q {qNum}/{type.questions}</span>
        <span>Score: {score.toLocaleString()}</span>
        <span className={`event-clock ${done ? "expired" : ""}`}>⏳ {str}</span>
      </div>
      <div className="timer-bar-wrap">
        <div className="timer-num" style={{ color: timer <= 5 ? "#ef4444" : "#fff" }}>{timer}s</div>
        <div className="timer-bar"><div className="timer-fill" style={{ width: `${(timer / type.timerSec) * 100}%`, background: timer <= 5 ? "#ef4444" : type.color }} /></div>
      </div>
      {loading ? <div className="question-loading"><div className="spinner" /></div> : question && (
        <>
          <div className="question-bubble"><p className="question-text">{question.question}</p></div>
          <div className="options-grid">
            {Object.entries(question.options).map(([key, val]) => (
              <button key={key} className={`option-btn ${selected === key && result?.isCorrect ? "correct" : ""} ${selected === key && !result?.isCorrect ? "wrong" : ""} ${!selected && result && result.correct === key ? "reveal-correct" : ""}`}
                onClick={() => handleAnswer(key)} disabled={!!selected}>
                <span className="opt-key">{key}</span><span className="opt-val">{val}</span>
                {selected === key && result?.isCorrect && <span className="result-icon">✅</span>}
                {selected === key && !result?.isCorrect && <span className="result-icon">❌</span>}
              </button>
            ))}
          </div>
          {result && qNum < type.questions && !done && (
            <div className={`result-banner ${result.isCorrect ? "correct" : "wrong"}`}>
              <p>{result.isCorrect ? "✅ Sahi!" : "❌ Galat!"} {result.explanation}</p>
              <button className="btn-primary" onClick={nextQ}>Next ➜</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RewardClaim({ eventId, score, reward }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ upi: "", phone: "", name: user?.displayName || "" });
  const [submitted, setSubmitted] = useState(false);
  const handleClaim = async (e) => {
    e.preventDefault();
    await push(ref(db, "rewardClaims"), { eventId, userId: user.uid, userName: user.displayName, score, reward, upi: form.upi, phone: form.phone, claimedAt: Date.now(), status: "pending" });
    setSubmitted(true);
  };
  if (submitted) return <div className="claim-success">✅ Claim submit ho gaya! Admin 24-48 ghante mein reward bhejega.</div>;
  return (
    <form onSubmit={handleClaim} className="claim-form">
      <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Aapka naam" required />
      <input value={form.upi} onChange={e => setForm({...form, upi: e.target.value})} placeholder="UPI ID (agar cash reward ho)" />
      <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone number" />
      <button type="submit" className="btn-primary">Claim Karo 🎁</button>
    </form>
  );
}

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tab, setTab] = useState("live");

  useEffect(() => {
    const eventsRef = ref(db, "events");
    const unsub = onValue(eventsRef, snap => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, e]) => ({ id, ...e })).filter(e => e.active);
      setEvents(list);
    });
    return () => off(eventsRef);
  }, []);

  useEffect(() => {
    if (!activeEvent) return;
    const lbRef = ref(db, `events/${activeEvent.id}/players`);
    const unsub = onValue(lbRef, snap => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([uid, d]) => ({ uid, ...d })).sort((a, b) => b.score - a.score);
      setLeaderboard(list);
    });
    return () => off(lbRef);
  }, [activeEvent]);

  const joinEvent = async (event) => {
    if (user) await update(ref(db, `events/${event.id}/players/${user.uid}`), { score: 0, name: user.displayName || user.email, joinedAt: Date.now() });
    setActiveEvent(event);
  };

  const live = events.filter(e => e.endTime > Date.now());
  const past = events.filter(e => e.endTime <= Date.now());

  if (activeEvent && !leaderboard.length && leaderboard !== undefined) {
    return <EventGame event={activeEvent} onFinish={() => setActiveEvent(null)} />;
  }

  if (activeEvent) return (
    <div className="event-split">
      <div className="event-game-wrap"><EventGame event={activeEvent} onFinish={() => setActiveEvent(null)} /></div>
      <div className="event-lb">
        <h3>🏆 Live Leaderboard</h3>
        {leaderboard.slice(0, 20).map((p, i) => (
          <div key={p.uid} className={`lb-row ${p.uid === user?.uid ? "mine" : ""}`}>
            <span className="lb-rank">{i + 1}</span>
            <span className="lb-name">{p.name}</span>
            <span className="lb-score">{p.score?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="events-page">
      <div className="events-header">
        <h2>🎪 Live Events</h2>
        <p>Join karo aur prizes jeeto!</p>
        <div className="events-tabs">
          <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>Live ({live.length})</button>
          <button className={tab === "past" ? "active" : ""} onClick={() => setTab("past")}>Past ({past.length})</button>
        </div>
      </div>
      <div className="event-types-info">
        {config.eventTypes.map(t => (
          <div key={t.id} className="type-badge" style={{ borderColor: t.color }}>
            <span>{t.icon}</span><span style={{ color: t.color }}>{t.label}</span><span>{t.multiplier}x</span>
          </div>
        ))}
      </div>
      {(tab === "live" ? live : past).length === 0
        ? <div className="empty-state"><p>{tab === "live" ? "Abhi koi live event nahi hai. Jaldi aayega! 🎯" : "Koi past events nahi."}</p></div>
        : <div className="events-grid">{(tab === "live" ? live : past).map(e => <EventCard key={e.id} event={e} onJoin={joinEvent} />)}</div>}
    </div>
  );
}
