-- 2026-06-10: Enable Row-Level Security on the two public reference tables that
-- were still missing it (Supabase "rls_disabled_in_public" critical alert).
--
-- `matches` and `teams` are public reference data (fixtures + team names/flags)
-- that the app legitimately reads. anon/authenticated already hold SELECT only
-- (INSERT/UPDATE/DELETE were revoked in the v2.6.87 security hardening), and all
-- writes go through service_role (sync scripts), which bypasses RLS. So enabling
-- RLS with a read-only policy keeps every legitimate read working while closing
-- the "anyone can read/edit/delete" alert. Idempotent — safe to re-run.

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perm_read_matches ON public.matches;
CREATE POLICY perm_read_matches ON public.matches
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS perm_read_teams ON public.teams;
CREATE POLICY perm_read_teams ON public.teams
  FOR SELECT TO anon, authenticated USING (true);
