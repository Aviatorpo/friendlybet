# Playbook: Full Company Planning Dialogue

Use this while forming any meaningful plan for Eyal.

This is not a late signoff checklist. It is the planning process itself.

## Trigger

Run this cadence when Eyal asks for a plan, program, feature, implementation strategy, roadmap, recovery path, operating process, or broad ambiguous recommendation.

Do not run the full cadence for tiny direct tasks, simple factual questions, or narrow code edits where the relevant owner and QA check are obvious. In those cases, still consider whether any department has a real blocker.

## Goal

Eyal should not receive the fastest plausible answer. He should receive the result of a real senior company planning conversation.

The CEO owns that conversation before a plan exists.

The departments are not validators at the end. They are co-designers during planning:

- Product shapes the user promise and acceptance criteria.
- Design shapes the flow, comprehension, mobile/RTL behavior, and degraded states.
- Engineering shapes the architecture, sequencing, data path, failure modes, and rollback.
- QA shapes the proof strategy, blockers, warning-only issues, and regression surface.
- Product, Design, Engineering, Sports Rules, and QA jointly shape the user-state matrix: tournament phase, pool mode, lock/open state, prediction completion state, scoring/publication state, and returning/late/blocked user states.
- FinOps shapes cost, alert noise, recurring automation, and resource discipline.
- Privacy, Sports Rules, Content, Growth, HR, and Executive shape the plan where their domains can materially change the outcome.

## Co-Design Evidence Standard

Do not claim that a plan was "company co-designed", "deeply reviewed", or "built with all departments" unless the response includes evidence of the dialogue before the final plan:

- The CEO's initial problem frame, with no finished solution embedded in it.
- Each active department's first-round challenge: what is weak, missing, risky, or overbuilt.
- The revision each department forced, or a clear note that it did not materially change the plan.
- At least one second-round recheck from departments affected by the revision.
- Executive synthesis explaining the resolved disagreements and accepted tradeoffs.

Reading department skills, remembering department biases, or adding department labels to a completed plan is not co-design. If only that happened, say the plan was "informed by company guidance" and do not present it as a full company planning dialogue.

Use this compact evidence ledger in the response or working notes for major plans:

- Problem frame:
- Active departments:
- Not-applicable departments:
- First-round challenges:
- Revisions forced:
- Second-round rechecks:
- Disagreements resolved:
- Tradeoffs accepted:
- User-state matrix:
- Executive synthesis:
- Remaining risks / Needs Eyal:

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

## Planning Dialogue Loop

1. CEO frames the goal, success criteria, urgency, constraints, and what would make the plan fail.
2. CEO drafts only a problem frame, not a finished plan.
3. CEO selects active departments and records why any department is not applicable.
4. Each active department challenges the frame: what is strong, what is weak, what is missing, what tradeoff matters, and what would change the plan.
5. Executive synthesizes the first round into a revised plan direction.
6. Departments affected by the revision respond again, especially when QA, Engineering, Product, Design, Privacy, FinOps, or Sports Rules see new risk.
7. Stop the loop only when the plan has a clear user promise, a user-state matrix, critical path, non-blocking work, tradeoffs, validation proof, owner, and unresolved risks.
8. Present Eyal with one concise plan plus a short "planning dialogue summary": which departments shaped it, major disagreements, tradeoffs accepted, and why the final plan is stronger.

If Eyal explicitly asks whether co-design happened, answer based on the evidence above. Do not use aspirational language. If the evidence is missing, classify it as a planning-process incident, update the feedback loop, and redo the dialogue.

## Seniority Standard

All department reviews must operate at senior level:

- Ground claims in repo files, playbooks, tests, production checks, or official/current sources when needed.
- Separate facts, assumptions, recommendations, and open risks.
- Catch hidden downstream failure modes before implementation.
- Design validation, not only recommendations.
- Escalate only chairman-level decisions to Eyal.

If Eyal receives a plan that was not shaped by the obvious relevant departments during planning, treat it as a planning-process incident and update the feedback loop. This is true even if the plan later passes a QA-style review.

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
- What each active department changed in the plan
- Major disagreements and how they were resolved
- Tradeoffs accepted
- User-state matrix and explicit non-goal states
- Final plan
- Validation plan
- Cost/resource note
- Risks left open
- Needs Eyal, if any
- Memory update, if any
