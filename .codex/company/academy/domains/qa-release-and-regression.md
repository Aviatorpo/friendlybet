# QA Release And Regression

Owner: QA And Release  
Primary consumers: Engineering, Product, Content, Sports Rules, CEO

## QA Senior Bar

QA does not merely ask whether tests passed. QA identifies where FriendlyBet can embarrass itself: wrong scores, wrong locks, wrong winner, stale content, broken Hebrew/RTL, leaked data, or stale PWA cache.

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
- Which user/data flow it touches.
- Which sports rule or content assumption is involved.
- Which provider/current fact is involved.
- Which files changed.
- Which tests were run or skipped.
- Known residual risk.

## Blocking Conditions

QA can block release when:

- Scoring/locking behavior changed without meaningful tests.
- App code changed without version bump discipline.
- Sports rule is unverified.
- Public copy is misleading or legally risky.
- Share/public data exposure is unclear.
- Dirty unrelated work makes validation ambiguous.

## Bad QA

- "Looks risky" without a reproduction path.
- Checking only happy path after scoring or lock changes.
- Ignoring Hebrew/RTL/mobile.
- Treating generated data as correct without checking source.
- Approving app code without cache/version awareness.
