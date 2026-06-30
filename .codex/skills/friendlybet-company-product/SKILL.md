---
name: friendlybet-company-product
description: Shape FriendlyBet product decisions, MVP scope, user stories, tournament flows, multi-sport expansion, pool mechanics, social competition loops, and feature prioritization. Use when planning what FriendlyBet should build, cut, sequence, or validate, especially for new sports, prediction formats, pool flows, leaderboards, sharing, or product strategy.
---

# FriendlyBet Product Department

## Start Here

Read:

- `../../company/charter.md`
- `../../company/org-map.md`
- `../../company/agents/head-of-product.md`
- `../../company/agents/tournament-flow-pm.md`
- `../../company/agents/multi-sport-expansion-pm.md`
- `../../company/agents/social-competition-pm.md`

Read playbooks only when relevant:

- `../../company/playbooks/product-feature-review.md`
- `../../company/playbooks/new-sport-expansion.md`
- `../../company/playbooks/full-company-planning-review.md`
- `../../company/playbooks/live-scoring-operations.md` for live tournament states, official-vs-theoretical points, dashboard, leaderboard, or podium flows.

Read academy docs when product scope, cross-team learning, or senior product planning matters:

- `../../company/academy/01-app-deep-dive.md`
- `../../company/academy/domains/product-design-growth-and-trust.md`
- `../../company/academy/handoffs/product-design-growth-to-engineering-content.md`
- `../../company/academy/certification/product-design-growth-certification.md`

## Workflow

1. Identify the target user and the social prediction job.
2. Define the smallest lovable version.
3. Name what is explicitly out of scope.
4. Check bilingual, mobile, privacy, scoring, and cost implications.
5. Hand off architecture risks to Engineering, rule risks to Sports Rules, and release risks to QA.
6. During phase transitions, define the user's minimum promise first: points visible, leaderboard updated, and eligible pools able to make the next picks. Content richness is secondary until that path works in production.
7. Treat Pundit, Stories, banter, share copy, social/video, and decorative polish as enhancement scope for result/scoring/match surfaces. Do not make them MVP blockers for verified results, scoring, locks, leaderboards, or match display.
8. For user-facing features, build the user-state matrix before defining MVP: tournament phase, pool mode, lock/open state, prediction completion, scoring/publication, stale/fresh data, and returning/late/blocked user states.
9. During planning dialogue, shape whether the plan solves the real user job in every relevant state, whether the MVP is too broad or too thin, what should be cut or added, and what acceptance criteria prove the user outcome.
10. Reject internal engineering/ops language in user-facing product states. Users should never see labels like failed, error, timeout, workflow, provider disagreement, or cache mismatch; translate them into calm, honest user promises and separate ops alerts.
11. During company planning, do not provide a standalone opinion only. Challenge Engineering, Design, QA, Content, Privacy, and FinOps where their assumptions weaken the user promise.
12. Reject plans that are short because they skipped user-state analysis, acceptance criteria, or cross-department challenge. Product can ask for concise presentation, but not shallow planning.
13. For live sports, define the user truth before the implementation truth: what happened, who advanced, whether points are verified, when the leaderboard should update, and what the user can do while confirmation is pending.
14. Reject product designs where `winner_code`, Action status, provider names, or manual Eyal input become the user promise. Those are internal mechanisms or incidents, not product states.

## Output

Return product decision, user-state matrix, MVP scope, out-of-scope states/items, dependencies, risks, and next action.
