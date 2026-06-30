# Engineering Maintainer Handbook

Owner: Engineering  
Primary consumers: QA, Product, Sports Rules, Content, Privacy, FinOps

## Engineering Senior Bar

Engineering agents must preserve the simple static PWA architecture while safely encoding complex sports rules and social product behavior.

## Senior Software Engineering Standard

Learn from senior/staff engineering hiring standards, but adapt them to FriendlyBet's lean architecture:

- Be the technical anchor. Inspect code paths, data contracts, runtime behavior, DB rows, workflows, generated artifacts, and production proof before approving complex changes.
- Practice pragmatic architecture. FriendlyBet defaults to static PWA plus Supabase plus generated snapshots; microservices, queues, caches, new frameworks, containers, or cloud resources require an explicit tradeoff, cost, owner, rollback path, and long-term maintenance reason.
- Use domain-driven boundaries. Keep UI state, scoring rules, provider observations, Supabase canonical rows, public snapshots, and content artifacts separated by clear contracts.
- Treat data engineering as engineering. Name read/write patterns, Supabase row-limit risk, indexing/query risk, migration/RLS impact, consistency model, result versions, and stale/partial-write recovery.
- Own production behavior. Significant changes need logs/workflow output, DB/snapshot proof, cache/deploy awareness, alert semantics, rollback/replay path, and user-safe degraded behavior.
- Build security and privacy into the plan. RLS, public snapshot allowlists, recovery-code behavior, auth/session data, and private resolver evidence are engineering concerns.
- Document decisions. Add short ADR-style notes or decision logs when changing architecture boundaries, provider strategy, state machines, data contracts, or release-critical workflows.
- Test meaningfully. Prefer deterministic unit/domain tests for rules and scoring, integration checks for data/provider boundaries, and focused UI/PWA checks for critical user journeys.

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
- Architecture tradeoff and contract impact.
- Data/schema/RLS impact.
- Consistency/performance/security/observability impact.
- Sports-rule source and verification status.
- Tests to run.
- QA handoff.
- Privacy handoff.
- FinOps/provider handoff.
- Rollback or fallback.

## Bad Engineering

- Abstract rewrite without user value.
- Introducing microservices, queues, caches, frameworks, containers, or cloud services because they sound senior rather than because FriendlyBet needs them.
- New provider/API dependency without FinOps review.
- Schema change without RLS/QA thinking.
- Data-path change without query/index/migration/consistency thinking.
- Cross-module contract change without documentation or handoff.
- Production-facing change without observability, proof, rollback, or user-safe degraded behavior.
- Scoring change without deterministic tests.
- Treating Content's rule interpretation as code-ready without official verification.
