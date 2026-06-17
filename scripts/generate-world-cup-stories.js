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

const ROOT = path.resolve(__dirname, '..');
const MATCHES_PATH = path.join(ROOT, 'public-data', 'matches.json');
const STORIES_PATH = path.join(ROOT, 'public-data', 'world-cup-stories.json');
const ASSET_DIR = path.join(ROOT, 'story-assets');
const MANIFEST_PATH = path.join(ASSET_DIR, 'manifest.json');
const MAX_STORIES = Number(process.env.WC_STORY_LIMIT || 24);
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
  AUS: { player: 'Mathew Ryan', number: 1, role: 'captain goalkeeper' },
  BEL: { player: 'Youri Tielemans', number: 8 },
  BIH: { player: 'Edin Dzeko', number: 11 },
  BRA: { player: 'Vinicius Jr', number: 7 },
  CAN: { player: 'Alphonso Davies', number: 19 },
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
  HAI: { player: 'Duckens Nazon', number: 9 },
  IRN: { player: 'Alireza Jahanbakhsh', number: 7 },
  IRQ: { player: 'Ali Jasim', number: 17 },
  JPN: { player: 'Wataru Endo', number: 6 },
  KOR: { player: 'Son Heung-min', number: 7 },
  MAR: { player: 'Achraf Hakimi', number: 2 },
  MEX: { player: 'Raul Jimenez', number: 9 },
  NED: { player: 'Virgil van Dijk', number: 4 },
  NOR: { player: 'Erling Haaland', number: 9 },
  NZL: { player: 'Chris Wood', number: 9 },
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

function manifestAsset(manifest, match, outcome) {
  const item = (manifest.items || []).find(entry => entry.match_id === match.id);
  const image = item && item.outcomes && item.outcomes[outcome];
  if (!image) return '';
  return fs.existsSync(path.join(ROOT, image)) ? image : '';
}

function knownOrGeneratedAsset(manifest, match, outcome) {
  const known = manifestAsset(manifest, match, outcome);
  if (known) return known;
  const generated = path.join('story-assets', assetSlug(match, outcome));
  return fs.existsSync(path.join(ROOT, generated)) ? generated : '';
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
  if (outcome === 'DRAW') {
    return {
      he: `${homeHe} ו${awayHe} נפרדו ב-${score}: דרמה בלי הכרעה`,
      en: `${homeEn} and ${awayEn} draw ${score}: No winner, all drama`,
    };
  }
  const winner = outcome;
  const loser = winner === match.home_team_code ? match.away_team_code : match.home_team_code;
  return {
    he: `${teamName(winner, 'he')} ניצחה את ${teamName(loser, 'he')} ${score}: הצהרה!`,
    en: `${teamName(winner, 'en')} beat ${teamName(loser, 'en')} ${score}: Statement made!`,
  };
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

function poolFocuses(match, outcome) {
  const focus = focusTeam(match, outcome);
  const teamHe = teamName(focus, 'he');
  const teamEn = teamName(focus, 'en');
  const score = scoreForOutcome(match, outcome);
  const override = storyOverride(match);
  if (override && Array.isArray(override.pool_focuses) && override.pool_focuses.length) {
    return override.pool_focuses.map(item => hydratePoolFocus(item, focus));
  }
  if (override && override.pool) {
    return [{
      table: 'group_position_picks',
      team_code: focus,
      team_he: teamHe,
      team_en: teamEn,
      position: 1,
      ...override.pool,
    }];
  }
  if (outcome === 'DRAW') {
    return [{
      table: 'group_position_picks',
      team_code: focus,
      team_he: teamHe,
      team_en: teamEn,
      position: 1,
      he_name: `{names} שם את {team} ראשונה בבית. אחרי ${score}, הבחירה הזאת פתאום נראית הרבה פחות רגועה 😬`,
      he_names: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, הבחירה הזאת פתאום נראית הרבה פחות רגועה 😬`,
      he_count: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, הבחירה הזאת פתאום נראית הרבה פחות רגועה 😬`,
      en_name: `{names} picked {team} to top the group. After ${score}, that choice suddenly looks much less calm 😬`,
      en_names: `{names} picked {team} to top the group. After ${score}, that choice suddenly looks much less calm 😬`,
      en_count: `{names} picked {team} to top the group. After ${score}, that choice suddenly looks much less calm 😬`,
    }];
  }
  return [{
    table: 'group_position_picks',
    team_code: focus,
    team_he: teamHe,
    team_en: teamEn,
    position: 1,
    he_name: `{names} שם את {team} ראשונה בבית. אחרי ${score}, הטופס שלו כבר צריך נאום הגנה 🎤😬`,
    he_names: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, הטפסים שלהם כבר צריכים נאום הגנה 🎤😬`,
    he_count: `{names} שמו את {team} ראשונה בבית. אחרי ${score}, הטפסים שלהם כבר צריכים נאום הגנה 🎤😬`,
    en_name: `{names} picked {team} to top the group. After ${score}, that form already needs a defense speech 🎤😬`,
    en_names: `{names} picked {team} to top the group. After ${score}, those forms already need a defense speech 🎤😬`,
    en_count: `{names} picked {team} to top the group. After ${score}, those forms already need a defense speech 🎤😬`,
  }];
}

function poolFocus(match, outcome) {
  return poolFocuses(match, outcome)[0];
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
    he: `${teamName(outcome, 'he')} עושה רעש עם ${score} מול ${teamName(loser, 'he')}. משחק אחד, והטבלה כבר נראית אחרת 🔥`,
    en: `${teamName(outcome)} makes noise with ${score} against ${teamName(loser)}. One match, and the table already looks different 🔥`,
  };
}

function buildStory(match, image, outcome) {
  const titles = titleCopy(match, outcome);
  const captions = captionCopy(match, outcome);
  const focuses = poolFocuses(match, outcome);
  return {
    id: storyId(match),
    match_id: match.id,
    image,
    teams: [match.home_team_code, match.away_team_code],
    outcome,
    result: resultText(match),
    top_label: topLabel(match, outcome),
    pool_focus: focuses[0],
    pool_focuses: focuses,
    he: { headline: titles.he, caption: captions.he },
    en: { headline: titles.en, caption: captions.en },
  };
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

function imagePrompt(match, outcome) {
  const home = match.home_team_code;
  const away = match.away_team_code;
  const winner = outcome === 'DRAW' ? null : outcome;
  const loser = winner ? (winner === home ? away : home) : null;
  const left = STAR_PROFILES[winner || home] || { player: `the biggest current star of ${teamName(winner || home)}`, number: 'current' };
  const right = STAR_PROFILES[loser || away] || { player: `the biggest current star of ${teamName(loser || away)}`, number: 'current' };
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
    let image = knownOrGeneratedAsset(manifest, match, outcome);
    if (!image && process.env.STORY_AUTOGEN_IMAGES !== '0') {
      image = await generateImage(match, outcome);
    }
    if (!image) {
      console.warn(`No story image available for ${matchKey(match)} ${outcome}; story not added`);
      continue;
    }
    additions.push(buildStory(match, image, outcome));
    existingByMatch.add(match.id);
  }

  const items = additions
    .concat(existing)
    .sort((a, b) => {
      const aTime = existingMatchDates.get(a && a.match_id) || 0;
      const bTime = existingMatchDates.get(b && b.match_id) || 0;
      return bTime - aTime;
    })
    .slice(0, MAX_STORIES);
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
  knownOrGeneratedAsset,
  buildStory,
  validateStory,
  imagePrompt,
  requestImageBuffer,
  main,
};
