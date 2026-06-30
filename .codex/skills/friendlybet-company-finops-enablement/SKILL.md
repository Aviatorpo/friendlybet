---
name: friendlybet-company-finops-enablement
description: Control FriendlyBet operating cost, free-tier viability, provider/API cost, GitHub Actions/Supabase/Vercel usage, documentation hygiene, company memory updates, playbook maintenance, and skill validation. Use when evaluating cost, operational burden, tooling, internal docs, company memory, or whether agent profiles should become full skills.
---

# FriendlyBet FinOps And Enablement

## Start Here

Read:

- `../../company/charter.md`
- `../../company/org-map.md`
- `../../company/agents/finops-cost-control-agent.md`
- `../../company/agents/internal-enablement-documentation-agent.md`

Read playbooks only when relevant:

- `../../company/playbooks/memory-update.md`
- `../../company/playbooks/agent-domain-mastery-training.md`
- `../../company/playbooks/new-sport-expansion.md`
- `../../company/playbooks/full-company-planning-review.md`

Read academy docs when training, documenting, or validating department knowledge:

- `../../company/academy/README.md`
- `../../company/academy/domains/finops-cost-and-ops-discipline.md`
- `../../company/academy/handoffs/privacy-finops-to-all.md`
- `../../company/academy/handoffs/provider-data-to-content-engineering-qa-finops.md`

## Workflow

1. Estimate recurring cost and operational burden before adding providers or services.
2. Prefer free-tier friendly architecture and static/CDN paths.
3. Keep company memory short, current, and non-duplicative.
4. Promote an agent profile into a full skill only after repeated use.
5. Validate skills after changing skill metadata or instructions.
6. Treat repeated GitHub Actions failure emails during live tournament windows as operational cost and attention debt. Push for one owner, concise status, alert demotion for non-critical gates, and a reusable memory update.
6a. Do not create false-negative workflow failures by proving production CDN state too soon after a generated-data push. Prefer a bounded, low-frequency retry window over repeated reruns, failure emails, and manual operator attention.
7. Keep optional content workflows from creating noisy failures that obscure or block critical result/scoring/lock/leaderboard workflows. Demote content-only failures to separate incidents when the critical path is healthy.
8. During planning dialogue, shape meaningful plans around hidden cost and operational load when they involve GitHub Actions, APIs, providers, polling, recurring automation, Supabase/Vercel usage, image/video generation, subagents, long context loops, or repeated retries. Recommend a cheaper static/local/reusable path when it preserves quality.
9. Resource discipline must not become short-term optimization. Challenge wasteful tools and loops, but do not pressure the company to skip deep analysis, department debate, state coverage, or validation design when the request requires them.
10. Treat manual operator/Eyal match-truth work as hidden cost and reliability debt. A bounded automatic fallback is usually cheaper than repeated human rescue, angry-user support, and follow-up corrections.
11. Prefer typed outcomes and consolidated incidents over noisy failure emails: green for healthy, warning for non-critical/content/deploy-propagation wait, critical for user-risk or wrong/stale points.
12. Treat passive task-taking and repeated obvious misses as operational waste. A senior collaborator who catches the issue early is cheaper than repeated retries, long correction loops, and Eyal acting as unpaid QA or operator.
13. Treat unclear metrics and output-only work as cost risk. Work that cannot name the outcome it improves is harder to prioritize, validate, or stop.
14. AI use should reduce cycle time or improve quality without adding hidden subscription, context, review, or verification cost. AI-generated direction still needs human-quality gates.
15. Retired provider paths are cost and reliability debt. football-data.org must stay out of final-result automation unless an isolated legacy recovery/test explicitly opts in and documents why.

## Output

Return cost risk, cheaper alternative, documentation update, skill/memory recommendation, and validation notes.
