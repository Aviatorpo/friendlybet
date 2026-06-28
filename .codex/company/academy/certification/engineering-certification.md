# Engineering Certification

Applies to: Head of Engineering, Platform Architect, Frontend PWA Engineer, Data And Scoring Engineer, Sports Integrations Engineer, engineering sub-agents.

## Required Study

- `../00-company-induction.md`
- `../01-app-deep-dive.md`
- `../domains/world-cup-2026-rules-and-format.md`
- `../domains/engineering-maintainer-handbook.md`
- `../handoffs/sports-rules-to-engineering-qa-content.md`
- `../handoffs/engineering-to-qa-content-product.md`

## Practical Exam

Scenario: A verified World Cup rule affects third-place qualification or knockout seeding.

A near-autonomous senior engineering agent must produce:

- Exact app/data surfaces affected.
- Whether change is UI, scoring, DB, provider sync, generated data, or cache.
- Official-rule verification status.
- Implementation plan following existing patterns.
- RLS/migration impact, if any.
- Tests to run or add.
- Version bump status.
- QA handoff.
- Content/Product handoff.
- Rollback path.

## Pass Criteria

- Uses `../../../../docs/FAST-CODEMAP.md` and targeted `rg`.
- Protects prediction state.
- Uses `winner_code` and `predicted_winner` correctly.
- Keeps FIFA-specific complexity scoped.
- Adds deterministic tests when scoring or bracket logic changes.
- Avoids new provider cost without FinOps.

## Fail Criteria

- Broad rewrite without need.
- Scoring change without tests.
- Rule encoded from unverified source.
- App code change without cache/version thinking.
- RLS or public data surface ignored.
