# Playbook: Full Company Planning Review

Use this before presenting a meaningful plan to Eyal.

## Trigger

Run this cadence when Eyal asks for a plan, program, implementation strategy, roadmap, recovery path, operating process, or broad ambiguous recommendation.

Do not run the full cadence for tiny direct tasks, simple factual questions, or narrow code edits where the relevant owner and QA check are obvious. In those cases, still consider whether any department has a real blocker.

## Goal

Eyal should not need to manually ask: "Did QA check this?", "Did Engineering review this?", "Did Design see this?", or "Is Finance worried about cost?"

The CEO owns that routing before a plan is presented.

## Department Coverage

For every meaningful plan, explicitly consider each company department and either include it or mark it not applicable:

- Product: user job, MVP shape, scope, acceptance criteria.
- Engineering: feasibility, architecture, data flow, migration, cache, provider, and implementation sequence.
- Design: user journey, mobile/RTL/accessibility/text fit, and interaction clarity for user-facing work.
- QA And Release: regression risk, validation plan, release/version/deploy readiness.
- Sports Rules: competition format, scoring semantics, lock rules, provider data needs.
- Content And Community: bilingual product voice, Pundit/social/share wording, public communication.
- Growth And Open Source: public positioning, SEO, contributor trust, ethical discovery.
- Privacy Security: RLS, PII, public sharing, session/auth, legal/gambling wording.
- FinOps Enablement: GitHub Actions, APIs, providers, AI/tool usage, recurring cost, operational burden, memory hygiene.
- HR Agent Excellence: truthfulness, seniority, resource discipline, ownership, feedback-loop quality.
- Executive Office: cross-department conflict resolution, sequencing, decision rights, and final synthesis.

## Review Loop

1. CEO frames the goal, success criteria, urgency, constraints, and what would make the plan fail.
2. CEO selects the active departments and records why any department is not applicable.
3. Each active department returns: decision, strongest reason, concrete risks, smallest next action, validation needed, and memory update if any.
4. Executive synthesizes disagreement into one revised plan; do not paste a list of opinions.
5. If any department says revise or block, send the revised plan back to the departments affected by that revision.
6. Stop the loop only when blockers are resolved, escalated by decision rights, or explicitly left as known risks.
7. Present Eyal with one concise plan plus a short signoff summary, not raw internal debate.

## Seniority Standard

All department reviews must operate at senior level:

- Ground claims in repo files, playbooks, tests, production checks, or official/current sources when needed.
- Separate facts, assumptions, recommendations, and open risks.
- Catch hidden downstream failure modes before implementation.
- Design validation, not only recommendations.
- Escalate only chairman-level decisions to Eyal.

If Eyal has to ask for an obvious missing department review after a plan is presented, treat it as a planning-process incident and update the feedback loop.

## Cost And AI Resource Rule

FinOps must review plans that involve any of these:

- GitHub Actions, scheduled jobs, polling, provider calls, Supabase/Vercel usage, or other recurring automation.
- Paid services, API keys, external providers, image/video generation, large web research, subagents, long context loops, or repeated retries.
- Workflows that can create many alerts, emails, deploy comments, or operational noise.

The plan should prefer a cheaper static/local/reusable path when it preserves quality.

## Output

Return:

- Goal and success criteria
- Active departments and not-applicable departments
- Major disagreements and how they were resolved
- Final plan
- Validation plan
- Cost/resource note
- Risks left open
- Needs Eyal, if any
- Memory update, if any
