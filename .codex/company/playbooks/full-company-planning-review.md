# Playbook: Full Company Planning Dialogue

Use this while forming any meaningful plan for Eyal.

This is not a late signoff checklist. It is the planning process itself.

## Trigger

Run this cadence when Eyal asks for a plan, program, feature, implementation strategy, roadmap, recovery path, operating process, or broad ambiguous recommendation.

Do not run the full cadence for tiny direct tasks, simple factual questions, or narrow code edits where the relevant owner and QA check are obvious. In those cases, still consider whether any department has a real blocker.

## Goal

Eyal should not receive the fastest plausible answer. He should receive the result of a real senior company planning conversation.

The CEO owns that conversation before a plan exists.

Depth beats short-term speed. Do not compress this cadence merely because a shorter answer would be faster, easier, cheaper in context, or more convenient in the moment. The company may present a concise final plan, but the underlying planning work must still include real challenge, revision, and validation design.

This must feel like a real team meeting, not a roster call. Department names are not evidence. One sentence per department is not evidence. A planning dialogue is valid only when departments react to the same problem, challenge each other's assumptions, force revisions, and then recheck the revised plan before it is presented.

The departments are not validators at the end. They are co-designers during planning:

- Product shapes the user promise and acceptance criteria.
- Design shapes the flow, comprehension, mobile/RTL behavior, and degraded states.
- Engineering shapes the architecture, sequencing, data path, failure modes, and rollback.
- QA shapes the proof strategy, blockers, warning-only issues, and regression surface.
- Product, Design, Engineering, Sports Rules, and QA jointly shape the user-state matrix: tournament phase, pool mode, lock/open state, prediction completion state, scoring/publication state, and returning/late/blocked user states.
- FinOps shapes cost, alert noise, recurring automation, and resource discipline.
- Privacy, Sports Rules, Content, Growth, HR, and Executive shape the plan where their domains can materially change the outcome.

For live-result, scoring, fixture, leaderboard, or production-recovery plans, the dialogue must explicitly pressure-test: one GitHub Action fails, one provider is stale or incomplete, official FIFA is late, the match goes to extra time or penalties, `winner_code` is missing or contradictory, Supabase has stale live residue, snapshot export succeeds but Vercel/CDN is slow, one pool remains stale, optional content fails, and Eyal is not available to provide match truth.

## Co-Design Evidence Standard

Do not claim that a plan was "company co-designed", "deeply reviewed", or "built with all departments" unless the response includes evidence of the dialogue before the final plan:

- The CEO's initial problem frame, with no finished solution embedded in it.
- Each active department's first-round challenge: what is weak, missing, risky, or overbuilt.
- Cross-department responses where at least the materially affected departments react to another department's objection, not only to the CEO.
- The revision each department forced, or a clear note that it did not materially change the plan.
- At least one second-round recheck from departments affected by the revision.
- Executive synthesis explaining the resolved disagreements and accepted tradeoffs.

Reading department skills, remembering department biases, or adding department labels to a completed plan is not co-design. A list of "Product says / Design says / Engineering says" without critique, disagreement, revision, and recheck is also not co-design. If only that happened, say the plan was "informed by company guidance" and do not present it as a full company planning dialogue.

Use this compact evidence ledger in the response or working notes for major plans:

- Problem frame:
- Active departments:
- Not-applicable departments:
- First-round challenges:
- Cross-department debate:
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
5. Departments must respond to each other's material objections. Product and Design must explicitly reject user-hostile internal terminology or states. Engineering must answer whether the product promise is implementable without leaking internal status. QA must challenge untestable wording, hidden assumptions, and happy-path-only plans. FinOps and Privacy must challenge recurring cost, alert noise, data exposure, or user trust risks where relevant.
6. Executive synthesizes the first round into a revised plan direction.
7. Departments affected by the revision respond again, especially when QA, Engineering, Product, Design, Privacy, FinOps, or Sports Rules see new risk.
8. Stop the loop only when the plan has a clear user promise, a user-state matrix, critical path, non-blocking work, tradeoffs, validation proof, owner, and unresolved risks.
9. Present Eyal with one concise plan plus a short "planning dialogue summary": which departments shaped it, major disagreements, tradeoffs accepted, and why the final plan is stronger.

Before presenting, run the shortcut pressure test: if the answer would look almost the same after removing department names, if no department forced a material revision, or if speed/context-saving was the reason the debate stayed shallow, the planning dialogue failed and must be rerun.

## Invalid Planning Patterns

Reject the plan and redo the dialogue if any of these appear:

- Department sticker sheet: each department gets one isolated sentence and no one changes the plan.
- Internal-status leak: engineering terms such as failed, error, exception, timeout, stale cache, or workflow failure appear as user-facing product states.
- Premature synthesis: the CEO presents a polished plan before departments have challenged it.
- Happy-path tunnel: the plan works only when every workflow succeeds quickly.
- Manual-truth tunnel: the plan depends on Eyal, QA, or an operator supplying match truth instead of automatic official/source-family resolution.
- Single-control-plane tunnel: the plan treats GitHub Actions, Vercel deployment, or one static snapshot as the reliability layer rather than a replaceable runner/publication mechanism.
- Future-total tunnel: the plan precomputes future user totals across unresolved earlier matches instead of per-match deltas or baseline-fingerprinted snapshots.
- QA-afterthought: tests are attached after the plan instead of shaping the plan.
- No second round: material revisions are not rechecked by the departments whose risks caused them.
- Short-term optimization: the agent knowingly gives a smaller, faster, or cleaner-looking answer while leaving the deep analysis, objections, or state matrix undone.

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

Resource discipline is never a license to skip senior thinking. FinOps may challenge wasteful tools, redundant scans, paid services, and unnecessary subagents, but must not pressure the CEO to replace a required planning dialogue with a shallow summary.

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
