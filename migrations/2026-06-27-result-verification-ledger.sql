-- ============================================================
-- 2026-06-27  Final-result verification ledger
-- ============================================================
-- Why: official scoring needs auditable, multi-source final-result evidence
-- across workflow runs. The verifier can rotate source checks to reduce load,
-- then combine fresh observations from this ledger with the current run before
-- applying any final result.
--
-- Privacy: match results are public tournament facts. No user, pool, pick, or
-- recovery-code data is stored here.
--
-- Idempotent: safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.result_verification_candidates (
  external_id TEXT PRIMARY KEY,
  match_key TEXT,
  match_date TIMESTAMPTZ,
  home_team_code TEXT,
  away_team_code TEXT,
  current_status TEXT,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  latest_action TEXT,
  latest_consensus JSONB,
  latest_summary JSONB
);

CREATE TABLE IF NOT EXISTS public.result_verification_observations (
  id BIGSERIAL PRIMARY KEY,
  match_external_id TEXT NOT NULL,
  match_key TEXT,
  source TEXT NOT NULL,
  source_family TEXT NOT NULL,
  source_id TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state TEXT NOT NULL,
  status TEXT,
  home_score INTEGER,
  away_score INTEGER,
  winner_code TEXT,
  fixture_date TIMESTAMPTZ,
  reason TEXT,
  update JSONB
);

CREATE INDEX IF NOT EXISTS idx_result_verification_observations_match_time
  ON public.result_verification_observations (match_external_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_result_verification_observations_source_time
  ON public.result_verification_observations (source, observed_at DESC);

ALTER TABLE public.result_verification_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_verification_observations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.result_verification_candidates FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.result_verification_observations FROM anon, authenticated, public;
REVOKE ALL ON SEQUENCE public.result_verification_observations_id_seq FROM anon, authenticated, public;

COMMENT ON TABLE public.result_verification_candidates IS
  'Operational ledger for final-result verification decisions. Contains only public match facts and workflow evidence.';

COMMENT ON TABLE public.result_verification_observations IS
  'Append-only source observations used by the final-result verifier to combine fresh evidence across scheduled runs.';
