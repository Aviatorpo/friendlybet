---
name: friendlybet-company-engineering
description: Plan or review FriendlyBet architecture, implementation, schema, data flows, scoring, provider integrations, static/PWA behavior, Supabase/RLS impact, migrations, automation, and technical sequencing. Use when a task asks how to build, refactor, generalize, integrate, test, or safely ship FriendlyBet code.
---

# FriendlyBet Engineering

## Start Here

Read:

- `../../../docs/FAST-CODEMAP.md`
- `../../company/charter.md`
- `../../company/org-map.md`
- `../../company/agents/head-of-engineering.md`
- `../../company/agents/platform-architect.md`
- `../../company/agents/frontend-pwa-engineer.md`
- `../../company/agents/data-scoring-engineer.md`
- `../../company/agents/sports-integrations-engineer.md`

Read playbooks only when relevant:

- `../../company/playbooks/architecture-review.md`
- `../../company/playbooks/new-sport-expansion.md`
- `../../company/playbooks/full-company-planning-review.md`
- `../../company/playbooks/release-review.md`
- `../../company/playbooks/live-scoring-operations.md` for live results, group completion, scoring, provider sync, leaderboard snapshots, or Pundit/story result triggers.

Read academy docs when app mastery, sports-rule encoding, or senior engineering review matters:

- `../../company/academy/01-app-deep-dive.md`
- `../../company/academy/domains/engineering-maintainer-handbook.md`
- `../../company/academy/domains/data-provider-and-live-sports-operations.md`
- `../../company/academy/domains/world-cup-rules-one-source-of-truth.md` when sports-rule encoding or scoring behavior is involved.
- `../../company/academy/handoffs/engineering-to-qa-content-product.md`
- `../../company/academy/certification/engineering-certification.md`

## Workflow

1. Use targeted `rg` searches before opening large files.
2. Preserve the static-first, no-build architecture unless the task truly requires otherwise.
3. Keep scoring deterministic, idempotent, and testable.
4. Keep public reads on CDN snapshots where feasible.
5. Identify schema, RLS, cache, provider, and version-bump implications before editing.
6. For stale live match rows, do not end at diagnosis. Inspect provider/verifier/workflow health, use the existing Supabase-backed recovery workflow when safe, monitor it, and verify production snapshots before calling the incident handled.
7. For live scoring, final-result, and knockout-opening workflows, isolate the critical user path from non-critical content gates. Missing Stories, empty editorial news, or weak Pundit copy should warn and create content work, not block score calculation, snapshot publication, app hotfix CI, or pick access.
8. During planning review, challenge feasibility, data ownership, cache/deploy layers, migration/RLS impact, failure modes, and the smallest testable implementation sequence before a plan is presented.

## Output

Return architecture recommendation, files likely touched, data impact, tests, and rollback/fallback notes.
