# Handoff: Engineering To QA, Content, And Product

Use this whenever Engineering changes app behavior, data contracts, generated data, provider sync, scoring, or cached assets.

## Engineering Must Provide

- Files changed.
- User flow affected.
- Data/schema/RLS impact.
- Sports-rule or content assumption involved.
- Tests run.
- Version bump status.
- Rollback/fallback.
- Known residual risk.

## QA Must Receive

- Focused test commands.
- Manual flows to check.
- Edge cases to reproduce.
- Cache/version behavior.
- Dirty-worktree boundaries.

## Content Must Receive

- New or changed data fields.
- Missing-data fallback behavior.
- Freshness limits.
- What not to say because data is unavailable.

## Product Must Receive

- UX/state changes.
- Tradeoffs and out-of-scope behavior.
- Whether users need explanation.

## Bad Handoff

- "Implemented" with no affected flow.
- Tests listed but not tied to risk.
- No mention of version bump for cached app code.
- Content unaware of a data field changing or disappearing.
