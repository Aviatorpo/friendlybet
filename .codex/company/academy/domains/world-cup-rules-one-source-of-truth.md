# World Cup Rules One Source Of Truth

Owner: Sports Data And Rules  
Primary consumers: Content, Engineering, QA, Product, Design, FinOps, Pundit

This is the operational rule table agents must consult before claiming, coding, testing, or publishing World Cup 2026 format and discipline details.

Source register: `world-cup-official-source-register.md`

## Status Model

- Official-source-backed: an official FIFA or IFAB/FIFA page has been inspected and recorded.
- Local-tested authority: FriendlyBet has a local implementation and tests; do not change without source review.
- Secondary-corroborated: useful for training and source discovery, not final authority for public copy or code.
- Needs source: do not use as a hard claim.

## Official-Source-Backed Rules

| Rule | Source | App Impact | Content/QA Instruction |
| --- | --- | --- | --- |
| World Cup 2026 final competition format: group stage, round of 32, round of 16, quarter-finals, semi-finals, third-place match, and final; 48 teams in 12 groups of four; group winners, runners-up, and eight best third-placed teams qualify for the round of 32. | FIFA World Cup 26 Regulations, Articles 12.1, 12.2, 12.5 | Confirms FriendlyBet's single-phase and late-knockout bracket shape. | Content may explain the format with this source attached; QA must keep R32/R16 naming precise. |
| Round-of-32 slots M73-M88, round-of-16 through final wiring M89-M104, and Annex C best-third placement table are official. | FIFA World Cup 26 Regulations, Articles 12.6-12.11 and Annexe C | Confirms `SP_R32_DEF`, `SP_R16_DEF`, `SP_QF_DEF`, `SP_SF_DEF`, `SP_FINAL_DEF`, and Annex C allocation files. | QA must run Annex C/bracket tests and compare live seeded R32 matches against the public schedule snapshot before release. |
| Group ranking and best-third ranking use points, goal difference, goals scored, team conduct score, then successive FIFA/Coca-Cola Men's World Ranking editions. | FIFA World Cup 26 Regulations, Article 13 | Confirms `share-assets/world-cup-rules.js` fair-play/FIFA-ranking fallback model. | Public copy may explain tie-breakers only with source attached; real disciplinary/fair-play facts still require official match/disciplinary data. |
| Knockout matches level after normal time go to extra time and then penalties if still level. | FIFA World Cup 26 Regulations, Article 14 | Reinforces using `matches.winner_code` rather than score comparison for knockout scoring. | QA must keep penalty/tied-score winner tests. |
| Single yellow cards in the World Cup 2026 final competition are cancelled after the group stage and again after the quarter-finals. | FIFA Bureau update, FIFA Council 2026-04-28 release | No current scoring impact unless card data becomes a product feature. | Content may explain reset timing with source attached; QA must block unsourced variants. |
| Certain preliminary-competition suspensions do not carry into the final competition, while other pending red-card suspensions do. | FIFA Bureau Article 10(2) update | No current product impact unless displaying eligibility/suspension context. | Content must not infer a real player's eligibility without official disciplinary confirmation. |
| World Cup 2026 applies law changes for players leaving the field in protest and players covering their mouths in confrontational situations. | FIFA Council 2026-04-28 release; FIFA/IFAB Special Meeting release | No code impact unless misconduct reason codes become stored data. | Content may name the rule category; do not infer intent from images or unofficial reports. |
| A team causing match abandonment will, in principle, forfeit the match. | FIFA/IFAB Special Meeting release | Would affect match status/result modeling only if such a case occurs. | QA must require official match status before scoring or Pundit claims. |

## Local-Tested Authorities

| Rule | Local Source | Test Evidence | Instruction |
| --- | --- | --- | --- |
| Annex C third-place allocation has 495 possible combinations. | `share-assets/fifa-third-place-table.js` | `scripts/test-fifa-bracket.js` | Treat the local file as app authority until official PDF review requires a change. |
| Third-place allocation behavior is generated consistently. | `third-place-allocation.js`, `lib/third-place-allocation.mjs` | `scripts/test-third-place-allocation.js` | Use tests before any bracket mapping change. |
| Knockout winner must come from `matches.winner_code`, not score comparison. | `scripts/calculate-scores-v2.js`, app data model | `scripts/test-scoring.js` | Engineering and QA must block score-only winner inference. |

## Secondary-Corroborated Training Rules

These are allowed for internal academy drills and source-discovery prompts. They are not final authority for new code, scoring, legal claims, or public explainers.

| Topic | Secondary Sources | Training Use |
| --- | --- | --- |
| 12 groups of 4; top 2 plus 8 best third-placed teams advance. | 2026 FIFA World Cup overview; knockout-stage overview | Content, Product, and QA can use this in fictional cases while continuing official-source verification. |
| Round of 32 pairings and extra-time/penalty knockout format. | 2026 FIFA World Cup knockout-stage overview | Engineering and QA can compare local behavior against it, but official schedule/regulations should be attached before changing code. |
| Group-stage ranking order and fair-play/team-conduct deductions. | 2026 FIFA World Cup overview and group pages | Sports Rules must keep searching official wording before public copy or new scoring logic. |

## Needs Source Before Public Or Code Use

- Exact abandoned, forfeited, postponed, replayed, and match-interruption procedures beyond the currently verified media-release summary.
- Player eligibility, replacement, roster, and appeal rules.
- Official match-centre or disciplinary source for any real-match suspension or misconduct claim.

## Cross-Team Rule

When Sports Rules promotes any rule to official-source-backed, it must send a handoff to Engineering, QA, Content, Product, and FinOps with:

- The rule and exact source.
- Whether existing app code changes.
- Which tests or manual cases prove behavior.
- What Content can say publicly.
- What remains uncertain.
