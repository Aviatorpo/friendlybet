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
const MAX_ITEMS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// Top FIFA-ranked sides -> used only to flag a fixture as a "big match".
const FAVORITES = new Set(['ARG', 'FRA', 'ESP', 'ENG', 'BRA', 'POR', 'NED', 'GER', 'BEL', 'URU', 'CRO', 'COL']);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
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
    items.push({ id: `countdown-${ilParts(now.toISOString()).ymd}`, type: 'countdown', confidence: 'confirmed', he, en, sources: [] });
  }

  // ---- 2. Latest results (last 48h) -----------------------------------------
  const finished = matches
    .filter(m => m.status === 'FINISHED' && m.home_score != null && m.away_score != null)
    .filter(m => now.getTime() - Date.parse(m.match_date) < 2 * DAY_MS)
    .sort((x, y) => Date.parse(y.match_date) - Date.parse(x.match_date))
    .slice(0, 3);
  for (const m of finished) {
    const hs = m.home_score, as = m.away_score;
    const upset = (hs > as && FAVORITES.has(m.away_team_code) && !FAVORITES.has(m.home_team_code)) ||
                  (as > hs && FAVORITES.has(m.home_team_code) && !FAVORITES.has(m.away_team_code));
    const he = `${upset ? 'הפתעה! ' : ''}${teamName(m.home_team_code, 'he')} ${hs}:${as} ${teamName(m.away_team_code, 'he')}.`;
    const en = `${upset ? 'Upset! ' : ''}${teamName(m.home_team_code, 'en')} ${hs}-${as} ${teamName(m.away_team_code, 'en')}.`;
    items.push({ id: `result-${m.id}`, type: 'result', confidence: 'confirmed', he, en, sources: [] });
  }

  // ---- 3. Upcoming fixtures (next 48h) --------------------------------------
  const upcoming = matches
    .filter(m => (m.status === 'TIMED' || m.status === 'SCHEDULED') && Date.parse(m.match_date) > now.getTime())
    .sort((x, y) => Date.parse(x.match_date) - Date.parse(y.match_date))
    .filter(m => Date.parse(m.match_date) - now.getTime() < 2 * DAY_MS)
    .slice(0, 3);
  for (const m of upcoming) {
    const w = whenLabel(m.match_date, now);
    const big = FAVORITES.has(m.home_team_code) && FAVORITES.has(m.away_team_code);
    const he = `${big ? 'משחק ענק! ' : ''}${teamName(m.home_team_code, 'he')} נגד ${teamName(m.away_team_code, 'he')}, ${w.he}.`;
    const en = `${big ? 'Big match: ' : ''}${teamName(m.home_team_code, 'en')} vs ${teamName(m.away_team_code, 'en')}, ${w.en}.`;
    items.push({ id: `fixture-${m.id}`, type: 'fixture', confidence: 'confirmed', he, en, sources: [] });
  }

  // ---- 4. Verified news (from the news agent) -------------------------------
  const news = readJson(NEWS_FILE, { items: [] });
  const freshNews = (Array.isArray(news.items) ? news.items : [])
    .filter(n => n && n.he && n.en)
    .filter(n => !n.expires_at || Date.parse(n.expires_at) > now.getTime())
    .map(n => ({
      id: n.id || `news-${Math.abs(hash(n.he))}`,
      type: 'news',
      confidence: n.confidence === 'confirmed' ? 'confirmed' : 'reported',
      he: n.he, en: n.en,
      sources: Array.isArray(n.sources) ? n.sources.filter(s => s && s.url) : [],
      expires_at: n.expires_at || null,
    }))
    // Defense in depth: never render a news claim that fails the source gate,
    // even if a malformed pundit-news.json slipped past the validator.
    // 'reported' => >=2 independent sources, 'confirmed' => >=1 official source.
    .filter(it => it.sources.length >= (it.confidence === 'confirmed' ? 1 : 2));

  // Order: news first (most engaging), then results, fixtures, countdown.
  const priority = { news: 0, result: 1, fixture: 2, stat: 3, countdown: 4 };
  const merged = [...freshNews, ...items]
    .sort((a, b) => (priority[a.type] ?? 9) - (priority[b.type] ?? 9))
    .slice(0, MAX_ITEMS);

  // Fallback so the card is never empty.
  if (merged.length === 0) {
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
  const now = new Date();
  const items = build(now);

  // Only-if-changed: ignore updatedAt when comparing so the CI commit (and the
  // Vercel redeploy) only fires when the actual feed content moves.
  const prev = readJson(OUT_FILE, null);
  const sig = JSON.stringify(items);
  if (prev && JSON.stringify(prev.items || []) === sig) {
    console.log('pundit: no change, keeping existing feed');
    return;
  }

  const out = { updatedAt: now.toISOString(), count: items.length, items };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`pundit: wrote ${items.length} item(s) -> ${path.relative(ROOT, OUT_FILE)}`);
}

main();
