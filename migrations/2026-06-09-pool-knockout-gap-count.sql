-- ============================================================
-- 2026-06-09: pool_knockout_gap_count() — how many members need their knockout
-- ============================================================
-- Powers the admin dashboard nudge: counts single-phase members of a pool who
-- completed their groups (>=48 picks) but whose live knockout bracket is
-- incomplete (<31) — i.e. the bracket-save-loss victims the admin should remind.
-- Computed DB-side so it's correct for big pools (a 200-member pool has ~10k
-- group-pick rows, far past PostgREST's 1000-row default cap). Returns just an
-- integer (no PII). p_exclude lets the caller omit themselves so the count means
-- "other members". Idempotent.
--
-- TODO (post-kickoff): anon-callable; returns only an integer derived from
-- already-anon-readable data, so exposure is low — but re-scope it to
-- admin-of-this-pool via a recovery code (_auth_writer) once the rush is over.

create or replace function public.pool_knockout_gap_count(p_pool_id uuid, p_exclude uuid default null)
returns int
language sql
security definer
set search_path to ''
set statement_timeout to '5s'
stable
as $$
  with grp as (select user_id, count(*) n from public.group_position_picks where pool_id = p_pool_id group by 1),
       brk as (select user_id, count(*) n from public.knockout_picks
               where pool_id = p_pool_id and bracket_position is not null group by 1)
  select count(*)::int
  from public.users u
  join public.pools p on p.id = u.pool_id and p.betting_mode = 'single_phase'
  left join grp on grp.user_id = u.id
  left join brk on brk.user_id = u.id
  where u.pool_id = p_pool_id
    and (p_exclude is null or u.id <> p_exclude)
    and coalesce(grp.n, 0) >= 48
    and coalesce(brk.n, 0) < 31;
$$;

revoke all on function public.pool_knockout_gap_count(uuid, uuid) from public;
grant execute on function public.pool_knockout_gap_count(uuid, uuid) to anon, authenticated;
