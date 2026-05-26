// ═══════════════════════════════════════
// api/chat.js — Vercel Serverless Function
// Securely proxies requests to Gemini API
// ═══════════════════════════════════════

const GEMINI_MODEL = "gemini-2.5-flash";

export default async function handler(req, res) {
  // ── CORS Headers (fixes browser CORS error permanently) ──
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight request handle karo
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Sirf POST allow karo
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // API Key environment variable se lo (never expose in frontend!)
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY environment variable not set" });
  }

  try {
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: messages array required" });
    }

    // Gemini API call
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: system
            ? { parts: [{ text: system }] }
            : undefined,
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.85,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errData = await geminiRes.json();
      console.error("Gemini API error:", errData);
      return res.status(geminiRes.status).json({
        error: errData?.error?.message || "Gemini API error",
      });
    }

    const data = await geminiRes.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, kuch error ho gaya!";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
