// ============================================================
// AGENT 2 — VALIDATOR (v3)
// Topics extraction + Listening / Reading / Grammar
// Strict deduplication, 3 retry attempts
// ============================================================
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const { type, prompt, system, b64, mimeType } = req.body;
  const MAX = 3;
  let result = null;
  let lastErr = '';

  for (let attempt = 1; attempt <= MAX; attempt++) {
    try {
      const content = b64 ? [
        { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: b64 } },
        { type: 'text', text: prompt }
      ] : prompt;

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: (system || '') + '\nReturn ONLY valid JSON. No markdown fences. Start directly with [ or {.',
          messages: [{ role: 'user', content }],
        }),
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || 'API ' + r.status);

      const raw = d.content.map(c => c.text || '').join('');

      if (type === 'topics') {
        result = parseTopics(raw);
      } else if (type === 'grammar') {
        result = parseGrammar(raw);
      } else if (type === 'reading') {
        result = parseReading(raw);
      } else if (type === 'listening') {
        result = parseListening(raw);
      } else {
        result = parseGeneric(raw);
      }

      if (result && result.length >= (type === 'topics' ? 3 : 20)) break;
      lastErr = 'Not enough items: ' + (result ? result.length : 0);

    } catch (e) {
      lastErr = e.message;
      console.error(`[VALIDATOR] attempt ${attempt} error:`, e.message);
    }
  }

  if (!result || result.length === 0) {
    return res.status(200).json({ questions: [], source: 'empty', error: lastErr });
  }

  return res.status(200).json({ questions: result, source: 'ai' });
};

// ── parsers ──────────────────────────────────────────────────

function extractArray(raw) {
  const clean = raw.replace(/```json|```/gi, '').trim();
  const m = clean.match(/\[[\s\S]*\]/);
  if (!m) return null;
  return JSON.parse(m[0]);
}

function parseTopics(raw) {
  const arr = extractArray(raw);
  if (!arr) return null;
  return arr.map((t, i) => ({
    num: t.num || i + 1,
    title: t.title || t.name || `Topic ${i + 1}`,
    description: t.description || t.desc || '',
  })).filter(t => t.title);
}

function parseGrammar(raw) {
  const arr = extractArray(raw);
  if (!Array.isArray(arr)) return null;

  // Deduplicate by sentence text
  const seen = new Set();
  const out = [];

  for (const q of arr) {
    const text = (q.text || q.question || '').trim();
    if (!text) continue;
    const key = text.toLowerCase().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);

    const opts = Array.isArray(q.options) ? q.options.slice(0, 4) : ['A','B','C','D'];
    // Strip any A./B. prefixes inside options
    const cleanOpts = opts.map(o => String(o).replace(/^[A-D]\.\s*/i, '').trim());

    const correct = parseInt(q.correct);
    if (isNaN(correct) || correct < 0 || correct >= cleanOpts.length) continue; // skip bad correct index

    out.push({
      id: out.length + 1,
      text,
      options: cleanOpts,
      correct,
      explanation: q.explanation || '',
    });

    if (out.length >= 25) break;
  }

  return out.length >= 20 ? out : null;
}

function parseReading(raw) {
  const arr = extractArray(raw);
  if (!Array.isArray(arr)) return null;

  const seen = new Set();
  const out = [];

  for (const q of arr) {
    const word = (q.word || q.text || '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const opts = Array.isArray(q.options) ? q.options.slice(0, 4) : ['A','B','C','D'];
    const cleanOpts = opts.map(o => String(o).replace(/^[A-D]\.\s*/i, '').trim());

    const correct = parseInt(q.correct);
    if (isNaN(correct) || correct < 0 || correct >= cleanOpts.length) continue;

    out.push({
      id: out.length + 1,
      word,
      options: cleanOpts,
      correct,
    });

    if (out.length >= 25) break;
  }

  return out.length >= 20 ? out : null;
}

function parseListening(raw) {
  const arr = extractArray(raw);
  if (!Array.isArray(arr)) return null;

  const out = [];
  for (const q of arr) {
    const type = q.type || 'mcq';

    if (type === 'fill') {
      out.push({
        id: out.length + 1,
        type: 'fill',
        label: q.label || q.text || `Item ${out.length + 1}:`,
        answer: String(q.answer || ''),
      });
    } else if (type === 'match') {
      const item = {
        id: out.length + 1,
        type: 'match',
        day: q.day || `Day ${out.length + 1}`,
        answer: String(q.answer || 'A').toUpperCase().charAt(0),
      };
      if (Array.isArray(q.activities)) item.activities = q.activities;
      out.push(item);
    } else {
      // mcq
      const opts = Array.isArray(q.options) ? q.options.slice(0, 3) : ['A','B','C'];
      const cleanOpts = opts.map(o => String(o).replace(/^[A-C]\.\s*/i, '').trim());
      const correct = parseInt(q.correct);
      if (isNaN(correct) || correct < 0 || correct >= cleanOpts.length) {
        out.push({ id: out.length+1, type:'mcq', context: q.context||'', text: q.text||q.question||'Question', options: cleanOpts, correct: 0 });
      } else {
        out.push({ id: out.length+1, type:'mcq', context: q.context||'', text: q.text||q.question||'Question', options: cleanOpts, correct });
      }
    }
    if (out.length >= 25) break;
  }

  return out.length >= 20 ? out : null;
}

function parseGeneric(raw) {
  const arr = extractArray(raw);
  return Array.isArray(arr) && arr.length > 0 ? arr : null;
}
