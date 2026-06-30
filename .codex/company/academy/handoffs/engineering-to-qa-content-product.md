# Handoff: Engineering To QA, Content, And Product

Use this whenever Engineering changes app behavior, data contracts, generated data, provider sync, scoring, or cached assets.

## Engineering Must Provide

- Files changed.
- User flow affected.
- Architecture boundary or data contract changed, if any.
- Data/schema/RLS impact.
- Consistency model, snapshot/public-data impact, and stale/partial-write recovery.
- Performance, security, and observability assumptions.
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
- Logs, DB rows, generated snapshots, workflow outputs, or other grey-box proof QA should inspect.
- Failure mode to simulate or reason through, especially stale data, partial writes, provider disagreement, or rollback.
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
- User-safe degraded state when data, deployment, or recovery is delayed.

## Bad Handoff

- "Implemented" with no affected flow.
- Tests listed but not tied to risk.
- Contract, consistency, or observability impact left implicit.
- No mention of version bump for cached app code.
- Content unaware of a data field changing or disappearing.
