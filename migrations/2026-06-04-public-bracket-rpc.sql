-- ============================================================
-- get_public_bracket: anon-callable read of one user's SHAREABLE knockout
-- bracket, for the /share page + the OG card (api/og).
-- ============================================================
-- The security hardening closed anon SELECT on public.knockout_picks (RLS), so
-- the share data path (which reads a single user's bracket by id) started
-- returning [] -> empty semis/finals on the shared card. This SECURITY DEFINER
-- function restores ONLY the shareable read without reopening blanket table
-- SELECT: it bypasses RLS as the owner and returns just (bracket_position,
-- predicted_winner) for the requested user+pool -- exactly what the public
-- share link is designed to expose. No other columns, no list/enumeration
-- helper, single-phase rows only (bracket_position IS NOT NULL).
--
-- Idempotent. Run in the Supabase SQL editor (prod).

create or replace function public.get_public_bracket(p_user_id uuid, p_pool_id uuid)
returns table (bracket_position int, predicted_winner text)
language sql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
  select k.bracket_position, k.predicted_winner
  from public.knockout_picks k
  where k.user_id = p_user_id
    and k.pool_id = p_pool_id
    and k.bracket_position is not null
  order by k.bracket_position;
$$;

-- Only the controlled RPC is exposed; revoke the implicit PUBLIC grant first.
revoke all on function public.get_public_bracket(uuid, uuid) from public;
grant execute on function public.get_public_bracket(uuid, uuid) to anon, authenticated;

-- Tell PostgREST to pick up the new function immediately.
notify pgrst, 'reload schema';
