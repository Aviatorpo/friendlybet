# Decision: Full Company Planning Dialogue Before Meaningful Plans

Date: 2026-06-28

## Decision

When Eyal asks for a meaningful plan, FriendlyBet should not return the first plausible plan. The CEO must first run a senior cross-functional planning dialogue where relevant departments co-design the plan, challenge assumptions, expose tradeoffs, revise together, and only then present one concise recommendation to Eyal.

## Why

Recent work showed a repeated process failure: Eyal received a plan, then had to manually pull QA, Design, Engineering, Finance, and other departments into the conversation. Each late department conversation changed the plan. That means the company process was producing a plan too early, before the company had actually thought together.

## Operating Rule

- Every meaningful plan must explicitly consider all departments.
- Relevant departments must participate during planning, before the plan is formed.
- Departments with no useful role should be marked not applicable, not silently ignored.
- If a department materially changes the plan, the revised direction must be rechecked with affected departments.
- FinOps review is mandatory for plans involving Actions, APIs, providers, polling, recurring automation, AI/image/video generation, subagents, long context loops, or meaningful operational burden.
- If Eyal has to ask for an obvious missing department conversation, classify it as a planning-process incident.

## Future Trigger

Use `.codex/company/playbooks/full-company-planning-review.md` for plan requests, roadmaps, recovery plans, implementation strategies, operating processes, and broad ambiguous recommendations.
