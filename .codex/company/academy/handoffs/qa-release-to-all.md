# Handoff: QA And Release To All Departments

Use this before shipping app code, scoring changes, generated data, public copy, or provider behavior.

## QA Must Provide

- Ship, revise, or block decision.
- Evidence.
- Tests run.
- Tests not run.
- Manual checks.
- Shift-left/spec gaps found, or why none were material.
- Automation level used: domain/unit, integration/data, UI/visual, or manual, with reason.
- Grey-box evidence checked: code, logs, DB rows, snapshots, browser/network, workflows, or production artifact.
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
- Automation list with no testing-pyramid rationale.
- Ship/block decision without grey-box evidence when deeper evidence was available.
- Ship decision without version/cache status.
- Ignoring unrelated dirty work that confuses validation.
