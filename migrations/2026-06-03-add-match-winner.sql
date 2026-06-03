-- ============================================================
-- 2026-06-03  Add matches.winner_code
-- ============================================================
-- Why: knockout matches decided in a penalty shootout (or, rarely, recorded
-- with equal full-time scores) end with home_score == away_score. The scoring
-- engine derived the winner purely from home_score > away_score, so a
-- penalty-decided knockout match returned NO winner and awarded ZERO knockout
-- points to everyone who predicted the actual qualifier.
--
-- football-data.org exposes score.winner (HOME_TEAM / AWAY_TEAM / DRAW), which
-- already accounts for extra time and penalties. We persist the resolved team
-- code here so calculate-scores-v2.js can use the authoritative winner and fall
-- back to the score comparison only for legacy rows.
--
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_code TEXT;

-- Optional FK-style note: winner_code references teams(code) but is left
-- unconstrained so a sync can never fail on an unmapped/older code.

COMMENT ON COLUMN matches.winner_code IS
  'Resolved match winner team code (from football-data score.winner; accounts for ET/penalties). NULL for draws, not-yet-played, or unmapped.';
