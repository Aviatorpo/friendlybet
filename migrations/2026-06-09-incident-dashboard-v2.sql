-- ============================================================
-- 2026-06-09 v2: incident dashboard — separate REAL damage from normal in-progress
-- ============================================================
-- The first version's "gap" (groups>=48 & bracket<31) conflated two very different
-- groups, which made the headline rise with normal signups and look like an active
-- bug. It is NOT: saving works (brackets reach 31 continuously) and ~nobody is in
-- the "completed-but-unsaved" state. Split the gap honestly:
--   gap_submitted   = SUBMITTED but bracket<31  → the real "must re-enter" (≈stable)
--   gap_in_progress = NOT submitted, bracket<31 → still filling (benign, grows with
--                     signups; most will finish)
-- Also expose saved_last_hour = brackets that reached 31 in the last hour, as a
-- live "saving is working" proof. Idempotent.

alter table public.incident_snapshots add column if not exists gap_submitted   int;
alter table public.incident_snapshots add column if not exists gap_in_progress int;
alter table public.incident_snapshots add column if not exists saved_last_hour int;

drop function if exists public._incident_now();
create function public._incident_now()
returns table(total_sp_users int, total_sp_pools int, completed_full int,
              gap_total int, gap_submitted int, gap_in_progress int,
              affected_pools int, gap_with_backup int, gap_no_backup int, saved_last_hour int)
language sql security definer set search_path to '' set statement_timeout to '25s' stable
as $$
  with grp as (select user_id, pool_id, count(*) n from public.group_position_picks group by 1,2),
       brk as (select user_id, pool_id, count(*) n, max(created_at) last
               from public.knockout_picks where bracket_position is not null group by 1,2),
       fullbk as (select distinct b.user_id, b.pool_id from public.pick_backups b
                  where jsonb_typeof(b.payload->'bracketPicks')='object'
                    and (select count(*) from jsonb_each_text(b.payload->'bracketPicks') e where e.value<>'')=31),
       u as (
         select usr.id, usr.pool_id, usr.predictions_submitted_at sub,
                coalesce(g.n,0) gn, coalesce(k.n,0) kn,
                exists(select 1 from fullbk f where f.user_id=usr.id and f.pool_id=usr.pool_id) hasbk
         from public.users usr
         join public.pools p on p.id=usr.pool_id and p.betting_mode='single_phase'
         left join grp g on g.user_id=usr.id and g.pool_id=usr.pool_id
         left join brk k on k.user_id=usr.id and k.pool_id=usr.pool_id
       ),
       lasthr as (select count(*)::int n from brk where n>=31 and last >= now() - interval '1 hour')
  select
    (select count(*) from u)::int,
    (select count(*) from public.pools where betting_mode='single_phase')::int,
    count(*) filter (where gn>=48 and kn>=31)::int,
    count(*) filter (where gn>=48 and kn<31)::int,
    count(*) filter (where gn>=48 and kn<31 and sub is not null)::int,
    count(*) filter (where gn>=48 and kn<31 and sub is null)::int,
    (select count(distinct pool_id) from u where gn>=48 and kn<31 and sub is not null)::int,
    count(*) filter (where gn>=48 and kn<31 and hasbk)::int,
    count(*) filter (where gn>=48 and kn<31 and not hasbk)::int,
    (select n from lasthr)
  from u;
$$;

create or replace function public.record_incident_snapshot()
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '30s'
as $$
declare r record;
begin
  select * into r from public._incident_now();
  insert into public.incident_snapshots
    (total_sp_users,total_sp_pools,completed_full,gap_total,gap_submitted,gap_in_progress,
     affected_pools,gap_with_backup,gap_no_backup,saved_last_hour)
  values (r.total_sp_users,r.total_sp_pools,r.completed_full,r.gap_total,r.gap_submitted,r.gap_in_progress,
          r.affected_pools,r.gap_with_backup,r.gap_no_backup,r.saved_last_hour);
  return jsonb_build_object('gap_submitted',r.gap_submitted,'gap_in_progress',r.gap_in_progress,
                            'completed_full',r.completed_full,'saved_last_hour',r.saved_last_hour);
end$$;

create or replace function public.dashboard_incident_metrics(p_secret text)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '20s'
as $$
declare v_now record; v_pools jsonb; v_trend jsonb;
begin
  if p_secret is null or p_secret <> 'REDACTED_OWNER_DASHBOARD_SECRET' then
    raise exception 'unauthorized'; end if;
  select * into v_now from public._incident_now();

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

  return jsonb_build_object('now', to_jsonb(v_now), 'by_pool', v_pools, 'trend', v_trend, 'generated_at', now());
end$$;

revoke all on function public._incident_now() from public, anon, authenticated;
revoke all on function public.record_incident_snapshot() from public, anon, authenticated;
grant execute on function public.record_incident_snapshot() to service_role;
revoke all on function public.dashboard_incident_metrics(text) from public, anon, authenticated;
alter function public.dashboard_incident_metrics(text) owner to postgres;
grant execute on function public.dashboard_incident_metrics(text) to anon, authenticated;
