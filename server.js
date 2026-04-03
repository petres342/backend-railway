/**
 * Proxy server pentru Ce fac dacă...?
 * Ascunde cheia Anthropic API față de client.
 *
 * Deploy: Railway / Render / orice VPS Node.js
 * Env vars necesare: ANTHROPIC_API_KEY, ALLOWED_ORIGIN
 */

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS ──────────────────────────────────────────────────────────────────────
// Setează ALLOWED_ORIGIN la domeniul tău real (ex: https://cefacdaca.ro)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["POST"],
  })
);

app.use(express.json({ limit: "20kb" })); // limitează payload-ul

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── PROXY ENDPOINT ────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY lipsește din variabilele de mediu.");
    return res.status(500).json({ error: "Server misconfigurat." });
  }

  // Validare minimă — acceptăm doar un array de mesaje
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Câmpul `messages` lipsește sau e invalid." });
  }

  // System prompt-ul e definit DOAR pe server — clientul nu îl poate suprascrie
  const SYSTEM_PROMPT = `Ești un asistent practic și empatic specializat în situații stresante din viața de zi cu zi din România. Cunoști legislația română — Codul Muncii, Codul Civil, legile privind chiriile, drepturile consumatorilor, procedurile ANPC, BNR, etc.

Regulile tale:
1. Răspunzi MEREU în română, clar și practic.
2. Dai pași concreți, numerotați, acționabili.
3. Citezi legislația română relevantă (ex: Art. X din Codul Muncii) când e cazul.
4. Ești empatic — înțelegi că omul e stresat.
5. Dacă situația e complexă, recomanzi sincer un avocat sau specialist.
6. NU ești avocat și NU dai consultanță juridică oficială — oferi informații generale.
7. Formatează răspunsurile cu **bold** pentru termeni importanți.
8. Ține răspunsurile focalizate și utile — nu prea lungi.
9. La final, poți oferi să ajuți cu pași următori sau documente conexe.`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages, // trimitem doar mesajele de la client, nu system prompt-ul
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error("Eroare Anthropic:", data);
      return res.status(anthropicRes.status).json({ error: data.error?.message || "Eroare API." });
    }

    // Trimitem înapoi doar ce are nevoie clientul
    res.json({ content: data.content });
  } catch (err) {
    console.error("Fetch eșuat:", err);
    res.status(502).json({ error: "Nu am putut contacta API-ul. Încearcă din nou." });
  }
});

app.listen(PORT, () => console.log(`Proxy pornit pe portul ${PORT}`));
