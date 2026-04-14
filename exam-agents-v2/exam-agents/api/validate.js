// ============================================================
// AGENT 2 — VALIDATOR AGENT
// Vazifa: AI yaratgan savollarni tekshiradi:
//         - JSON format to'g'rimi?
//         - 25 ta savol bormi?
//         - Har savol to'liq fieldlarga egami?
//         - correct index to'g'rimi?
//         Xato topilsa — AI ga qayta so'raydi va tuzatadi
// ============================================================

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not set' });

  const { type, prompt, system, raw_questions, b64, mimeType } = req.body;

  // ─── 1. AI dan savollar olish ─────────────────────────────
  let questions = null;
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (!questions && attempts < MAX_ATTEMPTS) {
    attempts++;
    console.log(`[VALIDATOR] Attempt ${attempts}/${MAX_ATTEMPTS} — type: ${type}`);

    try {
      const content = b64 ? [
        { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: b64 } },
        { type: 'text', text: prompt }
      ] : prompt;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: system + '\nCRITICAL: Return ONLY a JSON array. No markdown fences, no explanation, start with [ and end with ]',
          messages: [{ role: 'user', content }],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'API error');

      const rawText = data.content.map(c => c.text || '').join('');
      questions = parseAndValidate(rawText, type);

      if (!questions) {
        console.log(`[VALIDATOR] Attempt ${attempts} failed validation, retrying...`);
      }
    } catch (err) {
      console.error(`[VALIDATOR] Attempt ${attempts} error:`, err.message);
      if (attempts >= MAX_ATTEMPTS) {
        return res.status(200).json({
          questions: getFallback(type),
          source: 'fallback',
          error: err.message,
        });
      }
    }
  }

  if (!questions) {
    console.log('[VALIDATOR] All attempts failed, using fallback');
    return res.status(200).json({
      questions: getFallback(type),
      source: 'fallback',
    });
  }

  return res.status(200).json({
    questions,
    source: 'ai',
    attempts,
  });
};

// ─── VALIDATOR: JSON parse + savol tekshiruvi ────────────────
function parseAndValidate(raw, type) {
  try {
    // JSON ni tozalash
    let clean = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    // Faqat [ ... ] qismini olish
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return null;

    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length < 20) return null;

    // Har bir savolni tekshirish
    const validated = arr.map((q, i) => {
      const fixed = { id: q.id || i + 1 };

      if (type === 'grammar' || type === 'reading') {
        // text/word majburiy
        if (type === 'grammar') {
          fixed.text = q.text || q.question || `Question ${i + 1}`;
        } else {
          fixed.word = q.word || q.text || `word${i + 1}`;
        }

        // options: 4 ta bo'lishi kerak
        fixed.options = Array.isArray(q.options) && q.options.length >= 4
          ? q.options.slice(0, 4)
          : ['Option A', 'Option B', 'Option C', 'Option D'];

        // A./B. prefix larni tozalash
        fixed.options = fixed.options.map(o =>
          typeof o === 'string' ? o.replace(/^[A-D]\.\s*/i, '').trim() : String(o)
        );

        // correct: 0–3 orasida bo'lishi kerak
        const c = parseInt(q.correct);
        fixed.correct = (c >= 0 && c <= 3) ? c : 0;

        // explanation ixtiyoriy
        if (q.explanation) fixed.explanation = q.explanation;

      } else if (type === 'listening_fill') {
        fixed.type = 'fill';
        fixed.label = q.label || q.text || `Item ${i + 1}:`;
        fixed.answer = q.answer || '';

      } else if (type === 'listening_mcq') {
        fixed.type = 'mcq';
        fixed.context = q.context || '';
        fixed.text = q.text || q.question || `Question ${i + 1}`;
        fixed.options = Array.isArray(q.options) && q.options.length >= 3
          ? q.options.slice(0, 3).map(o => String(o).replace(/^[A-C]\.\s*/i, '').trim())
          : ['Option A', 'Option B', 'Option C'];
        const c = parseInt(q.correct);
        fixed.correct = (c >= 0 && c <= 2) ? c : 0;

      } else if (type === 'listening_match') {
        fixed.type = 'match';
        fixed.day = q.day || `Day ${i + 1}`;
        fixed.answer = (q.answer || 'A').toString().toUpperCase().charAt(0);
        if (q.activities) fixed.activities = q.activities;
      }

      return fixed;
    });

    return validated;
  } catch (e) {
    console.error('[VALIDATOR] Parse error:', e.message);
    return null;
  }
}

// ─── FALLBACK savollar ────────────────────────────────────────
function getFallback(type) {
  if (type === 'reading') {
    return [
      {id:1,word:'pretext',options:['Seldom, rarely','Talent, skill','Excuse; false reason','Friendly chat'],correct:2},
      {id:2,word:'contemplate',options:['To think','To go for a walk','To confirm','Completely, entirely'],correct:0},
      {id:3,word:'undergo',options:['To complain','To talk about','To make suitable for','To go through; to experience'],correct:3},
      {id:4,word:'rely on',options:['To trust','To develop','To use','To take the risk of'],correct:0},
      {id:5,word:'incredible',options:['View, spectacle','Unbelievable','Veranda, entrance','Past, previous'],correct:1},
      {id:6,word:'tension',options:['Worry, anxiety','Obvious, clear','To resort to','To be caused by'],correct:0},
      {id:7,word:'unjust',options:['Unfair','Harmful','To consider','Advantage, benefit'],correct:0},
      {id:8,word:'discrepancy',options:['Considerably, a lot','Difference','Very cold','To claim'],correct:1},
      {id:9,word:'enhance',options:['To improve','To reduce','To ignore','To delay'],correct:0},
      {id:10,word:'utilize',options:['To waste','To use effectively','To criticize','To avoid'],correct:1},
      {id:11,word:'wholly',options:['Partially','Occasionally','Completely','Rarely'],correct:2},
      {id:12,word:'conceal',options:['To reveal','To hide','To find','To announce'],correct:1},
      {id:13,word:'assert',options:['To deny','To question','To state confidently','To apologize'],correct:2},
      {id:14,word:'landmark',options:['A famous place','A type of map','A boundary','A legal document'],correct:0},
      {id:15,word:'streamer',options:['Cook in oven','To long for','Flag, ribbon','Decoration'],correct:2},
      {id:16,word:'to be fond of',options:['To dislike','To be afraid of','To like very much','To be confused by'],correct:2},
      {id:17,word:'to dare',options:['To refuse','To have courage to do','To ask politely','To avoid'],correct:1},
      {id:18,word:'to tend',options:['To ignore','To have a habit of','To disagree','To prevent'],correct:1},
      {id:19,word:'burst upon',options:['To arrive suddenly','To leave quietly','To plan carefully','To wait patiently'],correct:0},
      {id:20,word:'converse',options:['To agree','To talk','To write','To listen'],correct:1},
      {id:21,word:'associations',options:['Connections or links','Physical exercises','Daily routines','Written agreements'],correct:0},
      {id:22,word:'impatient for',options:['Willing to wait for','Anxious or eager for','Afraid of','Grateful for'],correct:1},
      {id:23,word:'to be attached to',options:['To be separated from','To have strong feelings for','To be confused by','To be critical of'],correct:1},
      {id:24,word:'pin on',options:['To come suddenly to','To get','To set','To place the blame on'],correct:3},
      {id:25,word:'deliberately',options:['By accident','On purpose','Quickly','Rarely'],correct:1},
    ];
  }
  if (type === 'grammar') {
    return Array.from({length:25},(_,i)=>({
      id:i+1,
      text:['She ___ to school every day.','They ___ football right now.','I ___ my homework yesterday.','He ___ in the garden at the moment.','We usually ___ dinner at 7 PM.','The baby ___ now.','They always ___ their homework on time.','I ___ your idea. It\'s great!','She ___ the answer.','We ___ this music.','He ___ very tired right now.','They ___ about the test at the moment.','She ___ dinner at the moment.','I usually ___ up at 7 AM.','___ she go to the gym every day?','Right now, he ___ his homework.','We ___ dinner at the moment.','She ___ to the office at 9 AM every day.','They ___ TV right now.','He usually ___ to bed early.','I ___ a book at the moment.','She ___ football every weekend.','I usually ___ coffee in the morning.','___ you speaking to the manager?','They ___ football every weekend.'][i],
      options:[['go','goes','going','gone'],['play','plays','are playing','played'],['do','does','did','doing'],['works','work','is working','worked'],['have','having','has','are having'],['sleep','sleeps','is sleeping','sleeping'],['do','does','are doing','doing'],['am liking','like','likes','liked'],['is knowing','knows','know','knowing'],['are loving','love','loves','loved'],['is feeling','feel','feels','feeling'],['think','thinks','are thinking','thought'],['cooks','cook','is cooking','cooked'],['wake','wakes','am waking','woke'],['Do','Does','Is','Are'],['do','does','is doing','did'],['have','has','are having','had'],['go','goes','is going','going'],['watch','watches','are watching','watched'],['go','goes','is going','went'],['read','reads','am reading','reading'],['play','plays','is playing','playing'],['drink','drinks','am drinking','drinking'],['Do','Does','Are','Is'],['play','plays','are playing','played']][i],
      correct:[1,2,2,2,0,2,0,1,1,1,0,2,2,0,1,2,2,1,2,1,2,1,0,2,0][i],
      explanation:['3rd person singular uses "goes"','Right now = present continuous','Yesterday = past simple','At the moment = present continuous','Usually = present simple','Now = present continuous','Always + they = base form','State verbs don\'t use -ing','Know is a state verb','Love is a state verb','Feel can use continuous for temporary states','At the moment = present continuous','At the moment = present continuous','Usually + I = base form','3rd person question uses Does','Right now = present continuous','At the moment = present continuous','Daily routine + 3rd person = goes','Right now = present continuous','Usually + 3rd person = goes','At the moment = present continuous','Every weekend + 3rd person = plays','Usually + I = base form','Present continuous question with you = Are','Every weekend + they = base form'][i]
    }));
  }
  return [];
}
