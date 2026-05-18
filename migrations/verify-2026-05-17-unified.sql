-- ============================================================
-- FriendlyBet v2 - Unified migration verification (one result set)
-- ============================================================
-- Run this in the Supabase SQL editor. Returns a SINGLE table where
-- every row says PASS or FAIL. If every row says PASS, you're good.
-- ============================================================

WITH checks AS (
  -- 1) pools columns
  SELECT 1 AS step, 'pools.betting_mode + scoring_rules + locked_at' AS what,
         (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name = 'pools'
            AND column_name IN ('betting_mode','scoring_rules','locked_at'))::int AS actual,
         3 AS expected

  UNION ALL
  -- 2) group_position_picks columns
  SELECT 2, 'group_position_picks (7 columns)',
         (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name = 'group_position_picks')::int,
         7

  UNION ALL
  -- 3) knockout_picks.bracket_position
  SELECT 3, 'knockout_picks.bracket_position',
         (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name = 'knockout_picks'
            AND column_name = 'bracket_position')::int,
         1

  UNION ALL
  -- 4) tournament_winner_picks columns
  SELECT 4, 'tournament_winner_picks (5 columns)',
         (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name = 'tournament_winner_picks')::int,
         5

  UNION ALL
  -- 5) users score columns
  SELECT 5, 'users score columns (5)',
         (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name = 'users'
            AND column_name IN ('group_points','knockout_points','bonus_points',
                                'predictions_locked','predictions_submitted_at'))::int,
         5

  UNION ALL
  -- 6) RLS enabled on the 2 new tables
  SELECT 6, 'RLS enabled on gpp + twp',
         (SELECT COUNT(*) FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname IN ('group_position_picks','tournament_winner_picks')
            AND c.relrowsecurity = true)::int,
         2

  UNION ALL
  -- 7) RLS policies (4 each on gpp + twp)
  SELECT 7, 'RLS policies on gpp + twp',
         (SELECT COUNT(*) FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename IN ('group_position_picks','tournament_winner_picks'))::int,
         8

  UNION ALL
  -- 8) Indexes
  SELECT 8, 'Indexes (gpp x2, twp x1, kp x1)',
         (SELECT COUNT(*) FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname IN ('idx_gpp_pool_user','idx_gpp_group',
                              'idx_twp_pool_user','idx_kp_bracket_pos'))::int,
         4

  UNION ALL
  -- 9) Pools have betting_mode populated (>= 1 row)
  SELECT 9, 'pools.betting_mode populated',
         (SELECT COUNT(*) FROM pools WHERE betting_mode IS NOT NULL)::int,
         (SELECT COUNT(*) FROM pools)::int
)
SELECT
  step,
  CASE WHEN actual >= expected THEN 'PASS' ELSE 'FAIL' END AS status,
  what,
  actual,
  expected
FROM checks
ORDER BY step;

-- Look at the "status" column. Every row should say PASS.
-- If any row says FAIL, re-run migrations/2026-05-17-add-pool-config.sql
-- in the SQL editor (it is idempotent).
