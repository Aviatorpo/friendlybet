-- ============================================================
-- FriendlyBet v2 - Migration verification
-- ============================================================
-- Run this in the Supabase SQL editor.
-- It is READ-ONLY: it does not modify anything.
-- Each query should return rows. If any query returns 0 rows,
-- the migration is NOT fully applied and you need to re-run
-- migrations/2026-05-17-add-pool-config.sql.
-- ============================================================

-- 1) pools.betting_mode, pools.scoring_rules, pools.locked_at
SELECT 'pools columns' AS check, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pools'
  AND column_name IN ('betting_mode','scoring_rules','locked_at')
ORDER BY column_name;
-- Expected: 3 rows (betting_mode TEXT, locked_at TIMESTAMPTZ, scoring_rules JSONB)

-- 2) group_position_picks table + columns
SELECT 'group_position_picks columns' AS check, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'group_position_picks'
ORDER BY ordinal_position;
-- Expected: 7 rows (id, pool_id, user_id, group_letter, position, team_code, created_at)

-- 3) knockout_picks.bracket_position
SELECT 'knockout_picks.bracket_position' AS check, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'knockout_picks'
  AND column_name = 'bracket_position';
-- Expected: 1 row

-- 4) tournament_winner_picks table
SELECT 'tournament_winner_picks columns' AS check, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tournament_winner_picks'
ORDER BY ordinal_position;
-- Expected: 5 rows (id, pool_id, user_id, team_code, created_at)

-- 5) users score columns
SELECT 'users score columns' AS check, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('group_points','knockout_points','bonus_points','predictions_locked','predictions_submitted_at')
ORDER BY column_name;
-- Expected: 5 rows

-- 6) RLS enabled on the new tables
SELECT 'RLS enabled' AS check, c.relname AS table, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('group_position_picks','tournament_winner_picks');
-- Expected: 2 rows with rls_enabled = true

-- 7) RLS policies on the new tables
SELECT 'RLS policies' AS check, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('group_position_picks','tournament_winner_picks')
ORDER BY tablename, policyname;
-- Expected: 8 rows (4 policies each for gpp and twp)

-- 8) Indexes on the new tables
SELECT 'Indexes' AS check, schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('group_position_picks','tournament_winner_picks','knockout_picks')
  AND indexname IN ('idx_gpp_pool_user','idx_gpp_group','idx_twp_pool_user','idx_kp_bracket_pos')
ORDER BY indexname;
-- Expected: 4 rows

-- 9) Smoke test: existing pools should now have a betting_mode
SELECT 'pools betting_mode populated' AS check, betting_mode, COUNT(*) AS n
FROM pools
GROUP BY betting_mode
ORDER BY betting_mode;
-- Expected: every pool has a non-null betting_mode (typically 'two_phase' for legacy, 'single_phase' for new wizard pools)

-- ============================================================
-- If every block returned the expected rows, the migration is
-- applied correctly. The app will now run end-to-end.
-- ============================================================
