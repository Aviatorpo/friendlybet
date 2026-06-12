-- ============================================================
-- 2026-06-12  Add live match source/clock fields
-- ============================================================
-- Why: ESPN exposes a provider clock/status detail for live World Cup matches
-- (for example "21'" or "90'+7'"). FriendlyBet previously had only
-- matches.status + scores, so the client either guessed the minute locally or
-- showed a generic live state. These nullable fields let the server-side live
-- poller persist the provider clock and its freshness without changing scoring.
--
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS live_clock TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS live_period INTEGER;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS status_detail TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS live_source TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.matches.live_clock IS
  'Provider live clock label for display only, e.g. 21'' or 90''+7''. Does not affect scoring.';
COMMENT ON COLUMN public.matches.live_period IS
  'Provider live period/half number for display/debugging. Does not affect scoring.';
COMMENT ON COLUMN public.matches.status_detail IS
  'Provider status label such as Live, Half-time, FT, or Scheduled.';
COMMENT ON COLUMN public.matches.live_source IS
  'Provider that last updated live display fields, e.g. espn.';
COMMENT ON COLUMN public.matches.source_updated_at IS
  'Timestamp when live provider fields were last refreshed.';
