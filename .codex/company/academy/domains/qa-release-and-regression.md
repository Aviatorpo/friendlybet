# QA Release And Regression

Owner: QA And Release  
Primary consumers: Engineering, Product, Content, Sports Rules, CEO

## QA Senior Bar

QA does not merely ask whether tests passed. QA identifies where FriendlyBet can embarrass itself: wrong scores, wrong locks, wrong winner, stale content, broken Hebrew/RTL, leaked data, or stale PWA cache.

Senior QA is a strategic quality partner:

- Shift left: review product definitions, PRDs, acceptance criteria, state matrices, and sports-rule assumptions before implementation.
- Challenge logic: point out contradictions, unhandled states, ambiguous copy, untestable promises, missing rollback/replay paths, and hidden dependencies.
- Own smart automation: use the testing pyramid deliberately instead of creating brittle end-to-end scripts for every concern.
- Debug grey-box: inspect code, generated artifacts, Supabase rows, public snapshots, workflow logs, browser/network state, and production URLs when the risk demands it.
- Lead without formal authority: convert vague risk into reproducible evidence, mentor other departments on quality, and make crisp ship/revise/block decisions under pressure.

## Highest-Risk Areas

- Scoring and ranking.
- Locking and reopen flows.
- Prediction persistence.
- Third-place and Annex C logic.
- Knockout `winner_code`.
- Provider sync and fallback data.
- RLS and public share surfaces.
- Hebrew/English copy consistency.
- Service worker cache/versioning.
- Dirty worktree separation.

## Test Map

Use existing focused scripts before inventing a new harness:

- `node scripts/test-scoring.js`
- `node scripts/test-sync-transform.js`
- `node scripts/test-fifa-bracket.js`
- `node scripts/test-third-place-allocation.js`
- `node scripts/test-world-cup-stories.js`
- Relevant verifier tests when match-final logic changes.

Automation architecture rule:

- Prefer deterministic domain/unit tests for scoring, locks, source transforms, and rules.
- Use integration/API-style tests for Supabase boundaries, generated snapshots, workflow inputs, and provider/source bridge behavior.
- Use Playwright/browser or visual checks only for user-critical journeys, mobile/RTL/text-fit, PWA cache behavior, and screens where DOM/canvas/layout matters.
- Avoid automation that is expensive, flaky, duplicate, or disconnected from a real user/release risk.

## Manual Review Map

For user-facing changes:

- Mobile layout.
- RTL Hebrew and LTR English.
- Text fit in compact controls.
- Dashboard/Pundit/story freshness.
- Public share page and OG card when sharing changes.
- Offline/PWA update behavior when cached assets change.

## QA Handoff Requirements

QA must receive:

- What changed.
- Product intent and acceptance criteria.
- Which user/data flow it touches.
- Which sports rule or content assumption is involved.
- Which provider/current fact is involved.
- Which files changed.
- Which tests were run or skipped.
- Which logs/DB rows/public artifacts/prod URLs were inspected when debugging.
- Known residual risk.

## Blocking Conditions

QA can block release when:

- Product/spec gaps make the intended behavior ambiguous or untestable.
- Scoring/locking behavior changed without meaningful tests.
- App code changed without version bump discipline.
- Sports rule is unverified.
- Public copy is misleading or legally risky.
- Share/public data exposure is unclear.
- Dirty unrelated work makes validation ambiguous.
- Automation is brittle/noisy enough to create false confidence or alert fatigue.

## Bad QA

- "Looks risky" without a reproduction path.
- Checking only happy path after scoring or lock changes.
- Ignoring Hebrew/RTL/mobile.
- Treating generated data as correct without checking source.
- Approving app code without cache/version awareness.
- Writing automation because it is possible, not because it reduces meaningful release risk.
- Waiting until the end to object to a spec gap that should have been caught during product definition.
