# World Cup Official Source Register

Owner: Sports Data And Rules  
Consumers: Content, Engineering, QA, Product, FinOps

## Purpose

Track which World Cup 2026 rules are official-source verified, which are locally encoded, and which are only scouted from secondary sources.

## Status Legend

- Verified official: official FIFA regulation, match centre, schedule, or post-match report inspected.
- Locally encoded: FriendlyBet already has a local implementation or generated table that must not be changed without source review.
- Secondary scouted: useful for research, not authoritative for code, scoring, or public copy.
- Needs source: must be verified before use.

## Official Sources To Attach

Add exact URLs, PDFs, article/section numbers, and retrieval date when found:

- FIFA World Cup 2026 Regulations.
- FIFA World Cup 26 match schedule.
- FIFA match centre and official match reports.
- FIFA post-match summary PDFs.
- FIFA disciplinary updates.
- FIFA rankings used by the tournament regulations.

## Verified Official Sources

Retrieved: 2026-06-28

### FIFA World Cup 26 Regulations

- Source: https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf
- Status: Verified official.
- Published/label: FIFA World Cup 26 Regulations, May 2025.
- Rule area: final competition format, group ranking, best-third ranking, knockout bracket wiring, extra time and penalties.
- Verified rules:
  - Article 12.1: the final competition has a group stage, round of 32, round of 16, quarter-finals, semi-finals, match for third place, and final.
  - Article 12.2: the 48 teams are divided into 12 groups of four.
  - Article 12.5: the 12 group winners, 12 group runners-up, and eight best third-placed teams qualify for the round of 32.
  - Article 12.6: M73-M88 define the round-of-32 slots, including the allowed best-third group sets for M74, M77, M79, M80, M81, M82, M85, and M87.
  - Article 12.7-12.11: M89-M104 define the round of 16, quarter-final, semi-final, third-place, and final wiring.
  - Article 13: group ties and best-third ranking use points, goal difference, goals scored, team conduct score, then successive FIFA/Coca-Cola Men's World Ranking editions.
  - Article 14: knockout matches level after normal time go to extra time and then penalties if still level.
  - Annexe C: FIFA provides the 495 possible best-third combinations and next match-ups for the round of 32.
- Applies to: Sports Rules, Engineering, QA, Product, Content, Pundit, Social Video.
- Local code/data impacted: confirms `app.js` `SP_R32_DEF`/round wiring, `third-place-allocation.js`, `lib/third-place-allocation.mjs`, `share-assets/fifa-third-place-table.js`, `share-assets/world-cup-rules.js`, and scoring use of verified advancement stored as resolved `winner_code`.
- Content implication: agents may now explain the official 48-team format, R32/R16 bracket wiring, best-third tie-break order, and extra-time/penalty rule with this source attached.
- QA cases: verify 495 Annex C rows, exact R32 slots, M89-M104 wiring, current live bracket seed, fair-play/team-conduct tie fallback, FIFA-ranking fallback, and knockout advancement/`winner_code` behavior.
- FinOps/provider implication: no paid provider needed for bracket rules; current match/result feeds still need official/fresh verification for live team placement and winners.

Retrieved: 2026-06-23

### FIFA Bureau Article 10(2) Update

- Source: https://inside.fifa.com/organisation/fifa-council/news/council-update-regulations-world-cup-2026
- Status: Verified official.
- Published: 2026-05-08.
- Rule area: preliminary-competition suspension carry-over into the final competition; final-competition yellow-card cancellation.
- Verified rules:
  - Single yellow cards from preliminary competition do not carry over to the final competition.
  - Pending one- or two-match suspensions caused by cautions in different preliminary matches, an indirect red card, or a direct red card for denying an obvious goalscoring opportunity or for serious foul play do not carry over to the final competition.
  - Other pending match suspensions imposed because of a preliminary-competition red card do carry over to the final competition.
  - Single yellow cards in the final competition are cancelled after the group stage and again after the quarter-finals.
- Applies to: Sports Rules, Content, QA, Engineering, Data Provider, Pundit, Social Video.
- Local code/data impacted: no current FriendlyBet scoring impact unless we add cards/suspensions; Pundit/content guardrails are impacted immediately.
- Content implication: agents may explain yellow-card reset timing only with this source attached; red-card suspension implications still require the exact disciplinary case or official disciplinary update.
- QA cases: fictional card-heavy group match, quarter-final yellow-card reset, preliminary suspension carry-over exception.
- FinOps/provider implication: do not pay for card feeds unless cards become a product feature; official disciplinary updates remain the authority for suspension-specific claims.

### FIFA Council 28 April 2026 Media Release

- Source: https://inside.fifa.com/organisation/fifa-council/media-releases/council-increases-record-financial-distribution-member-associations-world-cup-2026
- Status: Verified official.
- Published: 2026-04-28.
- Rule area: final-competition yellow-card reset; World Cup 2026 adoption of IFAB law changes.
- Verified rules:
  - Single yellow cards in the final competition are cancelled after the group stage and again after the quarter-finals.
  - FIFA World Cup 2026 applies the law changes concerning players leaving the field of play in direct protest at a referee's decision and players covering their mouths when speaking to opponents in confrontational situations.
- Applies to: Sports Rules, Content, QA, Engineering, Legal Gambling Risk, Privacy, Social Video.
- Local code/data impacted: no app-code change unless cards/misconduct become stored product data.
- Content implication: this is an official corroborating source for the yellow-card reset and new misconduct story context.
- QA cases: content uses official caveats; no product logic infers suspensions without an official disciplinary source.

### FIFA/IFAB Special Meeting Media Release

- Source: https://inside.fifa.com/organisation/media-releases/the-ifab-red-card-players-covering-mouths-to-conceal-discriminatory-behaviour
- Status: Verified official.
- Published: 2026-04-28.
- Rule area: red-card law changes and match-abandonment consequence.
- Verified rules:
  - At the competition organiser's discretion, a player covering their mouth in a confrontational situation with an opponent may be sanctioned with a red card.
  - At the competition organiser's discretion, the referee may sanction a player with a red card for leaving the field of play in protest at a referee's decision.
  - The same rule applies to a team official who incites players to leave the field of play.
  - A team that causes a match to be abandoned will, in principle, forfeit the match.
  - These amendments are to be implemented at FIFA World Cup 2026.
- Applies to: Sports Rules, Content, QA, Engineering, Privacy, Legal Gambling Risk, Social Video.
- Local code/data impacted: no code change unless FriendlyBet stores misconduct reason codes, abandonment status, or forfeits.
- Content implication: agents may name the rule category, but must not accuse a player of discriminatory intent unless an official report says so.
- QA cases: fictional abandonment, protest walk-off, card feed missing reason code, copy requiring privacy/legal review.

## Current Local Authorities

- Annex C third-place allocation: `share-assets/fifa-third-place-table.js`.
- Annex C generated allocation: `third-place-allocation.js`, `lib/third-place-allocation.mjs`.
- Annex C tests: `scripts/test-fifa-bracket.js`, `scripts/test-third-place-allocation.js`.
- Knockout winner implementation: `matches.winner_code`, tested in `scripts/test-scoring.js`.
- Current group constants: `app.js` `WC2026_GROUPS` and `../../../../docs/FAST-CODEMAP.md`.

## Cross-Checked Secondary Sources

Retrieved: 2026-06-23

Use these for scouting and academy drills only. Do not treat them as final authority for code, scoring, legal, or public rule claims without official-source confirmation or existing local tested implementation.

- 2026 FIFA World Cup overview: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup
  - Secondary-scouted topics: 48-team format, 12 groups of 4, top 2 plus 8 best third-placed teams, group ranking order, fair-play/team-conduct deductions, yellow-card reset summary.
- 2026 FIFA World Cup knockout stage: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
  - Secondary-scouted topics: 32-team knockout stage, extra time and penalties, Round of 32 pairings, Annex C 495 third-place combinations.
- 2026 FIFA World Cup group pages:
  - Secondary-scouted topic: repeated fair-play deduction table for yellow card, indirect red, direct red, and yellow plus direct red.

## Secondary-Scouted Rule Checklist

These items appeared in secondary sources and must be checked against official FIFA wording before use:

- Group ranking tie-break order.
- Best third-place ranking tie-break order.
- Team conduct/fair-play card deductions.
- Yellow-card accumulation rules.
- Red-card automatic suspension and possible extension.
- Whether cards/suspensions expire or carry over at specific stages.
- Qualification-round suspension carry-over exceptions.
- Abandoned, forfeited, postponed, or replayed match rules.
- Player eligibility and replacement rules.

## Internal Use Policy

- Verified official rules may be used by Content, QA, Engineering, and Pundit with this register cited.
- Locally encoded and test-backed rules may be used in app behavior only through their existing source files and tests.
- Secondary-scouted rules may be used for internal academy cases, source discovery, and risk mapping. They must not become public copy, code, scoring, or automated Pundit claims unless promoted to verified official or local-tested authority.
- Any card, abandonment, forfeit, or suspension claim about a real match still needs the official match report, disciplinary update, or authoritative match-centre fact for that match.

## Rule Verification Template

```text
Rule:
Official source:
Article/section:
Retrieved:
Applies to:
Local code/data impacted:
Content implication:
QA cases:
FinOps/provider implication:
Notes:
```

## Current Gap

As of 2026-06-28, the full FIFA World Cup 26 Regulations PDF is verified for competition format, bracket wiring, group ranking, best-third ranking, team-conduct tie-breaks, extra time, and penalties.

Remaining gaps that still require exact official-source verification before use:

- Abandoned, forfeited, postponed, or replayed match procedures beyond the FIFA/IFAB media-release summary.
- Player eligibility, replacement, roster, and appeal rules.
- Current official match reports or disciplinary updates for any real-match suspension or misconduct claim.
