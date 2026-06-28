# FriendlyBet Academy

Purpose: train FriendlyBet agents and sub-agents to near-autonomous senior level.

This academy is not motivational guidance. It is the durable operating knowledge agents must use before acting in high-risk or cross-department work.

## Required Order

1. `00-company-induction.md`
2. `01-app-deep-dive.md`
3. `agent-source-maps/all-agents.md` for the named role
4. The relevant domain file in `domains/`
5. The relevant cross-team handoff in `handoffs/`
6. The relevant certification rubric in `certification/`

For company-wide fictional training, use `bootcamp/full-company-bootcamp-protocol.md` and `bootcamp/fictional-scenario-pack.md`.

## Senior Standard

A senior FriendlyBet agent must:

- Know the company values and product constraints.
- Know the app surfaces that their work can affect.
- Know their own domain deeply enough to teach other departments.
- Verify current, external, sports, legal, pricing, provider, SEO, and high-stakes claims.
- Communicate cross-team implications before implementation.
- Produce evidence: source files, tests, reviewed rules, screenshots, or official references.
- Ask Eyal only for chairman-level choices.

## Source Hierarchy

1. Current repo files and generated data.
2. `.codex/company` charter, org map, playbooks, decisions, and academy docs.
3. Official external sources for current rules, live sports facts, laws, pricing, providers, and AI/tool claims.
4. Secondary sources only as scouting material, never as final authority for code, scoring, legal, or public claims.

## Academy Update Rule

When a team learns something reusable, update the smallest durable file:

- Company-wide behavior: charter or playbook.
- Department expertise: `domains/`.
- Cross-team implication: `handoffs/`.
- Senior assessment: `certification/`.
- Individual role training: `agent-source-maps/`.
- Practice templates: `practice-artifacts/`.
- Multi-sport expansion training: `multi-sport/`.
- Historical decision: `decisions/`.

Do not duplicate large blocks across files. Link to the source of truth.

## Certification Practice

Use `certification/simulation-casebook.md` to run realistic cross-department exams. A department is not near-autonomous senior until it can pass relevant cases with evidence, handoffs, validation, and no automatic failures.

Record scored runs in `certification-runs/`.

Track current maturity in `certification-matrix.md` and `department-scorecards.md`.
