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
- Knockout advancing team, including advancement after extra time or penalties.
- Penalty shootout score when available; useful for display/content, but not required for scoring if advancement is otherwise verified.
- Group/stage.
- Cards, substitutions, scorers, and lineups when used for content.
- Table and third-place standings.
- Official match reports for player participation and shirt numbers.

## Source Policy

Prefer:

1. Official FIFA match centre, schedule, regulations, and post-match PDFs.
2. Stable provider snapshots with clear terms and rate limits.
3. Reputable match reports for content scouting.
4. Automatic approved-source escalation for critical moments, with break-glass repair limited to runners/configuration rather than manual match truth.

Never rely on model memory for current match state.

For knockout finals, use a human-match-desk consensus model: check FIFA first; when FIFA is late, incomplete, or missing penalty/advancement detail, corroborate with multiple independent reliable match centers. Automatic scoring may proceed from FIFA final/advancement alone, or from strong multi-source agreement on final status and advancing team. Missing penalty shootout numbers should be backfilled later rather than blocking scoring when advancement is verified.

football-data.org is retired from final-result truth. Do not use it as a finished-match source, `winner_code` source, scoring input, or leaderboard-publication trigger.

## Architecture Preference

- Scheduled sync jobs.
- Cached public JSON snapshots.
- Break-glass repair scripts for critical final-result pipeline failures; ordinary result truth still comes from FIFA or approved source-family consensus.
- No provider calls in ordinary user request paths.
- Deterministic transformation tests.
- Raw source observation ledger plus deterministic result resolver. Canonical fields such as `winner_code` should be resolved outputs with audit evidence, not blindly trusted provider fields.

## Provider Review

Before adding or expanding a provider:

- Terms/licensing.
- Rate limits.
- Cost at tournament peak.
- Reliability and update latency.
- Coverage of required fields.
- Failure behavior.
- Automatic fallback and break-glass repair path.

## QA Requirements

QA must cover:

- Provider unavailable.
- Stale data.
- Disagreement between local and external data.
- Knockout penalty winner via `winner_code`.
- Knockout advancement verified while penalty shootout score is missing.
- Provider/source disagreement on advancing team.
- Stale or contradictory `winner_code` residue.
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
- Treating one provider's `winner`, `winner_code`, or final-status field as truth without rule validation and source corroboration.
- Blocking user points because penalty shootout numbers are missing even though advancement is verified.
- Using live provider data in user request path.
- Publishing current facts from stale snapshots.
- Adding a provider without FinOps.
- Depending on manual result entry for critical match finalization instead of automatic approved-source consensus and safe-wait behavior.
