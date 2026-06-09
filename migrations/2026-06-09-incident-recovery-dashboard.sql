-- ============================================================
-- 2026-06-09: incident-recovery dashboard (owner-only) — track bug damage + recovery
-- ============================================================
-- Powers a private dashboard that shows the knockout-bracket-loss damage and how
-- fast we're reducing it: how many single-phase members completed groups but are
-- missing a full bracket ("gap"), split by recoverable-from-backup vs must-re-enter,
-- which pools are affected, and a time-series so the curve can be watched shrinking.
--
-- Three objects:
--   _incident_now()            internal aggregate of the CURRENT numbers
--   record_incident_snapshot() service_role; appends current numbers to a snapshot
--                              table (called every 10 min by heal-brackets.yml)
--   dashboard_incident_metrics(p_secret) secret-gated, browser-callable; returns
--                              current numbers + per-pool breakdown + the trend
-- Read-only over pick tables; no PII beyond pool name/code + nicknames are NOT
-- returned. Idempotent.

create table if not exists public.incident_snapshots (
  id            bigserial primary key,
  captured_at   timestamptz not null default now(),
  total_sp_users  int,
  total_sp_pools  int,
  completed_full  int,
  gap_total       int,
  affected_pools  int,
  gap_with_backup int,
  gap_no_backup   int
);
create index if not exists incident_snapshots_captured_idx on public.incident_snapshots(captured_at);

-- Current aggregate (single source of truth for the numbers).
create or replace function public._incident_now()
returns table(total_sp_users int, total_sp_pools int, completed_full int, gap_total int,
              affected_pools int, gap_with_backup int, gap_no_backup int)
language sql security definer set search_path to '' set statement_timeout to '20s' stable
as $$
  with grp as (select user_id, pool_id, count(*) n from public.group_position_picks group by 1,2),
       brk as (select user_id, pool_id, count(*) n from public.knockout_picks
               where bracket_position is not null group by 1,2),
       fullbk as (select distinct b.user_id, b.pool_id from public.pick_backups b
                  where jsonb_typeof(b.payload->'bracketPicks')='object'
                    and (select count(*) from jsonb_each_text(b.payload->'bracketPicks') e where e.value<>'')=31),
       u as (
         select usr.id, usr.pool_id,
                coalesce(g.n,0) gn, coalesce(k.n,0) kn,
                exists(select 1 from fullbk f where f.user_id=usr.id and f.pool_id=usr.pool_id) hasbk
         from public.users usr
         join public.pools p on p.id=usr.pool_id and p.betting_mode='single_phase'
         left join grp g on g.user_id=usr.id and g.pool_id=usr.pool_id
         left join brk k on k.user_id=usr.id and k.pool_id=usr.pool_id
       )
  select
    (select count(*) from u)::int,
    (select count(*) from public.pools where betting_mode='single_phase')::int,
    count(*) filter (where gn>=48 and kn>=31)::int,
    count(*) filter (where gn>=48 and kn<31)::int,
    (select count(distinct pool_id) from u where gn>=48 and kn<31)::int,
    count(*) filter (where gn>=48 and kn<31 and hasbk)::int,
    count(*) filter (where gn>=48 and kn<31 and not hasbk)::int
  from u;
$$;

-- Append a snapshot (service_role; the heal workflow calls this every 10 min).
create or replace function public.record_incident_snapshot()
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '30s'
as $$
declare r record;
begin
  select * into r from public._incident_now();
  insert into public.incident_snapshots
    (total_sp_users,total_sp_pools,completed_full,gap_total,affected_pools,gap_with_backup,gap_no_backup)
  values (r.total_sp_users,r.total_sp_pools,r.completed_full,r.gap_total,r.affected_pools,r.gap_with_backup,r.gap_no_backup);
  return jsonb_build_object('gap_total',r.gap_total,'completed_full',r.completed_full,'gap_no_backup',r.gap_no_backup);
end$$;

-- Owner dashboard (secret-gated, browser-callable — same pattern/secret as dashboard_signups).
create or replace function public.dashboard_incident_metrics(p_secret text)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '20s'
as $$
declare v_now record; v_pools jsonb; v_trend jsonb;
begin
  if p_secret is null or p_secret <> 'e7f0cae4b489a60a6372a1303bd70c2d3451d4188523199f' then
    raise exception 'unauthorized'; end if;
  select * into v_now from public._incident_now();

  with grp as (select user_id, pool_id, count(*) n from public.group_position_picks group by 1,2),
       brk as (select user_id, pool_id, count(*) n from public.knockout_picks
               where bracket_position is not null group by 1,2),
       u as (
         select usr.id, usr.pool_id, coalesce(g.n,0) gn, coalesce(k.n,0) kn
         from public.users usr
         join public.pools p on p.id=usr.pool_id and p.betting_mode='single_phase'
         left join grp g on g.user_id=usr.id and g.pool_id=usr.pool_id
         left join brk k on k.user_id=usr.id and k.pool_id=usr.pool_id
       ),
       per_pool as (
         select pool_id,
                count(*) filter (where gn>=48 and kn<31) gap,
                count(*) filter (where gn>=48 and kn>=31) completed,
                count(*) total
         from u group by pool_id
       )
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', p.code, 'name', p.name, 'size', pp.total, 'gap', pp.gap, 'completed', pp.completed
         ) order by pp.gap desc, pp.total desc), '[]'::jsonb)
    into v_pools
  from per_pool pp join public.pools p on p.id = pp.pool_id
  where pp.gap > 0
  limit 60;

  select coalesce(jsonb_agg(jsonb_build_object(
           't', captured_at, 'gap', gap_total, 'done', completed_full,
           'no_backup', gap_no_backup, 'pools', affected_pools
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
