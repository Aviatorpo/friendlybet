# Practice Artifact: QA Release Risk Worksheet

Owner: QA And Release

Use before shipping app code, scoring changes, generated data, public copy, or provider behavior.

## Change Summary

- Change:
- Files/surfaces:
- Product intent / acceptance criteria:
- User flows:
- Data flows:
- App-code version bump required:

## Shift-Left Review

- Spec gaps or ambiguity:
- Missing states:
- Hidden dependencies:
- Acceptance criteria revisions needed:

## Risk Map

- Scoring:
- Locking/reopen:
- Persistence:
- Provider/fallback:
- RLS/privacy:
- Public sharing:
- Hebrew/English/RTL:
- PWA/cache:
- Dirty worktree:

## Tests

Testing-pyramid choice:

- Domain/unit:
- Integration/data:
- UI/visual:
- Manual:

Commands:

```powershell

```

Manual checks:

-

Grey-box evidence checked:

- Code path:
- DB rows / snapshots:
- Workflow logs:
- Browser/network:
- Production artifact:

Skipped checks and reason:

-

## Decision

- Ship, revise, or block:
- Evidence:
- Remaining risk:
- Required follow-up:

## Pass Gate

- Test depth matches blast radius.
- QA challenged spec/state gaps before release approval.
- Automation level matches the risk and avoids brittle/noisy coverage.
- Serious failures include grey-box evidence, not only symptoms.
- Blocking issues have reproduction steps.
- App-code version status is explicit.
- Unrelated dirty work is not reverted or hidden.
