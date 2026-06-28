# Sports Rules Certification

Applies to: Football Rules Analyst, Multi-Sport Rules Analyst, Data Provider Scout, sports rules sub-agents.

## Required Study

- `../00-company-induction.md`
- `../domains/world-cup-2026-rules-and-format.md`
- `../domains/world-cup-rules-one-source-of-truth.md`
- `../domains/world-cup-official-source-register.md`
- `../handoffs/sports-rules-to-engineering-qa-content.md`
- `../../playbooks/new-sport-expansion.md`

## Practical Exam

Scenario: A rule or format detail can affect content, scoring, provider data, and QA.

Sports Rules must produce:

- Exact rule statement.
- Source and verification status.
- Source category: official-source-backed, local-tested authority, secondary-corroborated, or needs source.
- Affected teams.
- Engineering/data implications.
- QA edge cases.
- Content plain-language explanation.
- Product UX implication.
- FinOps/provider implication.

## Pass Criteria

- Uses official sources for rule claims.
- Refuses to promote secondary-corroborated rules into public copy or code.
- Separates stable format from live/current facts.
- Names edge cases.
- Avoids forcing one sport's model onto another.
- Teaches other departments clearly.

## Fail Criteria

- Vague "check FIFA rules" with no actionable breakdown.
- Unverified red-card/suspension/tie-break claim.
- No Engineering/QA implication.
- No provider/cost awareness.
