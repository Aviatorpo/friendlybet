# FriendlyBet - Fast Agent Brief

Keep this file tiny. Details and anchors live in `docs/FAST-CODEMAP.md`; release history lives in `CHANGELOG.md`.

## Project

FriendlyBet is a free social World Cup 2026 prediction PWA for Hebrew/Israeli users, with English support. No money, just fun.

- Live: https://friendlybet.live
- GitHub: https://github.com/Aviatorpo/friendlybet
- Stack: static HTML, vanilla JS, CSS, Supabase PostgreSQL, Vercel.
- Auth: 16-char recovery codes, SHA-256 hashed.

## Always Start Here

1. Read `docs/FAST-CODEMAP.md` before scanning large files.
2. Use targeted `rg` searches instead of opening all of `app.js`, `styles.css`, `index.html`, or `i18n.js`.
3. Use `git status --short --untracked-files=no` for quick dirty checks.
4. Treat `Codex/`, `_codex_*`, `_stories_*`, `gindi/`, preview images, and scratch exports as local noise unless specifically requested.
5. Load the virtual company defaults from `.codex/company/charter.md` and `.codex/company/org-map.md`.

## Company Operating Model

- Eyal is Chairman; the FriendlyBet CEO is the default operating interface for broad, strategic, ambiguous, or end-to-end work.
- For company work, route through the relevant `.codex/skills/friendlybet-company-*` skills and only involve departments that add value.
- For meaningful plans, roadmaps, recovery paths, or implementation strategies, run `.codex/company/playbooks/full-company-planning-review.md` before presenting the plan: consider every department, involve relevant senior reviewers, synthesize disagreements, and recheck affected departments.
- Preserve the company values: free forever, open source, ad-free, tracker-free, privacy-first, no real-money gambling, lean/free-tier friendly operations.
- Ask Eyal only for chairman-level decisions: values, brand, legal/reputation risk, meaningful cost, irreversible choices, strategy, or personal taste.
- Use HR / Agent Excellence standards by default: truthful, proactive, low-ego, risk-aware, resource-disciplined, and clear about uncertainty.
- Update `.codex/company` only for reusable lessons, routing changes, role changes, or playbook improvements.

## Must Remember

- Reply to Eyal in English in FriendlyBet threads.
- For user-facing copy, update both Hebrew and English.
- When shipping app code, bump `config.js`, `service-worker.js`, and the `index.html` footer version together.
- Do not wipe in-memory prediction state before DB operations finish.
- `knockout_picks` stores picks in `predicted_winner`, not `team_code`.
- Knockout results should use `matches.winner_code`, not score comparison.
- Use the official FIFA Annex C table in `share-assets/fifa-third-place-table.js`.
- Do not revert unrelated dirty work.
