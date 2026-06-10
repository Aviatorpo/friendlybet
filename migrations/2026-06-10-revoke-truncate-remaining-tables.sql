-- ============================================================================
-- 2026-06-10  Revoke TRUNCATE on the remaining application tables
-- ----------------------------------------------------------------------------
-- The pick tables / users / pools were covered by
-- 2026-06-10-revoke-truncate-pick-tables.sql, but a read-only audit found
-- anon + authenticated STILL hold TRUNCATE on these reference/ops tables:
--   teams, players, matches, admin_actions, app_settings
-- (Supabase's default `grant all on all tables to anon, authenticated` left them
-- behind.) A leaked publishable/anon key could TRUNCATE teams -> FK cascade /
-- mass wipe. None of these tables is ever written by the anon client — all writes
-- go through service-role sync scripts or SECURITY DEFINER RPCs — so revoking
-- TRUNCATE has zero app impact. SELECT and the existing RPC paths are untouched.
--
-- Idempotent: REVOKE of an absent privilege is a no-op. Safe to re-run.
-- ============================================================================

revoke truncate on table public.teams         from anon, authenticated, public;
revoke truncate on table public.players        from anon, authenticated, public;
revoke truncate on table public.matches        from anon, authenticated, public;
revoke truncate on table public.admin_actions  from anon, authenticated, public;
revoke truncate on table public.app_settings   from anon, authenticated, public;

-- Re-assert (idempotent) on the tables a prior migration already covered, so this
-- one file fully describes the intended end-state.
revoke truncate on table public.group_picks            from anon, authenticated, public;
revoke truncate on table public.knockout_picks         from anon, authenticated, public;
revoke truncate on table public.group_position_picks   from anon, authenticated, public;
revoke truncate on table public.tournament_winner_picks from anon, authenticated, public;
revoke truncate on table public.top_scorer_picks       from anon, authenticated, public;
revoke truncate on table public.sp_third_place_picks   from anon, authenticated, public;
revoke truncate on table public.pick_backups           from anon, authenticated, public;
revoke truncate on table public.users                  from anon, authenticated, public;
revoke truncate on table public.pools                  from anon, authenticated, public;
