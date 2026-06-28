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

## Output

Return:

- Architecture recommendation
- Files likely touched
- Data model impact
- Migration/RLS impact
- Test plan
- Rollback/fallback plan
