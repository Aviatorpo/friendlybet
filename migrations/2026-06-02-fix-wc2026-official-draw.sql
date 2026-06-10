-- ☠️☠️ DO NOT RE-RUN ON PRODUCTION — DESTRUCTIVE / ONE-OFF (applied 2026-06-02) ☠️☠️
-- This migration DELETEs ALL rows from group_position_picks, knockout_picks,
-- tournament_winner_picks, group_picks (+ some top_scorer_picks). It was a one-time
-- pre-launch draw correction. Replaying it on the live DB WIPES EVERY USER'S
-- PREDICTIONS (this exact class of accident — a destructive statement re-run against
-- real data — is what caused the 2026-06-10 knockout_picks mass loss via sync-teams).
-- If you must re-apply ANY part, snapshot first and run ONLY the specific teams fix,
-- never the pick DELETEs.
-- ============================================================
-- FriendlyBet - Correct the teams table to the OFFICIAL WC2026 draw
-- ============================================================
-- The original seed (2026-05-18-seed-wc2026-teams.sql) used a STALE /
-- placeholder draw. Three teams that did NOT qualify were seeded
-- (Ukraine UKR, Cameroon CMR, Jamaica JAM) and three real qualifiers
-- were missing (Ecuador ECU, Colombia COL, DR Congo COD). Groups E-K
-- were also assigned wrong teams.
--
-- This migration:
--   1. Wipes stale single-phase + two-phase prediction picks (the old
--      group layout makes every pick invalid - users redo, same as the
--      v2.5.68 R32 wipe). The tournament hasn't started.
--   2. Removes the 3 non-qualifier team rows.
--   3. Upserts all 48 real teams with the correct group_letter, names,
--      and FIFA ranking (matching app.js FIFA_RANKINGS).
--
-- Idempotent: safe to re-run. Run ONCE in the Supabase SQL editor.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Wipe stale predictions (made against the wrong groups).
--    Order matters only for readability; none of these reference
--    each other. top_scorer_picks are player-based, but any pick of
--    a player from a removed team would block the team DELETE, so we
--    clear those rows too.
-- ------------------------------------------------------------
DELETE FROM group_position_picks;                       -- single-phase group order
DELETE FROM knockout_picks WHERE bracket_position IS NOT NULL; -- single-phase bracket
DELETE FROM tournament_winner_picks;                    -- champion pick (mirror of bracket 31)
DELETE FROM group_picks;                                -- two-phase advancing-team picks
DELETE FROM knockout_picks WHERE bracket_position IS NULL;     -- two-phase knockout picks
DELETE FROM top_scorer_picks WHERE team_code IN ('UKR','CMR','JAM');

-- ------------------------------------------------------------
-- 2. Remove the three non-qualifiers.
-- ------------------------------------------------------------
DELETE FROM teams WHERE code IN ('UKR','CMR','JAM');

-- ------------------------------------------------------------
-- 3. Upsert all 48 real teams with the official group letters.
--    fifa_ranking mirrors app.js FIFA_RANKINGS for consistency.
-- ------------------------------------------------------------
INSERT INTO teams (code, name_en, name_he, group_letter, tier, fifa_ranking) VALUES
  -- Group A
  ('MEX', 'Mexico',            'מקסיקו',          'A', 'contender', 17),
  ('RSA', 'South Africa',      'דרום אפריקה',     'A', 'underdog',  42),
  ('KOR', 'South Korea',       'דרום קוריאה',     'A', 'contender', 22),
  ('CZE', 'Czechia',           'צ''כיה',          'A', 'contender', 33),
  -- Group B
  ('CAN', 'Canada',            'קנדה',            'B', 'contender', 32),
  ('BIH', 'Bosnia-Herzegovina','בוסניה-הרצגובינה','B', 'underdog',  59),
  ('QAT', 'Qatar',             'קטאר',            'B', 'underdog',  66),
  ('SUI', 'Switzerland',       'שווייץ',          'B', 'contender', 19),
  -- Group C
  ('BRA', 'Brazil',            'ברזיל',           'C', 'favorite',  5),
  ('MAR', 'Morocco',           'מרוקו',           'C', 'contender', 14),
  ('HAI', 'Haiti',             'האיטי',           'C', 'underdog',  60),
  ('SCO', 'Scotland',          'סקוטלנד',         'C', 'contender', 34),
  -- Group D
  ('USA', 'United States',     'ארה"ב',           'D', 'contender', 16),
  ('PAR', 'Paraguay',          'פרגוואי',         'D', 'underdog',  37),
  ('AUS', 'Australia',         'אוסטרליה',        'D', 'contender', 26),
  ('TUR', 'Turkey',            'טורקיה',          'D', 'contender', 27),
  -- Group E
  ('GER', 'Germany',           'גרמניה',          'E', 'favorite',  12),
  ('CUR', 'Curaçao',           'קוראסאו',         'E', 'underdog',  85),
  ('CIV', 'Ivory Coast',       'חוף השנהב',       'E', 'contender', 35),
  ('ECU', 'Ecuador',           'אקוודור',         'E', 'contender', 24),
  -- Group F
  ('NED', 'Netherlands',       'הולנד',           'F', 'favorite',  7),
  ('JPN', 'Japan',             'יפן',             'F', 'contender', 18),
  ('SWE', 'Sweden',            'שבדיה',           'F', 'contender', 25),
  ('TUN', 'Tunisia',           'תוניסיה',         'F', 'underdog',  29),
  -- Group G
  ('BEL', 'Belgium',           'בלגיה',           'G', 'favorite',  8),
  ('EGY', 'Egypt',             'מצרים',           'G', 'underdog',  30),
  ('IRN', 'Iran',              'איראן',           'G', 'contender', 21),
  ('NZL', 'New Zealand',       'ניו זילנד',       'G', 'underdog',  55),
  -- Group H
  ('ESP', 'Spain',             'ספרד',            'H', 'favorite',  2),
  ('CPV', 'Cape Verde Islands','כף ורדה',         'H', 'underdog',  65),
  ('SAU', 'Saudi Arabia',      'ערב הסעודית',     'H', 'underdog',  57),
  ('URU', 'Uruguay',           'אורוגוואי',       'H', 'contender', 15),
  -- Group I
  ('FRA', 'France',            'צרפת',            'I', 'favorite',  3),
  ('SEN', 'Senegal',           'סנגל',            'I', 'contender', 20),
  ('IRQ', 'Iraq',              'עיראק',           'I', 'underdog',  40),
  ('NOR', 'Norway',            'נורווגיה',        'I', 'contender', 28),
  -- Group J
  ('ARG', 'Argentina',         'ארגנטינה',        'J', 'favorite',  1),
  ('ALG', 'Algeria',           'אלג''יריה',       'J', 'contender', 31),
  ('AUT', 'Austria',           'אוסטריה',         'J', 'contender', 23),
  ('JOR', 'Jordan',            'ירדן',            'J', 'underdog',  44),
  -- Group K
  ('POR', 'Portugal',          'פורטוגל',         'K', 'favorite',  6),
  ('COD', 'DR Congo',          'קונגו',           'K', 'underdog',  58),
  ('UZB', 'Uzbekistan',        'אוזבקיסטן',       'K', 'underdog',  43),
  ('COL', 'Colombia',          'קולומביה',        'K', 'contender', 13),
  -- Group L
  ('ENG', 'England',           'אנגליה',          'L', 'favorite',  4),
  ('CRO', 'Croatia',           'קרואטיה',         'L', 'contender', 9),
  ('GHA', 'Ghana',             'גאנה',            'L', 'underdog',  47),
  ('PAN', 'Panama',            'פנמה',            'L', 'underdog',  38)
ON CONFLICT (code) DO UPDATE SET
  name_en      = EXCLUDED.name_en,
  name_he      = EXCLUDED.name_he,
  group_letter = EXCLUDED.group_letter,
  tier         = EXCLUDED.tier,
  fifa_ranking = EXCLUDED.fifa_ranking;

COMMIT;

-- ------------------------------------------------------------
-- Verify: 48 teams, 4 per group, no stale codes.
-- ------------------------------------------------------------
SELECT COUNT(*) AS team_count FROM teams;                                  -- expect 48
SELECT group_letter, COUNT(*) FROM teams GROUP BY group_letter ORDER BY 1; -- each = 4
SELECT code FROM teams WHERE code IN ('UKR','CMR','JAM');                   -- expect 0 rows
SELECT code FROM teams WHERE code IN ('ECU','COL','COD');                   -- expect 3 rows
