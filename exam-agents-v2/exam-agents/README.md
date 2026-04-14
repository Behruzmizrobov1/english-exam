# English Exam Platform v2 — 3 AI Agent arxitekturasi

## Agent arxitekturasi

```
FOYDALANUVCHI (brauzer)
       │
       │  /api/validate  (Grammar / Reading / Listening)
       ▼
┌─────────────────────────────┐
│  AGENT 2 — VALIDATOR        │  ← api/validate.js
│  • AI dan savol so'raydi    │
│  • JSON formatni tekshiradi │
│  • 3 marta qayta urinadi    │
│  • Xato bo'lsa fallback     │
└──────────────┬──────────────┘
               │  Anthropic API
               ▼
┌─────────────────────────────┐
│  AGENT 1 — BACKEND          │  ← api/claude.js
│  • API kalitni himoya qiladi│
│  • Rate limit tekshiradi    │
│  • Xatolarni qayta ishlaydi │
└──────────────┬──────────────┘
               │
               ▼
         Anthropic API
         (claude-sonnet)

┌─────────────────────────────┐
│  AGENT 3 — HEALTH CHECK     │  ← api/health.js
│  • GET /api/health          │
│  • API kaliti bormi?        │
│  • Model javob berayaptimi? │
│  • JSON parse ishlayaptimi? │
└─────────────────────────────┘
```

## Loyiha tuzilmasi

```
english-exam-platform/
├── index.html          ← Frontend (UI)
├── api/
│   ├── claude.js       ← Agent 1: Backend proxy
│   ├── validate.js     ← Agent 2: Savol validator
│   └── health.js       ← Agent 3: Health check
├── vercel.json
└── package.json
```

---

## Deploy qilish (GitHub mavjud bo'lsa)

### 1. Faqat yangi fayllarni GitHub ga push qiling

```bash
# Mavjud loyihangiz papkasiga o'ting
cd your-project-folder

# Yangi fayllarni ko'chiring:
# api/claude.js   → yangi versiya (module.exports)
# api/validate.js → yangi Agent 2
# api/health.js   → yangi Agent 3
# index.html      → yangilangan
# vercel.json     → yangilangan

git add .
git commit -m "Add 3 AI agents, fix CommonJS export"
git push
```

Vercel avtomatik qayta deploy qiladi (1-2 daqiqa).

---

## Saytni tekshirish

Deploy bo'lgach, brauzerda oching:

```
https://english-exam-six.vercel.app/api/health
```

Bunday javob ko'rinsangiz — hammasi ishlayapti:
```json
{
  "overall": "ok",
  "checks": {
    "api_key": { "status": "ok" },
    "anthropic_api": { "status": "ok", "model": "claude-sonnet-4-..." },
    "grammar_generation": { "status": "ok", "sample": "She ___ to school..." }
  }
}
```

---

## Xatolar va yechimlari

| Xato | Sabab | Yechim |
|------|-------|--------|
| `overall: "fail"` + `api_key: fail` | ENV var yo'q | Vercel → Settings → Env Vars → ANTHROPIC_API_KEY qo'shing |
| `anthropic_api: fail` | API kaliti noto'g'ri | Anthropic console dan yangi kalit oling |
| Spinner aylanib qoladi | validate.js yuklanmagan | `git push` qilib, deploy ni kuting |
| Savollar chiqmaydi | JSON parse xatosi | Agent 2 fallback ishlatadi — ko'rish kerak: `overall: degraded` |

---

## Har bir Agent nima qiladi?

### Agent 1 — Backend (api/claude.js)
- Anthropic API ga xavfsiz ulanadi
- API kalitni foydalanuvchidan yashiradi
- `max_tokens` ni 4000 dan oshirmaslik

### Agent 2 — Validator (api/validate.js)
- Grammar, Reading, Listening savollarini AI dan oladi
- JSON ni 3 marta urinib parse qiladi
- Har savol to'g'ri formatda ekanligini tekshiradi:
  - `correct` 0-3 orasidami?
  - `options` 4 ta bormi?
  - `text` mavjudmi?
- Xato bo'lsa tayyor fallback savollar qaytaradi

### Agent 3 — Health Check (api/health.js)
- `GET /api/health` — sayt holatini tekshiradi
- API kaliti, model ulanishi, JSON generate — barchasini sinab ko'radi
- Muammo topilsa aniq xabar beradi
