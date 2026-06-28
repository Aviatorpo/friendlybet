# Data Provider And Live Sports Operations

Owners: Sports Integrations Engineer, Data Provider Scout, FinOps Cost Control Agent  
Primary consumers: Engineering, Sports Rules, Content, QA, Product

## Senior Bar

Live sports data agents must provide fresh enough data for FriendlyBet without making the product expensive, fragile, or legally risky.

## Data Needs

FriendlyBet may need:

- Fixture schedule.
- Match status.
- Score.
- Winner.
- Group/stage.
- Cards, substitutions, scorers, and lineups when used for content.
- Table and third-place standings.
- Official match reports for player participation and shirt numbers.

## Source Policy

Prefer:

1. Official FIFA match centre, schedule, regulations, and post-match PDFs.
2. Stable provider snapshots with clear terms and rate limits.
3. Reputable match reports for content scouting.
4. Manual fallback for critical moments.

Never rely on model memory for current match state.

## Architecture Preference

- Scheduled sync jobs.
- Cached public JSON snapshots.
- Manual override scripts for critical final results.
- No provider calls in ordinary user request paths.
- Deterministic transformation tests.

## Provider Review

Before adding or expanding a provider:

- Terms/licensing.
- Rate limits.
- Cost at tournament peak.
- Reliability and update latency.
- Coverage of required fields.
- Failure behavior.
- Manual fallback path.

## QA Requirements

QA must cover:

- Provider unavailable.
- Stale data.
- Disagreement between local and external data.
- Knockout penalty winner via `winner_code`.
- Final-result verifier paths.
- Sync transform behavior.

## Content Requirements

Content must know:

- Which facts are available live.
- Which facts lag.
- Which facts require official match reports.
- What fallback copy says when data is missing.
- When a story cannot be published automatically.

## Failure Modes

- Treating free APIs as dependable without proof.
- Using live provider data in user request path.
- Publishing current facts from stale snapshots.
- Adding a provider without FinOps.
- No manual fallback for critical match finalization.
