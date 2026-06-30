---
name: friendlybet-company-sports-rules
description: Model sports rules, event formats, prediction types, scoring implications, lock rules, data requirements, and provider constraints for FriendlyBet. Use when adding or comparing sports such as football, basketball, American football, tennis, tournaments, leagues, playoffs, brackets, weekly picks, or World Cup-specific logic.
---

# FriendlyBet Sports Rules

## Start Here

Read:

- `../../company/charter.md`
- `../../company/org-map.md`
- `../../company/agents/football-rules-analyst.md`
- `../../company/agents/multi-sport-rules-analyst.md`
- `../../company/agents/data-provider-scout.md`

Read playbooks only when relevant:

- `../../company/playbooks/new-sport-expansion.md`
- `../../company/playbooks/full-company-planning-review.md`
- `../../company/playbooks/live-scoring-operations.md` for World Cup group completion, final-result confidence, third-place timing, or scoring invariants.

Read academy docs when World Cup or cross-team rules knowledge matters:

- `../../company/academy/domains/world-cup-2026-rules-and-format.md`
- `../../company/academy/domains/world-cup-rules-one-source-of-truth.md`
- `../../company/academy/domains/world-cup-official-source-register.md`
- `../../company/academy/domains/data-provider-and-live-sports-operations.md`
- `../../company/academy/handoffs/sports-rules-to-engineering-qa-content.md`
- `../../company/academy/handoffs/provider-data-to-content-engineering-qa-finops.md`
- `../../company/academy/certification/sports-rules-certification.md`

## Workflow

1. Describe the real competition format before suggesting UI or schema.
2. Separate participants, schedule, prediction types, lock rules, results, and scoring.
3. Keep FIFA/football-specific rules out of generic sport templates unless named.
4. Identify provider data needs and free-tier/license risks.
5. Hand off implementation to Engineering and user-facing simplification to Product/Design.
6. During group-completion and knockout-opening incidents, keep the rule boundary explicit: verified terminal fixtures and official advancement determine scoring/bracket readiness, with `winner_code` only as the resolved stored output; Story/Pundit/social readiness is not a sports-rule dependency.
7. For tournament-aware plans, enumerate the competition phases and phase transitions that affect user state: before tournament, group stage, group completion, each knockout round active/complete, and final completion.
8. During planning dialogue, shape any plan that touches sports formats, scoring, locks, advancement, provider data, phase transitions, or official-vs-derived results before implementation starts.
9. Reject fast plans that skip rule boundaries, phase transitions, or official-vs-derived result semantics. Sports correctness is not optional because a shorter answer would be easier.
10. Treat extra time and penalties as normal knockout states. The scoring-critical fact is verified advancement; penalty shootout numbers improve display/content but should not block points when advancement is safely verified.
11. Do not treat a provider's winner field or stored `winner_code` as sports truth without rule validation. Sports Rules must define what makes the result safe: fixture identity, teams, stage, final/awarded state, score, result method when known, and advancing team.

## Output

Return sport format model, phase/state transitions, prediction types, scoring/lock implications, provider notes, and edge cases.
