<div align="center">

<img src="./friendlybet-banner-hd.png" alt="FriendlyBet Live — Free, Open-Source, Privacy-First World Cup 2026 Prediction Pool" width="100%" />

# FriendlyBet Live ⚽🚀

### A 100% Free, Open-Source (MIT), and Privacy-First World Cup 2026 Prediction Pool Application.

**Built with pure Vanilla JavaScript and Supabase.** Pick the groups, build your bracket, climb the live leaderboard, win the bragging rights.

<br/>

[![Live](https://img.shields.io/badge/▶_Live-friendlybet.live-d9b46a?style=for-the-badge)](https://friendlybet.live)
[![Version](https://img.shields.io/badge/version-2.6.25-d9b46a?style=for-the-badge)](https://friendlybet.live)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://friendlybet.live)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)
[![JavaScript](https://img.shields.io/badge/Vanilla_JS-zero_frameworks-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](#-technical-architecture--privacy-blueprint)
[![i18n](https://img.shields.io/badge/i18n-English_%2B_Hebrew-d9b46a?style=flat-square)](#-multilingual)

<br/>

**⭐ Enjoying FriendlyBet? [Give it a star](https://github.com/Aviatorpo/friendlybet) to help other football fans find it!**

### 👉 [**Play now at friendlybet.live**](https://friendlybet.live) 👈

</div>

---

## 🤔 Why FriendlyBet?

**FriendlyBet Live ([friendlybet.live](https://friendlybet.live)) is a non-commercial, open-source hobby project** built for one reason: to make running an office, family, or group World Cup 2026 prediction pool genuinely fun and completely free. It is an independent project and is not affiliated with any other similarly named commercial service (e.g. `friendlybet.org`).

Unlike legacy or ad-supported prediction platforms, FriendlyBet was never designed to monetize your attention or your data. There is nothing to buy, no money handled inside the app, and nothing tracking you across the web.

| | FriendlyBet Live | Typical commercial alternatives |
|:--|:--:|:--:|
| **Price** | 100% free, forever | Freemium / paid tiers |
| **Sign-up** | ❌ None required | ✅ Email / phone / OAuth |
| **Ads & trackers** | ❌ Zero | Often ad-supported |
| **Source code** | ✅ Open (MIT) | Usually closed |
| **Real money** | ❌ Never | Sometimes |

**What makes it different, in one breath:**

- **🚫 Zero signups / registration** — pick a nickname and play. No email, no phone, no OAuth.
- **🚫 No ads. No trackers. No analytics SDKs.** Nothing follows you around.
- **🆓 Genuinely free & non-commercial** — a hobby project, MIT-licensed, no paid tiers.
- **🎯 Predict the whole tournament** — group standings, the full FIFA-format knockout bracket, and the Golden Boot.
- **🔥 Optional Underdog Multiplier** — pool creators can switch on a risk multiplier so calling an upset is worth more. Reward the bold predictions, not just the safe ones.
- **🌍 Bilingual** — full Hebrew + English with native RTL support.

> No money changes hands inside the app. Any friendly side bets stay between friends, outside the platform.

---

## ✨ Features

### 🎲 Predict the entire tournament, your way
- **Group stage** — rank all four teams in each of the 12 groups.
- **Knockout bracket** — build the full Round of 32 → Final, exactly as the official FIFA 2026 format works.
- **Top scorer** — call the Golden Boot winner for bonus points.
- **Your bracket, your logic** — the knockout tree is built from *your* group predictions, so it is a true test of your own forecast.

### 🏅 Smart, transparent scoring
- **Doubling knockout progression** — R32 = 2 pts, R16 = 4, QF = 8, SF = 16, Final = 32. Harder, later calls are rewarded proportionally to the odds.
- **Group points** — 4 / 3 / 2 / 1 points per correctly placed position.
- **Third-place bonus** — predict which of the best third-placed teams advance.
- **Optional Underdog / risk multiplier** — pool creators can reward predicted upsets with multiplied points.
- **Automatic & fair** — results sync and scores recalculate on a schedule. No manual tallying, no arguments.

### 👥 Built for groups
- **One-tap invites** — share a join link or short pool code via WhatsApp or Telegram.
- **Live leaderboard** — see exactly where you rank, with a per-stage points breakdown for every player.
- **Private pools** — your league, your friends, your rules.

### 📱 Installable PWA
- **Works like a native app** — add it to your home screen on iOS or Android.
- **Mobile-first** — a premium dark + gold interface tuned for the phone in your hand.
- **Offline-aware** — a service worker caches the app so it loads instantly.

---

## 🏛️ Technical Architecture & Privacy Blueprint

FriendlyBet is deliberately engineered to be **lean, transparent, and privacy-preserving by design** — not by policy. The architecture itself is the privacy guarantee.

### Frontend — blazing-fast Vanilla JavaScript
- **Zero bloated frameworks.** No React, no Vue, no bundler, no build step — just hand-crafted HTML, CSS, and modern Vanilla JS served as static files.
- **Loads instantly** and is trivially auditable: open `app.js` and read exactly what runs.
- **PWA supported** — an offline-first service worker with a versioned cache makes it installable and app-like.

### Backend / Database — Supabase with strict Row-Level Security
- Data lives in **Supabase (PostgreSQL)**, accessed directly from the client over HTTPS using the public anon key.
- **Row-Level Security (RLS) is enforced on every table.** Access is gated by database policies, so the client can only ever read and write what it is explicitly permitted to.
- No bespoke server to compromise — the security model is declared in the database.

### Authentication — client-side keys, hashed before they ever leave the browser
- There are **no passwords and no personally identifiable information (PII)**. No email, no phone number, no real name.
- Account access uses a **16-character recovery key** (formatted `XXXX-XXXX-XXXX-XXXX`) generated **entirely client-side**.
- That key is hashed with **SHA-256** in the browser (`crypto.subtle.digest('SHA-256', …)`) **before** anything touches the database — only the hash is ever stored or transmitted. The plaintext key never enters our system.
- Joining a pool uses a short, shareable pool code; your recovery key is your private way back in.

```
┌─────────────────────────────────────────────┐
│  Browser (PWA)                                │
│  index.html · app.js · styles.css · i18n.js   │
│  Service Worker (offline cache)               │
│  recovery key ──SHA-256──▶ hash (client-side) │
└──────────────────┬──────────────────────────┘
                   │  HTTPS (anon key)
                   ▼
┌─────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Row-Level Security)   │
│  pools · users · picks · matches · players    │
│  stores only the SHA-256 hash — no PII        │
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
| `i18n.js` | Hebrew + English translations (RTL aware) |
| `config.js` | Supabase URL + public anon key + app version |
| `service-worker.js` | PWA offline cache (versioned) |
| `scripts/` | Match / player sync + score calculation |
| `.github/workflows/` | Scheduled GitHub Actions |
| `migrations/` | SQL schema migrations |

---

## 🚀 Deployment & Self-Hosting

Because FriendlyBet is **pure static files with no build step**, you can clone, inspect, or self-host it in about 30 seconds on Vercel, Netlify, GitHub Pages, or any static host.

```bash
# 1. Clone the repository
git clone https://github.com/Aviatorpo/friendlybet.git
cd friendlybet

# 2. Run it locally (any static server works — pick one)
npx serve .
# or:  python -m http.server 8000
```

To point it at **your own** backend:

1. **Create a free Supabase project** at [supabase.com](https://supabase.com).
2. **Apply the schema** — open the Supabase SQL editor and run the migration files in [`migrations/`](./migrations) in order (they are idempotent and safe to re-run).
3. **Set your keys** — edit [`config.js`](./config.js) with your Supabase **project URL** and **public anon key** (the anon key is meant to be public; RLS protects the data).
4. **Deploy** — push to a Vercel/Netlify project (or any static host). On Vercel it auto-deploys from `main`; there is nothing to build.

> That is it — no server, no containers, no secrets beyond a public anon key. The official instance lives at [friendlybet.live](https://friendlybet.live) (also reachable at [friendlybet.vercel.app](https://friendlybet.vercel.app)).

---

## 🌍 Multilingual

- **Hebrew & English**, switchable on the fly.
- **Geo-aware** — Israeli visitors are greeted in Hebrew automatically; everyone else gets English.
- **Full RTL support** for a native Hebrew experience.

---

## 📜 License

Released under the **[MIT License](./LICENSE)** — free to use, modify, and distribute.

FriendlyBet is a non-commercial hobby project. It does not facilitate real-money gambling; predictions are for fun and bragging rights only.

---

<div align="center">

<img src="./icon-192.png" alt="FriendlyBet" width="72" />

**FriendlyBet Live** — the free, open-source, privacy-first World Cup 2026 prediction pool.

🇮🇱 Built with ❤️ for the football community.

</div>
