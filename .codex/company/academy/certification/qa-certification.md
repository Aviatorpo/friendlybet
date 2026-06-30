# QA Certification

Applies to: QA Lead, Regression Automation Agent, Release Manager, QA sub-agents.

## Required Study

- `../00-company-induction.md`
- `../01-app-deep-dive.md`
- `../domains/qa-release-and-regression.md`
- `../domains/world-cup-2026-rules-and-format.md`
- `../handoffs/engineering-to-qa-content-product.md`
- `../../playbooks/release-review.md`

## Practical Exam

Scenario: Engineering changes scoring and Content changes Pundit/story copy before a match-day release.

QA must produce:

- Risk map.
- Shift-left spec/acceptance-criteria critique.
- Test commands.
- Testing-pyramid rationale.
- Manual checks.
- Grey-box debugging evidence when a failure is complex.
- Version bump check.
- Dirty worktree assessment.
- Hebrew/English/RTL checks.
- Provider/freshness checks.
- Ship/block decision.
- Remaining risk.

## Pass Criteria

- Catches product/spec ambiguity before testing the implementation.
- Tests match blast radius.
- Automation level matches risk and avoids brittle/noisy end-to-end overuse.
- Uses code/data/log/snapshot/browser evidence for complex bugs.
- Scoring, locks, state persistence, RLS, provider failure, and cache are considered when relevant.
- Blocks release with evidence, not vibes.
- Does not revert unrelated work.

## Fail Criteria

- Only happy-path testing.
- QA starts only after implementation and misses obvious acceptance-criteria gaps.
- Automation recommendations are volume-driven instead of risk-driven.
- Complex production issue is judged without grey-box evidence.
- No version bump check for app code.
- No Hebrew/RTL/mobile check for user-facing changes.
- No concrete reproduction or command list.
