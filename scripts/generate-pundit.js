// ============================================================
// FriendlyBet - "The Pundit" feed generator  (public-data/pundit.json)
// ============================================================
// Produces the rotating dashboard commentary feed. Two content sources, merged:
//
//   1. DATA-DRIVEN items  (this script, ZERO hallucination)
//      Computed straight from public-data/matches.json + the kickoff date:
//      countdown, upcoming fixtures, latest results. These are pure facts so
//      they can never be wrong. Always present, so the card is never empty.
//
//   2. NEWS items  (public-data/pundit-news.json, produced by the news agent)
//      The verified-news pipeline (marketing-scout/pundit/PUNDIT-AGENT.md) writes
//      that file ONLY with claims corroborated by >=2 independent sources (or 1
//      official). Each item carries a `confidence` (confirmed|reported) and a
//      `sources` list. We merge them in, dropping anything past `expires_at`.
//
// Output contract (public-data/pundit.json):
//   { updatedAt, count, items: [ { id, type, confidence, he, en, sources[], expires_at } ] }
//
// Run:  node scripts/generate-pundit.js
// No env, no network -> safe to run in CI on a cron.
// ============================================================
const fs = require('fs');
const path = require('path');
const { teamName } = require('./team-names');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public-data');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const NEWS_FILE = path.join(DATA_DIR, 'pundit-news.json');
const OUT_FILE = path.join(DATA_DIR, 'pundit.json');

// First WC2026 match (UTC). Used as the countdown anchor; overridden by the
// earliest match in the snapshot when available so we never drift from reality.
const DEFAULT_KICKOFF = '2026-06-11T19:00:00+00:00';
const MAX_ITEMS = 12;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const RESULT_WINDOW_MS = 36 * HOUR_MS;
const FIXTURE_WINDOW_MS = 30 * HOUR_MS;
const FIXTURE_PRE_KICKOFF_BUFFER_MS = 15 * 60 * 1000;
const NEWS_MAX_AGE_MS = 30 * HOUR_MS;
const NEWS_MAX_FUTURE_EXPIRY_MS = 30 * HOUR_MS;
const FEED_FRESH_MS = 6 * HOUR_MS;
const REFRESH_COMMIT_MS = 3 * HOUR_MS;
const LIVE_STATUSES = new Set(['IN_PLAY', 'LIVE', 'PAUSED']);
const SCHEDULED_STATUSES = new Set(['TIMED', 'SCHEDULED']);
const FINISHED_STATUSES = new Set(['FINISHED', 'AWARDED']);
const TERMINAL_STATUSES = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);
const STALE_SCHEDULED_MS = 35 * 60 * 1000;
const MAX_MATCH_MS = 3.5 * HOUR_MS;
const MONTHS = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};
const OFFICIAL_HOSTS = [
  'fifa.com',
  'inside.fifa.com',
  'theifab.com',
  'concacaf.com',
  'uefa.com',
  'cafonline.com',
  'conmebol.com',
  'the-afc.com',
  'oceaniafootball.com',
];

// Top FIFA-ranked sides -> used only to flag a fixture as a "big match".
const FAVORITES = new Set(['ARG', 'FRA', 'ESP', 'ENG', 'BRA', 'POR', 'NED', 'GER', 'BEL', 'URU', 'CRO', 'COL']);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function parseTime(value) {
  if (!value) return NaN;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function buildNow() {
  const forced = process.env.PUNDIT_NOW ? new Date(process.env.PUNDIT_NOW) : null;
  return forced && !Number.isNaN(forced.getTime()) ? forced : new Date();
}

function newsAnchorMs(item, feedUpdatedAt) {
  const candidates = [
    item && item.topic_date,
    item && item.source_checked_at,
    item && item.created_at,
    feedUpdatedAt,
  ];
  for (const candidate of candidates) {
    const ms = parseTime(candidate);
    if (Number.isFinite(ms)) return ms;
  }
  return NaN;
}

function isCurrentNews(item, feedUpdatedAt, now) {
  const nowMs = now.getTime();
  const anchor = newsAnchorMs(item, feedUpdatedAt);
  const expires = parseTime(item && item.expires_at);
  if (!Number.isFinite(anchor) || !Number.isFinite(expires)) return false;
  if (expires <= nowMs) return false;
  if (anchor - nowMs > HOUR_MS) return false;
  if (nowMs - anchor > NEWS_MAX_AGE_MS) return false;
  if (expires - nowMs > NEWS_MAX_FUTURE_EXPIRY_MS) return false;
  return true;
}

function sourceHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return null; }
}

function isOfficialHost(host) {
  return !!host && OFFICIAL_HOSTS.some(official => host === official || host.endsWith(`.${official}`));
}

function hasOfficialSource(sources) {
  return (sources || []).some(s => isOfficialHost(sourceHost(s && s.url)));
}

function independentSourceCount(sources) {
  return new Set((sources || []).map(s => sourceHost(s && s.url)).filter(Boolean)).size;
}

function isPastDatedPreview(item, now) {
  const text = String((item && item.en) || '').toLowerCase();
  if (!/\b(open|opener|opens|face|faces|against|kickoff|kick off|before|makes history|takes place|will)\b/.test(text)) return false;
  const match = text.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})\b/);
  if (!match) return false;
  const month = MONTHS[match[1]];
  const day = Number(match[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const previewDate = new Date(Date.UTC(now.getUTCFullYear(), month, day));
  return previewDate.getTime() < today.getTime();
}

function shouldTreatAsLive(match, now) {
  const status = String(match.status || '').toUpperCase();
  return LIVE_STATUSES.has(status) && !shouldTreatAsVerification(match, now);
}

function isPendingProviderFinal(match) {
  const source = String((match && match.live_source) || '').toLowerCase();
  const detail = String((match && match.status_detail) || '').toLowerCase();
  return source === 'espn-final' || detail.includes('pending verification');
}

function shouldTreatAsVerification(match, now) {
  const status = String((match && match.status) || '').toUpperCase();
  const start = parseTime(match.match_date);
  if (isPendingProviderFinal(match)) return true;
  if (!Number.isFinite(start)) return false;
  const elapsed = now.getTime() - start;
  if (LIVE_STATUSES.has(status) && elapsed >= MAX_MATCH_MS) return true;
  if (SCHEDULED_STATUSES.has(status) && elapsed >= STALE_SCHEDULED_MS && !TERMINAL_STATUSES.has(status)) return true;
  return false;
}

// Format a UTC ISO time into Israel-local {ymd, hm} (the audience is Israeli).
function ilParts(iso) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}

// Returns { he, en } describing when `iso` falls relative to `now`.
function whenLabel(iso, now) {
  const a = ilParts(iso), b = ilParts(now.toISOString());
  const diffDays = Math.round((Date.parse(a.ymd) - Date.parse(b.ymd)) / DAY_MS);
  if (diffDays === 0) return { he: `היום ${a.hm}`, en: `today ${a.hm}` };
  if (diffDays === 1) return { he: `מחר ${a.hm}`, en: `tomorrow ${a.hm}` };
  if (diffDays === -1) return { he: `אתמול`, en: `yesterday` };
  const [, m, d] = a.ymd.split('-');
  return { he: `${d}/${m} ${a.hm}`, en: `${d}/${m} ${a.hm}` };
}

function variantFor(match, variants, salt = '') {
  const key = `${String((match && match.id) || (match && match.match_date) || '')}:${salt}`;
  return variants[Math.abs(hash(key)) % variants.length];
}

const PUNDIT_EMOJI_BY_TYPE = {
  countdown: '🏆',
  live: '🔥',
  verification: '🧐',
  result: '🧾',
  fixture: '⏰',
  news: '👀',
  stat: '📊',
  pool: '🎯',
};

function hasEndingEmoji(text) {
  return /[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?$/u.test(String(text || '').trim());
}

function withPunditEmoji(text, type) {
  const copy = String(text || '').trim();
  if (!copy || hasEndingEmoji(copy)) return copy;
  const emoji = PUNDIT_EMOJI_BY_TYPE[type] || '⚽';
  return `${copy.replace(/[.。]\s*$/, '')} ${emoji}`;
}

function withPunditItemEmoji(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    he: withPunditEmoji(item.he, item.type),
    en: withPunditEmoji(item.en, item.type),
  };
}

function resultCommentary(match, salt = '') {
  const hs = Number(match.home_score);
  const as = Number(match.away_score);
  const homeHe = teamName(match.home_team_code, 'he');
  const awayHe = teamName(match.away_team_code, 'he');
  const homeEn = teamName(match.home_team_code, 'en');
  const awayEn = teamName(match.away_team_code, 'en');
  const homeFav = FAVORITES.has(match.home_team_code);
  const awayFav = FAVORITES.has(match.away_team_code);
  const upset = (hs > as && awayFav && !homeFav) || (as > hs && homeFav && !awayFav);
  const totalGoals = hs + as;

  if (hs === as) {
    if (hs === 0) {
      return variantFor(match, [
        {
          he: `${homeHe} ו${awayHe} נפרדו ב-0:0. תיקו כזה משאיר הרבה תחזיות בלי הכרעה ברורה.`,
          en: `${homeEn} and ${awayEn} finished 0-0. That leaves a lot of predictions without a clear answer.`,
        },
        {
          he: `${homeHe} ו${awayHe} סיימו 0:0. לא נוצץ, אבל נקודה לכל צד עדיין משנה את הבית.`,
          en: `${homeEn} and ${awayEn} ended 0-0. Not flashy, but a point each still changes the group.`,
        },
      ], salt);
    }
    return variantFor(match, [
      {
        he: `${homeHe} ו${awayHe} התחלקו ב-${hs}:${as}. אין מנצחת, והבית נשאר פתוח יותר.`,
        en: `${homeEn} and ${awayEn} split it ${hs}-${as}. No winner, and the group stays more open.`,
      },
      {
        he: `${homeHe} נגד ${awayHe} נגמר ${hs}:${as}. מי שסימן ניצחון לאחד הצדדים איבד נקודות חשובות.`,
        en: `${homeEn} vs ${awayEn} finished ${hs}-${as}. Anyone who picked a winner there lost important points.`,
      },
      {
        he: `${homeHe} ו${awayHe} עם ${hs}:${as}. נקודה לכל צד, ותזכורת שתיקו הוא לא ניחוש שולי.`,
        en: `${homeEn} and ${awayEn} with a ${hs}-${as}. A point each, and a reminder that draws are not throwaway picks.`,
      },
    ], salt);
  }

  const winnerHe = hs > as ? homeHe : awayHe;
  const loserHe = hs > as ? awayHe : homeHe;
  const winnerEn = hs > as ? homeEn : awayEn;
  const loserEn = hs > as ? awayEn : homeEn;
  const scoreHe = hs > as ? `${hs}:${as}` : `${as}:${hs}`;
  const scoreEn = hs > as ? `${hs}-${as}` : `${as}-${hs}`;

  if (upset) {
    return {
      he: `הפתעה: ${winnerHe} ניצחה את ${loserHe} ${scoreHe}. מי שהלך עם הפייבוריטית איבד כאן נקודות.`,
      en: `Upset: ${winnerEn} beat ${loserEn} ${scoreEn}. Anyone who backed the favorite dropped points here.`,
    };
  }
  if (totalGoals >= 5) {
    return {
      he: `${winnerHe} ניצחה את ${loserHe} ${scoreHe} במשחק פתוח. תוצאה כזאת משנה גם את הבית וגם לא מעט תחזיות.`,
      en: `${winnerEn} beat ${loserEn} ${scoreEn} in an open match. That result changes the group and a lot of predictions.`,
    };
  }
  if (hs === 0 || as === 0) {
    return variantFor(match, [
      {
        he: `${winnerHe} ניצחה את ${loserHe} ${scoreHe}. שלוש נקודות חשובות לבית ולכל מי שבחר בה.`,
        en: `${winnerEn} beat ${loserEn} ${scoreEn}. Three important points for the group and for anyone who picked them.`,
      },
      {
        he: `${winnerHe} סגרה את ${loserHe} עם ${scoreHe}. מי שסימן ניצחון נקי מקבל כאן יתרון יפה.`,
        en: `${winnerEn} shut out ${loserEn} ${scoreEn}. Anyone who called a clean win gets a useful edge here.`,
      },
      {
        he: `${winnerHe} עם ${scoreHe} על ${loserHe}. זה ניצחון שמסדר לה עמדה טובה יותר בבית.`,
        en: `${winnerEn} beat ${loserEn} ${scoreEn}. That gives them a stronger position in the group.`,
      },
    ], salt);
  }
  return variantFor(match, [
    {
      he: `${winnerHe} ניצחה את ${loserHe} ${scoreHe}. תוצאה חשובה לבית, ועוד נקודות למי שהלך איתה.`,
      en: `${winnerEn} beat ${loserEn} ${scoreEn}. An important group result, and points for anyone who backed them.`,
    },
    {
      he: `${winnerHe} עברה את ${loserHe} ${scoreHe}, והבית מתחיל לקבל צורה ברורה יותר.`,
      en: `${winnerEn} got past ${loserEn} ${scoreEn}, and the group is starting to take clearer shape.`,
    },
    {
      he: `${winnerHe} ניצחה ${scoreHe} את ${loserHe}. תוצאה צמודה, אבל מספיק חשובה כדי להשפיע על ההימורים.`,
      en: `${winnerEn} beat ${loserEn} ${scoreEn}. A close result, but important enough to affect the predictions.`,
    },
  ], salt);
}

const FIXTURE_CONSEQUENCE_EN = /\b(table|tables|group|prediction|predictions|predictors|pool|pools|pick|picks|picked|safe|sweating|points|qualify|qualification|places)\b/i;
const FIXTURE_CONSEQUENCE_HE = /(?:בית|בתים|תחזית|תחזיות|הימור|הימורים|נקודות|מקום|מקומות|עלייה|טבלה)/u;

function withFixtureConsequence(text) {
  const he = String((text && text.he) || '').trim();
  const en = String((text && text.en) || '').trim();
  return {
    he: FIXTURE_CONSEQUENCE_HE.test(he)
      ? he
      : `${he.replace(/[.。]\s*$/, '')}. זה עדיין משחק שיכול להזיז נקודות, הימורים ואת הבית.`,
    en: FIXTURE_CONSEQUENCE_EN.test(en)
      ? en
      : `${en.replace(/[.。]\s*$/, '')}. It still matters for table places, picks, and pool points.`,
  };
}

function fixtureCommentary(match, now, salt = '') {
  const w = whenLabel(match.match_date, now);
  const homeHe = teamName(match.home_team_code, 'he');
  const awayHe = teamName(match.away_team_code, 'he');
  const homeEn = teamName(match.home_team_code, 'en');
  const awayEn = teamName(match.away_team_code, 'en');
  const homeFav = FAVORITES.has(match.home_team_code);
  const awayFav = FAVORITES.has(match.away_team_code);

  if (homeFav && awayFav) {
    return withFixtureConsequence({
      he: `משחק גדול: ${homeHe} נגד ${awayHe}, ${w.he}. ניצחון כאן יכול לשנות את כל תמונת הבית.`,
      en: `Big match: ${homeEn} vs ${awayEn}, ${w.en}. A win here can change the whole group picture.`,
    });
  }
  if (homeFav || awayFav) {
    const favHe = homeFav ? homeHe : awayHe;
    const favEn = homeFav ? homeEn : awayEn;
    return withFixtureConsequence(variantFor(match, [
      {
        he: `${homeHe} נגד ${awayHe}, ${w.he}. ${favHe} פייבוריטית, אבל היא עדיין צריכה לעשות את העבודה על הדשא.`,
        en: `${homeEn} vs ${awayEn}, ${w.en}. ${favEn} are the favorite, but they still have to prove it on the pitch.`,
      },
      {
        he: `${homeHe} נגד ${awayHe}, ${w.he}. הרבה תחזיות ילכו עם ${favHe}; איבוד נקודות כאן יכאב.`,
        en: `${homeEn} vs ${awayEn}, ${w.en}. A lot of predictions will back ${favEn}; dropped points here would hurt.`,
      },
      {
        he: `${homeHe} נגד ${awayHe}, ${w.he}. אם ${favHe} לא מנצחת, הרבה הימורים ייפגעו מוקדם.`,
        en: `${homeEn} vs ${awayEn}, ${w.en}. If ${favEn} do not win, a lot of picks take an early hit.`,
      },
      {
        he: `${homeHe} נגד ${awayHe}, ${w.he}. משחק שהרבה אנשים יסמנו כבטוח, וזה בדיוק הסיכון.`,
        en: `${homeEn} vs ${awayEn}, ${w.en}. Many people will mark this as safe, and that is exactly the risk.`,
      },
    ], salt));
  }
  return withFixtureConsequence(variantFor(match, [
    {
      he: `${homeHe} נגד ${awayHe}, ${w.he}. משחק כזה יכול להכריע מקומות בבית בלי הרבה כותרות.`,
      en: `${homeEn} vs ${awayEn}, ${w.en}. This kind of match can decide group places without making many headlines.`,
    },
    {
      he: `${homeHe} נגד ${awayHe}, ${w.he}. לא המשחק הכי גדול, אבל הנקודות כאן יכולות להיות קריטיות.`,
      en: `${homeEn} vs ${awayEn}, ${w.en}. Not the biggest match, but the points here can be crucial.`,
    },
    {
      he: `${homeHe} נגד ${awayHe}, ${w.he}. מי שפוגע במשחקים האלה בדרך כלל מתקדם יפה בטבלה.`,
      en: `${homeEn} vs ${awayEn}, ${w.en}. People who get these matches right usually move well in the table.`,
    },
  ], salt));
}

function liveCommentary(match) {
  const homeHe = teamName(match.home_team_code, 'he');
  const awayHe = teamName(match.away_team_code, 'he');
  const homeEn = teamName(match.home_team_code, 'en');
  const awayEn = teamName(match.away_team_code, 'en');
  return {
    he: `${homeHe} נגד ${awayHe} עכשיו על הדשא. כל שער יכול לשנות את הבית ואת ההימורים.`,
    en: `${homeEn} vs ${awayEn} is live now. Every goal can change the group and the predictions.`,
  };
}

function verificationCommentary(match) {
  const homeHe = teamName(match.home_team_code, 'he');
  const awayHe = teamName(match.away_team_code, 'he');
  const homeEn = teamName(match.home_team_code, 'en');
  const awayEn = teamName(match.away_team_code, 'en');
  return {
    he: `${homeHe} נגד ${awayHe}: סטטוס המשחק בבדיקה לפני שהטבלה מקבלת נקודות. עדיף רגע של זהירות מטעות שמזיזה הימור שלם.`,
    en: `${homeEn} vs ${awayEn}: match status is being checked before the table gets points. A careful pause beats moving a whole pool on bad data.`,
  };
}

function build(now, options = {}) {
  const snap = options.matchesPayload || readJson(MATCHES_FILE, { matches: [] });
  const matches = Array.isArray(snap.matches) ? snap.matches : [];

  const kickoff = matches
    .map(m => m.match_date)
    .filter(Boolean)
    .sort()[0] || DEFAULT_KICKOFF;

  const items = [];

  // ---- 1. Countdown (pre-tournament only) -----------------------------------
  const msToKickoff = Date.parse(kickoff) - now.getTime();
  if (msToKickoff > 0) {
    const days = Math.floor(msToKickoff / DAY_MS);
    const hours = Math.ceil(msToKickoff / (60 * 60 * 1000));
    let he, en;
    if (days > 1) {
      he = `המונדיאל מתחיל בעוד ${days} ימים! כל ההימורים עוד פתוחים, מי תהיה ההפתעה של 2026?`;
      en = `The World Cup kicks off in ${days} days! Every prediction is still open. Who'll be the surprise of 2026?`;
    } else if (hours > 1) {
      he = `נותרו רק ${hours} שעות לפתיחת המונדיאל! זה הרגע האחרון לסגור את ההימורים.`;
      en = `Only ${hours} hours until kickoff! Last chance to lock in your predictions.`;
    } else {
      he = `המונדיאל מתחיל עכשיו! 🎉`;
      en = `The World Cup is kicking off now! 🎉`;
    }
    items.push({ id: `countdown-${ilParts(now.toISOString()).ymd}`, type: 'countdown', confidence: 'confirmed', he, en, sources: [], expires_at: iso(Date.parse(kickoff)) });
  }

  // ---- 2. Live matches -------------------------------------------------------
  const live = matches
    .filter(m => shouldTreatAsLive(m, now))
    .sort((x, y) => Date.parse(x.match_date) - Date.parse(y.match_date))
    .slice(0, 3);
  for (const m of live) {
    const text = liveCommentary(m);
    items.push({
      id: `live-${m.id}`,
      type: 'live',
      confidence: 'confirmed',
      he: text.he,
      en: text.en,
      sources: [],
      expires_at: iso(now.getTime() + 3 * HOUR_MS),
    });
  }

  // ---- 2b. Verification / recovery states -----------------------------------
  const verifying = matches
    .filter(m => shouldTreatAsVerification(m, now))
    .sort((x, y) => Date.parse(y.match_date) - Date.parse(x.match_date))
    .slice(0, 3);
  for (const m of verifying) {
    const text = verificationCommentary(m);
    items.push({
      id: `verify-${m.id}`,
      type: 'verification',
      confidence: 'confirmed',
      he: text.he,
      en: text.en,
      sources: [],
      expires_at: iso(now.getTime() + HOUR_MS),
    });
  }

  // ---- 3. Latest results (last 30h) -----------------------------------------
  const finished = matches
    .filter(m => FINISHED_STATUSES.has(String(m.status || '').toUpperCase()) && !isPendingProviderFinal(m) && m.home_score != null && m.away_score != null)
    .filter(m => now.getTime() - Date.parse(m.match_date) < RESULT_WINDOW_MS)
    .sort((x, y) => Date.parse(y.match_date) - Date.parse(x.match_date))
    .slice(0, 10);
  for (const [idx, m] of finished.entries()) {
    const text = resultCommentary(m, idx);
    items.push({ id: `result-${m.id}`, type: 'result', confidence: 'confirmed', he: text.he, en: text.en, sources: [], expires_at: iso(Date.parse(m.match_date) + RESULT_WINDOW_MS) });
  }

  // ---- 4. Upcoming fixtures (next 30h) --------------------------------------
  const upcoming = matches
    .filter(m => (m.status === 'TIMED' || m.status === 'SCHEDULED') && Date.parse(m.match_date) - now.getTime() > FIXTURE_PRE_KICKOFF_BUFFER_MS)
    .sort((x, y) => Date.parse(x.match_date) - Date.parse(y.match_date))
    .filter(m => Date.parse(m.match_date) - now.getTime() < FIXTURE_WINDOW_MS)
    .slice(0, 5);
  for (const [idx, m] of upcoming.entries()) {
    const text = fixtureCommentary(m, now, idx);
    items.push({ id: `fixture-${m.id}`, type: 'fixture', confidence: 'confirmed', he: text.he, en: text.en, sources: [], expires_at: iso(Date.parse(m.match_date) - FIXTURE_PRE_KICKOFF_BUFFER_MS) });
  }

  // ---- 5. Verified same-day news (from the news agent) ----------------------
  const news = options.newsPayload || readJson(NEWS_FILE, { items: [] });
  const newsUpdatedAt = news && news.updatedAt;
  const freshNews = (Array.isArray(news.items) ? news.items : [])
    .filter(n => n && n.he && n.en)
    .filter(n => isCurrentNews(n, newsUpdatedAt, now))
    .filter(n => !isPastDatedPreview(n, now))
    .map(n => ({
      id: n.id || `news-${Math.abs(hash(n.he))}`,
      type: 'news',
      confidence: n.confidence === 'confirmed' ? 'confirmed' : 'reported',
      he: n.he, en: n.en,
      team: typeof n.team === 'string' ? n.team.toUpperCase() : null,  // single-nation flag, optional
      teams: Array.isArray(n.teams) ? n.teams.map(t => String(t || '').toUpperCase()).filter(Boolean) : undefined,
      sources: Array.isArray(n.sources) ? n.sources.filter(s => s && s.url) : [],
      expires_at: n.expires_at || null,
      topic_date: n.topic_date || null,
      source_checked_at: n.source_checked_at || null,
    }))
    // Defense in depth: never render a news claim that fails the source gate,
    // even if a malformed pundit-news.json slipped past the validator.
    // 'confirmed' => official/source-of-record or >=2 independent sources.
    // 'reported' => >=2 independent sources.
    .filter(it => it.confidence === 'confirmed'
      ? (hasOfficialSource(it.sources) || independentSourceCount(it.sources) >= 2)
      : independentSourceCount(it.sources) >= 2);

  // During the tournament, facts from the match snapshot outrank editorial news.
  const priority = { live: 0, verification: 1, result: 2, fixture: 3, news: 4, stat: 5, countdown: 6 };
  const merged = [...items, ...freshNews]
    .sort((a, b) => (priority[a.type] ?? 9) - (priority[b.type] ?? 9))
    .slice(0, MAX_ITEMS);

  // Disabled in live tournament mode: better to show nothing than stale filler.
  if (false && merged.length === 0) {
    merged.push({
      id: 'welcome', type: 'countdown', confidence: 'confirmed', sources: [],
      he: 'ברוכים הבאים למונדיאל 2026! עקבו אחרי הפרשן לעדכונים חמים.',
      en: 'Welcome to World Cup 2026! Follow The Pundit for hot updates.',
    });
  }
  return merged.map(withPunditItemEmoji);
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}

function main() {
  const now = buildNow();
  const items = build(now);

  // Refresh at least every few hours, even when the facts are unchanged, so the
  // client can distinguish a current quiet feed from a stale stuck feed.
  const prev = readJson(OUT_FILE, null);
  const sig = JSON.stringify(items);
  const prevUpdatedAt = parseTime(prev && prev.updatedAt);
  const refreshDue = !Number.isFinite(prevUpdatedAt) || now.getTime() - prevUpdatedAt >= REFRESH_COMMIT_MS;
  if (prev && JSON.stringify(prev.items || []) === sig && !refreshDue) {
    console.log('pundit: no change, keeping existing feed');
    return;
  }

  const out = { updatedAt: now.toISOString(), freshUntil: iso(now.getTime() + FEED_FRESH_MS), count: items.length, items };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`pundit: wrote ${items.length} item(s) -> ${path.relative(ROOT, OUT_FILE)}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  build,
  isCurrentNews,
  isPastDatedPreview,
  shouldTreatAsLive,
  shouldTreatAsVerification,
  isPendingProviderFinal,
};
