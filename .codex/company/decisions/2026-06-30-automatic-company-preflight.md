# Decision: Automatic Company Preflight For FriendlyBet Requests

Date: 2026-06-30

## Decision

Every FriendlyBet request starts with automatic company preflight. The CEO/Executive front door must classify the request before action:

- Direct/simple: answer or execute with normal verification; no fake department theater.
- Owner-led: route through the relevant department skill and QA/release when user-visible or risky.
- Meaningful company work: run Full Company Planning Dialogue before a plan exists.

## Why

Eyal should not have to repeatedly say "ask Product", "ask Engineering", "ask QA", "include Finance", "read the company docs", or "think deeper" when the shape of the request already implies those owners. The company operating model must activate from the request itself.

## Operating Rule

- The CEO is the default FriendlyBet front door for preflight, even on small requests.
- The full company process is mandatory for plans, recovery paths, implementation strategies, user-facing changes, live scoring/results/leaderboards, meaningful architecture/data work, cost-sensitive automation, privacy-sensitive changes, public content, and agent-process changes.
- Tiny factual questions and narrow safe edits still get preflight but should not waste context with all-department theater.
- If Eyal has to manually remind the agent to use the company process, classify it as a routing/process incident and update memory.

## Future Trigger

Use this decision together with `AGENTS.md`, `.codex/company/org-map.md`, `.codex/company/playbooks/operating-cadences.md`, and `.codex/company/playbooks/full-company-planning-review.md` for every FriendlyBet turn.
