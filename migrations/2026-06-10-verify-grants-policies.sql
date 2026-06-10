-- ============================================================
-- 2026-06-10: READ-ONLY verification of grants + RLS policies
-- ============================================================
-- Safe to run in the Supabase SQL editor any time — it only SELECTs, never writes.
-- Use it to confirm production protection after the knockout_picks wipe incident:
--   * anon/authenticated/public must have NO INSERT/UPDATE/DELETE/TRUNCATE on the
--     prediction + account tables (writes go only through SECURITY DEFINER RPCs);
--   * surface any leftover permissive RLS policies (USING (true) / WITH CHECK (true))
--     so they can be reviewed/removed (they are inert once grants are revoked, but
--     they are weak defense-in-depth and confusing).
-- Expected healthy result: for every protected table, anon/authenticated show only
-- SELECT (+ REFERENCES/TRIGGER) — never INSERT/UPDATE/DELETE/TRUNCATE.

\echo '--- 1) WRITE grants held by anon/authenticated/public on protected tables (want: NONE) ---'
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated','public')
  and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  and table_name in (
    'knockout_picks','group_picks','group_position_picks','tournament_winner_picks',
    'top_scorer_picks','sp_third_place_picks','pick_backups','users','pools')
order by table_name, grantee, privilege_type;

\echo '--- 2) ALL grants (incl. read) on protected + reference tables, for review ---'
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated','public')
  and table_name in (
    'knockout_picks','group_picks','group_position_picks','tournament_winner_picks',
    'top_scorer_picks','sp_third_place_picks','pick_backups','users','pools',
    'matches','teams','players')
group by table_name, grantee
order by table_name, grantee;

\echo '--- 3) RLS policies on protected tables — flag permissive USING(true)/WITH CHECK(true) ---'
select tablename, policyname, cmd, roles::text as roles,
       coalesce(qual, '(none)') as using_expr,
       coalesce(with_check, '(none)') as with_check_expr,
       case when coalesce(qual,'') = 'true' or coalesce(with_check,'') = 'true'
            then 'REVIEW: permissive' else 'ok' end as note
from pg_policies
where schemaname = 'public'
  and tablename in (
    'knockout_picks','group_picks','group_position_picks','tournament_winner_picks',
    'top_scorer_picks','sp_third_place_picks','pick_backups','users','pools')
order by tablename, cmd, policyname;

\echo '--- 4) Is RLS actually enabled on each protected table? (want: rls=true) ---'
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'knockout_picks','group_picks','group_position_picks','tournament_winner_picks',
    'top_scorer_picks','sp_third_place_picks','pick_backups','users','pools')
order by c.relname;
