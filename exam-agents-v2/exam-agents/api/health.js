// ============================================================
// AGENT 3 — HEALTH CHECK AGENT
// Vazifa: Sayt va barcha agentlar ishlayotganini tekshiradi
//         API kaliti to'g'rimi, model javob berayaptimi,
//         JSON parse ishlayaptimi — barchasini test qiladi
// ============================================================

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const results = {
    timestamp: new Date().toISOString(),
    checks: {},
    overall: 'ok',
  };

  // ─── CHECK 1: API kaliti mavjudmi? ────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    results.checks.api_key = { status: 'fail', message: 'ANTHROPIC_API_KEY not set' };
    results.overall = 'fail';
  } else {
    results.checks.api_key = {
      status: 'ok',
      message: 'API key found: sk-ant-...' + apiKey.slice(-4),
    };
  }

  // ─── CHECK 2: Anthropic API javob berayaptimi? ────────────
  if (apiKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 30,
          messages: [{ role: 'user', content: 'Reply only with: {"status":"ok"}' }],
        }),
      });

      const data = await response.json();

      if (response.ok && data.content?.length > 0) {
        results.checks.anthropic_api = {
          status: 'ok',
          message: 'Anthropic API responding',
          model: data.model,
          usage: data.usage,
        };
      } else {
        results.checks.anthropic_api = {
          status: 'fail',
          message: data?.error?.message || 'Bad response',
        };
        results.overall = 'degraded';
      }
    } catch (err) {
      results.checks.anthropic_api = { status: 'fail', message: err.message };
      results.overall = 'fail';
    }
  }

  // ─── CHECK 3: Grammar savol yaratish testi ────────────────
  if (apiKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: 'Return ONLY valid JSON array. No markdown.',
          messages: [{
            role: 'user',
            content: 'Create 2 grammar MCQ questions. Format: [{"id":1,"text":"She ___ to school.","options":["go","goes","going","gone"],"correct":1},{"id":2,"text":"They ___ now.","options":["play","plays","are playing","playing"],"correct":2}]'
          }],
        }),
      });

      const data = await response.json();
      const raw = data.content?.map(c => c.text || '').join('') || '';
      const match = raw.replace(/```json|```/g,'').trim().match(/\[[\s\S]*\]/);

      if (match) {
        const parsed = JSON.parse(match[0]);
        results.checks.grammar_generation = {
          status: 'ok',
          message: `JSON parse OK — ${parsed.length} questions generated`,
          sample: parsed[0]?.text,
        };
      } else {
        results.checks.grammar_generation = {
          status: 'warn',
          message: 'JSON parse failed — raw: ' + raw.slice(0, 100),
        };
        results.overall = results.overall === 'ok' ? 'degraded' : results.overall;
      }
    } catch (err) {
      results.checks.grammar_generation = { status: 'fail', message: err.message };
    }
  }

  // ─── CHECK 4: Environment ─────────────────────────────────
  results.checks.environment = {
    status: 'ok',
    node_version: process.version,
    region: process.env.VERCEL_REGION || 'unknown',
    deployment: process.env.VERCEL_ENV || 'unknown',
  };

  // ─── Natija ───────────────────────────────────────────────
  const httpStatus = results.overall === 'fail' ? 500 : 200;
  return res.status(httpStatus).json(results);
};
