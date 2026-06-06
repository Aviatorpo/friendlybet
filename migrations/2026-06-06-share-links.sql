-- ============================================================
-- Recent bracket shares — the shares THEMSELVES (v2.8.6)
-- ============================================================
-- share_metrics() gives the aggregate funnel; this returns the individual
-- completed shares so the dashboard can link straight to each shared bracket.
-- Every shared bracket is already a PUBLIC /share?u=&p= page (anon SELECT is
-- allowed for the share page), so reconstructing the link exposes nothing new —
-- it just points at what the user already shared publicly. Service_role only.
--
-- One row per user who COMPLETED >=1 share, EXCLUDING Israel, most-recent first:
--   user_id, pool_id (for the /share link), nickname, country, shares, last_at
-- Depends on the share_events table from 2026-06-05-share-tracking.sql.

create or replace function public.recent_shares(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare v jsonb;
begin
  with done as (
    select e.user_id,
           count(*)            as shares,
           max(e.created_at)   as last_at
    from public.share_events e
    where e.kind = 'completed'
    group by e.user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id',  d.user_id,
           'pool_id',  u.pool_id,
           'nickname', coalesce(u.nickname, ''),
           'country',  coalesce(u.country, ''),
           'shares',   d.shares,
           'last_at',  d.last_at
         ) order by d.last_at desc), '[]'::jsonb)
  into v
  from done d
  join public.users u on u.id = d.user_id
  where coalesce(u.country, '') <> 'IL'      -- exclude Israel, same as share_metrics
  limit greatest(1, least(coalesce(p_limit, 50), 500));
  return v;
end$$;

revoke all on function public.recent_shares(int) from public, anon, authenticated;
alter function public.recent_shares(int) owner to postgres;
grant execute on function public.recent_shares(int) to service_role;

notify pgrst, 'reload schema';
