<div align="center">

<img src="./friendlybet-banner-hd.png" alt="FriendlyBet — World Cup 2026 Predictions with Friends" width="100%" />

# 🏆 FriendlyBet

### The free, no-money, no-ads way to predict the World Cup 2026 with your friends.

Pick the groups. Build your bracket. Climb the leaderboard. Win the bragging rights.

<br/>

[![Live](https://img.shields.io/badge/▶_Live-friendlybet.live-d9b46a?style=for-the-badge)](https://friendlybet.live)
[![Version](https://img.shields.io/badge/version-2.6.25-d9b46a?style=for-the-badge)](https://friendlybet.live)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://friendlybet.live)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)
[![JavaScript](https://img.shields.io/badge/Vanilla_JS-zero_frameworks-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](#%EF%B8%8F-tech-stack)
[![i18n](https://img.shields.io/badge/i18n-English_%2B_Hebrew-d9b46a?style=flat-square)](#-multilingual)

<br/>

**⭐ Enjoying FriendlyBet? [Give us a star](https://github.com/Aviatorpo/friendlybet) to help other football fans find it!**

</div>

---

## 🎯 What is FriendlyBet?

**FriendlyBet** is a free, social prediction game for the **FIFA World Cup 2026**. Create a private pool, invite your friends with a 5-character code, and everyone predicts the tournament — group standings, the full knockout bracket, and the top scorer. As real results come in, scores are calculated automatically and a live leaderboard crowns the sharpest mind in your group.

No money changes hands inside the app. No ads. No sign-up forms. Just you, your friends, and a season of bragging rights on the line.

> **Built for the Israeli community**, fully bilingual in Hebrew and English — and ready for football fans anywhere.

<div align="center">

### 👉 [**Play now at friendlybet.live**](https://friendlybet.live) 👈

</div>

---

## ✨ Features

Everything you need to run a World Cup prediction league with your friends — polished, fast, and free.

### 🎲 Predict the entire tournament, your way
- **Group stage** — rank all four teams in each of the 12 groups.
- **Knockout bracket** — build the full Round of 32 → Final, exactly as the official FIFA 2026 format works.
- **Top scorer** — call the Golden Boot winner for bonus points.
- **Your bracket, your logic** — the knockout tree is built from *your* group predictions, so it's a true test of your own forecast.

### 🏅 Smart, transparent scoring
- **Doubling knockout progression** — each round you survive is worth more: R32 = 2 pts, R16 = 4, QF = 8, SF = 16, Final = 32. Harder, later calls are rewarded proportionally to the odds.
- **Group points** — 4 / 3 / 2 / 1 points per correctly placed position.
- **Third-place bonus** — predict which of the best third-placed teams advance.
- **Fully tunable** — pool creators can keep the balanced defaults or customize every scoring rule.
- **Automatic & fair** — results sync and scores recalculate on a schedule. No manual tallying, no arguments.

### 👥 Built for groups
- **One-tap invites** — share a join link or 5-character code via WhatsApp or Telegram.
- **Live leaderboard** — see exactly where you rank, with a per-stage points breakdown for every player.
- **Private pools** — your league, your friends, your rules.

### 🔒 Privacy-first, friction-free
- **No email. No phone. No registration.** You play behind a nickname.
- **Recovery codes** — a single 16-character code is your key back in. No passwords to forget.
- **No money handling** — any side bets happen between friends, outside the app.

### 📱 Installable PWA
- **Works like a native app** — add it to your home screen on iOS or Android.
- **Mobile-first design** — a premium dark + gold interface tuned for the phone in your hand.
- **Offline-aware** — a service worker caches the app so it loads instantly.

### 🌍 Multilingual
- **Hebrew & English**, switchable on the fly.
- **Geo-aware** — Israeli visitors are greeted in Hebrew automatically; everyone else gets English.
- **Full RTL support** for a native Hebrew experience.

---

## 🎮 How to play

<div align="center">

| | Step | What happens |
|:--:|:--|:--|
| **1** | **Create or join a pool** | Start your own league or join a friend's with a 5-character code. |
| **2** | **Pick a nickname & save your recovery code** | No email needed — your recovery code is your login. |
| **3** | **Invite your friends** | Send the join link via WhatsApp or Telegram with one tap. |
| **4** | **Make your predictions** | Rank the groups, build your knockout bracket, and call the top scorer. |
| **5** | **Climb the leaderboard** | Scores update automatically as results come in. Last one standing wins the bragging rights. |

</div>

You can edit your predictions anytime — right up until the tournament kicks off. Once the first match starts, picks lock in and the race is on.

---

## 🛠️ Tech Stack

FriendlyBet is deliberately built with **zero frontend frameworks** — just fast, hand-crafted vanilla web tech served as static files. It's lean, loads instantly, and has no build step.

| Layer | Technology |
|:--|:--|
| **Frontend** | Static HTML + Vanilla JavaScript + CSS (no frameworks, no bundler) |
| **Database** | Supabase (PostgreSQL) with Row-Level Security |
| **Hosting** | Vercel — auto-deploy from `main` |
| **Auth** | Recovery codes (16 characters, SHA-256 hashed) — no registration |
| **PWA** | Service worker with versioned cache for offline-first loading |
| **i18n** | Custom translation layer (`i18n.js`) — Hebrew + English, RTL aware |
| **Scoring** | Node scripts on GitHub Actions, scheduled via cron |
| **Live data** | Match & player feeds synced on a schedule |

### Architecture at a glance

```
┌─────────────────────────────────────────────┐
│  Browser (PWA)                                │
│  index.html · app.js · styles.css · i18n.js   │
│  Service Worker (offline cache)               │
└──────────────────┬──────────────────────────┘
                   │  HTTPS
                   ▼
┌─────────────────────────────────────────────┐
│  Supabase (PostgreSQL + RLS)                  │
│  pools · users · picks · matches · players    │
└──────────────────┬──────────────────────────┘
                   ▲
                   │  scheduled cron
┌──────────────────┴──────────────────────────┐
│  GitHub Actions                               │
│  match sync · player sync · score calculation │
└─────────────────────────────────────────────┘
```

### Project structure

| File / Folder | Purpose |
|:--|:--|
| `index.html` | Single-page app — every screen, stacked |
| `app.js` | All application logic & flow |
| `styles.css` | The complete premium dark + gold theme |
| `i18n.js` | Hebrew + English translations |
| `config.js` | Supabase keys + app version |
| `service-worker.js` | PWA offline cache |
| `scripts/` | Match/player sync + score calculation |
| `.github/workflows/` | Scheduled GitHub Actions |
| `migrations/` | SQL schema migrations |

---

## 🌐 Links

- **Live app:** [friendlybet.live](https://friendlybet.live) · [friendlybet.vercel.app](https://friendlybet.vercel.app)
- **Repository:** [github.com/Aviatorpo/friendlybet](https://github.com/Aviatorpo/friendlybet)

---

## 📜 License

Released under the **[MIT License](./LICENSE)** — free to use, modify, and distribute.

---

<div align="center">

<img src="./icon-192.png" alt="FriendlyBet" width="72" />

**FriendlyBet** — World Cup 2026 predictions with friends.

🇮🇱 Built with ❤️ for the football community.

</div>
