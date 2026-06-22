# KBC Quiz AI

## Files
- `server.js` — Express backend (Render pe deploy karo)
- `src/config.js` — **Yahan apna logo URL, admin email daalo**
- `src/App.jsx` — Main app + routing
- `src/Auth.jsx` — Login/Register + Razorpay Premium
- `src/Quiz.jsx` — Quiz game (AI questions, timer, lifelines)
- `src/Events.jsx` — Events system (Premium)
- `src/Rooms.jsx` — Room Mode (multiplayer)
- `src/Admin.jsx` — Admin Dashboard
- `src/index.css` — Poori styling
- `index.html` — AdSense + verification meta tags

## Setup

### 1. Dependencies Install Karo
```bash
npm install
```

### 2. .env File Banao
```bash
cp .env.example .env
```
`.env` mein apni values daalo:
```
OPENAI_API_KEY=sk-...
RAZORPAY_KEY_SECRET=rzp_...
PORT=3001
```

### 3. config.js Update Karo
```js
logo: "YOUR_LOGO_URL",         // apna logo URL
adminEmail: "you@email.com",   // admin email
razorpay: { keyId: "rzp_live_..." }
```

### 4. index.html Update Karo
- `YOUR_GOOGLE_VERIFICATION_CODE` — Google verification code

## GitHub pe Deploy Karo
```bash
git init
git add .
git commit -m "KBC Quiz AI"
git push origin main
```

## Render pe Deploy Karo (Backend)
1. render.com pe jaao
2. New Web Service → GitHub repo connect karo
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Environment Variables mein daalo:
   - `OPENAI_API_KEY`
   - `RAZORPAY_KEY_SECRET`

## Admin Access
`config.js` mein `adminEmail` set karo — woh email se login karne wala automatically admin ban jaayega.

## Premium Activate (Manual)
Admin dashboard → Users → kisi bhi user ko 7 days / 30 days / Lifetime premium do.
