# English Test Platform

Listening · Reading · Grammar — 25 ta savol har bo'lim
AI (Claude Sonnet) tomonidan savollar yaratiladi.

---

## Loyiha tuzilmasi

```
english-exam-platform/
├── index.html          ← Asosiy frontend (barcha UI)
├── api/
│   └── claude.js       ← Vercel serverless function (API proxy)
├── vercel.json         ← Vercel konfiguratsiyasi
├── package.json
└── README.md
```

---

## Vercel ga deploy qilish (bosqichma-bosqich)

### 1. GitHub ga yuklang

```bash
# Git repozitoriy yarating
git init
git add .
git commit -m "Initial commit"

# GitHub da yangi repo yarating, keyin:
git remote add origin https://github.com/SIZNING_USERNAME/english-exam-platform.git
git push -u origin main
```

### 2. Vercel ga ulang

1. https://vercel.com ga kiring (GitHub bilan login)
2. "New Project" → GitHub reponzini tanlang
3. "Deploy" tugmasini bosing — avtomatik deploy bo'ladi

### 3. Anthropic API kalitini qo'shing (MUHIM!)

Vercel dashboard → Loyihangiz → **Settings** → **Environment Variables**

```
Name:  ANTHROPIC_API_KEY
Value: sk-ant-api03-xxxxxxxxxxxxxxxx...
```

"Save" → **Redeploy** qiling

### 4. Tayyor!

`https://LOYIHA_NOMI.vercel.app` — bu yerda ishlaydi.

---

## Lokal sinash

```bash
# Vercel CLI o'rnating
npm i -g vercel

# .env.local fayl yarating
echo "ANTHROPIC_API_KEY=sk-ant-api03-..." > .env.local

# Lokal ishga tushiring
vercel dev
# → http://localhost:3000
```

---

## Qanday ishlaydi

### Part 1 — Listening
- Mavzu va unit raqami kiritiladi
- 4 tagacha audio fayl yuklanadi
- AI (yoki namuna) 25 ta savol yaratadi:
  - **Part 2:** Bo'sh joy to'ldirish (hotel ma'lumotlari)
  - **Part 3 & 4:** Ko'p tanlovli savollar
  - **Part 5:** Hafta kunlari ↔ faoliyat moslash

### Part 2 — Reading
- Kitob PDFi yoki rasmi yuklanadi
- AI kitobdagi Vocabulary so'zlaridan savol oladi
- Format: `"pretext" — Choose the correct definition`

### Part 3 — Grammar
- Mavzular chiplar bilan tanlanadi
- Daraja (A1–B2) tanlanadi
- AI 25 ta gap to'ldirish savoli yaratadi
- Tekshirishda to'g'ri javob (yashil) va noto'g'ri (qizil) ko'rinadi + tushuntirish

---

## API narxi haqida

Claude Sonnet 4 ishlatiladi. Har bir test yaratish uchun taxminan:
- Grammar: ~$0.002
- Reading (PDFsiz): ~$0.002
- Listening: ~$0.003

Kuniga 100 test = ~$0.50 atrofida.

---

## Xavfsizlik

- API kaliti faqat serverda (`api/claude.js`) — foydalanuvchi ko'ra olmaydi
- `max_tokens: 4000` chegaralangan
- CORS sozlangan

---

## Muammolar bo'lsa

**"AI xatosi" ko'rinsa:**
- Vercel dashboard → Settings → Environment Variables → API kaliti to'g'ri kiritilganmi?
- Redeploy qilindi mi?

**Audio ishlamasa:**
- Browser audio ruxsatini tekshiring
- MP3 yoki WAV format ishlatilg'an

**PDF ishlamasa:**
- Rasm (JPG/PNG) sifatida yuklang — PDF dan ko'ra tezroq
