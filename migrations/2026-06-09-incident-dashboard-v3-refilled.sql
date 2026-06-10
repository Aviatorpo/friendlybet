-- ============================================================
-- 2026-06-09 v3: incident dashboard — measure AFFECTED users who re-filled
-- ============================================================
-- Adds a clean, rolling "affected users who came back and re-filled their knockout"
-- metric to dashboard_incident_metrics. Definition (precise + honest):
--   user SUBMITTED before the window (committed earlier, was in the
--   submitted-but-no-bracket state) AND now has a full bracket (>=31) whose latest
--   bracket row was created within the window.
-- This catches a victim returning to finish their knockout, and EXCLUDES first-timers
-- (their submitted_at is recent) and the one-time backup restore (it ran hours ago,
-- outside a 1-3h window). Computed live (rolling), not snapshotted. Idempotent.

create or replace function public.dashboard_incident_metrics(p_secret text)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '25s'
as $$
declare v_now record; v_pools jsonb; v_trend jsonb; v_ref1 int; v_real int;
  -- the one-time backup-restore finished ~03:43 UTC on 2026-06-09. Anything after this is genuine
  -- user activity, NOT the restore (the restore writes knockout_picks but creates NO pick_backups).
  c_restore_end constant timestamptz := timestamptz '2026-06-09 03:45:00+00';
begin
  if p_secret is null or p_secret <> 'REDACTED_OWNER_DASHBOARD_SECRET' then
    raise exception 'unauthorized'; end if;
  select * into v_now from public._incident_now();

  -- REAL re-fills (EXCLUDES the 321 backup-restore): a bug-affected member who came back to the app
  -- and saved a full knockout. Conditions: submitted before the restore (was a committed victim) AND
  -- now has a full live bracket (>=31, so it saved + displays) whose latest row landed after the
  -- restore AND has a client-written pick_backup after the restore (proves they were in the app
  -- saving — the restore never creates backups, so this cleanly excludes restored users).
  with brk as (select user_id, pool_id, count(*) n, max(created_at) last
               from public.knockout_picks where bracket_position is not null group by 1,2),
       real_refills as (
         select u.id, b.last
         from public.users u
         join public.pools p on p.id=u.pool_id and p.betting_mode='single_phase'
         join brk b on b.user_id=u.id and b.pool_id=u.pool_id
         where u.predictions_submitted_at is not null
           and u.predictions_submitted_at < c_restore_end
           and b.n >= 31
           and b.last >= c_restore_end
           and exists(select 1 from public.pick_backups pb
                      where pb.user_id=u.id and pb.pool_id=u.pool_id and pb.created_at >= c_restore_end)
       )
  select count(*) filter (where last >= now() - interval '1 hour'),
         count(*)
    into v_ref1, v_real
  from real_refills;

  with grp as (select user_id, pool_id, count(*) n from public.group_position_picks group by 1,2),
       brk as (select user_id, pool_id, count(*) n from public.knockout_picks
               where bracket_position is not null group by 1,2),
       u as (
         select usr.id, usr.pool_id, usr.predictions_submitted_at sub, coalesce(g.n,0) gn, coalesce(k.n,0) kn
         from public.users usr
         join public.pools p on p.id=usr.pool_id and p.betting_mode='single_phase'
         left join grp g on g.user_id=usr.id and g.pool_id=usr.pool_id
         left join brk k on k.user_id=usr.id and k.pool_id=usr.pool_id
       ),
       per_pool as (
         select pool_id,
                count(*) filter (where gn>=48 and kn<31 and sub is not null) must_reenter,
                count(*) filter (where gn>=48 and kn<31 and sub is null) in_progress,
                count(*) filter (where gn>=48 and kn>=31) completed,
                count(*) total
         from u group by pool_id
       )
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', p.code, 'name', p.name, 'size', pp.total,
           'must_reenter', pp.must_reenter, 'in_progress', pp.in_progress, 'completed', pp.completed
         ) order by pp.must_reenter desc, pp.total desc), '[]'::jsonb)
    into v_pools
  from per_pool pp join public.pools p on p.id = pp.pool_id
  where pp.must_reenter > 0
  limit 80;

  select coalesce(jsonb_agg(jsonb_build_object(
           't', captured_at, 'submitted', coalesce(gap_submitted,gap_total),
           'in_progress', coalesce(gap_in_progress,0), 'done', completed_full
         ) order by captured_at), '[]'::jsonb)
    into v_trend
  from (select * from public.incident_snapshots order by captured_at desc limit 400) s;

  return jsonb_build_object('now', to_jsonb(v_now), 'by_pool', v_pools, 'trend', v_trend,
                            'real_refills', v_real, 'real_refills_1h', v_ref1, 'generated_at', now());
end$$;
