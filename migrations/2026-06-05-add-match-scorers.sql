-- ============================================================
-- FriendlyBet - add matches.scorers (goal-level data)
-- ============================================================
-- Stores per-goal scorer + minute for finished matches, fetched from
-- football-data's match-detail endpoint by scripts/sync-matches.js.
-- Powers the leaderboard "Pool Pundit" banter (late-winner / buzzer-beater
-- lines like "Yamal in the 90th flips the pool"). Read-only public data, no PII.
--
-- Shape (JSONB array): [{ "minute": 90, "injury": 4, "type": "REGULAR",
--                         "team": "ESP", "player": "Lamine Yamal" }, ...]
-- An empty array [] means "checked, no goals" (e.g. a 0-0), so the sync never
-- re-fetches it. NULL means "not yet fetched".
--
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS scorers JSONB;

COMMENT ON COLUMN matches.scorers IS
  'Per-goal data [{minute,injury,type,team,player}] from football-data; [] = checked/none, NULL = not fetched.';
