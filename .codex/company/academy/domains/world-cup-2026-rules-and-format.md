# World Cup 2026 Rules And Format

Owner: Sports Data And Rules  
Primary consumers: Content, Engineering, QA, Product, Design, FinOps

## Source Policy

This file trains agents on what they must know, but exact tournament rules must be verified before being used in code, scoring, public copy, or legal/risk-sensitive claims.

Use this hierarchy:

1. Official FIFA World Cup 2026 Regulations and official FIFA match/schedule data.
2. Local FriendlyBet source files that already encode a verified rule, especially `share-assets/fifa-third-place-table.js`.
3. Local generated data and tests.
4. Secondary sources only for scouting, never final authority.

If official FIFA wording cannot be checked, say `requires official FIFA verification` rather than guessing.

Use `world-cup-official-source-register.md` to record exact official sources, article/section references, retrieval date, and affected FriendlyBet surfaces.

Operational table: `world-cup-rules-one-source-of-truth.md`.

## Current FriendlyBet Group Model

Source: `../../../../docs/FAST-CODEMAP.md` and `app.js` `WC2026_GROUPS`.

- A: MEX, RSA, KOR, CZE
- B: CAN, BIH, QAT, SUI
- C: BRA, MAR, HAI, SCO
- D: USA, PAR, AUS, TUR
- E: GER, CUR, CIV, ECU
- F: NED, JPN, SWE, TUN
- G: BEL, EGY, IRN, NZL
- H: ESP, CPV, SAU, URU
- I: FRA, SEN, IRQ, NOR
- J: ARG, ALG, AUT, JOR
- K: POR, COD, UZB, COL
- L: ENG, CRO, GHA, PAN

## Qualification Model

Training rule:

- 12 groups of 4.
- Top 2 from each group advance to the Round of 32.
- 8 best third-placed teams also advance.
- Third-place allocation uses FIFA Annex C and has 495 possible combinations.

Implementation source:

- `share-assets/fifa-third-place-table.js` contains the exact Annex C table used by the app.
- `scripts/test-fifa-bracket.js` checks that the Annex C table has 495 combinations.
- `scripts/test-third-place-allocation.js` checks generated allocation behavior.

## Round Of 32 Slots

Training map. Verify against official FIFA regulations before changing code.

- Match 73: Runner-up A vs Runner-up B.
- Match 74: Winner E vs best third-place team from A/B/C/D/F.
- Match 75: Winner F vs Runner-up C.
- Match 76: Winner C vs Runner-up F.
- Match 77: Winner I vs best third-place team from C/D/F/G/H.
- Match 78: Runner-up E vs Runner-up I.
- Match 79: Winner A vs best third-place team from C/E/F/H/I.
- Match 80: Winner L vs best third-place team from E/H/I/J/K.
- Match 81: Winner D vs best third-place team from B/E/F/I/J.
- Match 82: Winner G vs best third-place team from A/E/H/I/J.
- Match 83: Runner-up K vs Runner-up L.
- Match 84: Winner H vs Runner-up J.
- Match 85: Winner B vs best third-place team from E/F/G/I/J.
- Match 86: Winner J vs Runner-up H.
- Match 87: Winner K vs best third-place team from D/E/I/J/L.
- Match 88: Runner-up D vs Runner-up G.

Content must know these paths because a group result can change the emotional story of the tournament. Engineering and QA must know them because bracket seeding, share cards, and scoring depend on them.

## Knockout Result Rule

FriendlyBet implementation rule:

- Use `matches.winner_code` for knockout winners.
- Do not infer knockout winners from score alone.
- Reason: extra time and penalties can produce a tied score field while `winner_code` carries the actual winner.

Tests:

- `scripts/test-scoring.js` covers penalty and tied-score winner behavior.
- `scripts/test-sync-transform.js` covers `winner_code` transform behavior.

## Third-Place Ranking And Tie-Breaks

Official-source-backed as of 2026-06-28 from the FIFA World Cup 26 Regulations, Article 13.

Agents must know the categories involved:

- Points.
- Goal difference.
- Goals scored.
- Team conduct score.
- Successive FIFA/Coca-Cola Men's World Ranking editions.

Do not publish a real-match disciplinary/team-conduct claim unless official match or disciplinary data has been checked for that case.

## Discipline And Misconduct

Some discipline and misconduct rules are now official-source-backed. The full regulations PDF is still needed for complete article-level coverage.

Official-source-backed rules as of 2026-06-23:

- Single yellow cards in the final competition are cancelled after the group stage and again after the quarter-finals.
- Single yellow cards from preliminary competition do not carry over to the final competition.
- Pending one- or two-match suspensions caused by cautions in different preliminary matches, an indirect red card, or a direct red card for denying an obvious goalscoring opportunity or for serious foul play do not carry over to the final competition.
- Other pending match suspensions imposed because of a red card in preliminary-competition matches do carry over to the final competition.
- At the competition organiser's discretion, a player covering their mouth in a confrontational situation with an opponent may be sanctioned with a red card.
- At the competition organiser's discretion, a referee may sanction a player with a red card for leaving the field of play in protest at a referee's decision.
- A team official who incites players to leave the field of play can be covered by the same rule.
- A team that causes a match to be abandoned will, in principle, forfeit the match.

Agents must distinguish:

- In-match card effect: yellow, second yellow, direct red.
- Match suspension effect: automatic next-match suspension, extension for serious offenses, accumulation rules.
- Team conduct effect: cards can affect fair-play/team-conduct tie-breaks.
- Content effect: red cards can be the central story, but never invent intent, quotes, or disciplinary outcomes.
- Product/Engineering effect: only store and score discipline if the product explicitly needs it and provider data is reliable.

Never claim suspension length, accumulation thresholds, appeal status, disciplinary committee outcome, discriminatory intent, or a real player's availability without current official confirmation for that case.

Training task: Sports Rules must keep filling the official source register with exact yellow-card accumulation, red-card suspension, team-conduct, and stage-expiry article references before these are used in product copy, scoring, or automated Pundit logic.

## Match Story Analysis Standard

Content and Pundit agents must be able to explain:

- What result changed.
- What table position changed.
- Whether qualification, elimination, or knockout path changed.
- Which FriendlyBet pick types became interesting.
- Which pool members were vindicated or hurt.
- Whether the story is tactical, emotional, disciplinary, historical, or bracket-path related.
- What is still uncertain because other groups/matches remain unresolved.

## Provider And Data Needs

Minimum live/current facts that may be needed:

- Match status, score, scorer, cards, substitutions, winner, and final status.
- Group table and third-place table.
- Official match reports for lineups, shirt numbers, player participation, cards, and substitutions.
- FIFA regulations for tie-breaks, discipline, and bracket mapping.

FinOps must review provider choices before a new live data dependency is added.

## Cross-Team Implications

- Sports Rules owns format correctness.
- Engineering owns encoding rules safely.
- QA owns proving edge cases.
- Content owns story interpretation without overclaiming.
- Product owns what users need to see.
- Privacy owns safe public sharing.
- FinOps owns provider/cost burden.

## Senior Agent Must Not

- Invent a card, suspension, scorer, quote, rule, bracket path, or tie-break.
- Treat a secondary article as final authority for code.
- Use score comparison for knockout winners.
- Ignore third-place combinations.
- Write content that sounds dramatic but misses the actual pool/prediction implication.
