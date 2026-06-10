-- Verification: no non-admin role may hold TRUNCATE on an application table.
-- Expected result: ZERO rows. Run after the revoke migration (and in CI / by ops).
select table_name, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and privilege_type = 'TRUNCATE'
   and grantee in ('anon', 'authenticated', 'PUBLIC')
   and table_name in (
     'teams','players','matches','admin_actions','app_settings',
     'group_picks','knockout_picks','group_position_picks',
     'tournament_winner_picks','top_scorer_picks','sp_third_place_picks',
     'pick_backups','users','pools'
   )
 order by table_name, grantee;
