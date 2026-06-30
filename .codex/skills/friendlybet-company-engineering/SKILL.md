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

Read academy docs when app mastery, sports-rule encoding, or senior engineering planning matters:

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
6a. For fixture/result/scoring work, always name both sources: what the user-facing match display reads and what the scorer/live poller/final verifier read. If they differ, the bridge is the primary engineering object. For WC2026, known official FIFA schedule fixtures must be upserted into Supabase `matches` before their match window, and newly known next-round fixtures must be bridged after each knockout result.
7. For live scoring, final-result, and knockout-opening workflows, isolate the critical user path from non-critical content gates. Missing Stories, empty editorial news, or weak Pundit copy should warn and create content work, not block score calculation, snapshot publication, app hotfix CI, or pick access.
8. For results, scoring, locks, leaderboards, and match display, never make core code await, import, validate, deploy, or depend on optional Pundit, Stories, banter, share copy, social/video, or visual-polish artifacts. Add timeout/fallback behavior and tests when optional content is adjacent.
9. For tournament-aware UI, identify or create the shared state resolver/source of truth before editing screens. Avoid screen-local assumptions about phase, lock/open state, submitted picks, scoring publication, or stale snapshots.
10. During planning dialogue, shape feasibility, data ownership, cache/deploy layers, migration/RLS impact, state model, failure modes, rollback, and the smallest testable implementation sequence before a plan is presented.
11. Do not let a fast implementation path replace deep architecture review when scoring, results, locks, public snapshots, or user-visible state are involved. Engineering should reduce waste, not reduce analysis.
12. Assume every live dependency can fail: provider, official source, Action, push, deploy, CDN, snapshot, DB write, cache, and optional content. Design one replayable/idempotent path with automatic fallback wake-ups rather than parallel business logic.
13. Treat result fields as validated outputs. `winner_code`/provider winners must be checked against stage, teams, score, penalties/advancement, source consensus, and contradiction rules before scoring.
14. Precompute scenario deltas or baseline-fingerprinted snapshots only; do not precompute future total scores across unresolved earlier matches.
15. If a workflow fails noisily after the data path is correct, fix the workflow's proof/alert design and rerun the current path. Do not normalize manual reruns or let old false failures remain the latest evidence.
16. Do not use football-data.org as a final-result source or scoring bridge. It is retired from match/result sync; legacy code must stay fenced behind explicit isolated-test/recovery opt-ins.

## Output

Return architecture recommendation, state model impact, files likely touched, data impact, tests, and rollback/fallback notes.
