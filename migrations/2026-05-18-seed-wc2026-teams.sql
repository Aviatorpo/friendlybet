-- ============================================================
-- FriendlyBet - Seed all 48 WC2026 teams
-- ============================================================
-- Root cause: group_position_picks + knockout_picks have an FK on
-- teams(code). If a user picks a team whose code isn't in the teams
-- table, the INSERT fails with:
--   "violates foreign key constraint ... Key is not present in
--    table 'teams'"
-- The sync-teams.js script only inserts what football-data.org's WC
-- endpoint returns, which omits the playoff qualifiers (RSA, BIH,
-- HAI, CPV, ALG, CUR, JOR, UZB, CIV, SCO, CZE, etc.). This SQL
-- seeds the full 48-team WC2026 squad. Idempotent: safe to re-run.
--
-- Run this ONCE in the Supabase SQL editor.
-- ============================================================

INSERT INTO teams (code, name_en, name_he, group_letter, tier, fifa_ranking) VALUES
  -- Group A
  ('MEX', 'Mexico',           'מקסיקו',         'A', 'contender', 18),
  ('RSA', 'South Africa',     'דרום אפריקה',    'A', 'underdog',  49),
  ('KOR', 'South Korea',      'דרום קוריאה',    'A', 'contender', 22),
  ('CZE', 'Czechia',          'צ''כיה',         'A', 'contender', 28),
  -- Group B
  ('CAN', 'Canada',           'קנדה',           'B', 'contender', 31),
  ('SUI', 'Switzerland',      'שווייץ',         'B', 'contender', 15),
  ('QAT', 'Qatar',            'קטאר',           'B', 'underdog',  54),
  ('BIH', 'Bosnia-Herzegovina','בוסניה-הרצגובינה','B','underdog', 51),
  -- Group C
  ('BRA', 'Brazil',           'ברזיל',          'C', 'favorite',  5),
  ('MAR', 'Morocco',          'מרוקו',          'C', 'contender', 14),
  ('HAI', 'Haiti',            'האיטי',          'C', 'underdog',  50),
  ('SCO', 'Scotland',         'סקוטלנד',        'C', 'contender', 33),
  -- Group D
  ('USA', 'United States',    'ארה"ב',          'D', 'contender', 17),
  ('PAR', 'Paraguay',         'פרגוואי',        'D', 'underdog',  43),
  ('AUS', 'Australia',        'אוסטרליה',       'D', 'contender', 23),
  ('TUR', 'Turkey',           'טורקיה',         'D', 'contender', 27),
  -- Group E
  ('ESP', 'Spain',            'ספרד',           'E', 'favorite',  3),
  ('UKR', 'Ukraine',          'אוקראינה',       'E', 'contender', 26),
  ('IRN', 'Iran',             'איראן',          'E', 'contender', 21),
  ('CPV', 'Cape Verde Islands','כף ורדה',       'E', 'underdog',  52),
  -- Group F
  ('ARG', 'Argentina',        'ארגנטינה',       'F', 'favorite',  1),
  ('TUN', 'Tunisia',          'תוניסיה',        'F', 'underdog',  32),
  ('IRQ', 'Iraq',             'עיראק',          'F', 'underdog',  46),
  ('ALG', 'Algeria',          'אלג''יריה',      'F', 'contender', 31),
  -- Group G
  ('GER', 'Germany',          'גרמניה',         'G', 'favorite',  8),
  ('CUR', 'Curaçao',          'קוראסאו',        'G', 'underdog',  55),
  ('BEL', 'Belgium',          'בלגיה',          'G', 'contender', 11),
  ('SAU', 'Saudi Arabia',     'ערב הסעודית',    'G', 'underdog',  45),
  -- Group H
  ('POR', 'Portugal',         'פורטוגל',        'H', 'favorite',  6),
  ('AUT', 'Austria',          'אוסטריה',        'H', 'contender', 28),
  ('EGY', 'Egypt',            'מצרים',          'H', 'underdog',  33),
  ('SWE', 'Sweden',           'שבדיה',          'H', 'contender', 30),
  -- Group I
  ('FRA', 'France',           'צרפת',           'I', 'favorite',  2),
  ('SEN', 'Senegal',          'סנגל',           'I', 'contender', 20),
  ('NOR', 'Norway',           'נורווגיה',       'I', 'contender', 29),
  ('NZL', 'New Zealand',      'ניו זילנד',      'I', 'underdog',  44),
  -- Group J
  ('NED', 'Netherlands',      'הולנד',          'J', 'favorite',  7),
  ('CMR', 'Cameroon',         'קמרון',          'J', 'underdog',  36),
  ('UZB', 'Uzbekistan',       'אוזבקיסטן',      'J', 'underdog',  48),
  ('JOR', 'Jordan',           'ירדן',           'J', 'underdog',  47),
  -- Group K
  ('URU', 'Uruguay',          'אורוגוואי',      'K', 'contender', 12),
  ('JPN', 'Japan',            'יפן',            'K', 'contender', 19),
  ('JAM', 'Jamaica',          'ג''מייקה',       'K', 'underdog',  39),
  ('CIV', 'Ivory Coast',      'חוף השנהב',      'K', 'contender', 32),
  -- Group L
  ('ENG', 'England',          'אנגליה',         'L', 'favorite',  4),
  ('CRO', 'Croatia',          'קרואטיה',        'L', 'contender', 10),
  ('GHA', 'Ghana',             'גאנה',          'L', 'underdog',  35),
  ('PAN', 'Panama',           'פנמה',           'L', 'underdog',  38)
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_he = EXCLUDED.name_he,
  group_letter = EXCLUDED.group_letter,
  tier = EXCLUDED.tier,
  fifa_ranking = EXCLUDED.fifa_ranking;

-- Verify: should return 48
SELECT COUNT(*) AS team_count FROM teams;
