import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref, set, get, update } from "firebase/database";
import { auth, db, useAuth } from "./App.jsx";
import { config } from "./config.js";

function loadRazorpay() {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function Auth() {
  const { user, isPremium, setIsPremium } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const upgrade = params.get("upgrade") === "1";
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState("");

  useEffect(() => { if (user && !upgrade) navigate("/quiz"); }, [user]);

  const saveUser = async (u) => {
    const snap = await get(ref(db, `users/${u.uid}`));
    if (!snap.exists()) {
      await set(ref(db, `users/${u.uid}`), { name: u.displayName || form.name, email: u.email, createdAt: Date.now(), premiumExpiry: 0, friends: {}, badges: {} });
    }
  };

  const handleGoogle = async () => {
    setLoading(true); setErr("");
    try {
      const res = await signInWithPopup(auth, new GoogleAuthProvider());
      await saveUser(res.user);
      navigate(upgrade ? "/auth?upgrade=1" : "/quiz");
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setErr("");
    try {
      let u;
      if (tab === "register") {
        const res = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await updateProfile(res.user, { displayName: form.name });
        u = res.user;
      } else {
        const res = await signInWithEmailAndPassword(auth, form.email, form.password);
        u = res.user;
      }
      await saveUser(u);
      navigate(upgrade ? "/auth?upgrade=1" : "/quiz");
    } catch (e) {
      const msgs = { "auth/email-already-in-use": "Email already registered!", "auth/wrong-password": "Wrong password!", "auth/user-not-found": "Account nahi mila!", "auth/weak-password": "Password 6+ chars chahiye!" };
      setErr(msgs[e.code] || e.message);
    }
    setLoading(false);
  };

  const handleUpgrade = async (planKey) => {
    if (!user) return;
    const plan = config.premium[planKey];
    setPayLoading(planKey);
    const loaded = await loadRazorpay();
    if (!loaded) { alert("Razorpay load nahi hua. Internet check karo!"); setPayLoading(""); return; }
    const options = {
      key: config.razorpay.keyId,
      amount: plan.price,
      currency: "INR",
      name: config.siteName,
      description: `${plan.label} Premium`,
      handler: async (response) => {
        const expiry = plan.days === -1 ? -1 : Date.now() + plan.days * 86400000;
        await update(ref(db, `users/${user.uid}`), { premiumExpiry: expiry, premiumPlan: planKey, lastPayment: response.razorpay_payment_id });
        setIsPremium(true);
        alert("🎉 Premium activated! Enjoy!");
        navigate("/quiz");
      },
      prefill: { name: user.displayName, email: user.email },
      theme: { color: "#2563eb" },
    };
    new window.Razorpay(options).open();
    setPayLoading("");
  };

  if (user && upgrade) return (
    <div className="auth-page">
      <div className="auth-card upgrade-card">
        <h2>💎 Premium Choose Karo</h2>
        <p>Saare premium features unlock karo!</p>
        <div className="pricing-cards-vertical">
          {Object.entries(config.premium).map(([key, plan]) => (
            <div key={key} className={`price-card-v ${key === "monthly" ? "popular" : ""}`}>
              {key === "monthly" && <span className="popular-tag">Most Popular</span>}
              <div className="price-label">{plan.label}</div>
              <div className="price-amount">₹{plan.price / 100}<span className="price-period">/{key}</span></div>
              <ul className="price-features">
                <li>✅ All Events Access</li><li>✅ Room Create</li>
                <li>✅ 3 Lifelines</li><li>✅ Full Leaderboard</li>
                <li>✅ Rewards Eligible</li>
              </ul>
              <button className="btn-primary" onClick={() => handleUpgrade(key)} disabled={payLoading === key}>
                {payLoading === key ? "Processing..." : "Upgrade Karo"}
              </button>
            </div>
          ))}
        </div>
        <button className="btn-ghost" onClick={() => navigate(-1)}>Skip, Free Rehne Do</button>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{tab === "login" ? "Wapas Aao! 👋" : "Account Banao 🎯"}</h2>
          <p>{tab === "login" ? "Login karo aur quiz khelo" : "Free mein register karo"}</p>
        </div>
        <div className="auth-tabs">
          <button className={tab === "login" ? "active" : ""} onClick={() => { setTab("login"); setErr(""); }}>Login</button>
          <button className={tab === "register" ? "active" : ""} onClick={() => { setTab("register"); setErr(""); }}>Register</button>
        </div>
        <button className="btn-google" onClick={handleGoogle} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
          Google se {tab === "login" ? "Login" : "Register"}
        </button>
        <div className="divider"><span>ya</span></div>
        {err && <div className="alert-error">{err}</div>}
        <form onSubmit={handleSubmit}>
          {tab === "register" && <div className="form-group"><label>Naam</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Aapka naam" required /></div>}
          <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@example.com" required /></div>
          <div className="form-group"><label>Password</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Password" required /></div>
          <button type="submit" className="btn-primary btn-full" disabled={loading}>{loading ? "Loading..." : tab === "login" ? "Login Karo" : "Account Banao"}</button>
        </form>
        <p className="auth-footer">Demo mein bhi khel sakte ho — <a href="/quiz">Guest Mode Try Karo</a></p>
      </div>
    </div>
  );
}
