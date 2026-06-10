-- ============================================================
-- 2026-06-10: HARDENING — revoke TRUNCATE on all pick tables
-- ============================================================
-- INCIDENT (2026-06-10 ~05:00 UTC): a manual `TRUNCATE knockout_picks CASCADE`
-- (run once in the SQL editor / a direct connection — NOT from app code or any
-- committed migration) wiped the ENTIRE knockout_picks table: ~1,000 complete
-- single-phase brackets + partials (~31k rows) gone in one statement. Confirmed
-- via pg_stat_statements ("TRUNCATE knockout_picks CASCADE", calls=1) and the
-- table's oldest surviving row being the first post-truncate re-entry (05:00:33Z).
-- All other pick tables (group_position_picks / tournament_winner_picks /
-- top_scorer_picks / pick_backups) were untouched. Recovery: heal_brackets_from_backup()
-- restored 1,039 brackets from the users' own pick_backups; the ~370 with no backup
-- (pre-v2.9.5 sessions) must re-enter — the dashboard banner guides them.
--
-- ROOT-CAUSE HARDENING: the v2.6.87 security revoke dropped anon/authenticated
-- INSERT/UPDATE/DELETE on the pick tables but LEFT the TRUNCATE grant in place.
-- TRUNCATE isn't reachable through PostgREST (so this specific wipe was a
-- privileged manual command, not an anon exploit), but leaving anon/authenticated
-- holding TRUNCATE on user-data tables is needless blast radius. Drop it everywhere.
-- Idempotent — safe to re-run.

revoke truncate on public.knockout_picks         from anon, authenticated, public;
revoke truncate on public.group_position_picks    from anon, authenticated, public;
revoke truncate on public.tournament_winner_picks  from anon, authenticated, public;
revoke truncate on public.top_scorer_picks         from anon, authenticated, public;
revoke truncate on public.group_picks              from anon, authenticated, public;
revoke truncate on public.sp_third_place_picks     from anon, authenticated, public;
revoke truncate on public.pick_backups             from anon, authenticated, public;

-- After this, anon/authenticated retain only SELECT, REFERENCES, TRIGGER on these
-- tables; all writes (incl. TRUNCATE) go exclusively through the SECURITY DEFINER
-- RPCs. Operational note: NEVER run TRUNCATE/DELETE on a pick table by hand —
-- use the scoped RPCs; if a table truly must be cleared, snapshot it first.
