-- ☠️☠️ DO NOT RE-RUN ON PRODUCTION — DESTRUCTIVE / ONE-OFF (applied 2026-05-19) ☠️☠️
-- This migration DELETEs ALL single-phase knockout_picks (to re-number bracket
-- positions). It was a one-time pre-launch schema change. Replaying it on the live
-- DB WIPES EVERY USER'S KNOCKOUT BRACKET. Do not re-apply; if a bracket re-number is
-- ever needed again, write a new, scoped, snapshot-first migration.
-- ============================================================
-- FriendlyBet v2.5.68 - R32 bracket (official WC 2026 format)
-- ============================================================
-- Expand bracket_position from 1-15 (R16 -> Final) to 1-31:
--   1-16  = Round of 32   (16 matches)
--   17-24 = Round of 16   (8 matches)
--   25-28 = Quarter Final (4 matches)
--   29-30 = Semi Final    (2 matches)
--   31    = Final
-- Run this in the Supabase SQL editor (one-time). Idempotent.
-- ============================================================

-- 1. Drop the old CHECK constraint (positions 1-15) if it exists.
DO $$
DECLARE
  con TEXT;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'knockout_picks'::regclass
       AND pg_get_constraintdef(oid) ILIKE '%bracket_position%'
  LOOP
    EXECUTE format('ALTER TABLE knockout_picks DROP CONSTRAINT %I', con);
  END LOOP;
END $$;

-- 2. Re-add the constraint with the new 1-31 range.
ALTER TABLE knockout_picks
  ADD CONSTRAINT knockout_picks_bracket_position_check
  CHECK (bracket_position IS NULL OR (bracket_position BETWEEN 1 AND 31));

-- 3. Old single-phase bracket picks used a different position numbering
--    (1-8 = R16, 9-12 = QF, 13-14 = SF, 15 = Final). In the new scheme
--    those positions mean entirely different matches (1-16 are R32).
--    Since the tournament has not started, wipe old SP bracket picks so
--    users redo them under the correct format. Two-phase rows
--    (bracket_position IS NULL) are untouched.
DELETE FROM knockout_picks WHERE bracket_position IS NOT NULL;

-- Done. The app will repopulate bracket_position 1-31 as users predict.
