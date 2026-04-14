// ============================================================
// AGENT 1 — BACKEND AGENT
// Vazifa: Anthropic API bilan xavfsiz muloqot qiladi
//         API kalitni himoya qiladi, xatolarni qayta ishlaydi
//         Model javobini tekshiradi va tozalaydi
// ============================================================

const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel Environment Variables' });
  }

  try {
    const { model, max_tokens, system, messages } = req.body;

    // --- Kirish validatsiyasi ---
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const safeBody = {
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: Math.min(max_tokens || 2000, 4000),
      system: system || '',
      messages,
    };

    // --- Anthropic API ga so'rov ---
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(safeBody),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `Anthropic API error: ${response.status}`;
      console.error('[BACKEND AGENT] Anthropic error:', errMsg);
      return res.status(response.status).json({ error: errMsg });
    }

    // --- Javobni tekshirib qaytarish ---
    if (!data.content || data.content.length === 0) {
      return res.status(500).json({ error: 'Empty response from Anthropic' });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[BACKEND AGENT] Unhandled error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
