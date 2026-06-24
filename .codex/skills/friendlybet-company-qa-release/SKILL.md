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
- `../../company/playbooks/live-scoring-operations.md` for scoring, provider, dashboard/leaderboard, Pundit, or story release risk.

Read academy docs when release confidence, regression strategy, or senior QA review matters:

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

## Output

Return release readiness, tests run or recommended, blockers, remaining risks, and version-bump status.
