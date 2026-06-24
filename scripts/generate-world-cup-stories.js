#!/usr/bin/env node
/*
 * Generates the public Story of the World Cup feed from finished matches.
 *
 * The client reads public-data/world-cup-stories.json with cache:no-store, so
 * this script can add fresh stories from the scheduled scoring workflow without
 * requiring an app version bump or a PWA cache release.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MATCHES_PATH = path.join(ROOT, 'public-data', 'matches.json');
const STORIES_PATH = path.join(ROOT, 'public-data', 'world-cup-stories.json');
const ASSET_DIR = path.join(ROOT, 'story-assets');
const OUTCOME_BASE_DIR = path.join(ASSET_DIR, 'outcome-bases');
const MANIFEST_PATH = path.join(ASSET_DIR, 'manifest.json');
const MAX_STORIES = Number(process.env.WC_STORY_LIMIT || 104);
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || 'sb_publishable_Aj_p7rZjAat_-ros9gzD_g_AsPtotpU';
const MATCH_SOURCE = String(process.env.WC_STORY_MATCH_SOURCE || 'auto').toLowerCase();
const TEAM_NAMES = {
  ALG: { en: 'Algeria', he: "אלג'יריה" },
  ARG: { en: 'Argentina', he: 'ארגנטינה' },
  AUS: { en: 'Australia', he: 'אוסטרליה' },
  AUT: { en: 'Austria', he: 'אוסטריה' },
  BEL: { en: 'Belgium', he: 'בלגיה' },
  BIH: { en: 'Bosnia and Herzegovina', he: 'בוסניה והרצגובינה' },
  BRA: { en: 'Brazil', he: 'ברזיל' },
  CAN: { en: 'Canada', he: 'קנדה' },
  CIV: { en: 'Ivory Coast', he: 'חוף השנהב' },
  COD: { en: 'DR Congo', he: 'הרפובליקה הדמוקרטית של קונגו' },
  COL: { en: 'Colombia', he: 'קולומביה' },
  CPV: { en: 'Cape Verde', he: 'כף ורדה' },
  CRO: { en: 'Croatia', he: 'קרואטיה' },
  CUR: { en: 'Curacao', he: 'קוראסאו' },
  CZE: { en: 'Czech Republic', he: "צ'כיה" },
  ECU: { en: 'Ecuador', he: 'אקוודור' },
  EGY: { en: 'Egypt', he: 'מצרים' },
  ENG: { en: 'England', he: 'אנגליה' },
  ESP: { en: 'Spain', he: 'ספרד' },
  FRA: { en: 'France', he: 'צרפת' },
  GER: { en: 'Germany', he: 'גרמניה' },
  GHA: { en: 'Ghana', he: 'גאנה' },
  HAI: { en: 'Haiti', he: 'האיטי' },
  IRN: { en: 'Iran', he: 'איראן' },
  IRQ: { en: 'Iraq', he: 'עיראק' },
  JPN: { en: 'Japan', he: 'יפן' },
  JOR: { en: 'Jordan', he: 'ירדן' },
  KOR: { en: 'South Korea', he: 'קוריאה הדרומית' },
  MAR: { en: 'Morocco', he: 'מרוקו' },
  MEX: { en: 'Mexico', he: 'מקסיקו' },
  NED: { en: 'Netherlands', he: 'הולנד' },
  NOR: { en: 'Norway', he: 'נורבגיה' },
  NZL: { en: 'New Zealand', he: 'ניו זילנד' },
  PAN: { en: 'Panama', he: 'פנמה' },
  PAR: { en: 'Paraguay', he: 'פרגוואי' },
  POR: { en: 'Portugal', he: 'פורטוגל' },
  QAT: { en: 'Qatar', he: 'קטאר' },
  RSA: { en: 'South Africa', he: 'דרום אפריקה' },
  SAU: { en: 'Saudi Arabia', he: 'ערב הסעודית' },
  SCO: { en: 'Scotland', he: 'סקוטלנד' },
  SEN: { en: 'Senegal', he: 'סנגל' },
  SUI: { en: 'Switzerland', he: 'שווייץ' },
  SWE: { en: 'Sweden', he: 'שוודיה' },
  TUN: { en: 'Tunisia', he: 'תוניסיה' },
  TUR: { en: 'Turkey', he: 'טורקיה' },
  URU: { en: 'Uruguay', he: 'אורוגוואי' },
  USA: { en: 'USA', he: 'ארה"ב' },
  UZB: { en: 'Uzbekistan', he: 'אוזבקיסטן' },
};

const STAR_PROFILES = {
  ALG: { player: 'Riyad Mahrez', number: 7 },
  ARG: { player: 'Lionel Messi', number: 10 },
  AUT: { player: 'David Alaba', number: 8 },
  AUS: { player: 'Mathew Ryan', number: 1, role: 'captain goalkeeper' },
  BEL: { player: 'Youri Tielemans', number: 8 },
  BIH: { player: 'Edin Dzeko', number: 11 },
  BRA: { player: 'Vinicius Jr', number: 7 },
  CAN: { player: 'Jonathan David', number: 10 },
  COD: { player: 'Cedric Bakambu', number: 17 },
  COL: { player: 'Luis Diaz', number: 7 },
  CRO: { player: 'Luka Modric', number: 10 },
  CZE: { player: 'Patrik Schick', number: 10 },
  ENG: { player: 'Harry Kane', number: 9 },
  CPV: { player: 'Ryan Mendes', number: 20 },
  EGY: { player: 'Mohamed Salah', number: 10 },
  ESP: { player: 'Rodri', number: 16 },
  FRA: { player: 'Kylian Mbappe', number: 10 },
  CUR: { player: 'Leandro Bacuna', number: 10 },
  CIV: { player: 'Franck Kessie', number: 8 },
  ECU: { player: 'Enner Valencia', number: 13 },
  GER: { player: 'Joshua Kimmich', number: 6 },
  GHA: { player: 'Jordan Ayew', number: 9 },
  HAI: { player: 'Duckens Nazon', number: 9 },
  IRN: { player: 'Alireza Jahanbakhsh', number: 7 },
  IRQ: { player: 'Ali Jasim', number: 17 },
  JOR: { player: 'Mousa Al Tamari', number: 10 },
  JPN: { player: 'Shuto Machino', number: 6 },
  KOR: { player: 'Son Heung-min', number: 7 },
  MAR: { player: 'Achraf Hakimi', number: 2 },
  MEX: { player: 'Raul Jimenez', number: 9 },
  NED: { player: 'Virgil van Dijk', number: 4 },
  NOR: { player: 'Erling Haaland', number: 9 },
  NZL: { player: 'Chris Wood', number: 9 },
  PAN: { player: 'Ismael Diaz', number: 10 },
  PAR: { player: 'Miguel Almiron', number: 10 },
  POR: { player: 'Bruno Fernandes', number: 8 },
  QAT: { player: 'Akram Afif', number: 11 },
  RSA: { player: 'Ronwen Williams', number: 1, role: 'goalkeeper' },
  SAU: { player: 'Salem Al-Dawsari', number: 10 },
  SCO: { player: 'Andy Robertson', number: 3 },
  SEN: { player: 'Sadio Mane', number: 10 },
  SUI: { player: 'Granit Xhaka', number: 10 },
  SWE: { player: 'Victor Nilsson Lindelof', number: 3 },
  TUN: { player: 'Ellyes Skhiri', number: 17 },
  TUR: { player: 'Hakan Calhanoglu', number: 10 },
  URU: { player: 'Federico Valverde', number: 8 },
  USA: { player: 'Christian Pulisic', number: 10 },
  UZB: { player: 'Eldor Shomurodov', number: 14 },
};

const DRAW_FOCUS = {
  'BRA-MAR': 'BRA',
  'BEL-EGY': 'BEL',
  'CAN-BIH': 'CAN',
  'ESP-CPV': 'ESP',
  'IRN-NZL': 'IRN',
  'NED-JPN': 'NED',
  'QAT-SUI': 'SUI',
  'SAU-URU': 'URU',
};

const STORY_COPY_OVERRIDES = {
  'MEX-KOR': {
    caption: {
      he: 'מקסיקו עברה את קוריאה הדרומית עם 1-0 קטן וחד. בית A כבר לא מחפש רעש, הוא מחפש מי נשאר מספיק רגוע לסמן אותה ראשונה 🔥',
      en: 'Mexico slipped past South Korea with a sharp 1-0. Group A is no longer looking for noise, it is looking for whoever stayed calm enough to put Mexico first 🔥',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'MEX',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-0 על קוריאה הדרומית, זה מרגיש פחות כמו הימור ביתי ויותר כמו קבלה על העתיד 🔥',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 על קוריאה הדרומית, אלה כבר לא טפסים שקטים - אלה קבלות קטנות על העתיד 🔥',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 על קוריאה הדרומית, אלה כבר לא טפסים שקטים - אלה קבלות קטנות על העתיד 🔥',
        en_name: '{names} picked {team} to top the group. After 1-0 over South Korea, that feels less like home bias and more like a receipt 🔥',
        en_names: '{names} picked {team} to top the group. After 1-0 over South Korea, those forms feel less like home bias and more like receipts 🔥',
        en_count: '{names} picked {team} to top the group. After 1-0 over South Korea, those forms feel less like home bias and more like receipts 🔥',
      },
      {
        table: 'group_position_picks',
        team_code: 'KOR',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-0 ממקסיקו, התוכנית עדיין חיה, אבל כבר ביקשה כוס מים ונאום הגנה 🎤',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 ממקסיקו, התוכניות עדיין חיות, אבל כבר ביקשו כוס מים ונאום הגנה 🎤',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 ממקסיקו, התוכניות עדיין חיות, אבל כבר ביקשו כוס מים ונאום הגנה 🎤',
        en_name: '{names} picked {team} to top the group. After 1-0 from Mexico, the plan is alive, but it already asked for water and a defense speech 🎤',
        en_names: '{names} picked {team} to top the group. After 1-0 from Mexico, the plans are alive, but they already asked for water and a defense speech 🎤',
        en_count: '{names} picked {team} to top the group. After 1-0 from Mexico, the plans are alive, but they already asked for water and a defense speech 🎤',
      },
    ],
  },
  'SUI-BIH': {
    caption: {
      he: 'שווייץ פירקה 4-1 את בוסניה והרצגובינה ופתחה את בית B בלי למצמץ. זאת הייתה תשובה בקול רם לכל הבית ⚡',
      en: 'Switzerland tore through Bosnia and Herzegovina 4-1 and opened Group B without blinking. That was a loud answer to the whole group ⚡',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'SUI',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 4-1 על בוסניה והרצגובינה, זה כבר לא הימור זהיר - זה טופס שמרים גבה לכולם ⚡',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 4-1 על בוסניה והרצגובינה, אלה כבר לא הימורים זהירים - אלה טפסים שמרימים גבה לכולם ⚡',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 4-1 על בוסניה והרצגובינה, אלה כבר לא הימורים זהירים - אלה טפסים שמרימים גבה לכולם ⚡',
        en_name: '{names} picked {team} to top the group. After 4-1 over Bosnia and Herzegovina, that is not a cautious pick anymore - it is a raised eyebrow ⚡',
        en_names: '{names} picked {team} to top the group. After 4-1 over Bosnia and Herzegovina, those are not cautious picks anymore - they are raised eyebrows ⚡',
        en_count: '{names} picked {team} to top the group. After 4-1 over Bosnia and Herzegovina, those are not cautious picks anymore - they are raised eyebrows ⚡',
      },
      {
        table: 'group_position_picks',
        team_code: 'BIH',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 4-1 משווייץ, הטופס עדיין על השולחן, אבל הוא כבר יושב שם עם קרח על המצח 😬',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 4-1 משווייץ, הטפסים עדיין על השולחן, אבל הם כבר יושבים שם עם קרח על המצח 😬',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 4-1 משווייץ, הטפסים עדיין על השולחן, אבל הם כבר יושבים שם עם קרח על המצח 😬',
        en_name: '{names} picked {team} to top the group. After 4-1 from Switzerland, the form is still on the table, but it has ice on its forehead 😬',
        en_names: '{names} picked {team} to top the group. After 4-1 from Switzerland, those forms are still on the table, but they have ice on their forehead 😬',
        en_count: '{names} picked {team} to top the group. After 4-1 from Switzerland, those forms are still on the table, but they have ice on their forehead 😬',
      },
    ],
  },
  'CZE-RSA': {
    caption: {
      he: 'צ\'כיה ודרום אפריקה נפרדו ב-1-1 שהשאיר את בית A עצבני. לא ניצחון, אבל מספיק כדי לגרום לכל טופס להסתכל לצדדים 👀',
      en: 'Czech Republic and South Africa split a 1-1 that left Group A twitchy. Not a win, but enough to make every form glance sideways 👀',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'CZE',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-1 מול דרום אפריקה, זה עדיין אפשרי, אבל כבר הרבה פחות נינוח 😬',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול דרום אפריקה, זה עדיין אפשרי, אבל כבר הרבה פחות נינוח 😬',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול דרום אפריקה, זה עדיין אפשרי, אבל כבר הרבה פחות נינוח 😬',
        en_name: '{names} picked {team} to top the group. After 1-1 with South Africa, it is still possible, just a lot less comfortable 😬',
        en_names: '{names} picked {team} to top the group. After 1-1 with South Africa, it is still possible, just a lot less comfortable 😬',
        en_count: '{names} picked {team} to top the group. After 1-1 with South Africa, it is still possible, just a lot less comfortable 😬',
      },
      {
        table: 'group_position_picks',
        team_code: 'RSA',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-1 מול צ\'כיה, זה כבר לא נשמע כמו בדיחה מהצד - זה נשמע כמו משהו שצריך לעקוב אחריו 👀',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול צ\'כיה, זה כבר לא נשמע כמו בדיחה מהצד - זה נשמע כמו משהו שצריך לעקוב אחריו 👀',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול צ\'כיה, זה כבר לא נשמע כמו בדיחה מהצד - זה נשמע כמו משהו שצריך לעקוב אחריו 👀',
        en_name: '{names} picked {team} to top the group. After 1-1 with Czech Republic, that no longer sounds like a side joke - it sounds worth tracking 👀',
        en_names: '{names} picked {team} to top the group. After 1-1 with Czech Republic, that no longer sounds like a side joke - it sounds worth tracking 👀',
        en_count: '{names} picked {team} to top the group. After 1-1 with Czech Republic, that no longer sounds like a side joke - it sounds worth tracking 👀',
      },
    ],
  },
  'CAN-QAT': {
    caption: {
      he: 'קנדה דרסה 6-0 את קטאר ופתחה את בית B בלי רחמים. זה מסוג המשחקים שמוחקים עיפרון ומוציאים מרקר 🔥',
      en: 'Canada crushed Qatar 6-0 and opened Group B without mercy. This is the kind of result that swaps pencil for permanent marker 🔥',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'CAN',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 6-0 על קטאר, הטופס הזה כבר לא לוחש - הוא עושה סיבוב ניצחון 🔥',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 6-0 על קטאר, הטפסים האלה כבר לא לוחשים - הם עושים סיבוב ניצחון 🔥',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 6-0 על קטאר, הטפסים האלה כבר לא לוחשים - הם עושים סיבוב ניצחון 🔥',
        en_name: '{names} picked {team} to top the group. After 6-0 over Qatar, that form is not whispering anymore - it is taking a victory lap 🔥',
        en_names: '{names} picked {team} to top the group. After 6-0 over Qatar, those forms are not whispering anymore - they are taking a victory lap 🔥',
        en_count: '{names} picked {team} to top the group. After 6-0 over Qatar, those forms are not whispering anymore - they are taking a victory lap 🔥',
      },
      {
        table: 'group_position_picks',
        team_code: 'QAT',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 6-0 מקנדה, נאום ההגנה כבר צריך פתיח, גוף, סיכום ונספח 😬',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 6-0 מקנדה, נאום ההגנה כבר צריך פתיח, גוף, סיכום ונספח 😬',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 6-0 מקנדה, נאום ההגנה כבר צריך פתיח, גוף, סיכום ונספח 😬',
        en_name: '{names} picked {team} to top the group. After 6-0 from Canada, the defense speech needs an intro, body, conclusion, and appendix 😬',
        en_names: '{names} picked {team} to top the group. After 6-0 from Canada, the defense speech needs an intro, body, conclusion, and appendix 😬',
        en_count: '{names} picked {team} to top the group. After 6-0 from Canada, the defense speech needs an intro, body, conclusion, and appendix 😬',
      },
    ],
  },
  'ARG-ALG': {
    caption: {
      he: 'מסי פתח את הטורניר עם 3-0 חד על אלג\'יריה, והספקנים קיבלו במקום זה תזכורת מי מנהל את ההצגה 🔥',
      en: 'Messi opened with a sharp 3-0 over Algeria. Anyone waiting for doubts got a reminder of who still runs the show 🔥',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'ARG',
        he_name: 'כולם לעמוד ולמחוא כפיים ל{names}. הוא בחר את {team} כמנצחת המונדיאל, ואחרי 3-0 מול אלג\'יריה זה כבר נראה הרבה פחות אמיץ ויותר גאוני 👏',
        he_names: 'כולם לעמוד ולמחוא כפיים ל{names}. הם בחרו את {team} כמנצחת המונדיאל, ואחרי 3-0 מול אלג\'יריה זה כבר נראה הרבה פחות אמיץ ויותר גאוני 👏',
        he_count: 'כולם לעמוד ולמחוא כפיים ל{names}. הם בחרו את {team} כמנצחת המונדיאל, ואחרי 3-0 מול אלג\'יריה זה כבר נראה הרבה פחות אמיץ ויותר גאוני 👏',
        en_name: 'Everyone stand up and clap for {names}. He picked {team} to win the World Cup, and after 3-0 over Algeria it looks less brave and more genius 👏',
        en_names: 'Everyone stand up and clap for {names}. They picked {team} to win the World Cup, and after 3-0 over Algeria it looks less brave and more genius 👏',
        en_count: 'Everyone stand up and clap for {names}. They picked {team} to win the World Cup, and after 3-0 over Algeria it looks less brave and more genius 👏',
      },
      {
        table: 'group_position_picks',
        team_code: 'ALG',
        position: 1,
        he_name: 'אוי הבושה. {names} שם את {team} ראשונה בבית, ואז ארגנטינה שמה 3-0 על השולחן. נאום ההגנה כבר צריך מצגת 🎤',
        he_names: 'אוי הבושה. {names} שמו את {team} ראשונה בבית, ואז ארגנטינה שמה 3-0 על השולחן. נאום ההגנה כבר צריך מצגת 🎤',
        he_count: 'אוי הבושה. {names} שמו את {team} ראשונה בבית, ואז ארגנטינה שמה 3-0 על השולחן. נאום ההגנה כבר צריך מצגת 🎤',
        en_name: 'Oh, the shame. {names} picked {team} to top the group, then Argentina put 3-0 on the table. The defense speech needs slides now 🎤',
        en_names: 'Oh, the shame. {names} picked {team} to top the group, then Argentina put 3-0 on the table. The defense speech needs slides now 🎤',
        en_count: 'Oh, the shame. {names} picked {team} to top the group, then Argentina put 3-0 on the table. The defense speech needs slides now 🎤',
      },
    ],
  },
  'IRQ-NOR': {
    caption: {
      he: 'הולאנד ונורבגיה הפכו את זה ל-4-1 על עיראק, ופתאום בית I נראה כמו מקום שלא כדאי להגיע אליו בלי קסדה ⚡',
      en: 'Haaland and Norway turned it into 4-1 against Iraq, and Group I suddenly looks like a place you enter with a helmet ⚡',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'NOR',
        he_name: '{names} בחר את {team} כמנצחת המונדיאל. אחרי 4-1 על עיראק, זה כבר לא הימור מוזר, זה פתיח לכתבה 🔥',
        he_names: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 4-1 על עיראק, זה כבר לא הימור מוזר, זה פתיח לכתבה 🔥',
        he_count: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 4-1 על עיראק, זה כבר לא הימור מוזר, זה פתיח לכתבה 🔥',
        en_name: '{names} picked {team} to win the World Cup. After 4-1 over Iraq, that is no longer weird, it is an article opener 🔥',
        en_names: '{names} picked {team} to win the World Cup. After 4-1 over Iraq, that is no longer weird, it is an article opener 🔥',
        en_count: '{names} picked {team} to win the World Cup. After 4-1 over Iraq, that is no longer weird, it is an article opener 🔥',
      },
      {
        table: 'group_position_picks',
        team_code: 'IRQ',
        position: 1,
        he_name: 'זה היה מביך... {names} שם את {team} ראשונה בבית. אחרי 4-1 מנורבגיה, אפשר לקרוע את הטופס או למסגר אותו כמזכרת 🧾',
        he_names: 'זה היה מביך... {names} שמו את {team} ראשונה בבית. אחרי 4-1 מנורבגיה, אפשר לקרוע את הטפסים או למסגר אותם כמזכרת 🧾',
        he_count: 'זה היה מביך... {names} שמו את {team} ראשונה בבית. אחרי 4-1 מנורבגיה, אפשר לקרוע את הטפסים או למסגר אותם כמזכרת 🧾',
        en_name: 'That was awkward... {names} picked {team} to top the group. After 4-1 from Norway, the form can be torn up or framed as a souvenir 🧾',
        en_names: 'That was awkward... {names} picked {team} to top the group. After 4-1 from Norway, the forms can be torn up or framed as souvenirs 🧾',
        en_count: 'That was awkward... {names} picked {team} to top the group. After 4-1 from Norway, the forms can be torn up or framed as souvenirs 🧾',
      },
    ],
  },
  'FRA-SEN': {
    caption: {
      he: 'צרפת לא נזקקה לדרמה: 3-1 על סנגל, אמבפה מחייך, וכל הבית כבר מבין מי באה לכאן עם רעש של אלופה 👑',
      en: 'France did not need drama: 3-1 over Senegal, Mbappe smiling, and the whole group can hear the champion noise 👑',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'FRA',
        he_name: '{names} בחר את {team} כמנצחת המונדיאל. אחרי 3-1 על סנגל, הוא כבר מרשה לעצמו חיוך קטן של "אמרתי לכם" 👑',
        he_names: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 3-1 על סנגל, הם כבר מרשים לעצמם חיוך קטן של "אמרנו לכם" 👑',
        he_count: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 3-1 על סנגל, הם כבר מרשים לעצמם חיוך קטן של "אמרנו לכם" 👑',
        en_name: '{names} picked {team} to win the World Cup. After 3-1 over Senegal, he has earned a small "told you" smile 👑',
        en_names: '{names} picked {team} to win the World Cup. After 3-1 over Senegal, they have earned a small "told you" smile 👑',
        en_count: '{names} picked {team} to win the World Cup. After 3-1 over Senegal, they have earned a small "told you" smile 👑',
      },
      {
        table: 'group_position_picks',
        team_code: 'SEN',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 3-1 מצרפת, הטופס שלו עדיין חי, אבל הוא כבר מדבר בקול נמוך יותר 😬',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 3-1 מצרפת, הטפסים שלהם עדיין חיים, אבל הם כבר מדברים בקול נמוך יותר 😬',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 3-1 מצרפת, הטפסים שלהם עדיין חיים, אבל הם כבר מדברים בקול נמוך יותר 😬',
        en_name: '{names} picked {team} to top the group. After 3-1 from France, the form is still alive, but it is speaking much more quietly 😬',
        en_names: '{names} picked {team} to top the group. After 3-1 from France, the forms are still alive, but they are speaking much more quietly 😬',
        en_count: '{names} picked {team} to top the group. After 3-1 from France, the forms are still alive, but they are speaking much more quietly 😬',
      },
    ],
  },
  'ESP-CPV': {
    caption: {
      he: 'ספרד בעטה בלי למצוא שער, כף ורדה החזיקה 0-0, והמשחק הזה הפך את בית H להרבה פחות צפוי 🫣',
      en: 'Spain kept knocking without scoring, Cape Verde held the 0-0, and Group H suddenly looks much less predictable 🫣',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'ESP',
        he_name: 'זה היה מביך... {names} בחר את {team} כמנצחת המונדיאל. אחרי 0-0 מול כף ורדה, הטופס שלו כבר מבקש עורך דין 🧾🫣',
        he_names: 'זה היה מביך... {names} בחרו את {team} כמנצחת המונדיאל. אחרי 0-0 מול כף ורדה, הטפסים שלהם כבר מבקשים עורך דין 🧾🫣',
        he_count: 'זה היה מביך... {names} בחרו את {team} כמנצחת המונדיאל. אחרי 0-0 מול כף ורדה, הטפסים שלהם כבר מבקשים עורך דין 🧾🫣',
        en_name: 'That was awkward... {names} picked {team} to win the World Cup. After 0-0 with Cape Verde, his form already needs a lawyer 🧾🫣',
        en_names: 'That was awkward... {names} picked {team} to win the World Cup. After 0-0 with Cape Verde, their forms already need a lawyer 🧾🫣',
        en_count: 'That was awkward... {names} picked {team} to win the World Cup. After 0-0 with Cape Verde, their forms already need a lawyer 🧾🫣',
      },
      {
        table: 'group_position_picks',
        team_code: 'ESP',
        position: 1,
        he_name: 'אוי הבושה. {names} שם את {team} ראשונה בבית, ואז הגיע 0-0 מול כף ורדה. נאום ה"זה רק משחק ראשון" כבר מוכן 🎤',
        he_names: 'אוי הבושה. {names} שמו את {team} ראשונה בבית, ואז הגיע 0-0 מול כף ורדה. נאום ה"זה רק משחק ראשון" כבר מוכן 🎤',
        he_count: 'אוי הבושה. {names} שמו את {team} ראשונה בבית, ואז הגיע 0-0 מול כף ורדה. נאום ה"זה רק משחק ראשון" כבר מוכן 🎤',
        en_name: 'Oh, the shame. {names} picked {team} to top the group, then Cape Verde made it 0-0. The "it is only one game" speech is ready 🎤',
        en_names: 'Oh, the shame. {names} picked {team} to top the group, then Cape Verde made it 0-0. The "it is only one game" speech is ready 🎤',
        en_count: 'Oh, the shame. {names} picked {team} to top the group, then Cape Verde made it 0-0. The "it is only one game" speech is ready 🎤',
      },
    ],
  },
  'BEL-EGY': {
    caption: {
      he: 'בלגיה הובילה, מצרים לא נבהלה, וזה נגמר 1-1 שהשאיר את בית G פתוח ומאוד לא רגוע 😬',
      en: 'Belgium led, Egypt refused to blink, and the 1-1 left Group G open and very uncomfortable 😬',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'BEL',
        he_name: '{names} בחר את {team} כמנצחת המונדיאל. אחרי 1-1 מול מצרים, הביטחון הזה כבר ביקש חילוף 😬',
        he_names: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 1-1 מול מצרים, הביטחון הקבוצתי כבר ביקש חילוף 😬',
        he_count: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 1-1 מול מצרים, הביטחון הקבוצתי כבר ביקש חילוף 😬',
        en_name: '{names} picked {team} to win the World Cup. After 1-1 with Egypt, that confidence officially requested a substitution 😬',
        en_names: '{names} picked {team} to win the World Cup. After 1-1 with Egypt, the group confidence officially requested a substitution 😬',
        en_count: '{names} picked {team} to win the World Cup. After 1-1 with Egypt, the group confidence officially requested a substitution 😬',
      },
      {
        table: 'group_position_picks',
        team_code: 'BEL',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-1 מול מצרים, זה עדיין חי, אבל הדופק כבר לא רגוע 😬',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול מצרים, זה עדיין חי, אבל הדופק כבר לא רגוע 😬',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול מצרים, זה עדיין חי, אבל הדופק כבר לא רגוע 😬',
        en_name: '{names} picked {team} first in the group. After 1-1 with Egypt, it is alive, but the pulse is not calm 😬',
        en_names: '{names} picked {team} first in the group. After 1-1 with Egypt, it is alive, but the pulse is not calm 😬',
        en_count: '{names} picked {team} first in the group. After 1-1 with Egypt, it is alive, but the pulse is not calm 😬',
      },
    ],
  },
  'SAU-URU': {
    caption: {
      he: 'ערב הסעודית הוציאה 1-1 מאורוגוואי, ופתאום בית H קיבל סיפור הרבה יותר רציני 🎤😬',
      en: 'Saudi Arabia pulled a 1-1 out of Uruguay, and suddenly Group H has a much bigger story 🎤😬',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'URU',
        he_name: 'אוי הבושה. {names} בחר את {team} כמנצחת המונדיאל, ואז הגיע 1-1 מול ערב הסעודית. נאום ההגנה מתחיל עכשיו 🎤😬',
        he_names: 'אוי הבושה. {names} בחרו את {team} כמנצחת המונדיאל, ואז הגיע 1-1 מול ערב הסעודית. נאום ההגנה מתחיל עכשיו 🎤😬',
        he_count: 'אוי הבושה. {names} בחרו את {team} כמנצחת המונדיאל, ואז הגיע 1-1 מול ערב הסעודית. נאום ההגנה מתחיל עכשיו 🎤😬',
        en_name: 'Oh, the shame. {names} picked {team} to win the World Cup, then came 1-1 with Saudi Arabia. The defense speech starts now 🎤😬',
        en_names: 'Oh, the shame. {names} picked {team} to win the World Cup, then came 1-1 with Saudi Arabia. The defense speech starts now 🎤😬',
        en_count: 'Oh, the shame. {names} picked {team} to win the World Cup, then came 1-1 with Saudi Arabia. The defense speech starts now 🎤😬',
      },
      {
        table: 'group_position_picks',
        team_code: 'URU',
        position: 1,
        he_name: 'אוי הבושה. {names} שם את {team} ראשונה בבית, ואחרי 1-1 מול ערב הסעודית הוא כבר בשלב התירוצים 🎤😬',
        he_names: 'אוי הבושה. {names} שמו את {team} ראשונה בבית, ואחרי 1-1 מול ערב הסעודית הם כבר בשלב התירוצים 🎤😬',
        he_count: 'אוי הבושה. {names} שמו את {team} ראשונה בבית, ואחרי 1-1 מול ערב הסעודית הם כבר בשלב התירוצים 🎤😬',
        en_name: 'Oh, the shame. {names} picked {team} first in the group, and after 1-1 with Saudi Arabia he is already in excuse mode 🎤😬',
        en_names: 'Oh, the shame. {names} picked {team} first in the group, and after 1-1 with Saudi Arabia they are already in excuse mode 🎤😬',
        en_count: 'Oh, the shame. {names} picked {team} first in the group, and after 1-1 with Saudi Arabia they are already in excuse mode 🎤😬',
      },
    ],
  },
  'IRN-NZL': {
    caption: {
      he: 'איראן וניו זילנד נתנו 2-2 קצבי, ובית G נשאר פתוח בדיוק בשביל ההימורים האמיצים 🔥',
      en: 'Iran and New Zealand gave us a lively 2-2, and Group G stayed wide open for the brave picks 🔥',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'IRN',
        position: 1,
        he_name: 'כולם לעמוד ולמחוא כפיים. {names} שם את {team} ראשונה בבית, ואחרי 2-2 מול ניו זילנד זה כבר לא נשמע הזוי 👏🔥',
        he_names: 'כולם לעמוד ולמחוא כפיים. {names} שמו את {team} ראשונה בבית, ואחרי 2-2 מול ניו זילנד זה כבר לא נשמע הזוי 👏🔥',
        he_count: 'כולם לעמוד ולמחוא כפיים. {names} שמו את {team} ראשונה בבית, ואחרי 2-2 מול ניו זילנד זה כבר לא נשמע הזוי 👏🔥',
        en_name: 'Everybody stand up and clap. {names} picked {team} to top the group, and after 2-2 with New Zealand it no longer sounds crazy 👏🔥',
        en_names: 'Everybody stand up and clap. {names} picked {team} to top the group, and after 2-2 with New Zealand it no longer sounds crazy 👏🔥',
        en_count: 'Everybody stand up and clap. {names} picked {team} to top the group, and after 2-2 with New Zealand it no longer sounds crazy 👏🔥',
      },
    ],
  },
  'GER-CUR': {
    caption: {
      he: 'גרמניה פתחה מבערים עם 7-1 מול קוראסאו. זה לא היה משחק, זה היה תיקון אגרסיבי לטבלה 🔥',
      en: 'Germany turned the volume all the way up with 7-1 against Curacao. Not a match, a brutal table correction 🔥',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'CUR',
        position: 1,
        he_name: 'זה היה מביך... {names} שם את {team} ראשונה בבית. אחרי 7-1 מגרמניה, הטופס הזה צריך טיפול נמרץ 🧾',
        he_names: 'זה היה מביך... {names} שמו את {team} ראשונה בבית. אחרי 7-1 מגרמניה, הטפסים האלה צריכים טיפול נמרץ 🧾',
        he_count: 'זה היה מביך... {names} שמו את {team} ראשונה בבית. אחרי 7-1 מגרמניה, הטפסים האלה צריכים טיפול נמרץ 🧾',
        en_name: 'That was awkward... {names} picked {team} to top the group. After Germany made it 7-1, that form needs intensive care 🧾',
        en_names: 'That was awkward... {names} picked {team} to top the group. After Germany made it 7-1, those forms need intensive care 🧾',
        en_count: 'That was awkward... {names} picked {team} to top the group. After Germany made it 7-1, those forms need intensive care 🧾',
      },
    ],
  },
  'NED-JPN': {
    caption: {
      he: 'הולנד ויפן סיימו 2-2 והשאירו את בית F פתוח. משחק אחד, וכל הטבלה נראית פחות רגועה 🟠',
      en: 'Netherlands and Japan finished 2-2 and left Group F open. One match, and the whole table looks less calm 🟠',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'NED',
        he_name: '{names} בחר את {team} כמנצחת המונדיאל. אחרי 2-2 מול יפן, הבחירה הזאת נראית קצת פחות אפויה 🟠',
        he_names: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 2-2 מול יפן, הבחירה הזאת נראית קצת פחות אפויה 🟠',
        he_count: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 2-2 מול יפן, הבחירה הזאת נראית קצת פחות אפויה 🟠',
        en_name: '{names} picked {team} to win the World Cup. After 2-2 with Japan, that choice looks a little undercooked 🟠',
        en_names: '{names} picked {team} to win the World Cup. After 2-2 with Japan, those choices look a little undercooked 🟠',
        en_count: '{names} picked {team} to win the World Cup. After 2-2 with Japan, those choices look a little undercooked 🟠',
      },
      {
        table: 'group_position_picks',
        team_code: 'NED',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 2-2 מול יפן, הדרך לשם כבר נראית כמו שאלת בונוס 🟠',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 2-2 מול יפן, הדרך לשם כבר נראית כמו שאלת בונוס 🟠',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 2-2 מול יפן, הדרך לשם כבר נראית כמו שאלת בונוס 🟠',
        en_name: '{names} picked {team} to top the group. After 2-2 with Japan, that route now looks like a bonus question 🟠',
        en_names: '{names} picked {team} to top the group. After 2-2 with Japan, that route now looks like a bonus question 🟠',
        en_count: '{names} picked {team} to top the group. After 2-2 with Japan, that route now looks like a bonus question 🟠',
      },
    ],
  },
  'CIV-ECU': {
    caption: {
      he: 'חוף השנהב לקחה 1-0 קטן מאקוודור, אבל בטבלה זה מרגיש הרבה יותר גדול 📈',
      en: 'Ivory Coast took a small 1-0 from Ecuador, but in the table it feels much bigger 📈',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'ECU',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. 1-0 קטן לחוף השנהב, והטופס שלו כבר מזיע 📉',
        he_names: '{names} שמו את {team} ראשונה בבית. 1-0 קטן לחוף השנהב, והטפסים שלהם כבר מזיעים 📉',
        he_count: '{names} שמו את {team} ראשונה בבית. 1-0 קטן לחוף השנהב, והטפסים שלהם כבר מזיעים 📉',
        en_name: '{names} picked {team} to top the group. A tiny 1-0 for Ivory Coast, and his form is already sweating 📉',
        en_names: '{names} picked {team} to top the group. A tiny 1-0 for Ivory Coast, and their forms are already sweating 📉',
        en_count: '{names} picked {team} to top the group. A tiny 1-0 for Ivory Coast, and their forms are already sweating 📉',
      },
    ],
  },
  'SWE-TUN': {
    caption: {
      he: 'שוודיה פירקה את תוניסיה 5-1, משחק אחד שהפך כל הימור נגד שוודיה למסמך בעייתי 🧾',
      en: 'Sweden smashed Tunisia 5-1, one match that turned every anti-Sweden form into a problematic document 🧾',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'TUN',
        he_name: 'זה היה מביך... {names} בחר את {team} כמנצחת המונדיאל. אחרי 5-1 משוודיה, הטופס הזה נכנס למוזיאון ההחלטות האמיצות 🧾',
        he_names: 'זה היה מביך... {names} בחרו את {team} כמנצחת המונדיאל. אחרי 5-1 משוודיה, הטפסים האלה נכנסים למוזיאון ההחלטות האמיצות 🧾',
        he_count: 'זה היה מביך... {names} בחרו את {team} כמנצחת המונדיאל. אחרי 5-1 משוודיה, הטפסים האלה נכנסים למוזיאון ההחלטות האמיצות 🧾',
        en_name: 'That was awkward... {names} picked {team} to win the World Cup. After Sweden made it 5-1, that form belongs in the brave-decisions museum 🧾',
        en_names: 'That was awkward... {names} picked {team} to win the World Cup. After Sweden made it 5-1, those forms belong in the brave-decisions museum 🧾',
        en_count: 'That was awkward... {names} picked {team} to win the World Cup. After Sweden made it 5-1, those forms belong in the brave-decisions museum 🧾',
      },
      {
        table: 'group_position_picks',
        team_code: 'TUN',
        position: 1,
        he_name: 'זה היה מביך... {names} שם את {team} ראשונה בבית. אחרי 5-1 משוודיה, אפשר לקרוע את הטופס או למסגר אותו כמזכרת 🧾',
        he_names: 'זה היה מביך... {names} שמו את {team} ראשונה בבית. אחרי 5-1 משוודיה, אפשר לקרוע את הטפסים או למסגר אותם כמזכרת 🧾',
        he_count: 'זה היה מביך... {names} שמו את {team} ראשונה בבית. אחרי 5-1 משוודיה, אפשר לקרוע את הטפסים או למסגר אותם כמזכרת 🧾',
        en_name: 'That was awkward... {names} picked {team} to top the group. After Sweden made it 5-1, the form can be torn up or framed as a souvenir 🧾',
        en_names: 'That was awkward... {names} picked {team} to top the group. After Sweden made it 5-1, the forms can be torn up or framed as souvenirs 🧾',
        en_count: 'That was awkward... {names} picked {team} to top the group. After Sweden made it 5-1, the forms can be torn up or framed as souvenirs 🧾',
      },
    ],
  },
  'UZB-COL': {
    caption: {
      he: 'קולומביה ניצחה 3-1 את אוזבקיסטן ופתחה את בית K עם חיוך גדול. הבית הזה כבר קיבל צבע, קצב וטיפה לחץ 🔥',
      en: 'Colombia beat Uzbekistan 3-1 and opened Group K with a grin. The group already has color, tempo, and a little pressure 🔥',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'COL',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 3-1 על אוזבקיסטן, זה כבר לא הימור שקט - זה רגע לצלם את הטופס 🔥',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 3-1 על אוזבקיסטן, זה כבר לא הימור שקט - זה רגע לצלם את הטפסים 🔥',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 3-1 על אוזבקיסטן, זה כבר לא הימור שקט - זה רגע לצלם את הטפסים 🔥',
        en_name: '{names} picked {team} to top the group. After 3-1 over Uzbekistan, that is no longer a quiet pick - it is screenshot material 🔥',
        en_names: '{names} picked {team} to top the group. After 3-1 over Uzbekistan, those are no longer quiet picks - they are screenshot material 🔥',
        en_count: '{names} picked {team} to top the group. After 3-1 over Uzbekistan, those are no longer quiet picks - they are screenshot material 🔥',
      },
      {
        table: 'group_position_picks',
        team_code: 'UZB',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 3-1 מקולומביה, הטופס עדיין חי, אבל הוא כבר מחפש תחבושת 😬',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 3-1 מקולומביה, הטפסים עדיין חיים, אבל הם כבר מחפשים תחבושת 😬',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 3-1 מקולומביה, הטפסים עדיין חיים, אבל הם כבר מחפשים תחבושת 😬',
        en_name: '{names} picked {team} to top the group. After 3-1 from Colombia, that form is still alive, but it is already looking for a bandage 😬',
        en_names: '{names} picked {team} to top the group. After 3-1 from Colombia, those forms are still alive, but they are already looking for bandages 😬',
        en_count: '{names} picked {team} to top the group. After 3-1 from Colombia, those forms are still alive, but they are already looking for bandages 😬',
      },
    ],
  },
  'GHA-PAN': {
    caption: {
      he: 'גאנה לקחה 1-0 קטן וקשוח מפנמה. לא תמיד צריך הצגה גדולה כדי להפוך בית שלם לעצבני 🔥',
      en: 'Ghana took a tight, stubborn 1-0 from Panama. Sometimes one goal is enough to make a whole group nervous 🔥',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'GHA',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-0 על פנמה, זה בדיוק הזמן לפתוח את הטופס עם חיוך קטן 🔥',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 על פנמה, זה בדיוק הזמן לפתוח את הטפסים עם חיוך קטן 🔥',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 על פנמה, זה בדיוק הזמן לפתוח את הטפסים עם חיוך קטן 🔥',
        en_name: '{names} picked {team} to top the group. After 1-0 over Panama, this is exactly when that form gets opened with a tiny smile 🔥',
        en_names: '{names} picked {team} to top the group. After 1-0 over Panama, this is exactly when those forms get opened with tiny smiles 🔥',
        en_count: '{names} picked {team} to top the group. After 1-0 over Panama, this is exactly when those forms get opened with tiny smiles 🔥',
      },
      {
        table: 'group_position_picks',
        team_code: 'PAN',
        position: 1,
        he_name: 'אוי. {names} שם את {team} ראשונה בבית, ואז גאנה גנבה 1-0. נאום ה"זה רק מחזור ראשון" כבר בדרך 🎤',
        he_names: 'אוי. {names} שמו את {team} ראשונה בבית, ואז גאנה גנבה 1-0. נאום ה"זה רק מחזור ראשון" כבר בדרך 🎤',
        he_count: 'אוי. {names} שמו את {team} ראשונה בבית, ואז גאנה גנבה 1-0. נאום ה"זה רק מחזור ראשון" כבר בדרך 🎤',
        en_name: 'Oof. {names} picked {team} to top the group, then Ghana stole the 1-0. The "it is only match one" speech is already loading 🎤',
        en_names: 'Oof. {names} picked {team} to top the group, then Ghana stole the 1-0. The "it is only match one" speech is already loading 🎤',
        en_count: 'Oof. {names} picked {team} to top the group, then Ghana stole the 1-0. The "it is only match one" speech is already loading 🎤',
      },
    ],
  },
  'ENG-CRO': {
    caption: {
      he: 'אנגליה שרדה את הרעש הקרואטי ויצאה עם 4-2. קיין חייך, והטפסים של אנגליה פתאום נראים קצת יותר בטוחים 👑',
      en: 'England survived the Croatian noise and walked out with 4-2. Kane smiled, and the England forms suddenly look a little safer 👑',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'ENG',
        he_name: '{names} בחר את {team} כמנצחת המונדיאל. אחרי 4-2 על קרואטיה, מותר לו כבר חיוך קטן של "אמרתי לכם" 👑',
        he_names: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 4-2 על קרואטיה, מותר להם כבר חיוך קטן של "אמרנו לכם" 👑',
        he_count: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 4-2 על קרואטיה, מותר להם כבר חיוך קטן של "אמרנו לכם" 👑',
        en_name: '{names} picked {team} to win the World Cup. After 4-2 over Croatia, he is allowed one tiny "I knew it" smile 👑',
        en_names: '{names} picked {team} to win the World Cup. After 4-2 over Croatia, they are allowed one tiny "we knew it" smile 👑',
        en_count: '{names} picked {team} to win the World Cup. After 4-2 over Croatia, they are allowed one tiny "we knew it" smile 👑',
      },
      {
        table: 'group_position_picks',
        team_code: 'CRO',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 4-2 מאנגליה, הטופס עדיין חי, אבל הוא כבר מדבר בקול נמוך יותר 😬',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 4-2 מאנגליה, הטפסים עדיין חיים, אבל הם כבר מדברים בקול נמוך יותר 😬',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 4-2 מאנגליה, הטפסים עדיין חיים, אבל הם כבר מדברים בקול נמוך יותר 😬',
        en_name: '{names} picked {team} to top the group. After 4-2 from England, the form is still alive, but it is speaking much more quietly 😬',
        en_names: '{names} picked {team} to top the group. After 4-2 from England, the forms are still alive, but they are speaking much more quietly 😬',
        en_count: '{names} picked {team} to top the group. After 4-2 from England, the forms are still alive, but they are speaking much more quietly 😬',
      },
    ],
  },
  'POR-COD': {
    caption: {
      he: 'פורטוגל וקונגו נפרדו ב-1-1 שהרגיש כמו אזהרה. בית K פתאום קיבל שיניים 😬',
      en: 'Portugal and DR Congo split a 1-1 that felt like a warning. Group K just showed teeth 😬',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'POR',
        he_name: '{names} בחר את {team} כמנצחת המונדיאל. אחרי 1-1 מול קונגו, הביטחון הזה כבר ביקש כיסא ומים 😬',
        he_names: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 1-1 מול קונגו, הביטחון הזה כבר ביקש כיסא ומים 😬',
        he_count: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 1-1 מול קונגו, הביטחון הזה כבר ביקש כיסא ומים 😬',
        en_name: '{names} picked {team} to win the World Cup. After 1-1 with DR Congo, that confidence asked for a chair and water 😬',
        en_names: '{names} picked {team} to win the World Cup. After 1-1 with DR Congo, that confidence asked for a chair and water 😬',
        en_count: '{names} picked {team} to win the World Cup. After 1-1 with DR Congo, that confidence asked for a chair and water 😬',
      },
      {
        table: 'group_position_picks',
        team_code: 'COD',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-1 מול פורטוגל, פתאום זה לא נשמע כמו בדיחה, זה נשמע כמו חומר לסטורי 🔥',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול פורטוגל, פתאום זה לא נשמע כמו בדיחה, זה נשמע כמו חומר לסטורי 🔥',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול פורטוגל, פתאום זה לא נשמע כמו בדיחה, זה נשמע כמו חומר לסטורי 🔥',
        en_name: '{names} picked {team} to top the group. After 1-1 with Portugal, that no longer sounds like a joke, it sounds like story material 🔥',
        en_names: '{names} picked {team} to top the group. After 1-1 with Portugal, that no longer sounds like a joke, it sounds like story material 🔥',
        en_count: '{names} picked {team} to top the group. After 1-1 with Portugal, that no longer sounds like a joke, it sounds like story material 🔥',
      },
    ],
  },
  'AUT-JOR': {
    caption: {
      he: 'אוסטריה פתחה עם 3-1 על ירדן בלי יותר מדי רחמים. בית J קיבל עוד קבוצה שלא באה לקשט ⚡',
      en: 'Austria opened with 3-1 over Jordan, without much mercy. Group J just found another team that did not come to decorate ⚡',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'AUT',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 3-1 על ירדן, זה כבר לא רק הימור אמיץ - זה טופס עם פתיחה חזקה ⚡',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 3-1 על ירדן, זה כבר לא רק הימור אמיץ - אלה טפסים עם פתיחה חזקה ⚡',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 3-1 על ירדן, זה כבר לא רק הימור אמיץ - אלה טפסים עם פתיחה חזקה ⚡',
        en_name: '{names} picked {team} to top the group. After 3-1 over Jordan, that is not just a brave pick - it is a form with a strong opening ⚡',
        en_names: '{names} picked {team} to top the group. After 3-1 over Jordan, those are not just brave picks - they are forms with a strong opening ⚡',
        en_count: '{names} picked {team} to top the group. After 3-1 over Jordan, those are not just brave picks - they are forms with a strong opening ⚡',
      },
      {
        table: 'group_position_picks',
        team_code: 'JOR',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 3-1 מאוסטריה, נאום ההגנה כבר צריך פתיח, גוף וסיכום 🎤',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 3-1 מאוסטריה, נאום ההגנה כבר צריך פתיח, גוף וסיכום 🎤',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 3-1 מאוסטריה, נאום ההגנה כבר צריך פתיח, גוף וסיכום 🎤',
        en_name: '{names} picked {team} to top the group. After 3-1 from Austria, the defense speech needs an intro, body, and conclusion 🎤',
        en_names: '{names} picked {team} to top the group. After 3-1 from Austria, the defense speech needs an intro, body, and conclusion 🎤',
        en_count: '{names} picked {team} to top the group. After 3-1 from Austria, the defense speech needs an intro, body, and conclusion 🎤',
      },
    ],
  },
  'MEX-RSA': {
    caption: {
      he: 'מקסיקו פתחה עם 2-0 נקי על דרום אפריקה, וזה הרגיש כמו הודעה קצרה לכל בית A: לא באנו להתחמם, באנו לקחת מקום.',
      en: 'Mexico opened with a clean 2-0 over South Africa, the kind of short message Group A understands immediately: no warm-up, just business.',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'MEX',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 2-0 על דרום אפריקה, זה כבר נראה פחות כמו אהבת בית ויותר כמו קריאת מפה מוקדמת.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 2-0 על דרום אפריקה, אלה כבר נראים פחות כמו הימורים ביתיים ויותר כמו קריאת מפה מוקדמת.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 2-0 על דרום אפריקה, אלה כבר נראים פחות כמו הימורים ביתיים ויותר כמו קריאת מפה מוקדמת.',
        en_name: '{names} picked {team} to top the group. After 2-0 over South Africa, that looks less like home love and more like reading the map early.',
        en_names: '{names} picked {team} to top the group. After 2-0 over South Africa, those look less like home-love picks and more like reading the map early.',
        en_count: '{names} picked {team} to top the group. After 2-0 over South Africa, those look less like home-love picks and more like reading the map early.',
      },
      {
        table: 'group_position_picks',
        team_code: 'RSA',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 2-0 ממקסיקו, הטופס לא מת, אבל הוא כבר מחפש הסבר שלא מתחיל ב"משחק פתיחה".',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 2-0 ממקסיקו, הטפסים לא מתים, אבל הם כבר מחפשים הסבר שלא מתחיל ב"משחק פתיחה".',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 2-0 ממקסיקו, הטפסים לא מתים, אבל הם כבר מחפשים הסבר שלא מתחיל ב"משחק פתיחה".',
        en_name: '{names} picked {team} to top the group. After 2-0 from Mexico, the form is not dead, but it needs an explanation that is not "opening game".',
        en_names: '{names} picked {team} to top the group. After 2-0 from Mexico, the forms are not dead, but they need an explanation that is not "opening game".',
        en_count: '{names} picked {team} to top the group. After 2-0 from Mexico, the forms are not dead, but they need an explanation that is not "opening game".',
      },
    ],
  },
  'KOR-CZE': {
    caption: {
      he: 'קוריאה הדרומית לקחה 2-1 מצ׳כיה והשאירה את בית A עם פחות חמצן. ניצחון קטן, אבל כזה שמזיז הרבה טפסים בכיסא.',
      en: 'South Korea took 2-1 from Czech Republic and left Group A with less oxygen. A small win, but one that moves a lot of forms in their seats.',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'KOR',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 2-1 על צ׳כיה, זה כבר לא טופס שקט - זה טופס שמבקש שיסתכלו עליו שוב.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 2-1 על צ׳כיה, אלה כבר לא טפסים שקטים - אלה טפסים שמבקשים שיסתכלו עליהם שוב.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 2-1 על צ׳כיה, אלה כבר לא טפסים שקטים - אלה טפסים שמבקשים שיסתכלו עליהם שוב.',
        en_name: '{names} picked {team} to top the group. After 2-1 over Czech Republic, that is no longer a quiet form - it wants another look.',
        en_names: '{names} picked {team} to top the group. After 2-1 over Czech Republic, those are no longer quiet forms - they want another look.',
        en_count: '{names} picked {team} to top the group. After 2-1 over Czech Republic, those are no longer quiet forms - they want another look.',
      },
      {
        table: 'group_position_picks',
        team_code: 'CZE',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 2-1 מקוריאה הדרומית, יש עדיין דרך, אבל עכשיו היא מגיעה עם עלייה ודופק.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 2-1 מקוריאה הדרומית, יש עדיין דרך, אבל עכשיו היא מגיעה עם עלייה ודופק.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 2-1 מקוריאה הדרומית, יש עדיין דרך, אבל עכשיו היא מגיעה עם עלייה ודופק.',
        en_name: '{names} picked {team} to top the group. After 2-1 from South Korea, there is still a path, but now it comes uphill and breathing hard.',
        en_names: '{names} picked {team} to top the group. After 2-1 from South Korea, there is still a path, but now it comes uphill and breathing hard.',
        en_count: '{names} picked {team} to top the group. After 2-1 from South Korea, there is still a path, but now it comes uphill and breathing hard.',
      },
    ],
  },
  'CAN-BIH': {
    caption: {
      he: 'קנדה ובוסניה נפרדו ב-1-1, תוצאה שלא סוגרת כלום אבל פותחת מספיק ויכוחים. בית B קיבל תיקו עם רעש לוואי.',
      en: 'Canada and Bosnia drew 1-1, a result that closes nothing and opens plenty of arguments. Group B got a draw with aftershock.',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'CAN',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-1 מול בוסניה, זה עדיין חי, אבל כבר פחות הולך עם משקפי שמש.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול בוסניה, זה עדיין חי, אבל כבר פחות הולך עם משקפי שמש.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול בוסניה, זה עדיין חי, אבל כבר פחות הולך עם משקפי שמש.',
        en_name: '{names} picked {team} to top the group. After 1-1 with Bosnia, it is still alive, just wearing fewer sunglasses.',
        en_names: '{names} picked {team} to top the group. After 1-1 with Bosnia, it is still alive, just wearing fewer sunglasses.',
        en_count: '{names} picked {team} to top the group. After 1-1 with Bosnia, it is still alive, just wearing fewer sunglasses.',
      },
      {
        table: 'group_position_picks',
        team_code: 'BIH',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. 1-1 מול קנדה לא נותן מצעד, אבל הוא בהחלט משאיר את הדלת פתוחה עם רגל בפנים.',
        he_names: '{names} שמו את {team} ראשונה בבית. 1-1 מול קנדה לא נותן מצעד, אבל הוא בהחלט משאיר את הדלת פתוחה עם רגל בפנים.',
        he_count: '{names} שמו את {team} ראשונה בבית. 1-1 מול קנדה לא נותן מצעד, אבל הוא בהחלט משאיר את הדלת פתוחה עם רגל בפנים.',
        en_name: '{names} picked {team} to top the group. A 1-1 with Canada is not a parade, but it keeps one foot firmly in the door.',
        en_names: '{names} picked {team} to top the group. A 1-1 with Canada is not a parade, but it keeps one foot firmly in the door.',
        en_count: '{names} picked {team} to top the group. A 1-1 with Canada is not a parade, but it keeps one foot firmly in the door.',
      },
    ],
  },
  'USA-PAR': {
    caption: {
      he: 'ארה״ב פתחה מבערים עם 4-1 על פרגוואי. זה לא היה רמז, זה היה שלט ניאון באמצע בית D.',
      en: 'USA hit the burners with 4-1 over Paraguay. That was not a hint, it was a neon sign in the middle of Group D.',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'USA',
        he_name: '{names} בחר את {team} כמנצחת המונדיאל. אחרי 4-1 על פרגוואי, זה עדיין אמיץ - אבל פתאום הרבה יותר קשה לצחוק.',
        he_names: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 4-1 על פרגוואי, זה עדיין אמיץ - אבל פתאום הרבה יותר קשה לצחוק.',
        he_count: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 4-1 על פרגוואי, זה עדיין אמיץ - אבל פתאום הרבה יותר קשה לצחוק.',
        en_name: '{names} picked {team} to win the World Cup. After 4-1 over Paraguay, it is still bold - just suddenly harder to laugh at.',
        en_names: '{names} picked {team} to win the World Cup. After 4-1 over Paraguay, it is still bold - just suddenly harder to laugh at.',
        en_count: '{names} picked {team} to win the World Cup. After 4-1 over Paraguay, it is still bold - just suddenly harder to laugh at.',
      },
      {
        table: 'group_position_picks',
        team_code: 'PAR',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 4-1 מארה״ב, הטופס לא נקרע, אבל הוא בהחלט עבר למצב טיוטה.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 4-1 מארה״ב, הטפסים לא נקרעים, אבל הם בהחלט עברו למצב טיוטה.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 4-1 מארה״ב, הטפסים לא נקרעים, אבל הם בהחלט עברו למצב טיוטה.',
        en_name: '{names} picked {team} to top the group. After 4-1 from USA, the form is not torn up, but it has definitely moved to draft mode.',
        en_names: '{names} picked {team} to top the group. After 4-1 from USA, the forms are not torn up, but they have definitely moved to draft mode.',
        en_count: '{names} picked {team} to top the group. After 4-1 from USA, the forms are not torn up, but they have definitely moved to draft mode.',
      },
    ],
  },
  'USA-AUS': {
    caption: {
      he: 'עוד 2-0 לארה״ב, הפעם מול אוסטרליה, והבית מתחיל להיראות כמו חדר שהם כבר סידרו לעצמם מראש.',
      en: 'Another 2-0 for USA, this time over Australia, and the group is starting to look like a room they arranged for themselves in advance.',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'USA',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי עוד 2-0, הפעם על אוסטרליה, הטופס הזה כבר לא מבקש אישור - הוא מבקש מסגרת.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי עוד 2-0, הפעם על אוסטרליה, הטפסים האלה כבר לא מבקשים אישור - הם מבקשים מסגרת.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי עוד 2-0, הפעם על אוסטרליה, הטפסים האלה כבר לא מבקשים אישור - הם מבקשים מסגרת.',
        en_name: '{names} picked {team} to top the group. After another 2-0, this time over Australia, that form is not asking for approval anymore - it wants a frame.',
        en_names: '{names} picked {team} to top the group. After another 2-0, this time over Australia, those forms are not asking for approval anymore - they want frames.',
        en_count: '{names} picked {team} to top the group. After another 2-0, this time over Australia, those forms are not asking for approval anymore - they want frames.',
      },
      {
        table: 'group_position_picks',
        team_code: 'AUS',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 2-0 מארה״ב, הדרך עדיין קיימת, אבל היא כבר צריכה GPS ומצב רוח חזק.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 2-0 מארה״ב, הדרך עדיין קיימת, אבל היא כבר צריכה GPS ומצב רוח חזק.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 2-0 מארה״ב, הדרך עדיין קיימת, אבל היא כבר צריכה GPS ומצב רוח חזק.',
        en_name: '{names} picked {team} to top the group. After 2-0 from USA, the route still exists, but now it needs GPS and a strong mood.',
        en_names: '{names} picked {team} to top the group. After 2-0 from USA, the route still exists, but now it needs GPS and a strong mood.',
        en_count: '{names} picked {team} to top the group. After 2-0 from USA, the route still exists, but now it needs GPS and a strong mood.',
      },
    ],
  },
  'SCO-MAR': {
    caption: {
      he: 'מרוקו לקחה 1-0 מסקוטלנד, תוצאה קטנה על המסך אבל גדולה באמצע בית C 🔥',
      en: 'Morocco took 1-0 from Scotland, a small scoreline with real weight in Group C 🔥',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'MAR',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-0 על סקוטלנד, זה לא זיקוקים - זה יותר מסוכן: שלוש נקודות בשקט.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 על סקוטלנד, אלה לא זיקוקים - זה יותר מסוכן: שלוש נקודות בשקט.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 על סקוטלנד, אלה לא זיקוקים - זה יותר מסוכן: שלוש נקודות בשקט.',
        en_name: '{names} picked {team} to top the group. After 1-0 over Scotland, it is not fireworks - it is more dangerous: quiet three points.',
        en_names: '{names} picked {team} to top the group. After 1-0 over Scotland, those are not fireworks - they are more dangerous: quiet three points.',
        en_count: '{names} picked {team} to top the group. After 1-0 over Scotland, those are not fireworks - they are more dangerous: quiet three points.',
      },
      {
        table: 'group_position_picks',
        team_code: 'SCO',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-0 ממרוקו, זה עדיין אפשרי, אבל הטופס כבר הפסיק לדבר בביטחון מלא.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 ממרוקו, זה עדיין אפשרי, אבל הטפסים כבר הפסיקו לדבר בביטחון מלא.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 ממרוקו, זה עדיין אפשרי, אבל הטפסים כבר הפסיקו לדבר בביטחון מלא.',
        en_name: '{names} picked {team} to top the group. After 1-0 from Morocco, it is still possible, but the form has stopped speaking with full confidence.',
        en_names: '{names} picked {team} to top the group. After 1-0 from Morocco, it is still possible, but the forms have stopped speaking with full confidence.',
        en_count: '{names} picked {team} to top the group. After 1-0 from Morocco, it is still possible, but the forms have stopped speaking with full confidence.',
      },
    ],
  },
  'BRA-HAI': {
    caption: {
      he: 'ברזיל עשתה 3-0 על האיטי בלי להרים יותר מדי את הקול. לפעמים הכי מפחיד זה כשזה נראה כמו יום עבודה רגיל.',
      en: 'Brazil made it 3-0 over Haiti without raising the volume too much. Sometimes the scary part is when it looks like a normal day at work.',
    },
    pool_focuses: [
      {
        table: 'tournament_winner_picks',
        team_code: 'BRA',
        he_name: '{names} בחר את {team} כמנצחת המונדיאל. אחרי 3-0 על האיטי, הוא לא צריך לצעוק "אמרתי לכם" - הטבלה עושה את זה בשבילו.',
        he_names: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 3-0 על האיטי, הם לא צריכים לצעוק "אמרנו לכם" - הטבלה עושה את זה בשבילם.',
        he_count: '{names} בחרו את {team} כמנצחת המונדיאל. אחרי 3-0 על האיטי, הם לא צריכים לצעוק "אמרנו לכם" - הטבלה עושה את זה בשבילם.',
        en_name: '{names} picked {team} to win the World Cup. After 3-0 over Haiti, he does not need to shout "told you" - the table is doing it for him.',
        en_names: '{names} picked {team} to win the World Cup. After 3-0 over Haiti, they do not need to shout "told you" - the table is doing it for them.',
        en_count: '{names} picked {team} to win the World Cup. After 3-0 over Haiti, they do not need to shout "told you" - the table is doing it for them.',
      },
      {
        table: 'group_position_picks',
        team_code: 'HAI',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 3-0 מברזיל, הטופס עדיין על השולחן, אבל הוא יושב שם עם מגבת על הראש.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 3-0 מברזיל, הטפסים עדיין על השולחן, אבל הם יושבים שם עם מגבת על הראש.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 3-0 מברזיל, הטפסים עדיין על השולחן, אבל הם יושבים שם עם מגבת על הראש.',
        en_name: '{names} picked {team} to top the group. After 3-0 from Brazil, the form is still on the table, but it is sitting there with a towel over its head.',
        en_names: '{names} picked {team} to top the group. After 3-0 from Brazil, the forms are still on the table, but they are sitting there with towels over their heads.',
        en_count: '{names} picked {team} to top the group. After 3-0 from Brazil, the forms are still on the table, but they are sitting there with towels over their heads.',
      },
    ],
  },
  'TUR-PAR': {
    caption: {
      he: 'פרגוואי לקחה 1-0 קשוח מטורקיה, בדיוק מהסוג שמרגיש קטן בלוח התוצאות וגדול מאוד בבית D.',
      en: 'Paraguay took a stubborn 1-0 from Turkey, exactly the kind of result that looks small on the scoreboard and huge in Group D.',
    },
    pool_focuses: [
      {
        table: 'group_position_picks',
        team_code: 'PAR',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-0 על טורקיה, זה כבר לא הימור שקט - זה טופס שמרים גבה לכל הבית.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 על טורקיה, אלה כבר לא הימורים שקטים - אלה טפסים שמרימים גבה לכל הבית.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 על טורקיה, אלה כבר לא הימורים שקטים - אלה טפסים שמרימים גבה לכל הבית.',
        en_name: '{names} picked {team} to top the group. After 1-0 over Turkey, that is no longer a quiet form - it is raising an eyebrow at the whole group.',
        en_names: '{names} picked {team} to top the group. After 1-0 over Turkey, those are no longer quiet forms - they are raising an eyebrow at the whole group.',
        en_count: '{names} picked {team} to top the group. After 1-0 over Turkey, those are no longer quiet forms - they are raising an eyebrow at the whole group.',
      },
      {
        table: 'group_position_picks',
        team_code: 'TUR',
        position: 1,
        he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-0 מפרגוואי, הדרך עדיין שם, אבל היא כבר הגיעה עם תיק גב כבד.',
        he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 מפרגוואי, הדרך עדיין שם, אבל היא כבר הגיעה עם תיק גב כבד.',
        he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-0 מפרגוואי, הדרך עדיין שם, אבל היא כבר הגיעה עם תיק גב כבד.',
        en_name: '{names} picked {team} to top the group. After 1-0 from Paraguay, the route is still there, but it is carrying a heavier bag now.',
        en_names: '{names} picked {team} to top the group. After 1-0 from Paraguay, the route is still there, but it is carrying a heavier bag now.',
        en_count: '{names} picked {team} to top the group. After 1-0 from Paraguay, the route is still there, but it is carrying a heavier bag now.',
      },
    ],
  },
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJsonIfChanged(file, data) {
  const next = JSON.stringify(data, null, 2) + '\n';
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current === next) return false;
  fs.writeFileSync(file, next, 'utf8');
  return true;
}

function normalizeAssetPath(image) {
  return String(image || '').replace(/\\/g, '/');
}

async function fetchMatchesFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY || typeof fetch !== 'function') return null;

  const endpoint = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/matches?select=*&order=match_date.asc,id.asc`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase matches fetch failed (${res.status}): ${body.slice(0, 240)}`);
  }

  const matches = await res.json();
  if (!Array.isArray(matches) || matches.length === 0) return null;
  return {
    updatedAt: new Date().toISOString(),
    count: matches.length,
    matches,
    source: 'supabase',
  };
}

async function loadMatchesPayload() {
  if (MATCH_SOURCE === 'snapshot') {
    return { ...readJson(MATCHES_PATH, { matches: [] }), source: 'snapshot' };
  }

  try {
    const live = await fetchMatchesFromSupabase();
    if (live) return live;
  } catch (err) {
    if (MATCH_SOURCE === 'db') throw err;
    console.warn(`Supabase match source unavailable; falling back to snapshot: ${err.message}`);
  }

  return { ...readJson(MATCHES_PATH, { matches: [] }), source: 'snapshot' };
}

function teamName(code, lang = 'en') {
  return (TEAM_NAMES[code] && TEAM_NAMES[code][lang]) || code;
}

function matchKey(match) {
  return `${match.home_team_code}-${match.away_team_code}`;
}

function storyOverride(match) {
  return STORY_COPY_OVERRIDES[matchKey(match)] || null;
}

function storyId(match) {
  const date = String(match.match_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `${match.home_team_code}-${match.away_team_code}-${date}`.toLowerCase();
}

function outcomeFor(match) {
  if (match.winner_code) return match.winner_code;
  return Number(match.home_score) === Number(match.away_score) ? 'DRAW' : null;
}

function scoreDash(match) {
  return `${Number(match.home_score)}-${Number(match.away_score)}`;
}

function scoreForOutcome(match, outcome) {
  if (outcome === 'DRAW') return scoreDash(match);
  const winnerScore = outcome === match.home_team_code ? Number(match.home_score) : Number(match.away_score);
  const loserScore = outcome === match.home_team_code ? Number(match.away_score) : Number(match.home_score);
  return `${winnerScore}-${loserScore}`;
}

function resultText(match) {
  const outcome = outcomeFor(match);
  if (outcome && outcome !== 'DRAW') {
    const loser = outcome === match.home_team_code ? match.away_team_code : match.home_team_code;
    return `${outcome} ${scoreForOutcome(match, outcome)} ${loser}`;
  }
  return `${match.home_team_code} ${scoreDash(match)} ${match.away_team_code}`;
}

function assetSlug(match, outcome) {
  const home = teamName(match.home_team_code).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const away = teamName(match.away_team_code).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (outcome === 'DRAW') return `${home}-${away}-draw.png`;
  const winner = outcome === match.home_team_code ? home : away;
  const loser = outcome === match.home_team_code ? away : home;
  return `${winner}-wins-${loser}.png`;
}

function outcomeBaseSlug(match, outcome) {
  const key = matchKey(match).toLowerCase();
  const outcomeKey = outcome === 'DRAW' ? 'draw' : `${String(outcome).toLowerCase()}-wins`;
  return `${key}-${outcomeKey}-base.png`;
}

function outcomeBaseAsset(match, outcome) {
  const relative = path.join('story-assets', 'outcome-bases', outcomeBaseSlug(match, outcome)).replace(/\\/g, '/');
  return fs.existsSync(path.join(ROOT, relative)) ? relative : '';
}

function manifestAsset(manifest, match, outcome) {
  const item = (manifest.items || []).find(entry => entry.match_id === match.id);
  const image = normalizeAssetPath(item && item.outcomes && item.outcomes[outcome]);
  if (!image) return '';
  return fs.existsSync(path.join(ROOT, image)) ? image : '';
}

function knownOrGeneratedAsset(manifest, match, outcome) {
  const known = manifestAsset(manifest, match, outcome);
  if (known) return known;
  const generated = normalizeAssetPath(path.join('story-assets', assetSlug(match, outcome)));
  return fs.existsSync(path.join(ROOT, generated)) ? generated : '';
}

function runPython(args) {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  let last = null;
  for (const exe of candidates) {
    const res = spawnSync(exe, args, { cwd: ROOT, stdio: 'inherit' });
    if (res.error && res.error.code === 'ENOENT') {
      last = res.error;
      continue;
    }
    if (res.status !== 0) throw new Error(`${exe} ${args.join(' ')} failed with status ${res.status}`);
    return;
  }
  throw last || new Error('Python not found');
}

function scoreLine(match) {
  return `${match.home_team_code} ${Number(match.home_score)}-${Number(match.away_score)} ${match.away_team_code}`;
}

function finalizeOutcomeBase(match, outcome, baseImage) {
  const output = path.join(ROOT, 'story-assets', assetSlug(match, outcome));
  if (fs.existsSync(output)) return path.relative(ROOT, output).replace(/\\/g, '/');
  runPython([
    'scripts/process-story-image.py',
    'result-card',
    baseImage,
    output,
    topLabel(match, outcome),
    scoreLine(match),
  ]);
  return path.relative(ROOT, output).replace(/\\/g, '/');
}

function ensureStoryAsset(manifest, match, outcome) {
  const known = knownOrGeneratedAsset(manifest, match, outcome);
  if (known) return known;
  const base = outcomeBaseAsset(match, outcome);
  if (base) return finalizeOutcomeBase(match, outcome, path.join(ROOT, base));
  return '';
}

function focusTeam(match, outcome) {
  if (outcome === 'DRAW') {
    return DRAW_FOCUS[matchKey(match)] || DRAW_FOCUS[`${match.away_team_code}-${match.home_team_code}`] || match.home_team_code;
  }
  return outcome === match.home_team_code ? match.away_team_code : match.home_team_code;
}

function titleCopy(match, outcome) {
  const score = scoreForOutcome(match, outcome);
  const homeHe = teamName(match.home_team_code, 'he');
  const awayHe = teamName(match.away_team_code, 'he');
  const homeEn = teamName(match.home_team_code, 'en');
  const awayEn = teamName(match.away_team_code, 'en');
  const group = match && match.group_letter ? match.group_letter : 'WC';
  if (outcome === 'DRAW') {
    return storyCopyChoice(match, 'title-draw', [
      {
        he: `${homeHe} ו${awayHe} נפרדו ב-${score}: בית ${group} נשאר פתוח`,
        en: `${homeEn} and ${awayEn} draw ${score}: Group ${group} stays open`,
      },
      {
        he: `${homeHe} ו${awayHe} נפרדו ב-${score}: הטבלה עוד לא נרגעה`,
        en: `${homeEn} and ${awayEn} draw ${score}: the table is not settled`,
      },
      {
        he: `${homeHe} ו${awayHe} נפרדו ב-${score}: בית ${group} נשאר צמוד`,
        en: `${homeEn} and ${awayEn} draw ${score}: Group ${group} stays tight`,
      },
    ]);
  }
  const winner = outcome;
  const loser = winner === match.home_team_code ? match.away_team_code : match.home_team_code;
  const winnerHe = teamName(winner, 'he');
  const loserHe = teamName(loser, 'he');
  const winnerEn = teamName(winner, 'en');
  const loserEn = teamName(loser, 'en');
  return storyCopyChoice(match, 'title-win', [
    {
      he: `${winnerHe} ניצחה את ${loserHe} ${score}: בית ${group} זז`,
      en: `${winnerEn} beat ${loserEn} ${score}: Group ${group} moved`,
    },
    {
      he: `${winnerHe} ניצחה את ${loserHe} ${score}: הטבלה הרגישה את זה`,
      en: `${winnerEn} beat ${loserEn} ${score}: the table felt it`,
    },
    {
      he: `${winnerHe} ניצחה את ${loserHe} ${score}: בית ${group} משתנה`,
      en: `${winnerEn} beat ${loserEn} ${score}: Group ${group} shifts`,
    },
    {
      he: `${winnerHe} ניצחה את ${loserHe} ${score}: בית ${group} נפתח מחדש`,
      en: `${winnerEn} beat ${loserEn} ${score}: Group ${group} opens up`,
    },
  ]);
}

function topLabel(match, outcome) {
  if (outcome === 'DRAW') return 'DRAW!';
  return `${teamName(outcome, 'en').toUpperCase()} WINS!`;
}

function hydratePoolFocus(focus, fallbackTeamCode) {
  const teamCode = focus.team_code || fallbackTeamCode;
  return {
    table: focus.table || 'group_position_picks',
    team_code: teamCode,
    team_he: focus.team_he || teamName(teamCode, 'he'),
    team_en: focus.team_en || teamName(teamCode, 'en'),
    ...(focus.table === 'group_position_picks' || !focus.table ? { position: focus.position || 1 } : {}),
    ...focus,
  };
}

function opponentForTeam(match, teamCode) {
  return teamCode === match.home_team_code ? match.away_team_code : match.home_team_code;
}

function resultContext(match, outcome, teamCode, lang) {
  const score = scoreForOutcome(match, outcome);
  const opponent = teamName(opponentForTeam(match, teamCode), lang);
  if (outcome === 'DRAW') {
    return lang === 'he' ? `אחרי ${score} מול ${opponent}` : `After ${score} with ${opponent}`;
  }
  if (teamCode === outcome) {
    return lang === 'he' ? `אחרי ${score} על ${opponent}` : `After ${score} over ${opponent}`;
  }
  return lang === 'he' ? `אחרי ${score} מול ${opponent}` : `After ${score} against ${opponent}`;
}

function tournamentWinnerFocus(match, outcome, teamCode) {
  const heContext = resultContext(match, outcome, teamCode, 'he');
  const enContext = resultContext(match, outcome, teamCode, 'en');
  const category = outcome === 'DRAW' ? 'draw' : (teamCode === outcome ? 'winner' : 'loser');
  const variants = {
    winner: [
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, הטופס הזה כבר לא מתחבא בשוליים.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, הטפסים האלה כבר לא מתחבאים בשוליים.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, that form is no longer hiding in the margins.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, those forms are no longer hiding in the margins.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, הצ'אט של ההימור חייב לתת לזה מבט שני.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, הצ'אט של ההימור חייב לתת לזה מבט שני.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, the pool chat owes that pick a second look.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, the pool chat owes those picks a second look.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, החלום על הגביע קיבל הוכחה ראשונה.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, החלום על הגביע קיבל הוכחה ראשונה.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, the trophy dream just got its first real proof.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, the trophy dream just got its first real proof.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, הבדיחות על הבחירה הזאת צריכות להוריד ווליום.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, הבדיחות על הבחירות האלה צריכות להוריד ווליום.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, the jokes about that pick have to lower the volume.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, the jokes about those picks have to lower the volume.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, זה נראה פחות רומנטי ויותר מסוכן לשאר ההימור.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, זה נראה פחות רומנטי ויותר מסוכן לשאר ההימור.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, that looks less romantic and more dangerous for the pool.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, those look less romantic and more dangerous for the pool.`,
      },
    ],
    loser: [
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, הטופס הזה צריך נאום הגנה מוקדם.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, הטפסים האלה צריכים נאום הגנה מוקדם.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, that form needs an early defense speech.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, those forms need an early defense speech.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, הבחירה על הגביע קיבלה מכה פומבית.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, הבחירות על הגביע קיבלו מכה פומבית.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, that trophy pick just took a public hit.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, those trophy picks just took a public hit.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, החלום עדיין חי אבל כבר מזיע.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, החלום עדיין חי אבל כבר מזיע.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, the dream is alive but already sweating.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, the dream is alive but already sweating.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, כל צילום מסך של הבחירה הזאת נהיה מסוכן.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, כל צילום מסך של הבחירות האלה נהיה מסוכן.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, every screenshot of that pick just became dangerous.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, every screenshot of those picks just became dangerous.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, הצ'אט קיבל שאלה הוגנת מאוד.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, הצ'אט קיבל שאלה הוגנת מאוד.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, the chat has a very fair question now.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, the chat has a very fair question now.`,
      },
    ],
    draw: [
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, הטופס עוד חי אבל כבר פחות זחוח.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, הטפסים עוד חיים אבל כבר פחות זחוחים.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, that form is alive but less smug.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, those forms are alive but less smug.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, זה לא מוחק את החלום אבל כן מעקם אותו.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, זה לא מוחק את החלום אבל כן מעקם אותו.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, it does not erase the dream, but it bends it.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, it does not erase the dream, but it bends it.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, הצ'אט קיבל חומר חדש לדיון.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, הצ'אט קיבל חומר חדש לדיון.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, the chat just got fresh debate material.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, the chat just got fresh debate material.`,
      },
      {
        heName: `{names} בחר את {team} כמנצחת המונדיאל. ${heContext}, הביטחון בטופס ירד מדרגה אחת.`,
        heNames: `{names} בחרו את {team} כמנצחת המונדיאל. ${heContext}, הביטחון בטפסים ירד מדרגה אחת.`,
        enName: `{names} picked {team} to win the World Cup. ${enContext}, confidence in that form just dropped one level.`,
        enNames: `{names} picked {team} to win the World Cup. ${enContext}, confidence in those forms just dropped one level.`,
      },
    ],
  };
  const copy = storyCopyChoice(match, `focus-tournament-${category}-${teamCode}`, variants[category]);
  return {
    table: 'tournament_winner_picks',
    team_code: teamCode,
    team_he: teamName(teamCode, 'he'),
    team_en: teamName(teamCode, 'en'),
    he_name: copy.heName,
    he_names: copy.heNames,
    he_count: copy.heNames,
    en_name: copy.enName,
    en_names: copy.enNames,
    en_count: copy.enNames,
  };
}

function groupPositionFocus(match, outcome, teamCode) {
  const focus = {
    table: 'group_position_picks',
    team_code: teamCode,
    team_he: teamName(teamCode, 'he'),
    team_en: teamName(teamCode, 'en'),
    position: 1,
  };
  return {
    ...focus,
    ...fallbackEditorialFocus(match, outcome, focus),
  };
}

function uniquePoolFocuses(focuses) {
  const seen = new Set();
  return focuses.filter(focus => {
    const key = [focus.table || 'group_position_picks', focus.team_code || '', focus.position || '', focus.bracket_position || ''].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function poolFocuses(match, outcome) {
  const focus = focusTeam(match, outcome);
  const override = storyOverride(match);
  if (override && Array.isArray(override.pool_focuses) && override.pool_focuses.length) {
    return override.pool_focuses.map(item => hydratePoolFocus(item, focus));
  }
  if (override && override.pool) {
    return [{
      table: 'group_position_picks',
      team_code: focus,
      team_he: teamName(focus, 'he'),
      team_en: teamName(focus, 'en'),
      position: 1,
      ...override.pool,
    }];
  }
  if (outcome === 'DRAW') {
    const other = opponentForTeam(match, focus);
    return uniquePoolFocuses([
      tournamentWinnerFocus(match, outcome, focus),
      groupPositionFocus(match, outcome, focus),
      groupPositionFocus(match, outcome, other),
      tournamentWinnerFocus(match, outcome, other),
    ]);
  }
  const loser = outcome === match.home_team_code ? match.away_team_code : match.home_team_code;
  return uniquePoolFocuses([
    tournamentWinnerFocus(match, outcome, outcome),
    groupPositionFocus(match, outcome, outcome),
    groupPositionFocus(match, outcome, loser),
    tournamentWinnerFocus(match, outcome, loser),
  ]);
}

function poolFocus(match, outcome) {
  return poolFocuses(match, outcome)[0];
}

function storyCopyHash(value) {
  let h = 0;
  const s = String(value || '');
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function storyCopyChoice(match, salt, variants) {
  return variants[storyCopyHash(`${match.id || matchKey(match)}:${salt}`) % variants.length];
}

function storyEmoji(match, outcome) {
  if (outcome === 'DRAW') return '⚖️';
  const totalGoals = Number(match && match.home_score || 0) + Number(match && match.away_score || 0);
  if (totalGoals >= 4) return '🔥';
  return '⚽';
}

function withStoryEmoji(text, match, outcome) {
  const copy = String(text || '').trim();
  if (!copy) return copy;
  if (/[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?$/u.test(copy)) return copy;
  return `${copy.replace(/[.。]\s*$/, '')} ${storyEmoji(match, outcome)}`;
}

function withEndingStoryEmoji(text, match, outcome) {
  const copy = String(text || '').trim();
  if (!copy) return copy;
  if (/[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?$/u.test(copy)) return copy;
  const withoutTrailingEmoji = copy.replace(/\s*[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?\s*$/u, '');
  return `${withoutTrailingEmoji.replace(/[.。]\s*$/, '')} ${storyEmoji(match, outcome)}`;
}

function withPoolFocusStoryEmojis(focus, match, outcome) {
  if (!focus || typeof focus !== 'object') return focus;
  const next = { ...focus };
  [
    'he_name',
    'he_names',
    'he_count',
    'en_name',
    'en_names',
    'en_count',
  ].forEach(key => {
    if (next[key]) next[key] = withEndingStoryEmoji(next[key], match, outcome);
  });
  return next;
}

function applyStoryEmojiDiscipline(story, match) {
  if (!story || !match) return story;
  const outcome = outcomeFor(match);
  const focuses = Array.isArray(story.pool_focuses) && story.pool_focuses.length
    ? story.pool_focuses
    : (story.pool_focus ? [story.pool_focus] : []);
  const nextFocuses = focuses.map(focus => withPoolFocusStoryEmojis(focus, match, outcome));
  return {
    ...story,
    pool_focus: nextFocuses[0] || story.pool_focus,
    pool_focuses: nextFocuses,
    he: {
      ...story.he,
      headline: withStoryEmoji(story.he && story.he.headline, match, outcome),
      caption: withEndingStoryEmoji(story.he && story.he.caption, match, outcome),
    },
    en: {
      ...story.en,
      headline: withStoryEmoji(story.en && story.en.headline, match, outcome),
      caption: withEndingStoryEmoji(story.en && story.en.caption, match, outcome),
    },
  };
}

function fallbackEditorialCaption(match, outcome) {
  const score = scoreForOutcome(match, outcome);
  const group = match && match.group_letter ? match.group_letter : 'WC';
  const homeHe = teamName(match.home_team_code, 'he');
  const awayHe = teamName(match.away_team_code, 'he');
  const homeEn = teamName(match.home_team_code, 'en');
  const awayEn = teamName(match.away_team_code, 'en');
  if (outcome === 'DRAW') {
    return storyCopyChoice(match, 'caption-draw', [
      {
        he: `${homeHe} ו${awayHe} השאירו ${score} על הלוח, בדיוק מספיק כדי להשאיר את כל הבית בוויכוח.`,
        en: `${homeEn} and ${awayEn} left a ${score} on the board, just enough to keep the whole group arguing.`,
      },
      {
        he: `${score} בין ${homeHe} ל${awayHe} משאיר את בית ${group} פתוח וצמוד.`,
        en: `${score} between ${homeEn} and ${awayEn} keeps Group ${group} open and tight.`,
      },
      {
        he: `${homeHe} ו${awayHe} לא סגרו כלום עם ${score}. הטבלה קיבלה עוד סיבה להישאר ערה.`,
        en: `${homeEn} and ${awayEn} settled nothing with ${score}. The table got another reason to stay awake.`,
      },
    ]);
  }
  const loser = outcome === match.home_team_code ? match.away_team_code : match.home_team_code;
  const winnerHe = teamName(outcome, 'he');
  const loserHe = teamName(loser, 'he');
  const winnerEn = teamName(outcome, 'en');
  const loserEn = teamName(loser, 'en');
  return storyCopyChoice(match, 'caption-win', [
      {
        he: `${winnerHe} הפכה את ${score} לניצחון חשוב בבית ${group}. הטבלה נראית טוב יותר עבורה.`,
        en: `${winnerEn} turned ${score} into an important Group ${group} win. The table looks better for them now.`,
    },
    {
      he: `${winnerHe} ניצחה את ${loserHe} ${score}, וזה משנה את מצב בית ${group}.`,
      en: `${winnerEn}'s ${score} over ${loserEn} changes the Group ${group} picture.`,
    },
    {
      he: `${winnerHe} עם ${score}, ובית ${group} מקבל כיוון ברור יותר.`,
      en: `${winnerEn} won ${score}, and Group ${group} has a clearer direction now.`,
    },
    {
      he: `${score} ל${winnerHe} מול ${loserHe}, ובית ${group} נראה אחרת בטבלה.`,
      en: `${score} for ${winnerEn} against ${loserEn} changes the Group ${group} table.`,
    },
    {
      he: `${winnerHe} סגרה ${score}, ובית ${group} כבר נראה אחרת.`,
      en: `${winnerEn} won ${score}, and Group ${group} looks different now.`,
    },
  ]);
}

function fallbackEditorialFocus(match, outcome, focus) {
  const score = scoreForOutcome(match, outcome);
  const group = match && match.group_letter ? match.group_letter : 'WC';
  if (outcome === 'DRAW') {
    const copy = storyCopyChoice(match, `focus-draw-${focus.team_code || ''}`, [
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, זה עדיין חי - רק עם הרבה פחות ביטחון.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, זה עדיין חי - רק עם הרבה פחות ביטחון.`,
        enName: `{names} picked {team} to top the group. After ${score}, it is still alive, just with much less swagger.`,
        enNames: `{names} picked {team} to top the group. After ${score}, those forms are still alive, just with much less swagger.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. ${score} לא הורג את הטופס, אבל הוא בהחלט מזיז אותו לקצה הכיסא.`,
        heNames: `{names} שמו את {team} ראשונה בבית. ${score} לא הורג את הטפסים, אבל הוא בהחלט מזיז אותם לקצה הכיסא.`,
        enName: `{names} picked {team} to top the group. ${score} does not kill the form, but it moves it to the edge of the chair.`,
        enNames: `{names} picked {team} to top the group. ${score} does not kill those forms, but it moves them to the edge of the chair.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, בית ${group} עדיין פתוח והטופס הזה תקוע באמצע הוויכוח.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, בית ${group} עדיין פתוח והטפסים האלה תקועים באמצע הוויכוח.`,
        enName: `{names} picked {team} to top the group. After ${score}, Group ${group} is still open and that form is stuck in the argument.`,
        enNames: `{names} picked {team} to top the group. After ${score}, Group ${group} is still open and those forms are stuck in the argument.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, הבחירה הזאת לא נפלה - היא פשוט צריכה סבלנות.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, הבחירות האלה לא נפלו - הן פשוט צריכות סבלנות.`,
        enName: `{names} picked {team} to top the group. After ${score}, that pick is not dead - it just needs patience.`,
        enNames: `{names} picked {team} to top the group. After ${score}, those picks are not dead - they just need patience.`,
      },
    ]);
    return {
      he_name: copy.heName,
      he_names: copy.heNames,
      he_count: copy.heNames,
      en_name: copy.enName,
      en_names: copy.enNames,
      en_count: copy.enNames,
    };
  }
  const category = focus.team_code === outcome ? 'winner' : 'loser';
  const variants = {
    winner: [
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, זה כבר לא רק תקווה - זאת קבלה קטנה.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, אלה כבר לא רק תקוות - אלה קבלות קטנות.`,
        enName: `{names} picked {team} to top the group. After ${score}, that pick has receipts, not just hope.`,
        enNames: `{names} picked {team} to top the group. After ${score}, those picks have receipts, not just hope.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, הטבלה פתאום מקשיבה לטופס הזה.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, הטבלה פתאום מקשיבה לטפסים האלה.`,
        enName: `{names} picked {team} to top the group. After ${score}, the table is suddenly listening to that form.`,
        enNames: `{names} picked {team} to top the group. After ${score}, the table is suddenly listening to those forms.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. ${score} שם את הטופס שלו מתחת לפרוז'קטור.`,
        heNames: `{names} שמו את {team} ראשונה בבית. ${score} שם את הטפסים שלהם מתחת לפרוז'קטור.`,
        enName: `{names} picked {team} to top the group. ${score} puts that form under the floodlights.`,
        enNames: `{names} picked {team} to top the group. ${score} puts those forms under the floodlights.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, בית ${group} נראה קצת יותר כמו הטופס שלו.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, בית ${group} נראה קצת יותר כמו הטפסים שלהם.`,
        enName: `{names} picked {team} to top the group. After ${score}, Group ${group} looks a little more like that form.`,
        enNames: `{names} picked {team} to top the group. After ${score}, Group ${group} looks a little more like those forms.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, הבחירה הזאת יצאה מהשורה הקטנה והפכה לכותרת בהימור.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, הבחירות האלה יצאו מהשורה הקטנה והפכו לכותרת בהימור.`,
        enName: `{names} picked {team} to top the group. After ${score}, that pick moved from a small line to the pool headline.`,
        enNames: `{names} picked {team} to top the group. After ${score}, those picks moved from small lines to the pool headline.`,
      },
    ],
    loser: [
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, הטופס הזה צריך תשובה טובה בצ'אט.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, הטפסים האלה צריכים תשובה טובה בצ'אט.`,
        enName: `{names} picked {team} to top the group. After ${score}, that form needs a good answer in the chat.`,
        enNames: `{names} picked {team} to top the group. After ${score}, those forms need a good answer in the chat.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, המקום הראשון הזה נראה הרבה פחות פשוט.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, המקום הראשון הזה נראה הרבה פחות פשוט.`,
        enName: `{names} picked {team} to top the group. After ${score}, that first-place call looks much less simple.`,
        enNames: `{names} picked {team} to top the group. After ${score}, those first-place calls look much less simple.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. ${score} הפך את הבחירה הזאת לדיון רציני בהימור.`,
        heNames: `{names} שמו את {team} ראשונה בבית. ${score} הפך את הבחירות האלה לדיון רציני בהימור.`,
        enName: `{names} picked {team} to top the group. ${score} turned that pick into a serious pool debate.`,
        enNames: `{names} picked {team} to top the group. ${score} turned those picks into a serious pool debate.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, בית ${group} כבר לא משתף פעולה עם הטופס הזה.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, בית ${group} כבר לא משתף פעולה עם הטפסים האלה.`,
        enName: `{names} picked {team} to top the group. After ${score}, Group ${group} is no longer cooperating with that form.`,
        enNames: `{names} picked {team} to top the group. After ${score}, Group ${group} is no longer cooperating with those forms.`,
      },
      {
        heName: `{names} שם את {team} ראשונה בבית. אחרי ${score}, זו כבר לא בחירה שקטה - זו שיחה שצריך לשרוד.`,
        heNames: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, אלה כבר לא בחירות שקטות - אלה שיחות שצריך לשרוד.`,
        enName: `{names} picked {team} to top the group. After ${score}, that is no longer a quiet pick - it is a conversation to survive.`,
        enNames: `{names} picked {team} to top the group. After ${score}, those are no longer quiet picks - they are conversations to survive.`,
      },
    ],
  };
  const copy = storyCopyChoice(match, `focus-win-${category}-${focus.team_code || ''}`, variants[category]);
  return {
    he_name: copy.heName,
    he_names: copy.heNames,
    he_count: copy.heNames,
    en_name: copy.enName,
    en_names: copy.enNames,
    en_count: copy.enNames,
  };
}

function applyFallbackEditorialVariety(story, match, outcome) {
  if (storyOverride(match)) return story;
  const caption = fallbackEditorialCaption(match, outcome);
  const focuses = (story.pool_focuses || []).map(focus => {
    if (focus && focus.table === 'group_position_picks' && !focus.en_name && !focus.he_name) {
      return { ...focus, ...fallbackEditorialFocus(match, outcome, focus) };
    }
    return focus;
  });
  return {
    ...story,
    pool_focus: focuses[0] || story.pool_focus,
    pool_focuses: focuses,
    he: { ...story.he, caption: withEndingStoryEmoji(caption.he, match, outcome) },
    en: { ...story.en, caption: withEndingStoryEmoji(caption.en, match, outcome) },
  };
}

const STORY_SHAPE_TEAM_NAMES = Object.values(TEAM_NAMES || {})
  .flatMap(item => [item.en, item.he])
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

function storyShape(text, options = {}) {
  let value = String(text || '');
  if (options.normalizeTeams) {
    for (const name of STORY_SHAPE_TEAM_NAMES) value = value.split(name).join('{team}');
  }
  return value
    .replace(/\{names\}/g, '{names}')
    .replace(/\{team\}/g, '{team}')
    .replace(/\d+\s*-\s*\d+/g, '#-#')
    .replace(/\b[A-Z]{3}\b/g, 'TEAM')
    .replace(/[^\p{Letter}\p{Number}\s{}#-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function focusTextForShape(focus, lang) {
  const prefix = lang === 'he' ? 'he_' : 'en_';
  return [
    focus && focus[`${prefix}name`],
    focus && focus[`${prefix}names`],
    focus && focus[`${prefix}count`],
  ].filter(Boolean).join(' ');
}

const RECENT_STORY_COPY_WINDOW = 10;
const RECENT_COPY_VARIETY_ATTEMPTS = 8;
const RECENT_COPY_VARIETY_CLAUSES = {
  caption: {
    he: [
      'ההימור קיבל ויכוח אחר לגמרי.',
      'הטופס הבא כבר נקרא אחרת.',
      'זה משנה את השיחה על הבית.',
      'בחירות המקום הראשון מרגישות את זה מיד.',
      'הצ\'אט קיבל חומר חדש.',
      'הטבלה דחפה את הטפסים לצד אחר.',
      'הבחירות הישנות נראות פחות בטוחות עכשיו.',
      'זה לא אותו סיפור כמו המשחק הקודם.',
    ],
    en: [
      'The pool got a completely different argument.',
      'The next form reads differently now.',
      'That changes the group conversation.',
      'First-place picks feel it immediately.',
      'The chat just got new material.',
      'The table pushed the forms somewhere else.',
      'Old picks look less comfortable now.',
      'This is not the same story as the previous match.',
    ],
  },
  focus: {
    he: [
      'עכשיו זה רגע אישי בהימור.',
      'הצ\'אט יצטרך לבחור צד.',
      'הטופס הזה כבר לא רק רקע.',
      'זה בדיוק מסוג הבחירות שמצלמים למסך.',
      'הטבלה הכריחה את כולם לקרוא שוב.',
      'הבדיחה בצ\'אט השתנתה כיוון.',
      'זה חומר אמיתי לדיון אחרי המשחק.',
      'הבחירה הזאת קיבלה חיים משלה.',
    ],
    en: [
      'Now it is a personal pool moment.',
      'The chat has to pick a side.',
      'That form is no longer background noise.',
      'This is exactly the kind of pick people screenshot.',
      'The table forced everyone to read it again.',
      'The pool joke changed direction.',
      'That is real post-match debate material.',
      'That pick just got a life of its own.',
    ],
  },
};

function latestVarietyClause(story, kind, lang, attempt) {
  const clauses = RECENT_COPY_VARIETY_CLAUSES[kind] && RECENT_COPY_VARIETY_CLAUSES[kind][lang];
  if (!clauses || !clauses.length) return '';
  const index = storyCopyHash(`${story && story.id || ''}:${kind}:${lang}:${attempt}`) % clauses.length;
  return clauses[index];
}

function appendLatestShapeClause(story, match, kind, lang, focusIndex = 0, attempt = 0) {
  const group = match && match.group_letter ? match.group_letter : 'WC';
  const clause = latestVarietyClause(story, kind, lang, attempt);
  const safeClause = clause ? ` ${clause}` : (lang === 'he' ? ` בית ${group} מרגיש את זה.` : ` Group ${group} felt that one.`);
  if (kind === 'caption') {
    const base = String(story[lang] && story[lang].caption || '').replace(/\s+$/, '').replace(/\s*[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?\s*$/u, '');
    return {
      ...story,
      [lang]: {
        ...story[lang],
        caption: withEndingStoryEmoji(`${base}${safeClause}`, match, outcomeFor(match)),
      },
    };
  }
  const focuses = (story.pool_focuses || []).map((focus, idx) => {
    if (idx !== focusIndex) return focus;
    const prefix = lang === 'he' ? 'he_' : 'en_';
    return {
      ...focus,
      [`${prefix}name`]: `${String(focus[`${prefix}name`] || '').replace(/\s+$/, '')}${safeClause}`,
      [`${prefix}names`]: `${String(focus[`${prefix}names`] || '').replace(/\s+$/, '')}${safeClause}`,
      [`${prefix}count`]: `${String(focus[`${prefix}count`] || '').replace(/\s+$/, '')}${safeClause}`,
    };
  });
  return { ...story, pool_focus: focuses[0] || story.pool_focus, pool_focuses: focuses };
}

function applyLatestStoryShapeVariety(items, matchById) {
  const seenCaptions = { he: new Set(), en: new Set() };
  const seenFocuses = { he: new Set(), en: new Set() };
  return items.map((story, idx) => {
    if (idx >= RECENT_STORY_COPY_WINDOW) return story;
    let next = story;
    const match = matchById.get(story && story.match_id);
    for (const lang of ['he', 'en']) {
      let captionShape = storyShape(next[lang] && next[lang].caption, { normalizeTeams: true });
      for (let attempt = 0; captionShape && seenCaptions[lang].has(captionShape) && attempt < RECENT_COPY_VARIETY_ATTEMPTS; attempt += 1) {
        next = appendLatestShapeClause(next, match, 'caption', lang, 0, attempt);
        captionShape = storyShape(next[lang] && next[lang].caption, { normalizeTeams: true });
      }
      if (captionShape) seenCaptions[lang].add(captionShape);

      let focuses = Array.isArray(next.pool_focuses) && next.pool_focuses.length
        ? next.pool_focuses
        : (next.pool_focus ? [next.pool_focus] : []);
      for (let focusIndex = 0; focusIndex < focuses.length; focusIndex += 1) {
        let focusShape = storyShape(focusTextForShape(focuses[focusIndex], lang), { normalizeTeams: true });
        for (let attempt = 0; focusShape && seenFocuses[lang].has(focusShape) && attempt < RECENT_COPY_VARIETY_ATTEMPTS; attempt += 1) {
          next = appendLatestShapeClause(next, match, 'focus', lang, focusIndex, attempt);
          focuses = Array.isArray(next.pool_focuses) && next.pool_focuses.length
            ? next.pool_focuses
            : (next.pool_focus ? [next.pool_focus] : []);
          focusShape = storyShape(focusTextForShape(focuses[focusIndex], lang), { normalizeTeams: true });
        }
        if (focusShape) seenFocuses[lang].add(focusShape);
      }
    }
    return next;
  });
}

function captionCopy(match, outcome) {
  const override = storyOverride(match);
  if (override && override.caption) return override.caption;
  const focus = focusTeam(match, outcome);
  const score = scoreForOutcome(match, outcome);
  if (outcome === 'DRAW') {
    return {
      he: `${teamName(match.home_team_code, 'he')} ו${teamName(match.away_team_code, 'he')} משאירות את הבית פתוח אחרי ${score}. הדרמה בטבלה רק התחילה 👀`,
      en: `${teamName(match.home_team_code)} and ${teamName(match.away_team_code)} leave the group open after ${score}. The table drama is just getting started 👀`,
    };
  }
  const loser = focus;
  return {
    he: `${teamName(outcome, 'he')} לקחה ${score} מול ${teamName(loser, 'he')}, והבית צריך לחשב מחדש את הטפסים.`,
    en: `${teamName(outcome)} took ${score} against ${teamName(loser)}. The group has to reread the forms now.`,
  };
}

function buildStory(match, image, outcome) {
  const titles = titleCopy(match, outcome);
  const captions = captionCopy(match, outcome);
  const focuses = poolFocuses(match, outcome);
  const story = {
    id: storyId(match),
    match_id: match.id,
    image: normalizeAssetPath(image),
    teams: [match.home_team_code, match.away_team_code],
    outcome,
    result: resultText(match),
    top_label: topLabel(match, outcome),
    pool_focus: focuses[0],
    pool_focuses: focuses,
    he: { headline: withStoryEmoji(titles.he, match, outcome), caption: withStoryEmoji(captions.he, match, outcome) },
    en: { headline: withStoryEmoji(titles.en, match, outcome), caption: withStoryEmoji(captions.en, match, outcome) },
  };
  return applyStoryEmojiDiscipline(applyFallbackEditorialVariety(story, match, outcome), match);
}

function validateStory(story, match) {
  const outcome = outcomeFor(match);
  const expectedResult = resultText(match);
  const expectedTop = topLabel(match, outcome);
  const expectedScore = scoreForOutcome(match, outcome);
  const errors = [];
  if (story.result !== expectedResult) {
    errors.push(`result must be "${expectedResult}", got "${story.result}"`);
  }
  if (story.outcome !== outcome) {
    errors.push(`outcome must be "${outcome}", got "${story.outcome}"`);
  }
  if (story.top_label !== expectedTop) {
    errors.push(`top_label must be "${expectedTop}", got "${story.top_label}"`);
  }
  if (!story.he || !String(story.he.headline || '').includes(expectedScore)) {
    errors.push(`Hebrew headline must include winner-first score "${expectedScore}"`);
  }
  if (!story.en || !String(story.en.headline || '').includes(expectedScore)) {
    errors.push(`English headline must include winner-first score "${expectedScore}"`);
  }
  if (outcome !== 'DRAW') {
    const winnerHe = teamName(outcome, 'he');
    const loser = outcome === match.home_team_code ? match.away_team_code : match.home_team_code;
    const loserHe = teamName(loser, 'he');
    const heHeadline = String(story.he && story.he.headline || '');
    const enHeadline = String(story.en && story.en.headline || '');
    if (!heHeadline.includes('ניצחה את')) {
      errors.push('Hebrew win headline must use an explicit verb phrase');
    }
    if (heHeadline.includes(`${winnerHe}-${loserHe}`) || heHeadline.includes(`${loserHe}-${winnerHe}`)) {
      errors.push('Hebrew win headline must not use ambiguous hyphenated team order');
    }
    if (!enHeadline.toLowerCase().includes(' beat ')) {
      errors.push('English win headline must say who beat whom');
    }
  }
  if (errors.length) {
    throw new Error(`Invalid story ${story.id || story.match_id}: ${errors.join('; ')}`);
  }
}

function normalizeExistingStory(story, matchById) {
  const match = story && matchById.get(story.match_id);
  if (!match || match.status !== 'FINISHED' || match.home_score == null || match.away_score == null) {
    return story;
  }
  const outcome = outcomeFor(match);
  if (!outcome || !story.image) return story;
  return {
    ...buildStory(match, story.image, outcome),
    id: story.id || storyId(match),
  };
}

function approvedStarProfile(code) {
  const profile = STAR_PROFILES[code];
  if (!profile || !profile.player || !profile.number || profile.number === 'current') {
    throw new Error(`${code}: missing approved star profile / shirt number`);
  }
  return profile;
}

function imagePrompt(match, outcome) {
  const home = match.home_team_code;
  const away = match.away_team_code;
  const winner = outcome === 'DRAW' ? null : outcome;
  const loser = winner ? (winner === home ? away : home) : null;
  const left = approvedStarProfile(winner || home);
  const right = approvedStarProfile(loser || away);
  const topText = outcome === 'DRAW' ? 'DRAW!' : `${teamName(winner).toUpperCase()} WINS!`;
  const leftMood = outcome === 'DRAW' ? 'disappointed but proud after a draw' : 'celebrating the win in a fresh dynamic pose';
  const rightMood = outcome === 'DRAW' ? 'frustrated but composed after a draw' : 'sad after the loss, head down or hands on face';
  return [
    'Create a vertical 9:16 premium sports meme-card cartoon image for FriendlyBet.',
    `Match result context: ${teamName(home)} ${scoreDash(match)} ${teamName(away)} at FIFA World Cup 2026.`,
    'Style: high-end illustrated sports caricature poster, expressive cartoon realism, not photorealistic, not a real photo, not a deepfake. Make the main stars recognizable as stylized cartoon likenesses, not exact photographic likenesses.',
    'Show exactly two football stars, no other players anywhere.',
    `Left/foreground: ${left.player}, ${teamName(winner || home)} national-color kit, shirt number #${left.number} printed naturally into the jersey fabric, ${leftMood}, face clearly visible.`,
    `Right/midground: ${right.player}, ${teamName(loser || away)} national-color kit, shirt number #${right.number} printed naturally into the jersey fabric, ${rightMood}, face clearly visible.`,
    `Crowd: fans and flags of ${teamName(home)} and ${teamName(away)} only; no unrelated flags.`,
    'Composition: vertical portrait, dramatic stadium lights, two-player premium sports poster. Players heads high in frame but clearly below the top title.',
    'Leave the lower-middle band around 60%-77% visually clean enough for a black caption panel. Do not place faces in that band.',
    `Text: big baked white condensed uppercase top headline "${topText}". Add a small white score subtitle directly below it: "${teamName(home)} ${scoreDash(match)} ${teamName(away)}".`,
    'Avoid: yellow result headline, official FIFA logo, official club logos, sportswear logos, watermark, extra players, unrelated national flags, fake number patches, text over faces.',
  ].join('\n');
}

function outcomeBasePrompt(match, outcome) {
  const home = match.home_team_code;
  const away = match.away_team_code;
  const winner = outcome === 'DRAW' ? null : outcome;
  const loser = winner ? (winner === home ? away : home) : null;
  const left = approvedStarProfile(winner || home);
  const right = approvedStarProfile(loser || away);
  const outcomeText = outcome === 'DRAW' ? 'draw outcome' : `${teamName(winner)} win outcome`;
  const leftMood = outcome === 'DRAW' ? 'tense and defiant after a draw' : 'celebrating the win in a fresh dynamic pose';
  const rightMood = outcome === 'DRAW' ? 'tired but proud after a draw' : 'sad after the loss, head down or hands on face';
  return [
    'Create a vertical 9:16 premium sports meme-card base image for FriendlyBet.',
    `Match context: ${teamName(home)} vs ${teamName(away)} at FIFA World Cup 2026, ${outcomeText}.`,
    'This is a pre-generated outcome base. The exact score and result title will be added later by deterministic rendering after the match.',
    'Do not draw any title, score, letters, numbers-as-text overlays, words, logos, or watermarks anywhere except the real jersey shirt numbers described below.',
    'Leave the top 0%-17% clean and slightly darker for a future white result title and score subtitle.',
    'Style: high-end illustrated sports caricature poster, expressive cartoon realism, not photorealistic, not a real photo, not a deepfake. Make the main stars recognizable as stylized cartoon likenesses, not exact photographic likenesses.',
    'Show exactly two football stars, no other players anywhere.',
    `Left/foreground: ${left.player}, ${teamName(winner || home)} national-color kit, shirt number #${left.number} printed naturally into the jersey fabric, ${leftMood}, face clearly visible below the reserved top band.`,
    `Right/midground: ${right.player}, ${teamName(loser || away)} national-color kit, shirt number #${right.number} printed naturally into the jersey fabric, ${rightMood}, face clearly visible below the reserved top band.`,
    `Crowd: fans and flags of ${teamName(home)} and ${teamName(away)} only; no unrelated flags.`,
    'Composition: vertical portrait, dramatic stadium lights, two-player premium sports poster. Players heads high in frame but clearly below the reserved top result-text band.',
    'Leave the lower-middle band around 60%-77% visually clean enough for a black caption panel. Do not place faces in that band.',
    'Leave the lower edge visually calm for the deterministic FriendlyBet watermark added later.',
    'Avoid: score text, result title, yellow result headline, official FIFA logo, official club logos, sportswear logos, watermark, extra players, unrelated national flags, fake number patches, text over faces.',
  ].join('\n');
}

async function requestImageBuffer(prompt, label = 'story image') {
  if (!process.env.OPENAI_API_KEY) {
    console.warn(`No OPENAI_API_KEY; skipping image generation for ${label}`);
    return null;
  }
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const size = process.env.OPENAI_IMAGE_SIZE || '1024x1536';
  const body = { model, prompt, size };
  console.log(`Generating ${label} with ${model} (${size})`);
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI image generation failed for ${label}: ${res.status} ${text}`);
  }
  const json = await res.json();
  const first = json.data && json.data[0];
  const b64 = first && (first.b64_json || first.image_base64);
  if (!b64) throw new Error(`OpenAI image generation returned no base64 image for ${label}`);
  return Buffer.from(b64, 'base64');
}

async function generateImage(match, outcome) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn(`No OPENAI_API_KEY; skipping image generation for ${matchKey(match)} ${outcome}`);
    return '';
  }
  const fileName = assetSlug(match, outcome);
  const relative = path.join('story-assets', fileName).replace(/\\/g, '/');
  const output = path.join(ROOT, relative);
  if (fs.existsSync(output)) return relative;
  const buffer = await requestImageBuffer(imagePrompt(match, outcome), `${matchKey(match)} ${outcome}`);
  if (!buffer) return '';
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, buffer);
  return relative;
}

async function main() {
  const matchesPayload = await loadMatchesPayload();
  console.log(`Story match source: ${matchesPayload.source || 'snapshot'} (${(matchesPayload.matches || []).length} matches)`);
  const matchById = new Map((matchesPayload.matches || []).map(match => [match.id, match]));
  const manifest = readJson(MANIFEST_PATH, { version: 1, items: [] });
  const storiesPayload = readJson(STORIES_PATH, { items: [] });
  const existing = (Array.isArray(storiesPayload.items) ? storiesPayload.items : [])
    .map(story => normalizeExistingStory(story, matchById));
  const existingByMatch = new Set(existing.map(item => item && item.match_id).filter(Boolean));
  const existingMatchDates = new Map(
    (matchesPayload.matches || []).map(match => [match.id, new Date(match.match_date).getTime()])
  );
  const finished = (matchesPayload.matches || [])
    .filter(match => match && match.status === 'FINISHED' && match.home_score != null && match.away_score != null)
    .sort((a, b) => new Date(a.match_date) - new Date(b.match_date));

  const additions = [];
  for (const match of finished) {
    if (existingByMatch.has(match.id)) continue;
    const outcome = outcomeFor(match);
    if (!outcome) continue;
    let image = ensureStoryAsset(manifest, match, outcome);
    if (!image && process.env.STORY_AUTOGEN_IMAGES === '1') {
      image = await generateImage(match, outcome);
    }
    if (!image) {
      console.warn(`No story image available for ${matchKey(match)} ${outcome}; story not added`);
      continue;
    }
    additions.push(buildStory(match, image, outcome));
    existingByMatch.add(match.id);
  }

  let items = additions
    .concat(existing)
    .sort((a, b) => {
      const aTime = existingMatchDates.get(a && a.match_id) || 0;
      const bTime = existingMatchDates.get(b && b.match_id) || 0;
      return bTime - aTime;
    })
    .slice(0, MAX_STORIES);
  items = applyLatestStoryShapeVariety(items, matchById);
  items = items.map(story => applyStoryEmojiDiscipline(story, matchById.get(story && story.match_id)));
  items.forEach(story => {
    const match = matchById.get(story.match_id);
    if (match) validateStory(story, match);
  });
  const next = {
    updated_at: additions.length ? new Date().toISOString() : (storiesPayload.updated_at || new Date().toISOString()),
    items,
  };
  const changed = writeJsonIfChanged(STORIES_PATH, next);
  if (additions.length) {
    console.log(`Added ${additions.length} world cup stories. Feed now has ${items.length}/${MAX_STORIES}.`);
  } else if (changed) {
    console.log(`Normalized ${items.length} world cup stories.`);
  } else {
    console.log('No new world cup stories to add.');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  ROOT,
  MATCHES_PATH,
  STORIES_PATH,
  ASSET_DIR,
  OUTCOME_BASE_DIR,
  MANIFEST_PATH,
  TEAM_NAMES,
  STAR_PROFILES,
  readJson,
  writeJsonIfChanged,
  loadMatchesPayload,
  teamName,
  matchKey,
  storyId,
  outcomeFor,
  scoreForOutcome,
  scoreDash,
  resultText,
  assetSlug,
  outcomeBaseSlug,
  outcomeBaseAsset,
  knownOrGeneratedAsset,
  ensureStoryAsset,
  buildStory,
  validateStory,
  imagePrompt,
  outcomeBasePrompt,
  requestImageBuffer,
  main,
};
