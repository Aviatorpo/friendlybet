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
const MAX_STORIES = Number(process.env.WC_STORY_LIMIT || 5);

const TEAM_NAMES = {
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
  'ESP-CPV': {
    caption: {
      he: 'ספרד וכף ורדה סגרו 0-0, וזה היה מביך בשביל כל מי שסימן את ספרד על אוטומט. הטופס עדיין חי, אבל הרבה פחות זוהר 🫣',
      en: 'Spain and Cape Verde closed it at 0-0, and anyone who auto-picked Spain just had a very uncomfortable evening 🫣',
    },
    pool: {
      he_name: 'אוי הבושה. {names} שם את {team} ראשונה בבית, ואחרי 0-0 מול כף ורדה הוא כבר מחפש תירוצים 🫣',
      he_names: 'אוי הבושה. {names} שמו את {team} ראשונה בבית. אחרי 0-0 מול כף ורדה, הטופס שלהם נראה הרבה פחות בטוח 🫣',
      he_count: 'אוי הבושה. {names} שמו את {team} ראשונה בבית. אחרי 0-0 מול כף ורדה, הטופס שלהם נראה הרבה פחות בטוח 🫣',
      en_name: 'Oh, the shame. {names} picked {team} to top the group, and after 0-0 with Cape Verde he is already looking for excuses 🫣',
      en_names: 'Oh, the shame. {names} picked {team} to top the group. After 0-0 with Cape Verde, their form looks much less safe 🫣',
      en_count: 'Oh, the shame. {names} picked {team} to top the group. After 0-0 with Cape Verde, their form looks much less safe 🫣',
    },
  },
  'BEL-EGY': {
    caption: {
      he: 'בלגיה ומצרים נפרדו ב-1-1, וכל מי שבנה על בלגיה לטיול קל קיבל דרמה אישית מוקדם מהצפוי 😬',
      en: 'Belgium and Egypt finished 1-1, and everyone who expected an easy Belgium ride got personal drama early 😬',
    },
    pool: {
      he_name: '{names} שם את {team} ראשונה בבית. אחרי 1-1 מול מצרים, הביטחון ביקש חילוף 😬',
      he_names: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול מצרים, הביטחון הקבוצתי כבר ביקש חילוף 😬',
      he_count: '{names} שמו את {team} ראשונה בבית. אחרי 1-1 מול מצרים, הביטחון הקבוצתי כבר ביקש חילוף 😬',
      en_name: '{names} picked {team} first. After 1-1 with Egypt, that confidence officially requested a substitution 😬',
      en_names: '{names} picked {team} first. After 1-1 with Egypt, the group confidence officially requested a substitution 😬',
      en_count: '{names} picked {team} first. After 1-1 with Egypt, the group confidence officially requested a substitution 😬',
    },
  },
  'SAU-URU': {
    caption: {
      he: 'אורוגוואי נתקעה ב-1-1 מול ערב הסעודית. מי שהלך איתה בראש הבית כבר בשלב "חכו, זה עוד יסתדר" 😬',
      en: 'Uruguay got stuck at 1-1 with Saudi Arabia. Anyone who put them first is already in "wait, it will be fine" mode 😬',
    },
    pool: {
      he_name: 'אוי הבושה. {names} שם את {team} ראשונה בבית, ואחרי 1-1 מול ערב הסעודית הוא כבר מכין נאום הגנה 🎤😬',
      he_names: 'אוי הבושה. {names} שמו את {team} ראשונה בבית. אחרי 1-1 מול ערב הסעודית, הם כבר מכינים נאום הגנה 🎤😬',
      he_count: 'אוי הבושה. {names} שמו את {team} ראשונה בבית. אחרי 1-1 מול ערב הסעודית, הם כבר מכינים נאום הגנה 🎤😬',
      en_name: 'Oh, the shame. {names} picked {team} first, and after 1-1 with Saudi Arabia he is already preparing the defense speech 🎤😬',
      en_names: 'Oh, the shame. {names} picked {team} first. After 1-1 with Saudi Arabia, they are already preparing the defense speech 🎤😬',
      en_count: 'Oh, the shame. {names} picked {team} first. After 1-1 with Saudi Arabia, they are already preparing the defense speech 🎤😬',
    },
  },
  'IRN-NZL': {
    caption: {
      he: 'איראן וניו זילנד עשו 2-2, והבית הזה הפך לתיק פתוח. מי שהלך על איראן פתאום נראה הרבה פחות מוזר 🔥',
      en: 'Iran and New Zealand made it 2-2, and this group is suddenly wide open. Iran believers look a lot less strange now 🔥',
    },
    pool: {
      he_name: '{names} שם את {team} ראשונה בבית. גאון? אחרי 2-2 והבית הפתוח הזה, יש מצב 🔥',
      he_names: '{names} שמו את {team} ראשונה בבית. גאונים? אחרי 2-2 והבית הפתוח הזה, יש מצב 🔥',
      he_count: '{names} שמו את {team} ראשונה בבית. גאונים? אחרי 2-2 והבית הפתוח הזה, יש מצב 🔥',
      en_name: '{names} picked {team} to top the group. Genius? After this 2-2 and an open group, maybe 🔥',
      en_names: '{names} picked {team} to top the group. Geniuses? After this 2-2 and an open group, maybe 🔥',
      en_count: '{names} picked {team} to top the group. Geniuses? After this 2-2 and an open group, maybe 🔥',
    },
  },
  'GER-CUR': {
    caption: {
      he: 'גרמניה פתחה מבערים עם 7-1. מי שהימר על קוראסאו במקום הראשון כבר מחפש מחשבון וקצת אוויר.',
      en: 'Germany turned the volume all the way up. Anyone who had Curacao first now needs a calculator and a little air.',
    },
    pool: {
      he_name: '{names} הימר על {team} במקום הראשון. אחרי 7-1, זה כבר נראה כמו טופס שצריך טיפול נמרץ.',
      he_names: '{names} הימרו על {team} במקום הראשון. אחרי 7-1, זה כבר נראה כמו טופס שצריך טיפול נמרץ.',
      he_count: '{count} משתתפים הימרו על {team} במקום הראשון. אחרי 7-1, זה כבר נראה כמו טופס שצריך טיפול נמרץ.',
      en_name: '{names} had {team} first. After 7-1, that pick needs a medic and a calculator.',
      en_names: '{names} had {team} first. After 7-1, those picks need a medic and a calculator.',
      en_count: '{count} members had {team} first. After 7-1, those picks need a medic and a calculator.',
    },
  },
  'NED-JPN': {
    caption: {
      he: 'הולנד ויפן השאירו את הבית פתוח ואת הטבלאות על ספיד. מי שהימר על הולנד לטיול קל קיבל שיעורי בית.',
      en: 'Netherlands and Japan left the group wide open. Dutch first-place picks just got homework.',
    },
    pool: {
      he_name: '{names} הימר על {team} במקום הראשון. אחרי 2-2, הדרך לשם כבר נראית כמו שאלת בונוס.',
      he_names: '{names} הימרו על {team} במקום הראשון. אחרי 2-2, הדרך לשם כבר נראית כמו שאלת בונוס.',
      he_count: '{count} משתתפים הימרו על {team} במקום הראשון. אחרי 2-2, הדרך לשם כבר נראית כמו שאלת בונוס.',
      en_name: '{names} had {team} first. After 2-2, that route now looks like a bonus question.',
      en_names: '{names} had {team} first. After 2-2, that route now looks like a bonus question.',
      en_count: '{count} members had {team} first. After 2-2, that route now looks like a bonus question.',
    },
  },
  'CIV-ECU': {
    caption: {
      he: 'חוף השנהב לקחה 1-0 קטן עם אופי גדול. מי שהימר על אקוודור כבר חי מהתראה להתראה.',
      en: 'Ivory Coast took a small 1-0 with a big attitude. Ecuador picks are living notification to notification now.',
    },
    pool: {
      he_name: '{names} הימר על {team} במקום הראשון. 1-0 כזה קטן, והטופס כבר מזיע.',
      he_names: '{names} הימרו על {team} במקום הראשון. 1-0 כזה קטן, והטפסים כבר מזיעים.',
      he_count: '{count} משתתפים הימרו על {team} במקום הראשון. 1-0 כזה קטן, והטפסים כבר מזיעים.',
      en_name: '{names} had {team} first. A tiny 1-0, and that ticket is already sweating.',
      en_names: '{names} had {team} first. A tiny 1-0, and those tickets are already sweating.',
      en_count: '{count} members had {team} first. A tiny 1-0, and those tickets are already sweating.',
    },
  },
  'SWE-TUN': {
    caption: {
      he: 'שוודיה פירקה 5-1, וכל טופס עם תוניסיה למעלה ביקש רגע לבד 😬',
      en: 'Sweden smashed it 5-1, and every form with Tunisia on top asked for a moment alone 😬',
    },
    pool: {
      he_name: 'זה היה מביך... {names} שם את {team} ראשונה בבית. אחרי 5-1, אפשר לקרוע את הטופס או למסגר אותו כמזכרת 🧾',
      he_names: 'זה היה מביך... {names} שמו את {team} ראשונה בבית. אחרי 5-1, אפשר לקרוע את הטפסים או למסגר אותם כמזכרת 🧾',
      he_count: 'זה היה מביך... {names} שמו את {team} ראשונה בבית. אחרי 5-1, אפשר לקרוע את הטפסים או למסגר אותם כמזכרת 🧾',
      en_name: 'That was awkward... {names} picked {team} to top the group. After 5-1, the form can be torn up or framed as a souvenir 🧾',
      en_names: 'That was awkward... {names} picked {team} to top the group. After 5-1, the forms can be torn up or framed as souvenirs 🧾',
      en_count: 'That was awkward... {names} picked {team} to top the group. After 5-1, the forms can be torn up or framed as souvenirs 🧾',
    },
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

function poolFocus(match, outcome) {
  const focus = focusTeam(match, outcome);
  const teamHe = teamName(focus, 'he');
  const teamEn = teamName(focus, 'en');
  const score = scoreForOutcome(match, outcome);
  const override = storyOverride(match);
  if (override && override.pool) {
    return {
      table: 'group_position_picks',
      team_code: focus,
      team_he: teamHe,
      team_en: teamEn,
      position: 1,
      ...override.pool,
    };
  }
  if (outcome === 'DRAW') {
    return {
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
    };
  }
  return {
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
  };
}

function captionCopy(match, outcome) {
  const override = storyOverride(match);
  if (override && override.caption) return override.caption;
  const focus = focusTeam(match, outcome);
  const score = scoreForOutcome(match, outcome);
  if (outcome === 'DRAW') {
    return {
      he: `${teamName(match.home_team_code, 'he')} ו${teamName(match.away_team_code, 'he')} משאירות את הבית פתוח. מי שבנה על ${teamName(focus, 'he')} לטיול קל כבר מרגיש את הדופק עולה 👀🎢`,
      en: `${teamName(match.home_team_code)} and ${teamName(match.away_team_code)} leave the group wide open. Anyone banking on ${teamName(focus)} just felt the pulse jump 👀🎢`,
    };
  }
  const loser = focus;
  return {
    he: `${teamName(outcome, 'he')} עושה רעש עם ${score}. מי שבנה על ${teamName(loser, 'he')} קיבל תזכורת קטנה שהטבלה לא עושה הנחות 😅🔥`,
    en: `${teamName(outcome)} makes noise with ${score}. Anyone banking on ${teamName(loser)} just got a small reminder that the table has no mercy 😅🔥`,
  };
}

function buildStory(match, image, outcome) {
  const titles = titleCopy(match, outcome);
  const captions = captionCopy(match, outcome);
  return {
    id: storyId(match),
    match_id: match.id,
    image,
    teams: [match.home_team_code, match.away_team_code],
    outcome,
    result: resultText(match),
    top_label: topLabel(match, outcome),
    pool_focus: poolFocus(match, outcome),
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
    'Create a vertical 9:16 premium sports meme-card image for FriendlyBet.',
    `Match result context: ${teamName(home)} ${scoreDash(match)} ${teamName(away)} at FIFA World Cup 2026.`,
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

async function generateImage(match, outcome) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn(`No OPENAI_API_KEY; skipping image generation for ${matchKey(match)} ${outcome}`);
    return '';
  }
  const fileName = assetSlug(match, outcome);
  const relative = path.join('story-assets', fileName).replace(/\\/g, '/');
  const output = path.join(ROOT, relative);
  if (fs.existsSync(output)) return relative;
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const size = process.env.OPENAI_IMAGE_SIZE || '1024x1536';
  const body = {
    model,
    prompt: imagePrompt(match, outcome),
    size,
  };
  console.log(`Generating ${relative} with ${model} (${size})`);
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
    throw new Error(`OpenAI image generation failed for ${matchKey(match)} ${outcome}: ${res.status} ${text}`);
  }
  const json = await res.json();
  const first = json.data && json.data[0];
  const b64 = first && (first.b64_json || first.image_base64);
  if (!b64) throw new Error(`OpenAI image generation returned no base64 image for ${matchKey(match)} ${outcome}`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, Buffer.from(b64, 'base64'));
  return relative;
}

async function main() {
  const matchesPayload = readJson(MATCHES_PATH, { matches: [] });
  const matchById = new Map((matchesPayload.matches || []).map(match => [match.id, match]));
  const manifest = readJson(MANIFEST_PATH, { version: 1, items: [] });
  const storiesPayload = readJson(STORIES_PATH, { items: [] });
  const existing = (Array.isArray(storiesPayload.items) ? storiesPayload.items : [])
    .map(story => normalizeExistingStory(story, matchById));
  const existingByMatch = new Set(existing.map(item => item && item.match_id).filter(Boolean));
  const existingMatchDates = new Map(
    (matchesPayload.matches || []).map(match => [match.id, new Date(match.match_date).getTime()])
  );
  const newestExistingMatchTime = existing.reduce((latest, item) => {
    const time = existingMatchDates.get(item && item.match_id);
    return Number.isFinite(time) ? Math.max(latest, time) : latest;
  }, 0);
  const finished = (matchesPayload.matches || [])
    .filter(match => match && match.status === 'FINISHED' && match.home_score != null && match.away_score != null)
    .sort((a, b) => new Date(a.match_date) - new Date(b.match_date));

  const additions = [];
  for (const match of finished) {
    if (existingByMatch.has(match.id)) continue;
    const matchTime = new Date(match.match_date).getTime();
    if (newestExistingMatchTime && Number.isFinite(matchTime) && matchTime <= newestExistingMatchTime) {
      continue;
    }
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

  const items = additions.reverse().concat(existing).slice(0, MAX_STORIES);
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

main().catch(err => {
  console.error(err);
  process.exit(1);
});
