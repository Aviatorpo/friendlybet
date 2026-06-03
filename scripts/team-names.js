// ============================================================
// FriendlyBet - WC2026 team name map (code -> { en, he })
// ============================================================
// Single source of truth for the 48 World Cup 2026 teams, used by the
// deterministic pundit generator so its data-driven items can name teams
// in both languages without hitting the DB. Codes match the teams table PK
// and the WC2026_GROUPS constant in app.js.
// ============================================================

const TEAM_NAMES = {
  // Group A
  MEX: { en: 'Mexico', he: 'מקסיקו' },
  RSA: { en: 'South Africa', he: 'דרום אפריקה' },
  KOR: { en: 'South Korea', he: 'דרום קוריאה' },
  CZE: { en: 'Czechia', he: "צ'כיה" },
  // Group B
  CAN: { en: 'Canada', he: 'קנדה' },
  BIH: { en: 'Bosnia-Herzegovina', he: 'בוסניה-הרצגובינה' },
  QAT: { en: 'Qatar', he: 'קטאר' },
  SUI: { en: 'Switzerland', he: 'שווייץ' },
  // Group C
  BRA: { en: 'Brazil', he: 'ברזיל' },
  MAR: { en: 'Morocco', he: 'מרוקו' },
  HAI: { en: 'Haiti', he: 'האיטי' },
  SCO: { en: 'Scotland', he: 'סקוטלנד' },
  // Group D
  USA: { en: 'United States', he: 'ארה"ב' },
  PAR: { en: 'Paraguay', he: 'פרגוואי' },
  AUS: { en: 'Australia', he: 'אוסטרליה' },
  TUR: { en: 'Turkey', he: 'טורקיה' },
  // Group E
  GER: { en: 'Germany', he: 'גרמניה' },
  CUR: { en: 'Curaçao', he: 'קוראסאו' },
  CIV: { en: 'Ivory Coast', he: 'חוף השנהב' },
  ECU: { en: 'Ecuador', he: 'אקוודור' },
  // Group F
  NED: { en: 'Netherlands', he: 'הולנד' },
  JPN: { en: 'Japan', he: 'יפן' },
  SWE: { en: 'Sweden', he: 'שבדיה' },
  TUN: { en: 'Tunisia', he: 'תוניסיה' },
  // Group G
  BEL: { en: 'Belgium', he: 'בלגיה' },
  EGY: { en: 'Egypt', he: 'מצרים' },
  IRN: { en: 'Iran', he: 'איראן' },
  NZL: { en: 'New Zealand', he: 'ניו זילנד' },
  // Group H
  ESP: { en: 'Spain', he: 'ספרד' },
  CPV: { en: 'Cape Verde', he: 'כף ורדה' },
  SAU: { en: 'Saudi Arabia', he: 'ערב הסעודית' },
  URU: { en: 'Uruguay', he: 'אורוגוואי' },
  // Group I
  FRA: { en: 'France', he: 'צרפת' },
  SEN: { en: 'Senegal', he: 'סנגל' },
  IRQ: { en: 'Iraq', he: 'עיראק' },
  NOR: { en: 'Norway', he: 'נורווגיה' },
  // Group J
  ARG: { en: 'Argentina', he: 'ארגנטינה' },
  ALG: { en: 'Algeria', he: "אלג'יריה" },
  AUT: { en: 'Austria', he: 'אוסטריה' },
  JOR: { en: 'Jordan', he: 'ירדן' },
  // Group K
  POR: { en: 'Portugal', he: 'פורטוגל' },
  COD: { en: 'Congo DR', he: 'קונגו הדמוקרטית' },
  UZB: { en: 'Uzbekistan', he: 'אוזבקיסטן' },
  COL: { en: 'Colombia', he: 'קולומביה' },
  // Group L
  ENG: { en: 'England', he: 'אנגליה' },
  CRO: { en: 'Croatia', he: 'קרואטיה' },
  GHA: { en: 'Ghana', he: 'גאנה' },
  PAN: { en: 'Panama', he: 'פנמה' },
};

function teamName(code, lang) {
  const t = TEAM_NAMES[code];
  if (!t) return code || '';
  return (lang === 'he' ? t.he : t.en) || code;
}

module.exports = { TEAM_NAMES, teamName };
