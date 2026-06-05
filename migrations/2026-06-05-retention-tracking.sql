-- ============================================================
-- Retention tracking (v2.7.7)
-- ============================================================
-- Adds the ONE signal the app was missing: a per-user-per-day activity log,
-- so we can compute real retention (DAU/WAU/MAU, cohort curves, match-day
-- stickiness). The existing users.last_active_at was set once at signup and
-- never moved -> retention always read 0. This is forward-looking only:
-- there is no activity history to backfill, so the first meaningful D7
-- numbers appear ~1 week after the client heartbeat ships.
--
-- Pieces:
--   1. user_activity_daily(user_id, day)         -- one tiny row per active day
--   2. record_activity(p_code)                    -- anon RPC, throttled client-side
--   3. _cohort_ret_pct(cohort, offset)            -- internal helper
--   4. retention_metrics()                        -- server-side aggregate for the dashboard
--
-- Idempotent. Run in the Supabase SQL editor (prod).

-- 1) activity table -----------------------------------------------------------
create table if not exists public.user_activity_daily (
  user_id uuid not null references public.users(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
-- only (user_id, day); no PII, no IP. The PK makes "once per day" a no-op upsert.
create index if not exists user_activity_daily_day_idx on public.user_activity_daily(day);

alter table public.user_activity_daily enable row level security;
-- No anon/auth policies: the table is written ONLY through record_activity()
-- (SECURITY DEFINER) and read ONLY through retention_metrics() (service_role).
revoke all on public.user_activity_daily from anon, authenticated;

-- 2) record_activity: resolve caller from recovery code, stamp today ----------
-- Fire-and-forget from the client. Invalid code -> quiet {ok:false}, never raises
-- (it must not surface console errors on a best-effort heartbeat).
create or replace function public.record_activity(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare v_uid uuid;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then
    return jsonb_build_object('ok', false);
  end if;
  insert into public.user_activity_daily(user_id, day)
    values (v_uid, current_date)
    on conflict (user_id, day) do nothing;
  update public.users set last_active_at = now() where id = v_uid;
  return jsonb_build_object('ok', true);
end$$;

revoke all on function public.record_activity(text) from public;
alter function public.record_activity(text) owner to postgres;
grant execute on function public.record_activity(text) to anon, authenticated;

-- 3) cohort retention helper --------------------------------------------------
-- % of the users who joined on p_cohort that were active on (p_cohort + p_offset).
-- Internal only; called from retention_metrics (runs as owner, no grant needed).
create or replace function public._cohort_ret_pct(p_cohort date, p_offset int)
returns numeric
language sql
security definer
set search_path = ''
as $$
  select case when c.sz = 0 then 0 else round(100.0 * (
      select count(distinct a.user_id)
      from public.user_activity_daily a
      join public.users u on u.id = a.user_id
      where (u.joined_at)::date = p_cohort
        and a.day = p_cohort + p_offset
    ) / c.sz, 1) end
  from (select count(*) sz from public.users where (joined_at)::date = p_cohort) c;
$$;
revoke all on function public._cohort_ret_pct(date, int) from public, anon, authenticated;
alter function public._cohort_ret_pct(date, int) owner to postgres;

-- 4) retention_metrics: one pre-aggregated JSON for the dashboard -------------
-- Aggregated server-side on purpose: the raw table will outgrow the dashboard's
-- 10k-row REST cap, and this keeps the hourly build fast.
create or replace function public.retention_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_total int; v_dau int; v_wau int; v_mau int; v_ret int;
  v_daily jsonb; v_cohorts jsonb; v_md jsonb;
begin
  select count(*) into v_total from public.users;
  select count(distinct user_id) into v_dau from public.user_activity_daily where day = current_date;
  select count(distinct user_id) into v_wau from public.user_activity_daily where day >= current_date - 6;
  select count(distinct user_id) into v_mau from public.user_activity_daily where day >= current_date - 29;

  select count(distinct a.user_id) into v_ret
    from public.user_activity_daily a
    join public.users u on u.id = a.user_id
   where a.day > (u.joined_at)::date;

  -- last 30 days: active / new / returning
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', d::text, 'active', act, 'new_users', nu, 'returning', ret) order by d), '[]'::jsonb)
    into v_daily
  from (
    select g.d::date d,
      (select count(distinct a.user_id) from public.user_activity_daily a where a.day = g.d::date) act,
      (select count(*) from public.users u where (u.joined_at)::date = g.d::date) nu,
      (select count(distinct a.user_id) from public.user_activity_daily a
         join public.users u on u.id = a.user_id
        where a.day = g.d::date and (u.joined_at)::date < g.d::date) ret
    from generate_series(current_date - 29, current_date, interval '1 day') g(d)
  ) s;

  -- last 14 signup cohorts x retention offsets
  select coalesce(jsonb_agg(jsonb_build_object(
           'cohort_day', c::text, 'size', sz,
           'd0_pct',  public._cohort_ret_pct(c, 0),
           'd1_pct',  public._cohort_ret_pct(c, 1),
           'd3_pct',  public._cohort_ret_pct(c, 3),
           'd7_pct',  public._cohort_ret_pct(c, 7),
           'd14_pct', public._cohort_ret_pct(c, 14)) order by c desc), '[]'::jsonb)
    into v_cohorts
  from (
    select (joined_at)::date c, count(*) sz
    from public.users
    where (joined_at)::date >= current_date - 13
    group by 1
  ) ch;

  -- match-day vs ordinary-day average DAU (last 30d window)
  select jsonb_build_object(
           'matchday_avg_dau',    coalesce(round(avg(dau) filter (where is_md), 1), 0),
           'nonmatchday_avg_dau', coalesce(round(avg(dau) filter (where not is_md), 1), 0))
    into v_md
  from (
    select g.d::date d,
      (select count(distinct a.user_id) from public.user_activity_daily a where a.day = g.d::date) dau,
      exists(select 1 from public.matches m where (m.match_date)::date = g.d::date) is_md
    from generate_series(current_date - 29, current_date, interval '1 day') g(d)
  ) x;

  return jsonb_build_object(
    'generated_at', now(),
    'total_users', v_total,
    'dau', v_dau, 'wau', v_wau, 'mau', v_mau,
    'stickiness_pct', case when v_mau = 0 then 0 else round(100.0 * v_dau / v_mau, 1) end,
    'returned_after_signup', v_ret,
    'returned_after_signup_pct', case when v_total = 0 then 0 else round(100.0 * v_ret / v_total, 1) end,
    'daily', v_daily,
    'cohorts', v_cohorts,
    'matchday', v_md
  );
end$$;

revoke all on function public.retention_metrics() from public, anon, authenticated;
alter function public.retention_metrics() owner to postgres;
grant execute on function public.retention_metrics() to service_role;

-- Tell PostgREST to pick up the new functions immediately.
notify pgrst, 'reload schema';
