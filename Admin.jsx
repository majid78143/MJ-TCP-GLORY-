import React, { useState, useEffect } from "react";
import { ref, get, set, update, push, remove, onValue, off } from "firebase/database";
import { db, useAuth } from "./App.jsx";
import { config } from "./config.js";

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [claims, setClaims] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const usersRef = ref(db, "users");
    const eventsRef = ref(db, "events");
    const claimsRef = ref(db, "rewardClaims");
    const u1 = onValue(usersRef, s => { const d = s.val() || {}; setUsers(Object.entries(d).map(([id, v]) => ({ id, ...v }))); });
    const u2 = onValue(eventsRef, s => { const d = s.val() || {}; setEvents(Object.entries(d).map(([id, v]) => ({ id, ...v }))); });
    const u3 = onValue(claimsRef, s => { const d = s.val() || {}; setClaims(Object.entries(d).map(([id, v]) => ({ id, ...v }))); });
    return () => { off(usersRef); off(eventsRef); off(claimsRef); };
  }, []);

  const setPremium = async (uid, days) => {
    const expiry = days === -1 ? -1 : days === 0 ? 0 : Date.now() + days * 86400000;
    await update(ref(db, `users/${uid}`), { premiumExpiry: expiry });
    alert(days === 0 ? "Premium revoke ho gaya!" : `Premium ${days === -1 ? "lifetime" : days + " din ke liye"} de diya!`);
  };

  const updateClaimStatus = async (claimId, status) => {
    await update(ref(db, `rewardClaims/${claimId}`), { status, updatedAt: Date.now() });
  };

  const isPremiumUser = (u) => u.premiumExpiry === -1 || u.premiumExpiry > Date.now();

  const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>⚙️ Admin Dashboard</h2>
        <div className="admin-stats">
          <div className="astat"><span>{users.length}</span><label>Total Users</label></div>
          <div className="astat"><span>{users.filter(isPremiumUser).length}</span><label>Premium</label></div>
          <div className="astat"><span>{events.filter(e => e.active).length}</span><label>Live Events</label></div>
          <div className="astat"><span>{claims.filter(c => c.status === "pending").length}</span><label>Pending Rewards</label></div>
        </div>
      </div>
      <div className="admin-tabs">
        {["users","events","rewards"].map(t => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t === "users" ? "👥 Users" : t === "events" ? "🎪 Events" : "🎁 Rewards"}</button>)}
      </div>

      {tab === "users" && (
        <div className="admin-section">
          <input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." />
          <div className="users-table">
            {filteredUsers.map(u => (
              <div key={u.id} className={`user-row ${isPremiumUser(u) ? "premium-user" : ""}`}>
                <div className="user-info">
                  <div className="user-avatar">{u.name?.[0]?.toUpperCase() || "?"}</div>
                  <div><div className="user-name">{u.name || "—"} {isPremiumUser(u) ? "💎" : ""}</div><div className="user-email">{u.email}</div></div>
                </div>
                <div className="user-actions">
                  {isPremiumUser(u)
                    ? <button className="btn-danger-sm" onClick={() => setPremium(u.id, 0)}>Revoke Premium</button>
                    : <>
                        <button className="btn-sm" onClick={() => setPremium(u.id, 7)}>7 Days</button>
                        <button className="btn-sm" onClick={() => setPremium(u.id, 30)}>30 Days</button>
                        <button className="btn-sm btn-gold" onClick={() => setPremium(u.id, -1)}>Lifetime 👑</button>
                      </>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "events" && <EventManager events={events} />}

      {tab === "rewards" && (
        <div className="admin-section">
          <h3>🎁 Reward Claims</h3>
          {claims.length === 0 && <div className="empty-state"><p>Koi pending claims nahi.</p></div>}
          {claims.map(c => (
            <div key={c.id} className={`claim-row status-${c.status}`}>
              <div className="claim-info">
                <strong>{c.userName}</strong> — Score: {c.score?.toLocaleString()} — Reward: {c.reward}
                {c.upi && <div className="claim-upi">UPI: {c.upi}</div>}
                {c.phone && <div className="claim-phone">📱 {c.phone}</div>}
                <div className="claim-time">{new Date(c.claimedAt).toLocaleString()}</div>
              </div>
              <div className="claim-actions">
                <span className={`status-badge ${c.status}`}>{c.status}</span>
                {c.status === "pending" && <button className="btn-sm" onClick={() => updateClaimStatus(c.id, "sent")}>✅ Sent</button>}
                {c.status === "pending" && <button className="btn-danger-sm" onClick={() => updateClaimStatus(c.id, "rejected")}>❌ Reject</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventManager({ events }) {
  const [form, setForm] = useState({ name: "", description: "", type: "basic", category: "gaming", difficulty: "medium", customPrompt: "", durationHours: 24, active: true });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const saveEvent = async (e) => {
    e.preventDefault(); setSaving(true);
    const eventData = { ...form, startTime: Date.now(), endTime: Date.now() + Number(form.durationHours) * 3600000, playerCount: 0, active: true };
    if (editing) { await update(ref(db, `events/${editing}`), eventData); setEditing(null); }
    else { await push(ref(db, "events"), eventData); }
    setForm({ name: "", description: "", type: "basic", category: "gaming", difficulty: "medium", customPrompt: "", durationHours: 24, active: true });
    setSaving(false);
  };

  const toggleActive = async (id, cur) => { await update(ref(db, `events/${id}`), { active: !cur }); };
  const deleteEvent = async (id) => { if (window.confirm("Delete karo?")) await remove(ref(db, `events/${id}`)); };
  const editEvent = (ev) => { setForm({ ...ev, durationHours: Math.round((ev.endTime - Date.now()) / 3600000) }); setEditing(ev.id); };

  return (
    <div className="admin-section">
      <h3>{editing ? "✏️ Event Edit Karo" : "➕ Naya Event Banao"}</h3>
      <form onSubmit={saveEvent} className="event-form">
        <div className="form-row">
          <div className="form-group"><label>Event Naam</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Gaming Marathon" required /></div>
          <div className="form-group"><label>Type</label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              {config.eventTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {config.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Difficulty</label>
            <select value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value})}>
              <option value="easy">🟢 Easy</option><option value="medium">🟡 Medium</option><option value="hard">🔴 Hard</option>
            </select>
          </div>
          <div className="form-group"><label>Duration (hours)</label><input type="number" min={1} max={168} value={form.durationHours} onChange={e => setForm({...form, durationHours: e.target.value})} /></div>
        </div>
        <div className="form-group"><label>Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Event ka description" /></div>
        <div className="form-group"><label>Custom AI Prompt (optional — warna category prompt use hoga)</label>
          <textarea value={form.customPrompt} onChange={e => setForm({...form, customPrompt: e.target.value})} placeholder="Generate a multiple choice question about..." rows={3} />
        </div>
        <div className="form-btns">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : editing ? "Update Karo" : "Event Banao"}</button>
          {editing && <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setForm({ name: "", description: "", type: "basic", category: "gaming", difficulty: "medium", customPrompt: "", durationHours: 24, active: true }); }}>Cancel</button>}
        </div>
      </form>
      <div className="events-list-admin">
        <h3>All Events</h3>
        {events.map(ev => {
          const type = config.eventTypes.find(t => t.id === ev.type);
          return (
            <div key={ev.id} className={`event-admin-row ${ev.active ? "active" : "inactive"}`}>
              <div>
                <span style={{ color: type?.color }}>{type?.icon} {ev.name}</span>
                <span className="event-admin-meta">· {ev.category} · {ev.difficulty} · {Object.keys(ev.players || {}).length} players</span>
                <span className={`event-status ${ev.active ? "live" : "off"}`}>{ev.active ? "🟢 Live" : "⭕ Off"}</span>
              </div>
              <div className="event-admin-actions">
                <button className="btn-sm" onClick={() => editEvent(ev)}>Edit</button>
                <button className="btn-sm" onClick={() => toggleActive(ev.id, ev.active)}>{ev.active ? "Deactivate" : "Activate"}</button>
                <button className="btn-danger-sm" onClick={() => deleteEvent(ev.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
