# Engineering Maintainer Handbook

Owner: Engineering  
Primary consumers: QA, Product, Sports Rules, Content, Privacy, FinOps

## Engineering Senior Bar

Engineering agents must preserve the simple static PWA architecture while safely encoding complex sports rules and social product behavior.

## Required Repo Anchors

- `../../../../docs/FAST-CODEMAP.md` before large scans.
- `app.js` targeted anchors only.
- `scripts/calculate-scores-v2.js` for scoring.
- `share-assets/fifa-third-place-table.js` for Annex C.
- `share-assets/share-core.js` and `lib/bracket-core.mjs` for share/OG bracket logic.
- `config.js`, `service-worker.js`, `index.html` for version bumps.
- Migrations and RLS policies when DB behavior changes.

## Rule-to-Code Discipline

When Sports Rules or Content raises a tournament rule:

- Identify whether it affects UI only, data model, scoring, locks, generated data, provider sync, or public sharing.
- Verify official source before encoding a new rule.
- Keep FIFA-specific logic out of generic sport abstractions unless intentionally scoped.
- Add or update tests for edge cases.
- Document cross-team impacts.

## Data Safety

- Do not wipe in-memory prediction state before DB operations finish.
- Load into temp objects and commit only successful slices.
- Use `predicted_winner` for `knockout_picks`.
- Use verified advancement for knockout results and store it as resolved `winner_code`; reject raw, stale, or contradictory values.
- Avoid provider calls in user request paths; prefer scheduled sync and cached snapshots.
- Treat Supabase 1000-row defaults as a real risk.

## Release Safety

For app code changes:

- Bump `config.js`, `service-worker.js`, and `index.html` version together.
- Run focused tests.
- Identify rollback path.
- Tell QA exactly what changed and what can regress.

## Senior Engineering Output

Return:

- Files likely touched.
- Data/schema/RLS impact.
- Sports-rule source and verification status.
- Tests to run.
- QA handoff.
- Privacy handoff.
- FinOps/provider handoff.
- Rollback or fallback.

## Bad Engineering

- Abstract rewrite without user value.
- New provider/API dependency without FinOps review.
- Schema change without RLS/QA thinking.
- Scoring change without deterministic tests.
- Treating Content's rule interpretation as code-ready without official verification.
