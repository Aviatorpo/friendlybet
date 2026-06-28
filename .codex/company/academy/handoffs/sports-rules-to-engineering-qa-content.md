# Handoff: Sports Rules To Engineering, QA, And Content

Use this whenever a sports rule, tournament format, provider constraint, or live match fact affects more than one team.

## Sports Rules Must Provide

- Rule or format statement.
- Source and verification status.
- Source category from `../domains/world-cup-rules-one-source-of-truth.md`.
- Whether it is stable, current, or live-changing.
- Product implication.
- Engineering/data implication.
- QA edge cases.
- Content/story implication.
- FinOps/provider implication.

## Engineering Needs

- Does the rule affect UI, schema, scoring, locks, generated data, or provider sync?
- Is it FIFA-specific or reusable across sports?
- Is official wording available?
- What are edge cases and fallback behavior?

## QA Needs

- What behavior must be tested?
- Which script or manual case proves it?
- Which stale/provider failure can make it wrong?
- What blocks release?

## Content Needs

- What does the rule mean in plain language?
- What can be said publicly?
- What must be caveated?
- What pool/prediction angle does it create?

## Example: Third-Place Qualification

- Sports Rules: top 2 plus best 8 third-place teams advance; Annex C maps third-place groups into specific slots.
- Engineering: use `share-assets/fifa-third-place-table.js`; do not invent bracket mapping.
- QA: run Annex C and scoring tests; test exactly 32 advancers.
- Content: explain uncertainty until all relevant third-place teams are known.
- FinOps: avoid live recomputation from paid provider data unless justified.

## Example: Red Card

- Sports Rules: verify in-match and suspension consequences from official regulation/current disciplinary source.
- Engineering: do not store or score card data unless product requires it and provider data is reliable.
- QA: test content fallback if card data is missing.
- Content: a red card can be a story; suspension implications require verification.
