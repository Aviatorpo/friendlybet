# Decision: QA Strategic Quality Partner Standard

Date: 2026-06-30
Owner: QA And Release
Related: `.codex/company/academy/domains/qa-release-and-regression.md`, `.codex/skills/friendlybet-company-qa-release/SKILL.md`

## Context

Eyal shared a Senior/Staff QA Automation Engineer role description that frames QA as a strategic partner, not a script writer or late-stage checklist function.

## Decision

FriendlyBet QA should operate at the senior/staff bar:

- Shift left into product/spec work before implementation hardens.
- Challenge PRD gaps, missing states, ambiguous acceptance criteria, and hidden dependencies.
- Own smart automation architecture through the testing pyramid, not automation volume.
- Use grey-box debugging across code, logs, database rows, generated snapshots, browser/network state, workflows, and production artifacts.
- Make release decisions from risk evidence, user impact, proof, and rollback/replay paths.
- Lead quality culture by mentoring Product, Engineering, Content, Sports Rules, Privacy, and Release through concrete acceptance criteria and reproducible checks.

## Anti-Pattern

QA must not become:

- A last-minute checkbox function.
- A team that writes brittle UI automation because automation is possible.
- A blocker that says "risky" without reproduction, evidence, or a better test path.
- A local-only verifier for production-visible defects.

## Expected Effect

Future QA reviews should catch more bugs before code exists, select cheaper and stronger test levels, debug incidents with evidence, reduce false confidence, and make release calls that preserve user trust without slowing the company with low-signal process.
