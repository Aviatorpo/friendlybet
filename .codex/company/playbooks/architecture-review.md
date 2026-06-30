# Playbook: Architecture Review

Use this for schema, scoring, app architecture, data provider, automation, or performance decisions.

## Steps

1. Read `docs/FAST-CODEMAP.md` before scanning large files.
2. Locate existing anchors with targeted `rg`.
3. Preserve the static-first architecture unless there is a strong reason to add server runtime.
4. Keep scoring deterministic and idempotent.
5. Keep public reads on CDN snapshots where possible.
6. Avoid wiping in-memory prediction state before DB operations finish.
7. Keep RLS and privacy constraints explicit.
8. Prefer small reversible changes with clear tests.
9. Keep the critical path isolated: verified results, scoring, leaderboard snapshots, lock/open state, and match display must not await, import, validate, deploy, or depend on optional Pundit, Stories, banter, share copy, social, or visual-polish work.
10. For tournament-aware UI, prefer one explicit state resolver or shared state model over screen-local assumptions. The model must cover tournament phase, pool mode, lock/open state, prediction completion, scoring/publication, and stale snapshot/provider states.
11. For live result/scoring architecture, reject single points of failure: one Action, one provider, one field, one scorer path, one snapshot path, one cache/deploy layer, one alert, or one human.
12. Treat sports-result fields as derived evidence. Validate resolved advancement against teams, score, stage, penalties/extra time, source consensus, and contradiction rules before scoring.
13. Precompute scenario deltas or baseline-fingerprinted snapshots only. Do not precompute future total scores across unresolved earlier fixtures.
14. State the technology-selection tradeoff. If the existing static/modular path is not enough, justify any new service, queue, cache, framework, provider, cloud resource, or persistent worker with user value, cost, owner, rollback, and maintenance burden.
15. Define the domain contract. Name which module owns the fact, who reads it, how it is written, whether consistency is strong or eventual, and how stale or partial state is detected.
16. For DB/data changes, cover read/write shape, Supabase row limits, indexing/query risk, migration/RLS impact, generated snapshots, and public/private data boundaries.
17. For production-facing paths, cover performance, security, observability, alert semantics, degraded UX, replay/recovery, and proof after deployment when user-visible.
18. Add a short ADR/decision note when changing architecture boundaries, provider strategy, state machines, data contracts, or release-critical workflows.

## Output

Return:

- Architecture recommendation
- Files likely touched
- Data model impact
- Domain contract and technology tradeoff
- Migration/RLS impact
- Performance/security/observability impact
- Test plan
- Rollback/fallback plan
