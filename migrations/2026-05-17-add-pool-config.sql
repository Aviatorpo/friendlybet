-- ============================================================
-- FriendlyBet v2.0.0 - Pool config, single-phase betting,
-- hypothetical bracket & new scoring model
-- ============================================================
-- Run this in the Supabase SQL editor (one-time).
-- All statements are idempotent: safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. pools: betting_mode, scoring_rules, locked_at
-- ------------------------------------------------------------
ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS betting_mode TEXT DEFAULT 'two_phase'
    CHECK (betting_mode IN ('single_phase', 'two_phase'));

ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS scoring_rules JSONB DEFAULT '{
    "group_first": 5,
    "group_second": 3,
    "group_third": 2,
    "group_fourth": 1,
    "round_of_16": 5,
    "quarter_final": 8,
    "semi_final": 12,
    "final": 20,
    "tournament_winner": 30,
    "top_scorer": 10
  }'::jsonb;

ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 2. group_position_picks: predicted finishing order per group
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_position_picks (
  id SERIAL PRIMARY KEY,
  pool_id INTEGER REFERENCES pools(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  group_letter TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
  team_code TEXT NOT NULL REFERENCES teams(code),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pool_id, user_id, group_letter, position)
);

CREATE INDEX IF NOT EXISTS idx_gpp_pool_user
  ON group_position_picks (pool_id, user_id);
CREATE INDEX IF NOT EXISTS idx_gpp_group
  ON group_position_picks (group_letter);

ALTER TABLE group_position_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gpp_select_all ON group_position_picks;
DROP POLICY IF EXISTS gpp_insert_all ON group_position_picks;
DROP POLICY IF EXISTS gpp_update_all ON group_position_picks;
DROP POLICY IF EXISTS gpp_delete_all ON group_position_picks;

CREATE POLICY gpp_select_all ON group_position_picks
  FOR SELECT USING (true);
CREATE POLICY gpp_insert_all ON group_position_picks
  FOR INSERT WITH CHECK (true);
CREATE POLICY gpp_update_all ON group_position_picks
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY gpp_delete_all ON group_position_picks
  FOR DELETE USING (true);

-- ------------------------------------------------------------
-- 3. knockout_picks: add bracket_position for hypothetical bracket
--    1-8   = Round of 16
--    9-12  = Quarter Finals
--    13-14 = Semi Finals
--    15    = Final
-- ------------------------------------------------------------
ALTER TABLE knockout_picks
  ADD COLUMN IF NOT EXISTS bracket_position INTEGER
    CHECK (bracket_position IS NULL OR (bracket_position BETWEEN 1 AND 15));

CREATE INDEX IF NOT EXISTS idx_kp_bracket_pos
  ON knockout_picks (pool_id, user_id, bracket_position);

-- ------------------------------------------------------------
-- 4. tournament_winner_picks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_winner_picks (
  id SERIAL PRIMARY KEY,
  pool_id INTEGER REFERENCES pools(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  team_code TEXT NOT NULL REFERENCES teams(code),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pool_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_twp_pool_user
  ON tournament_winner_picks (pool_id, user_id);

ALTER TABLE tournament_winner_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS twp_select_all ON tournament_winner_picks;
DROP POLICY IF EXISTS twp_insert_all ON tournament_winner_picks;
DROP POLICY IF EXISTS twp_update_all ON tournament_winner_picks;
DROP POLICY IF EXISTS twp_delete_all ON tournament_winner_picks;

CREATE POLICY twp_select_all ON tournament_winner_picks
  FOR SELECT USING (true);
CREATE POLICY twp_insert_all ON tournament_winner_picks
  FOR INSERT WITH CHECK (true);
CREATE POLICY twp_update_all ON tournament_winner_picks
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY twp_delete_all ON tournament_winner_picks
  FOR DELETE USING (true);

-- ------------------------------------------------------------
-- 5. users: per-stage breakdown (used by v2 scoring + leaderboard)
-- ------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS group_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS knockout_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS predictions_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS predictions_submitted_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- Done. Existing pools default to 'two_phase' + recommended rules.
-- ------------------------------------------------------------
