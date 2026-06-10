# Runbook — v2.10.9 two-phase final hardening (2026-06-10, pre-kickoff)

Builds on the v2.10.7/v2.10.8 incident mitigation. Addresses the Codex production
audit. All DB migrations below were applied to prod after a fresh full snapshot
(`_private/snapshots/*__2026-06-10T1100Z.json`, taken via `PROD_DB_URL`, includes
`group_picks` + `pick_backups`).

## Migrations applied to prod (idempotent, in this order)

1. `2026-06-10-revoke-truncate-remaining-tables.sql`
   - REVOKE TRUNCATE on `teams, players, matches, admin_actions, app_settings`
     (and re-assert pick tables/users/pools) from `anon, authenticated, public`.
   - Verified: `verify-no-truncate-grants.sql` returns 0 rows.

2. `2026-06-10-auth-writer-grace.sql`
   - `_auth_writer` now reads `lock_at_override`; an active (future) override keeps
     writes OPEN even if the pool is otherwise locked, so the grace can't go fake
     after a manual/auto lock.
   - Verified truth table (rolled-back tx): unlocked/no-override=ALLOW,
     locked/no-override=BLOCK, locked/future-override=ALLOW, locked/past-override=BLOCK.

3. `2026-06-10-harden-save-group-picks-2p.sql`
   - `save_group_picks_2p` now rejects: team in wrong group, >3 per group, >32 total.
     Empty payload still a no-op (never wipes). Partial valid drafts still allowed.
   - Verified (rolled-back tx): valid-partial=OK, wrong-group=REJECT, >3/group=REJECT,
     valid-32=OK, >32=REJECT.

No new prod data writes for the grace targeting — see Task 8 below.

## App / engine changes (v2.10.9)

- **Completion semantics = exactly 32** (`isTwoPhaseGroupComplete`, app.js). Two-phase
  group stage is complete only at 32 picks with 2-3 per group (24 is NOT done — the
  8 best-thirds are still owed). Applied to: incident banner, `createMemberCard`,
  `_adminMemberProgress`. Banner now stays up for 24-31 incomplete users.
- **Client 32-cap** in `toggleTeamSelection` (+ i18n `groups.maxTotalReached`) mirrors
  the server cap so a legal selection never trips a save rejection.
- **Honest save result**: `savePicksToDb` / `saveKnockoutPicksToDb` return `{ ok, reason }`.
  `finishGroupBetting`, `saveProgressAndExit`, `finishKnockoutBetting` now BLOCK the
  "completed/exit" path when the save didn't land (an honest error toast is already shown).
- **Backup never regresses** (`_tpSnapshot`, app.js): each slice (groups / bracket) falls
  back to the last cached value when the live one is empty, so a knockout-only save can't
  store an empty-groups snapshot that crowds out the good one under the 12-row cap.
  Self-heal already picks the most-complete of {local, server}.
- **Scoring fairness** (`scripts/calculate-scores-v2.js`): `sanitizeTwoPhaseGroupPicks`
  drops team-in-wrong-group rows and de-duplicates a team (scores once per user) before
  awarding group points. Tests added to `test-scoring.js`.

## Task 8 — grace targeting (no change needed)

Report (read-only): extending the affected criterion from `group_picks < 24` to `< 32`
adds **0** new pools. The 2 engaged users with 24-31 picks are already inside pools that
received `lock_at_override` (those pools have other <24 members). The exactly-32 banner
fix ensures those 24-31 users now see the re-enter banner. Current state: 77 two-phase
pools have a future `lock_at_override`; 0 are locked.

## Verification run (all green)

- `node --check` app.js / i18n.js / config.js / calculate-scores-v2.js — OK
- `scripts/test-scoring.js` — 59 passed, 0 failed (incl. new fairness unit tests)
- `scripts/check-destructive-sql.js` — pass
- `scripts/test-sync-transform.js` — 12/0
- `scripts/test-banter.js` — 8 checks
- `scripts/test-live-poller.js` — 5/0
- Read-only prod: `verify-no-truncate-grants.sql` → 0 rows; 77 grace pools.

## Owner follow-ups (deferred / not done here)

- DELETE (not just TRUNCATE) is still granted to anon/authenticated on some reference
  tables (`teams/players/matches`); app code never uses it and `fbGuardDelete` blocks the
  scripts, but a future migration could revoke it too. Out of this task's TRUNCATE scope.
- The 1 historical over-complete (36-row) two-phase user: scoring now ignores the dupes/
  wrong-group rows; the RPC blocks them from saving >32 again. No data edit performed.
- No draft/submit split for two-phase groups (kept minimal pre-kickoff); the exactly-32
  final shape is enforced client-side (`finishGroupBetting`) + by the 32-cap + scoring.
