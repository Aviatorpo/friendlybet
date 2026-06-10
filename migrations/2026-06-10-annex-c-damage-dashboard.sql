-- ============================================================
-- 2026-06-10: Owner Annex C damage dashboard
-- ============================================================
-- Tracks only members directly affected by the FIFA Annex C pairing bug:
-- knockout_reopen_grants.incident_key='annex_c_2026'
-- and impact_kind='hard_invalid_r32'.
--
-- "Fixed" means the member successfully saved through the reopen flow and now
-- has a complete 31-pick single-phase knockout bracket.

create table if not exists public.annex_c_damage_snapshots (
  id                 bigserial primary key,
  captured_at        timestamptz not null default now(),
  total_affected     int not null,
  fixed_success      int not null,
  remaining_unfixed  int not null,
  active_unfixed     int not null,
  expired_unfixed    int not null,
  affected_pools     int not null
);

create index if not exists annex_c_damage_snapshots_captured_idx
  on public.annex_c_damage_snapshots(captured_at);

create or replace function public._annex_c_damage_now()
returns table(
  total_affected int,
  fixed_success int,
  remaining_unfixed int,
  active_unfixed int,
  expired_unfixed int,
  affected_pools int
)
language sql
security definer
set search_path to ''
set statement_timeout to '20s'
stable
as $$
  with brk as (
    select user_id, pool_id, count(*) n
    from public.knockout_picks
    where bracket_position is not null
    group by 1,2
  ),
  hard as (
    select
      gr.user_id,
      gr.pool_id,
      gr.expires_at,
      gr.used_at,
      coalesce(b.n, 0) as bracket_count,
      (gr.used_at is not null and coalesce(b.n, 0) >= 31) as is_fixed
    from public.knockout_reopen_grants gr
    join public.users u on u.id = gr.user_id and u.pool_id = gr.pool_id
    join public.pools p on p.id = gr.pool_id and p.betting_mode = 'single_phase'
    left join brk b on b.user_id = gr.user_id and b.pool_id = gr.pool_id
    where gr.incident_key = 'annex_c_2026'
      and gr.impact_kind = 'hard_invalid_r32'
  )
  select
    count(*)::int,
    count(*) filter (where is_fixed)::int,
    count(*) filter (where not is_fixed)::int,
    count(*) filter (where not is_fixed and expires_at > now())::int,
    count(*) filter (where not is_fixed and expires_at <= now())::int,
    count(distinct pool_id)::int
  from hard;
$$;

create or replace function public.record_annex_c_damage_snapshot()
returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout to '30s'
as $$
declare r record;
begin
  select * into r from public._annex_c_damage_now();
  insert into public.annex_c_damage_snapshots
    (total_affected, fixed_success, remaining_unfixed, active_unfixed, expired_unfixed, affected_pools)
  values
    (r.total_affected, r.fixed_success, r.remaining_unfixed, r.active_unfixed, r.expired_unfixed, r.affected_pools);
  return to_jsonb(r);
end$$;

create or replace function public.dashboard_annex_c_damage_metrics(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout to '30s'
as $$
declare
  v_now record;
  v_pools jsonb;
  v_trend jsonb;
begin
  -- Existing owner dashboard secret. Do not expose it in frontend code.
  if p_secret is null or p_secret <> 'REDACTED_OWNER_DASHBOARD_SECRET' then
    raise exception 'unauthorized';
  end if;

  select * into v_now from public._annex_c_damage_now();

  -- Keep a low-frequency trend automatically whenever the owner dashboard is open.
  if not exists (
    select 1 from public.annex_c_damage_snapshots
    where captured_at > now() - interval '5 minutes'
  ) then
    insert into public.annex_c_damage_snapshots
      (total_affected, fixed_success, remaining_unfixed, active_unfixed, expired_unfixed, affected_pools)
    values
      (v_now.total_affected, v_now.fixed_success, v_now.remaining_unfixed,
       v_now.active_unfixed, v_now.expired_unfixed, v_now.affected_pools);
  end if;

  with brk as (
    select user_id, pool_id, count(*) n
    from public.knockout_picks
    where bracket_position is not null
    group by 1,2
  ),
  hard as (
    select
      gr.user_id,
      gr.pool_id,
      gr.expires_at,
      gr.used_at,
      coalesce(b.n, 0) as bracket_count,
      (gr.used_at is not null and coalesce(b.n, 0) >= 31) as is_fixed
    from public.knockout_reopen_grants gr
    join public.users u on u.id = gr.user_id and u.pool_id = gr.pool_id
    join public.pools p on p.id = gr.pool_id and p.betting_mode = 'single_phase'
    left join brk b on b.user_id = gr.user_id and b.pool_id = gr.pool_id
    where gr.incident_key = 'annex_c_2026'
      and gr.impact_kind = 'hard_invalid_r32'
  ),
  per_pool as (
    select
      pool_id,
      count(*)::int as affected,
      count(*) filter (where is_fixed)::int as fixed,
      count(*) filter (where not is_fixed)::int as remaining,
      count(*) filter (where not is_fixed and expires_at > now())::int as active_remaining,
      count(*) filter (where not is_fixed and expires_at <= now())::int as expired_remaining
    from hard
    group by pool_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'pool_id', p.id,
      'code', p.code,
      'name', p.name,
      'affected', pp.affected,
      'fixed', pp.fixed,
      'remaining', pp.remaining,
      'active_remaining', pp.active_remaining,
      'expired_remaining', pp.expired_remaining
    ) order by pp.remaining desc, pp.affected desc, p.name), '[]'::jsonb)
    into v_pools
  from per_pool pp
  join public.pools p on p.id = pp.pool_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      't', captured_at,
      'affected', total_affected,
      'fixed', fixed_success,
      'remaining', remaining_unfixed,
      'active_remaining', active_unfixed,
      'expired_remaining', expired_unfixed,
      'pools', affected_pools
    ) order by captured_at), '[]'::jsonb)
    into v_trend
  from (
    select *
    from public.annex_c_damage_snapshots
    order by captured_at desc
    limit 288
  ) s;

  return jsonb_build_object(
    'now', to_jsonb(v_now),
    'by_pool', v_pools,
    'trend', v_trend,
    'generated_at', now()
  );
end$$;

revoke all on table public.annex_c_damage_snapshots from public, anon, authenticated;
revoke all on function public._annex_c_damage_now() from public, anon, authenticated;
revoke all on function public.record_annex_c_damage_snapshot() from public, anon, authenticated;
grant execute on function public.record_annex_c_damage_snapshot() to service_role;
revoke all on function public.dashboard_annex_c_damage_metrics(text) from public, anon, authenticated;
alter function public.dashboard_annex_c_damage_metrics(text) owner to postgres;
grant execute on function public.dashboard_annex_c_damage_metrics(text) to anon, authenticated;
