---
name: friendlybet-company-qa-release
description: Review FriendlyBet quality, regression risk, test plans, release readiness, version bump discipline, scoring/locking correctness, provider fallback behavior, and dirty-worktree safety. Use before shipping app code, scoring changes, migrations, sports integrations, copy updates, PWA cache changes, or any risky user-facing flow.
---

# FriendlyBet QA And Release

## Start Here

Read:

- `../../../docs/FAST-CODEMAP.md`
- `../../company/charter.md`
- `../../company/org-map.md`
- `../../company/agents/qa-lead.md`
- `../../company/agents/regression-automation-agent.md`
- `../../company/agents/release-manager.md`

Read playbooks only when relevant:

- `../../company/playbooks/release-review.md`
- `../../company/playbooks/architecture-review.md`
- `../../company/playbooks/full-company-planning-review.md`
- `../../company/playbooks/live-scoring-operations.md` for scoring, provider, dashboard/leaderboard, Pundit, or story release risk.

Read academy docs when release confidence, regression strategy, or senior QA planning matters:

- `../../company/academy/01-app-deep-dive.md`
- `../../company/academy/domains/qa-release-and-regression.md`
- `../../company/academy/domains/world-cup-rules-one-source-of-truth.md` when sports-rule, scoring, bracket, or live-match behavior is involved.
- `../../company/academy/handoffs/qa-release-to-all.md`
- `../../company/academy/certification/qa-certification.md`

## Workflow

1. Identify changed user flows, data paths, and cache/version impacts.
2. Prioritize scoring, locking, persistence, RLS, provider failure, and bilingual behavior.
3. Recommend focused scripts or manual checks.
4. For app code, verify the three-place version bump rule.
5. Never revert unrelated dirty work.
6. For live user-visible bugs, require production verification after push/deploy: cache-busted public-data fetch, live URL check, or screenshot proof as appropriate.
7. For generated content, require structural duplicate checks over the recent visible window, not only syntax or schema validation.
8. For live-data incidents, QA should expect recovery evidence, not only a blocker label: workflow/run id, stale rows, verifier output, production re-fetch, and remaining risk.
8a. For live-data and scoring incidents, QA must reject "end to end" evidence that does not compare the user-visible source to the canonical scoring source. For WC2026, a finished or scheduled fixture visible in `world-cup-schedule.json` is not enough; QA needs the matching Supabase `matches` row and the resulting public snapshot/scoring proof.
9. During live scoring or knockout-opening incidents, QA may block unverified results, wrong scoring, unsafe snapshots, or broken lock/open state. QA should not block the critical user path for accepted Story/Pundit/news backlog; record that as a separate content incident with its own validation.
10. For changes near results, scoring, locks, leaderboards, or match display, require proof that missing, stale, slow, invalid, or duplicate content cannot break the critical path.
11. For user-facing features, require a state matrix test plan. Each state that changes what users can see, pick, edit, score, or share needs an automated fixture or named manual/live verification.
12. During planning dialogue, shape the plan by defining acceptance tests, regression paths, state-matrix coverage, release/version/cache checks, dirty-worktree safety, blocker-vs-warning rules, and production verification when Eyal can see the outcome live.

## Output

Return release readiness, state coverage, tests run or recommended, blockers, remaining risks, and version-bump status.
