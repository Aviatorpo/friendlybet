-- ============================================================
-- FriendlyBet v2.5.79 - user-chosen "best 8 third-place" advancers
-- ============================================================
-- Single-phase users now pick WHICH 8 of the 12 group third-place teams
-- advance to the Round of 32 (instead of the app assuming a fixed set).
-- We store the 8 chosen GROUP LETTERS per user/pool (the actual team is
-- read from that group's 3rd-place position pick).
-- Run once in the Supabase SQL editor. Idempotent.
-- ============================================================

-- NOTE: pools.id and users.id are UUID in this project, so the FKs use UUID.
CREATE TABLE IF NOT EXISTS sp_third_place_picks (
  id           SERIAL PRIMARY KEY,
  pool_id      UUID REFERENCES pools(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  group_letter TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pool_id, user_id, group_letter)
);

CREATE INDEX IF NOT EXISTS idx_sptp_pool_user
  ON sp_third_place_picks (pool_id, user_id);

ALTER TABLE sp_third_place_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sptp_select_all ON sp_third_place_picks;
DROP POLICY IF EXISTS sptp_insert_all ON sp_third_place_picks;
DROP POLICY IF EXISTS sptp_update_all ON sp_third_place_picks;
DROP POLICY IF EXISTS sptp_delete_all ON sp_third_place_picks;

CREATE POLICY sptp_select_all ON sp_third_place_picks FOR SELECT USING (true);
CREATE POLICY sptp_insert_all ON sp_third_place_picks FOR INSERT WITH CHECK (true);
CREATE POLICY sptp_update_all ON sp_third_place_picks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY sptp_delete_all ON sp_third_place_picks FOR DELETE USING (true);
