# Handoff: Provider Data To Content, Engineering, QA, And FinOps

Use this when live/current sports data is needed or changed.

## Provider/Data Team Must Provide

- Source name and type.
- Fields available.
- Update frequency.
- Rate limits.
- Cost.
- License/terms concern.
- Failure modes.
- Automatic fallback and break-glass repair boundary.
- Freshness guarantee, or explicit lack of guarantee.

## Content Needs

- Which facts are safe to say.
- Which facts require official confirmation.
- How stale data is detected.
- Fallback copy when data is missing.

## Engineering Needs

- Endpoint/format.
- Transform rules.
- Cache/snapshot path.
- Error handling.
- Whether user request path is affected.

## QA Needs

- Stale provider case.
- Disagreement case.
- Missing field case.
- Rate-limit case.
- Break-glass repair case, without manual result truth as the normal path.

## FinOps Needs

- Peak tournament cost estimate.
- Calls per day.
- Free-tier risk.
- Cheaper alternative.
- Approval requirement.

## Bad Handoff

- "Use API X" with no terms or rate limit review.
- No automatic approved-source fallback/safe-wait path for live match finalization.
- Content assumes data is real-time when it is cached.
- Engineering stores fields the product does not need.
