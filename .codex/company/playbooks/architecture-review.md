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

## Output

Return:

- Architecture recommendation
- Files likely touched
- Data model impact
- Migration/RLS impact
- Test plan
- Rollback/fallback plan
