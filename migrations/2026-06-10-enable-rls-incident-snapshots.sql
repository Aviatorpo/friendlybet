-- 2026-06-10: Enable Row-Level Security on `incident_snapshots`
-- (Supabase "rls_disabled_in_public" alert — production project).
--
-- `incident_snapshots` is an internal ops/monitoring table (aggregate counts from
-- the knockout-save incident watch — no PII, no per-user rows). No client/app code
-- reads it; only service_role monitoring scripts do, and service_role bypasses RLS.
-- So we enable RLS with NO anon policy and revoke the leftover anon/authenticated
-- SELECT grant, making the table invisible to the public REST API entirely.
-- Idempotent — safe to re-run.

ALTER TABLE public.incident_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON public.incident_snapshots FROM anon, authenticated;
