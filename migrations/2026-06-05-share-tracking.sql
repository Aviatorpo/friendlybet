-- ============================================================
-- Bracket-share tracking (v2.8.2)
-- ============================================================
-- The app never recorded share events: "Share my bracket" runs through
-- navigator.share / link intents, all client-side, so we had zero data on how
-- many users shared their bracket. This adds a tiny event log + an anon RPC to
-- write it + a service_role aggregate for the dashboard (which EXCLUDES Israel,
-- per the metric we care about: reach outside our home market).
--
-- Forward-looking only — there is no share history to backfill.
--
-- Funnel model (two event kinds, one row each):
--   'click'     = the user triggered a bracket share (hero button or any chip)
--   'completed' = navigator.share actually RESOLVED (a real share)
-- A successful native share writes one 'click' + one 'completed' row, so
-- completed <= clicks is the funnel. Only the native share sheet can observe
-- completion; desktop link-intent shares are recorded as 'click' only (honest
-- limitation — the browser can't tell whether the user finished in the other app).
--
-- Pieces:
--   1. share_events(user_id, source, kind, created_at)  -- one row per event
--   2. record_share(p_code, p_source, p_kind)           -- anon RPC, fire-and-forget
--   3. share_metrics()                                  -- service_role aggregate, excludes IL
--
-- Idempotent. Run in the Supabase SQL editor (prod). Depends on _uid_from_code
-- (already created by the security-hardening / retention migrations).

-- 1) event table -------------------------------------------------------------
create table if not exists public.share_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  source     text,                          -- 'bracket_card' | 'bracket_chip'
  kind       text not null,                 -- 'click' | 'completed'
  created_at timestamptz not null default now()
);
create index if not exists share_events_user_idx    on public.share_events(user_id);
create index if not exists share_events_created_idx  on public.share_events(created_at);

alter table public.share_events enable row level security;
-- No anon/auth policies: written ONLY through record_share() (SECURITY DEFINER),
-- read ONLY through share_metrics() (service_role). No PII, no IP.
revoke all on public.share_events from anon, authenticated;

-- 2) record_share: resolve caller from recovery code, append one event --------
-- Fire-and-forget from the client; never raises. Returns a constant {ok:true}
-- regardless of whether the code resolved (no recovery-code validity oracle, same
-- as record_activity). Ignores unknown kinds. source is length-capped defensively.
create or replace function public.record_share(p_code text, p_source text, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare v_uid uuid;
begin
  if p_kind not in ('click', 'completed') then
    return jsonb_build_object('ok', true);          -- ignore garbage, no error
  end if;
  v_uid := public._uid_from_code(p_code);
  if v_uid is not null then
    insert into public.share_events(user_id, source, kind)
      values (v_uid, left(coalesce(p_source, ''), 40), p_kind);
  end if;
  return jsonb_build_object('ok', true);            -- constant response: no validity oracle
end$$;

revoke all on function public.record_share(text, text, text) from public;
alter function public.record_share(text, text, text) owner to postgres;
grant execute on function public.record_share(text, text, text) to anon, authenticated;

-- 3) share_metrics: one pre-aggregated JSON for the dashboard, EXCLUDING IL ----
-- "actually shared outside Israel" is the headline. We join users for country and
-- drop country='IL'; rows with no country are kept (unknown != Israel).
create or replace function public.share_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare v jsonb;
begin
  with ev as (
    select e.kind, e.source, e.user_id, coalesce(u.country, '') as country
    from public.share_events e
    join public.users u on u.id = e.user_id
    where coalesce(u.country, '') <> 'IL'           -- exclude Israel
  )
  select jsonb_build_object(
    'generated_at',     now(),
    'excludes_country', 'IL',
    'clicks',           (select count(*)                       from ev where kind = 'click'),
    'completed',        (select count(*)                       from ev where kind = 'completed'),
    'unique_clickers',  (select count(distinct user_id)        from ev where kind = 'click'),
    'unique_sharers',   (select count(distinct user_id)        from ev where kind = 'completed'),
    'by_source', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'source', source, 'clicks', clk, 'completed', cmp) order by clk desc), '[]'::jsonb)
      from (
        select coalesce(nullif(source, ''), '(unknown)') source,
               count(*) filter (where kind = 'click')     clk,
               count(*) filter (where kind = 'completed') cmp
        from ev group by 1
      ) s
    ),
    'by_country', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'country', country, 'completed', cmp) order by cmp desc, country), '[]'::jsonb)
      from (
        select nullif(country, '') country,
               count(*) filter (where kind = 'completed') cmp
        from ev group by 1
      ) c
      where cmp > 0
    )
  ) into v;
  return v;
end$$;

revoke all on function public.share_metrics() from public, anon, authenticated;
alter function public.share_metrics() owner to postgres;
grant execute on function public.share_metrics() to service_role;

-- Tell PostgREST to pick up the new functions immediately.
notify pgrst, 'reload schema';
