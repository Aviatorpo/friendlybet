# Next Training Backlog

This backlog keeps the agent-mastery goal active until every named agent and sub-agent can prove near-autonomous senior behavior.

## P0: Complete Official World Cup Source Register

Owner: Football Rules Analyst  
Support: Data Provider Scout, Content, QA

Tasks:

- Find full official FIFA World Cup 2026 Regulations PDF or equivalent official regulation page.
- Record exact URL, article/section, retrieval date, and local impact in `domains/world-cup-official-source-register.md`.
- Verify group ranking, best-third ranking, Annex C, complete fair-play wording, suspension, abandoned/forfeited/postponed/replayed match, eligibility, and replacement rules.
- Update Content, Engineering, and QA handoffs when official sections are recorded.

Already partially verified:

- Yellow-card reset timing.
- Selected preliminary-suspension carry-over rules.
- Protest walk-off and covering-mouth red-card law changes.
- Abandonment/forfeit principle.

Done when:

- Every rule that Content or Engineering may use has an official source entry or is marked not usable.

## P0: Run Remaining Certification Cases

Owner: HR And Agent Excellence  
Support: Executive Office

Status: completed on 2026-06-23 for first-pass process certification.

Runs:

- Case 1: `certification-runs/2026-06-23-case-1-red-card-chaos.md`.
- Case 3: `certification-runs/2026-06-23-case-3-live-provider-fails.md`.
- Case 4: `certification-runs/2026-06-23-case-4-social-prediction-feature.md`.
- Case 5: `certification-runs/2026-06-23-case-5-weak-agent-output-postmortem.md`.

Repeat when:

- Real task evidence contradicts the simulation.
- A department fails a real quality gate.
- New sports/rules/provider/product surfaces are added.

## P1: Split Dense Agent Source Maps

Owner: Internal Enablement Documentation Agent  
Support: Operating System Lead

Tasks:

- Split `agent-source-maps/all-agents.md` into department files only if agents stop using the all-in-one map.
- Keep the all-in-one index as the canonical directory.

Done when:

- Every agent can find its own study path in one click and no duplicate guidance drifts.

Status: no split needed yet. Cycles 1-4 used the all-agent map successfully.

## P1: Department Practice Artifacts

Owners: Department heads

Status: templates created on 2026-06-23.

Artifacts:

- Content: `practice-artifacts/content-post-match-live-desk-worksheet.md`.
- Engineering: `practice-artifacts/engineering-rule-to-code-worksheet.md`.
- QA: `practice-artifacts/qa-release-risk-worksheet.md`.
- Privacy: `practice-artifacts/privacy-public-share-rls-worksheet.md`.
- FinOps: `practice-artifacts/finops-provider-cost-worksheet.md`.
- Product/Design/Growth: `practice-artifacts/product-design-growth-mvp-trust-worksheet.md`.

Done when:

- Each artifact is used in at least one simulation or real task.

First use:

- Case 4 social prediction feature worksheet run: `practice-runs/2026-06-23-case-4-social-prediction-feature-worksheet-run.md`.

Status: first simulation use complete. Real-task use still required for Real-Task Proven status.

## P2: Multi-Sport Deepening

Owner: Multi-Sport Rules Analyst  
Support: Product, Engineering, QA, FinOps

Tasks:

- Use `multi-sport/second-sport-source-map-template.md` for one candidate second sport.
- Identify prediction types, locks, scoring, provider data, and UI implications.
- Keep World Cup-specific rules isolated.

Done when:

- One second-sport MVP can be reviewed without generic platform assumptions.

Status: fictional Cycle 4 passed. A real candidate sport source map is still required.

## P2: Academy Hygiene Review

Owner: Operating System Lead  
Support: Internal Enablement Documentation Agent

Tasks:

- Remove duplicate or unused guidance.
- Promote repeatedly used source maps into skill instructions.
- Retire stale paths.

Done when:

- Future agents can load the academy without drowning in process.

Use `execution-plan-next-runs.md`, `certification-matrix.md`, and `department-scorecards.md` for the next review.

Status: first hygiene drill completed in `bootcamp/runs/2026-06-23-cycle-2-remediation.md`; repeat after real-task usage.
