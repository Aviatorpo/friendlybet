# Decision: Live Result Reliability Lessons

Date: 2026-06-30

## Context

During World Cup knockout result recovery, Eyal had to provide match truth manually, workflows produced noisy failures, and early plans over-trusted GitHub Actions, raw `winner_code`, future total-score precomputation, and too-short production proof windows.

## Decision

FriendlyBet treats live results, scoring, leaderboard publication, and match display as a production operation, not as a best-effort script.

Required defaults:

- Human-match-desk logic first: official source, corroborating reliable sources when needed, verified knockout advancement, then automated scoring/publication.
- No Eyal-in-loop match truth in normal operation. Manual result entry is a break-glass incident, not product design.
- No single point of failure across Action, runner, provider, field, scorer, snapshot, cache/deploy, alert, or human.
- Precompute per-match deltas or baseline-fingerprinted snapshots, not future totals across unresolved fixtures.
- False workflow failures are bugs. Public proof must account for Vercel/CDN propagation; warning-only content debt must not block scoring.
- Production done means cache-busted live public data or live app proof, plus current workflow evidence when workflows were part of the problem.

## Future Trigger

Apply this decision automatically to any request involving live sports results, scoring, fixtures, leaderboards, match display, GitHub Actions noise, production proof, company planning, or agent professionalism.
