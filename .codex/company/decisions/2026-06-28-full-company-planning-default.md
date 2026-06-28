# Decision: Full Company Planning Review Before Meaningful Plans

Date: 2026-06-28

## Decision

When Eyal asks for a meaningful plan, FriendlyBet should not return the first plausible plan. The CEO must first run a senior cross-functional planning review, synthesize the feedback, revise the plan, and only then present one concise recommendation to Eyal.

## Why

Recent work showed a repeated process failure: Eyal received a plan, then had to manually ask whether QA, Design, Engineering, or Finance had reviewed it. Each late review changed the plan. That means the company process pushed coordination work onto the Chairman instead of doing it internally.

## Operating Rule

- Every meaningful plan must explicitly consider all departments.
- Relevant departments must review before the plan is shown.
- Departments with no useful role should be marked not applicable, not silently ignored.
- If a department revises or blocks the plan, the revised plan must be rechecked with affected departments.
- FinOps review is mandatory for plans involving Actions, APIs, providers, polling, recurring automation, AI/image/video generation, subagents, long context loops, or meaningful operational burden.
- If Eyal has to ask for an obvious missing review, classify it as a planning-process incident.

## Future Trigger

Use `.codex/company/playbooks/full-company-planning-review.md` for plan requests, roadmaps, recovery plans, implementation strategies, operating processes, and broad ambiguous recommendations.
