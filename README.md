# 🏆 FriendlyBet: World Cup 2026 Edition

FriendlyBet is a privacy-first, zero-friction social prediction platform for the World Cup 2026. Built with a "Kahoot-style" onboarding and an underdog-multiplier scoring system.

## 📖 Project Documentation
The full technical requirements (PRD) can be found in the link below.

### Core Features:
- **Blind OAuth:** Total anonymity (SHA-256 Hashing).
- **Underdog Multipliers:** x1.5 or x2.0 points for choosing weaker teams.
- **Top Scorer Module:** Pick the tournament golden boot.
- **RTL/LTR Support:** Native Hebrew & English support.

## 🛠 Tech Stack
- **Frontend:** Next.js (Static)
- **Backend:** Cloudflare Workers
- **Database:** Cloudflare KV

## 🚦 Getting Started for Developers
1. Clone the repo.
2. Run `npm install`.
3. Check the `public/results.json` for the data structure.
