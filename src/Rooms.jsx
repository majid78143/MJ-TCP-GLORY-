import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ref, set, get, update, push, onValue, off, remove } from "firebase/database";
import { db, useAuth } from "./App.jsx";
import { config } from "./config.js";

const genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

function PlayerProfile({ player, onClose }) {
  return (
    <div className="profile-modal" onClick={onClose}>
      <div className="profile-card" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <div className="profile-avatar">{player.name?.[0]?.toUpperCase() || "?"}</div>
        <h3>{player.name}</h3>
        <div className="profile-stats">
          <div className="pstat"><span className="pstat-val">{player.bestScore ? `₹${(player.bestScore/1000).toFixed(0)}K` : "—"}</span><span className="pstat-label">Best Score</span></div>
          <div className="pstat"><span className="pstat-val">{player.totalGames || 0}</span><span className="pstat-label">Games</span></div>
          <div className="pstat"><span className="pstat-val">{player.wins || 0}</span><span className="pstat-label">Wins</span></div>
          <div className="pstat"><span className="pstat-val">{player.badges ? Object.keys(player.badges).length : 0}</span><span className="pstat-label">Badges</span></div>
        </div>
        <div className="profile-badges">{player.badges && Object.keys(player.badges).map(b => <span key={b} className="badge-chip">{b}</span>)}</div>
        {player.isPremium && <div className="premium-tag-profile">💎 Premium Member</div>}
      </div>
    </div>
  );
}

function RoomChat({ roomId, user }) {
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");
  const endRef = useRef(null);
  useEffect(() => {
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const unsub = onValue(chatRef, snap => {
      const data = snap.val() || {};
      setMessages(Object.values(data).sort((a, b) => a.ts - b.ts));
    });
    return () => off(chatRef);
  }, [roomId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const send = async (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    await push(ref(db, `rooms/${roomId}/chat`), { text: msg.trim(), from: user?.displayName || "Guest", uid: user?.uid, ts: Date.now() });
    setMsg("");
  };
  return (
    <div className="room-chat">
      <div className="chat-header">💬 Room Chat</div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.uid === user?.uid ? "mine" : ""}`}>
            <span className="chat-from">{m.from}:</span>
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="chat-input">
        <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Message likho..." />
        <button type="submit" className="btn-primary">Send</button>
      </form>
    </div>
  );
}

function RoomGame({ room, roomId, onFinish }) {
  const { user } = useAuth();
  const catConfig = config.categories.find(c => c.id === room.category) || config.categories[0];
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState({});
  const [timer, setTimer] = useState(20);
  const [timerActive, setTimerActive] = useState(false);
  const [usedQs, setUsedQs] = useState([]);
  const [qNum, setQNum] = useState(1);
  const [viewProfile, setViewProfile] = useState(null);
  const timerRef = useRef(null);
  const isHost = room.host === user?.uid;

  useEffect(() => {
    const scRef = ref(db, `rooms/${roomId}/scores`);
    const unsub = onValue(scRef, snap => setScores(snap.val() || {}));
    return () => off(scRef);
  }, [roomId]);

  const fetchQ = useCallback(async () => {
    if (!isHost) return;
    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/api/question`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: catConfig.prompt, usedQuestions: usedQs, difficulty: room.difficulty || "medium" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setUsedQs(p => [...p, data.question.substring(0, 50)]);
      await set(ref(db, `rooms/${roomId}/currentQuestion`), { ...data, qNum, shownAt: Date.now() });
    } catch (e) { alert("Question error: " + e.message); }
    setLoading(false);
  }, [usedQs, roomId, catConfig, qNum, isHost]);

  useEffect(() => {
    const qRef = ref(db, `rooms/${roomId}/currentQuestion`);
    const unsub = onValue(qRef, snap => {
      const data = snap.val();
      if (data) { setQuestion(data); setSelected(null); setResult(null); setTimer(20); setTimerActive(true); setQNum(data.qNum || 1); }
    });
    return () => off(qRef);
  }, [roomId]);

  useEffect(() => {
    if (!timerActive || timer <= 0) { if (timer === 0) { clearInterval(timerRef.current); setTimerActive(false); } return; }
    timerRef.current = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [timerActive, timer]);

  const handleAnswer = async (opt) => {
    if (selected || result || !question) return;
    clearInterval(timerRef.current); setTimerActive(false); setSelected(opt);
    const isCorrect = opt === question.correct;
    setResult({ isCorrect, correct: question.correct, explanation: question.explanation });
    if (isCorrect && user) {
      const pts = qNum * 100;
      const cur = scores[user.uid]?.score || 0;
      await update(ref(db, `rooms/${roomId}/scores/${user.uid}`), { score: cur + pts, name: user.displayName || user.email });
    }
  };

  const loadProfile = async (uid) => {
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.exists()) setViewProfile({ ...snap.val(), uid });
  };

  const sortedScores = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);

  return (
    <div className="room-game">
      {viewProfile && <PlayerProfile player={viewProfile} onClose={() => setViewProfile(null)} />}
      <div className="room-game-layout">
        <div className="room-main">
          <div className="room-game-header">
            <span>Room: <strong>{roomId}</strong></span>
            <span>Q{qNum}</span>
            <span>👥 {Object.keys(scores).length} Players</span>
          </div>
          <div className="timer-bar-wrap">
            <div className="timer-num" style={{ color: timer <= 5 ? "#ef4444" : "#fff" }}>{timer}s</div>
            <div className="timer-bar"><div className="timer-fill" style={{ width: `${(timer / 20) * 100}%`, background: timer <= 5 ? "#ef4444" : "#2563eb" }} /></div>
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
              {result && (
                <div className={`result-banner ${result.isCorrect ? "correct" : "wrong"}`}>
                  <p>{result.isCorrect ? "✅ Sahi!" : "❌ Galat!"} {result.explanation}</p>
                  {isHost && <button className="btn-primary" onClick={() => { setQNum(q => q + 1); fetchQ(); }}>Next Question ➜</button>}
                  {!isHost && <p className="waiting-text">Host ka wait karo...</p>}
                </div>
              )}
            </>
          )}
          {isHost && !question && <button className="btn-primary btn-lg" onClick={fetchQ}>🚀 Pehla Question Load Karo</button>}
          <RoomChat roomId={roomId} user={user} />
        </div>
        <div className="room-sidebar">
          <h3>🏆 Scores</h3>
          {sortedScores.map(([uid, d], i) => (
            <div key={uid} className={`lb-row ${uid === user?.uid ? "mine" : ""}`} onClick={() => loadProfile(uid)} style={{ cursor: "pointer" }}>
              <span className="lb-rank">{i + 1}</span>
              <span className="lb-name">{d.name || "Player"}</span>
              <span className="lb-score">{d.score || 0}</span>
            </div>
          ))}
          <button className="btn-ghost btn-full" onClick={onFinish} style={{ marginTop: 16 }}>Room Chhodo</button>
        </div>
      </div>
    </div>
  );
}

export default function Rooms() {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState("home");
  const [joinCode, setJoinCode] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState({});
  const [category, setCategory] = useState("gaming");
  const [difficulty, setDifficulty] = useState("medium");
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [viewProfile, setViewProfile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!roomId) return;
    const rRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(rRef, snap => {
      const data = snap.val();
      if (data) { setRoom(data); setPlayers(data.players || {}); if (data.started) setScreen("game"); }
    });
    return () => off(rRef);
  }, [roomId]);

  const createRoom = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!isPremium) { navigate("/auth?upgrade=1"); return; }
    const code = genCode();
    const roomData = { host: user.uid, hostName: user.displayName || user.email, category, difficulty, maxPlayers: Number(maxPlayers), createdAt: Date.now(), started: false, players: { [user.uid]: { name: user.displayName || user.email, uid: user.uid, joinedAt: Date.now() } } };
    await set(ref(db, `rooms/${code}`), roomData);
    setRoomId(code); setScreen("lobby");
  };

  const joinRoom = async (code) => {
    const c = (code || joinCode).trim().toUpperCase();
    if (!c) { setErr("Room code daalo!"); return; }
    const snap = await get(ref(db, `rooms/${c}`));
    if (!snap.exists()) { setErr("Room nahi mili! Code check karo."); return; }
    const data = snap.val();
    if (Object.keys(data.players || {}).length >= data.maxPlayers) { setErr("Room full hai!"); return; }
    if (data.started) { setErr("Game already shuru ho gaya!"); return; }
    if (user) await update(ref(db, `rooms/${c}/players/${user.uid}`), { name: user.displayName || user.email, uid: user.uid, joinedAt: Date.now() });
    setRoomId(c); setRoom(data); setScreen("lobby");
  };

  const startGame = async () => {
    await update(ref(db, `rooms/${roomId}`), { started: true });
    setScreen("game");
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}/rooms?join=${roomId}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const loadProfile = async (uid) => {
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.exists()) setViewProfile({ ...snap.val(), uid });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get("join");
    if (joinParam) { setJoinCode(joinParam); joinRoom(joinParam); }
  }, []);

  if (screen === "game" && room) return <RoomGame room={room} roomId={roomId} onFinish={() => { setScreen("home"); setRoomId(null); setRoom(null); }} />;

  if (screen === "lobby" && room) return (
    <div className="lobby-page">
      {viewProfile && <PlayerProfile player={viewProfile} onClose={() => setViewProfile(null)} />}
      <div className="lobby-card">
        <div className="lobby-header">
          <h2>🚪 Room Lobby</h2>
          <div className="room-code-display">Code: <strong>{roomId}</strong></div>
          <div className="invite-btns">
            <button className="btn-outline" onClick={copyInvite}>{copied ? "✅ Copied!" : "📋 Link Copy Karo"}</button>
            <button className="btn-outline" onClick={() => window.open(`https://wa.me/?text=KBC Quiz Room join karo! Code: ${roomId}%0A${window.location.origin}/rooms?join=${roomId}`)}>💬 WhatsApp</button>
          </div>
        </div>
        <div className="lobby-meta">
          <span>{config.categories.find(c => c.id === room.category)?.icon} {room.category}</span>
          <span>👥 {Object.keys(players).length}/{room.maxPlayers}</span>
        </div>
        <div className="lobby-players">
          <h3>Players</h3>
          {Object.entries(players).map(([uid, p]) => (
            <div key={uid} className="lobby-player" onClick={() => loadProfile(uid)} style={{ cursor: "pointer" }}>
              <div className="player-avatar">{p.name?.[0]?.toUpperCase()}</div>
              <span>{p.name} {uid === room.host ? "👑 Host" : ""}</span>
            </div>
          ))}
        </div>
        {room.host === user?.uid
          ? <button className="btn-primary btn-lg btn-full" onClick={startGame} disabled={Object.keys(players).length < 2}>🚀 Game Shuru Karo {Object.keys(players).length < 2 ? "(2+ players chahiye)" : ""}</button>
          : <p className="waiting-text">Host ke game start karne ka wait karo...</p>}
      </div>
    </div>
  );

  return (
    <div className="rooms-page">
      {viewProfile && <PlayerProfile player={viewProfile} onClose={() => setViewProfile(null)} />}
      <div className="rooms-header"><h2>🚪 Room Mode</h2><p>Dosto ke saath khelo!</p></div>
      <div className="rooms-layout">
        {isPremium && (
          <div className="room-create-card">
            <h3>👑 Room Banao</h3>
            <div className="form-group"><label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {config.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="easy">🟢 Easy</option><option value="medium">🟡 Medium</option><option value="hard">🔴 Hard</option>
              </select>
            </div>
            <div className="form-group"><label>Max Players (2–10)</label>
              <input type="number" min={2} max={10} value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} />
            </div>
            <button className="btn-primary btn-full" onClick={createRoom}>🚀 Room Create Karo</button>
          </div>
        )}
        {!isPremium && (
          <div className="room-create-card locked">
            <div className="lock-icon">🔒</div>
            <h3>Room Banao</h3>
            <p>Room create karna Premium feature hai.</p>
            <button className="btn-primary" onClick={() => navigate("/auth?upgrade=1")}>💎 Upgrade Karo</button>
          </div>
        )}
        <div className="room-join-card">
          <h3>Join Room</h3>
          {err && <div className="alert-error">{err}</div>}
          <div className="join-input-row">
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Room code daalo (e.g. ABC123)" maxLength={6} />
            <button className="btn-primary" onClick={() => joinRoom()}>Join</button>
          </div>
          {!user && <p className="auth-note">👤 <a href="/auth">Login karo</a> score save karne ke liye. Guest bhi join kar sakta hai!</p>}
        </div>
      </div>
    </div>
  );
}
