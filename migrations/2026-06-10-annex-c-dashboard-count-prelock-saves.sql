-- ============================================================
-- 2026-06-10: Count pre-lock Annex C corrections in owner dashboard
-- ============================================================
-- The first dashboard version counted "fixed" only when used_at was set by the
-- post-lock reopen RPC. Before kickoff, affected members can correct their
-- knockout through the normal save_knockout_bracket RPC, which deletes/reinserts
-- all single-phase knockout rows but does not touch knockout_reopen_grants.used_at.
--
-- Correct fixed definition:
--   directly affected Annex C member
--   + has all 31 single-phase knockout picks
--   + either used the post-lock reopen RPC OR all 31 current picks were saved
--     after the Annex C incident grant was created.

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
    select
      user_id,
      pool_id,
      count(*)::int as n,
      min(created_at) as first_pick_at,
      max(created_at) as last_pick_at
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
      gr.created_at as grant_created_at,
      coalesce(b.n, 0) as bracket_count,
      (
        coalesce(b.n, 0) >= 31
        and (
          gr.used_at is not null
          or b.first_pick_at >= gr.created_at
        )
      ) as is_fixed
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
    select
      user_id,
      pool_id,
      count(*)::int as n,
      min(created_at) as first_pick_at,
      max(created_at) as last_pick_at
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
      gr.created_at as grant_created_at,
      coalesce(b.n, 0) as bracket_count,
      (
        coalesce(b.n, 0) >= 31
        and (
          gr.used_at is not null
          or b.first_pick_at >= gr.created_at
        )
      ) as is_fixed
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

revoke all on function public._annex_c_damage_now() from public, anon, authenticated;
revoke all on function public.dashboard_annex_c_damage_metrics(text) from public, anon, authenticated;
alter function public.dashboard_annex_c_damage_metrics(text) owner to postgres;
grant execute on function public.dashboard_annex_c_damage_metrics(text) to anon, authenticated;
