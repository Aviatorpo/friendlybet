-- ============================================================================
-- 2026-06-10  get_pick_backup: return the BEST snapshot, not blindly the latest
-- ----------------------------------------------------------------------------
-- For TWO-PHASE pools, prefer the backup with a COMPLETE group set (exactly 32
-- picks, groups A-L each 2-3) over a later sparse/bracket-only snapshot; fall back
-- to the one with the most group picks; created_at is only the tie-breaker. This
-- closes the gap where a later bad snapshot could shadow an older complete one.
-- SINGLE-PHASE behaviour is UNCHANGED (latest), because its snapshots are always
-- full cumulative state and "latest" is correct (a user may have intentionally
-- removed a pick, so a more-complete older one must NOT win).
--
-- Idempotent CREATE OR REPLACE; signature unchanged; SECURITY DEFINER + locked
-- search_path + short timeout preserved.
-- ============================================================================
create or replace function public.get_pick_backup(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare v_uid uuid; v_pid uuid; v_mode text; v jsonb;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then return null; end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then return null; end if;
  select betting_mode into v_mode from public.pools where id = v_pid;

  if v_mode = 'two_phase' then
    select payload into v from (
      select b.payload, b.created_at,
        -- total picks across the real A-L group keys only (junk keys ignored)
        case when jsonb_typeof(b.payload->'groupPositions') = 'object' then
          coalesce((select sum(jsonb_array_length(e.value))
                    from jsonb_each(b.payload->'groupPositions') e
                    where e.key in ('A','B','C','D','E','F','G','H','I','J','K','L')
                      and jsonb_typeof(e.value) = 'array'), 0)
        else 0 end as g_total,
        -- complete = ALL 12 real groups A-L present, each holding 2-3, total 32
        case when jsonb_typeof(b.payload->'groupPositions') = 'object'
          and (select count(*) from jsonb_each(b.payload->'groupPositions') e
               where e.key in ('A','B','C','D','E','F','G','H','I','J','K','L')
                 and jsonb_typeof(e.value) = 'array'
                 and jsonb_array_length(e.value) between 2 and 3) = 12
          and coalesce((select sum(jsonb_array_length(e.value))
                        from jsonb_each(b.payload->'groupPositions') e
                        where e.key in ('A','B','C','D','E','F','G','H','I','J','K','L')
                          and jsonb_typeof(e.value) = 'array'), 0) = 32
        then 1 else 0 end as g_valid
      from public.pick_backups b
      where b.user_id = v_uid and b.pool_id = v_pid
    ) s
    order by s.g_valid desc, s.g_total desc, s.created_at desc
    limit 1;
  else
    select payload into v from public.pick_backups
      where user_id = v_uid and pool_id = v_pid
      order by created_at desc
      limit 1;
  end if;

  return v;
end$function$;
