-- Durable live-match heartbeat for controller/provider freshness.
-- The app still renders from matches; this table is operational proof and recovery evidence.

CREATE TABLE IF NOT EXISTS public.match_live_heartbeats (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  external_id text,
  controller_owner text,
  last_provider_poll_at timestamptz,
  last_successful_live_write_at timestamptz,
  last_status text,
  source_age_seconds integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_live_heartbeats_updated_at
  ON public.match_live_heartbeats (updated_at DESC);

ALTER TABLE public.match_live_heartbeats ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.match_live_heartbeats TO service_role;

DROP POLICY IF EXISTS "Service role can manage match live heartbeats" ON public.match_live_heartbeats;
CREATE POLICY "Service role can manage match live heartbeats"
  ON public.match_live_heartbeats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
