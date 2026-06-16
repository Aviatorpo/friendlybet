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
const RESULT_WINDOW_MS = 30 * HOUR_MS;
const FIXTURE_WINDOW_MS = 30 * HOUR_MS;
const NEWS_MAX_AGE_MS = 30 * HOUR_MS;
const NEWS_MAX_FUTURE_EXPIRY_MS = 30 * HOUR_MS;
const FEED_FRESH_MS = 6 * HOUR_MS;
const REFRESH_COMMIT_MS = 3 * HOUR_MS;
const LIVE_STATUSES = new Set(['IN_PLAY', 'LIVE', 'PAUSED']);
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
  if (LIVE_STATUSES.has(status)) return true;
  const start = parseTime(match.match_date);
  return Number.isFinite(start) && now.getTime() >= start && now.getTime() - start <= 3 * HOUR_MS && status !== 'FINISHED';
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

function build(now) {
  const snap = readJson(MATCHES_FILE, { matches: [] });
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
    items.push({
      id: `live-${m.id}`,
      type: 'live',
      confidence: 'confirmed',
      he: `${teamName(m.home_team_code, 'he')} נגד ${teamName(m.away_team_code, 'he')} משוחק עכשיו. התוצאה הרשמית תתעדכן בסיום המשחק.`,
      en: `${teamName(m.home_team_code, 'en')} vs ${teamName(m.away_team_code, 'en')} is live now. The official score will update after full-time.`,
      sources: [],
      expires_at: iso(now.getTime() + 3 * HOUR_MS),
    });
  }

  // ---- 3. Latest results (last 30h) -----------------------------------------
  const finished = matches
    .filter(m => m.status === 'FINISHED' && m.home_score != null && m.away_score != null)
    .filter(m => now.getTime() - Date.parse(m.match_date) < RESULT_WINDOW_MS)
    .sort((x, y) => Date.parse(y.match_date) - Date.parse(x.match_date))
    .slice(0, 5);
  for (const m of finished) {
    const hs = m.home_score, as = m.away_score;
    const upset = (hs > as && FAVORITES.has(m.away_team_code) && !FAVORITES.has(m.home_team_code)) ||
                  (as > hs && FAVORITES.has(m.home_team_code) && !FAVORITES.has(m.away_team_code));
    const he = `${upset ? 'הפתעה! ' : ''}${teamName(m.home_team_code, 'he')} ${hs}:${as} ${teamName(m.away_team_code, 'he')}.`;
    const en = `${upset ? 'Upset! ' : ''}${teamName(m.home_team_code, 'en')} ${hs}-${as} ${teamName(m.away_team_code, 'en')}.`;
    items.push({ id: `result-${m.id}`, type: 'result', confidence: 'confirmed', he, en, sources: [], expires_at: iso(Date.parse(m.match_date) + RESULT_WINDOW_MS) });
  }

  // ---- 4. Upcoming fixtures (next 30h) --------------------------------------
  const upcoming = matches
    .filter(m => (m.status === 'TIMED' || m.status === 'SCHEDULED') && Date.parse(m.match_date) > now.getTime())
    .sort((x, y) => Date.parse(x.match_date) - Date.parse(y.match_date))
    .filter(m => Date.parse(m.match_date) - now.getTime() < FIXTURE_WINDOW_MS)
    .slice(0, 5);
  for (const m of upcoming) {
    const w = whenLabel(m.match_date, now);
    const big = FAVORITES.has(m.home_team_code) && FAVORITES.has(m.away_team_code);
    const he = `${big ? 'משחק ענק! ' : ''}${teamName(m.home_team_code, 'he')} נגד ${teamName(m.away_team_code, 'he')}, ${w.he}.`;
    const en = `${big ? 'Big match: ' : ''}${teamName(m.home_team_code, 'en')} vs ${teamName(m.away_team_code, 'en')}, ${w.en}.`;
    items.push({ id: `fixture-${m.id}`, type: 'fixture', confidence: 'confirmed', he, en, sources: [], expires_at: iso(Date.parse(m.match_date)) });
  }

  // ---- 5. Verified same-day news (from the news agent) ----------------------
  const news = readJson(NEWS_FILE, { items: [] });
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
  const priority = { live: 0, result: 1, fixture: 2, news: 3, stat: 4, countdown: 5 };
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
  return merged;
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

module.exports = { build, isCurrentNews, isPastDatedPreview };
