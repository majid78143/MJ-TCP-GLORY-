import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

app.post("/api/question", async (req, res) => {
  const { prompt, usedQuestions = [], difficulty = "medium" } = req.body;
  const difficultyMap = { easy: "simple (Class 5-8 level)", medium: "moderate (Class 10 level)", hard: "difficult (competitive exam level)" };
  const usedNote = usedQuestions.length > 0 ? `\nDo NOT repeat these questions: ${usedQuestions.slice(-20).join(" | ")}` : "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: `You are a quiz master for a KBC-style game. Generate ${difficultyMap[difficulty] || "moderate"} questions. Always respond with valid JSON only, no markdown. Format: {"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct":"A","explanation":"..."}`
      },{
        role: "user",
        content: `${prompt}. Make it ${difficultyMap[difficulty]}. ${usedNote}`
      }],
      temperature: 0.9,
      response_format: { type: "json_object" },
    });
    const data = JSON.parse(completion.choices[0].message.content);
    res.json({ success: true, ...data });
  } catch (e) {
    console.error("OpenAI Error:", e?.message || e);
    res.status(500).json({ success: false, error: e?.message || "Question generate karne mein problem aayi. Try again!" });
  }
});

app.post("/api/verify", async (req, res) => {
  const { question, selected, correct, explanation } = req.body;
  const isCorrect = selected === correct;
  res.json({ success: true, isCorrect, correct, explanation: explanation || (isCorrect ? "Bilkul sahi!" : `Sahi jawab ${correct} tha.`) });
});

app.post("/api/lifeline/fifty-fifty", async (req, res) => {
  const { options, correct } = req.body;
  const wrong = Object.keys(options).filter(k => k !== correct);
  const remove = wrong.sort(() => 0.5 - Math.random()).slice(0, 2);
  res.json({ success: true, removed: remove });
});

app.post("/api/lifeline/audience", async (req, res) => {
  const { correct } = req.body;
  const letters = ["A","B","C","D"];
  const poll = {};
  let remaining = 100, correctPct = 45 + Math.floor(Math.random() * 35);
  poll[correct] = correctPct; remaining -= correctPct;
  letters.filter(l => l !== correct).forEach((l, i, arr) => {
    const pct = i === arr.length - 1 ? remaining : Math.floor(Math.random() * remaining * 0.6);
    poll[l] = pct; remaining -= pct;
  });
  res.json({ success: true, poll });
});

app.use(express.static(join(__dirname, "dist")));
app.get("*", (_, res) => res.sendFile(join(__dirname, "dist", "index.html")));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
