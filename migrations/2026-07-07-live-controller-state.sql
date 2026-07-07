-- Durable live-controller state, private event ledger, and Supabase wake-up.
-- User-visible match truth remains in public.matches; these tables are private
-- operational controls for leases, cooldowns, recovery, and source-to-screen proof.

CREATE TABLE IF NOT EXISTS public.live_controller_state (
  controller_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  lease_owner text,
  lease_token text,
  lease_acquired_at timestamptz,
  lease_expires_at timestamptz,
  last_wake_at timestamptz,
  last_wake_source text,
  last_provider_poll_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  cooldown_until timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  incident_state text NOT NULL DEFAULT 'green'
    CHECK (incident_state IN ('green', 'warning', 'critical', 'disabled')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_controller_state_lease
  ON public.live_controller_state (lease_expires_at, cooldown_until);

CREATE TABLE IF NOT EXISTS public.live_match_jobs (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  external_id text,
  live_status text,
  next_attempt_at timestamptz,
  cooldown_until timestamptz,
  last_provider_poll_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  incident_state text NOT NULL DEFAULT 'green'
    CHECK (incident_state IN ('green', 'warning', 'critical', 'final_pending', 'disabled')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_match_jobs_next_attempt
  ON public.live_match_jobs (next_attempt_at, cooldown_until);

CREATE INDEX IF NOT EXISTS idx_live_match_jobs_updated_at
  ON public.live_match_jobs (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.live_controller_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  controller_key text NOT NULL DEFAULT 'wc2026-live',
  event_at timestamptz NOT NULL DEFAULT now(),
  source text,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  external_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_live_controller_events_event_at
  ON public.live_controller_events (event_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_controller_events_match_id
  ON public.live_controller_events (match_id, event_at DESC);

INSERT INTO public.live_controller_state (controller_key, enabled, incident_state)
VALUES ('wc2026-live', true, 'green')
ON CONFLICT (controller_key) DO NOTHING;

ALTER TABLE public.live_controller_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_match_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_controller_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.live_controller_state FROM anon, authenticated;
REVOKE ALL ON TABLE public.live_match_jobs FROM anon, authenticated;
REVOKE ALL ON TABLE public.live_controller_events FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.live_controller_state TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.live_match_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.live_controller_events TO service_role;
DO $grant_sequence$
BEGIN
  IF to_regclass('public.live_controller_events_id_seq') IS NOT NULL THEN
    GRANT USAGE, SELECT ON SEQUENCE public.live_controller_events_id_seq TO service_role;
  END IF;
END
$grant_sequence$;

DROP POLICY IF EXISTS "Service role can manage live controller state" ON public.live_controller_state;
CREATE POLICY "Service role can manage live controller state"
  ON public.live_controller_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage live match jobs" ON public.live_match_jobs;
CREATE POLICY "Service role can manage live match jobs"
  ON public.live_match_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage live controller events" ON public.live_controller_events;
CREATE POLICY "Service role can manage live controller events"
  ON public.live_controller_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $migration$
DECLARE
  june_job text := 'friendlybet-live-controller-june';
  july_job text := 'friendlybet-live-controller-july';
  command_text text := $cron$
    SELECT CASE
      WHEN now() >= TIMESTAMPTZ '2026-06-11 00:00:00+00'
       AND now() <  TIMESTAMPTZ '2026-07-20 00:00:00+00'
      THEN net.http_post(
        url := 'https://friendlybet.live/api/live-nudge',
        headers := '{"Content-Type":"application/json","X-FriendlyBet-Wake-Source":"supabase-cron"}'::jsonb,
        body := '{"source":"supabase-cron","reason":"scheduled-wakeup"}'::jsonb,
        timeout_milliseconds := 10000
      )
      ELSE NULL
    END;
  $cron$;
BEGIN
  BEGIN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_net extension was not created: %', SQLERRM;
  END;

  BEGIN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension was not created: %', SQLERRM;
  END;

  IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
    BEGIN
      EXECUTE format('SELECT cron.unschedule(%L)', june_job);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    BEGIN
      EXECUTE format('SELECT cron.unschedule(%L)', july_job);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    EXECUTE format('SELECT cron.schedule(%L, %L, %L)', june_job, '* * 11-30 6 *', command_text);
    EXECUTE format('SELECT cron.schedule(%L, %L, %L)', july_job, '* * 1-19 7 *', command_text);
  ELSE
    RAISE NOTICE 'pg_cron is unavailable; live-controller tables were created but Supabase scheduled wake-up was not installed.';
  END IF;
END
$migration$;
