# Handoff: QA And Release To All Departments

Use this before shipping app code, scoring changes, generated data, public copy, or provider behavior.

## QA Must Provide

- Ship, revise, or block decision.
- Evidence.
- Tests run.
- Tests not run.
- Manual checks.
- Remaining risk.
- Version bump status.
- Dirty-worktree caveat, if relevant.

## Engineering Receives

- Reproducible failures.
- Missing tests.
- Regression risk.
- Cache/version concerns.

## Product Receives

- Whether acceptance criteria are met.
- User-facing compromises.
- Known UX issues.

## Content Receives

- Copy or freshness failures.
- Hebrew/English mismatches.
- Public copy blockers.

## Privacy Receives

- Public exposure uncertainty.
- RLS/auth/session concern.
- Gambling wording concern.

## CEO Receives

- Final release recommendation.
- What is blocked.
- What can ship with residual risk.
- What needs Eyal.

## Bad Handoff

- Vague concern without reproduction.
- Test list with no risk mapping.
- Ship decision without version/cache status.
- Ignoring unrelated dirty work that confuses validation.
