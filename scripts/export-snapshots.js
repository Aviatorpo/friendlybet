// ============================================================
// FriendlyBet - CDN snapshot exporter (Pillar 1 + 2)
// ============================================================
// Reads the canonical data from Supabase and writes static JSON snapshots into
// public-data/ so the browser can fetch them from Vercel's edge CDN instead of
// hammering Postgres on every refresh during a kickoff/goal spike.
//
//   public-data/matches.json                -> all matches (public-safe, select=*)
//   public-data/leaderboard/<poolId>.json   -> per-pool standings (SAFE columns only)
//
// Safety:
//   * SAFE columns only for users  -> recovery_code_hash is NEVER written to a public file.
//   * Last-good guard              -> on empty/failed fetch we keep the previous file.
//   * Only-if-changed              -> we only rewrite a file when its data actually changed,
//                                     so the CI commit (and Vercel redeploy) is bounded.
//
// Run after the match sync and/or the score calc:  node scripts/export-snapshots.js
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY
// ============================================================
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public-data');
const LB_DIR = path.join(OUT_DIR, 'leaderboard');

// Columns safe to expose publicly on the leaderboard. NEVER include recovery_code_hash.
const SAFE_USER_COLS = [
  'id', 'pool_id', 'nickname', 'is_admin',
  'total_score', 'group_points', 'knockout_points', 'bonus_points',
  'groups_score', 'knockout_score', 'bonus_score',
  'predictions_submitted_at', 'joined_at', 'last_score_calc'
].join(',');

const REST_PAGE_SIZE = 1000;

function csvList(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

function requestedLeaderboardPoolIds(args = process.argv.slice(2), env = process.env) {
  const arg = args.find(a => String(a || '').startsWith('--pool-ids='));
  if (arg) return csvList(arg.slice('--pool-ids='.length)) || [];
  if (Object.prototype.hasOwnProperty.call(env, 'LEADERBOARD_POOL_IDS')) {
    const poolIds = csvList(env.LEADERBOARD_POOL_IDS);
    return poolIds && poolIds.length ? poolIds : null;
  }
  return null;
}

function postgrestInFilter(column, values) {
  return `${column}=in.(${values.map(v => encodeURIComponent(v)).join(',')})`;
}

async function sbAll(table, query = '', pageSize = REST_PAGE_SIZE) {
  const all = [];
  for (let from = 0, guard = 0; ; guard++, from += pageSize) {
    if (guard >= 10000) {
      throw new Error(`Supabase GET ${table}: pagination guard exceeded after ${all.length} rows`);
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + pageSize - 1}`
      }
    });
    if (!res.ok) throw new Error(`Supabase GET ${table} ${res.status}: ${await res.text()}`);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error(`Supabase GET ${table}: expected array page`);
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

// Write only if the meaningful payload changed (ignores the volatile updatedAt stamp), so a
// no-op run produces no git diff -> no needless Vercel redeploy. Returns true if written.
function writeIfChanged(file, payloadKey, payload) {
  const prev = readJson(file);
  const sameData = prev && JSON.stringify(prev[payloadKey]) === JSON.stringify(payload[payloadKey]);
  if (sameData) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload));
  return true;
}

// Live-match statuses (football-data). While any of these is active the match
// row churns every poll (clock/score), which would re-commit the snapshot and
// trigger a Vercel redeploy on every 10-min sync.
const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE']);
const FINAL_STATUSES = new Set(['FINISHED', 'AWARDED']);

function isPendingProviderFinal(match) {
  const source = String((match && match.live_source) || '').toLowerCase();
  const detail = String((match && match.status_detail) || '').toLowerCase();
  return source === 'espn-final' || detail.includes('pending verification');
}

function sanitizeMatchForSnapshot(match) {
  if (!match || typeof match !== 'object') return match;
  const clean = { ...match };
  const status = String(clean.status || '').toUpperCase();
  const hasScore = clean.home_score != null && clean.away_score != null;
  if (FINAL_STATUSES.has(status) && hasScore && !isPendingProviderFinal(clean)) {
    clean.live_clock = null;
    clean.live_period = null;
    clean.live_source = null;
    clean.status_detail = null;
  }
  return clean;
}

async function exportMatches() {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY');
  let matches;
  try {
    matches = await sbAll('matches', '?select=*&order=match_date.asc,id.asc');
  } catch (e) {
    console.error('matches fetch failed, keeping last-good snapshot:', e.message);
    return 0;
  }
  // Last-good guard: an empty result during an API hiccup must not wipe a good file.
  if (!Array.isArray(matches) || matches.length === 0) {
    console.warn('matches fetch empty, keeping last-good snapshot.');
    return 0;
  }

  // Deploy throttle: freeze the CDN snapshot while any match is live. The client
  // reads live scores straight from the DB during play (see live-poller), so the
  // snapshot does NOT need mid-match refreshes - freezing it keeps a busy WC day
  // from blowing through Vercel's 100-deploys/day cap. Final scores + schedule
  // land on the next run once nothing is live (between matches / overnight).
  // Override with FORCE_MATCH_SNAPSHOT=1 for a manual full refresh.
  const matchesFile = path.join(OUT_DIR, 'matches.json');
  const liveCount = matches.filter(m => LIVE_STATUSES.has(String(m.status || '').toUpperCase())).length;
  if (liveCount > 0 && fs.existsSync(matchesFile) && process.env.FORCE_MATCH_SNAPSHOT !== '1') {
    console.log(`matches.json: frozen - ${liveCount} live match(es); live scores come from the DB, snapshot refreshes once play settles.`);
    return 0;
  }
  matches = matches.map(sanitizeMatchForSnapshot);

  const wrote = writeIfChanged(matchesFile, 'matches',
    { updatedAt: new Date().toISOString(), count: matches.length, matches });
  console.log(`matches.json: ${wrote ? 'updated' : 'unchanged'} (${matches.length} rows)`);
  return wrote ? 1 : 0;
}

async function exportLeaderboards(opts = {}) {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY');
  const poolIds = csvList(opts.poolIds);
  if (Array.isArray(poolIds) && poolIds.length === 0) {
    console.log('leaderboards: skipped (no changed pool ids).');
    return 0;
  }
  const poolFilter = Array.isArray(poolIds) ? postgrestInFilter('id', poolIds) : '';
  const userFilter = Array.isArray(poolIds) ? postgrestInFilter('pool_id', poolIds) : '';
  let pools, users;
  try {
    pools = await sbAll('pools', `?select=id${poolFilter ? `&${poolFilter}` : ''}`);
    users = await sbAll('users', `?select=${SAFE_USER_COLS}${userFilter ? `&${userFilter}` : ''}&order=total_score.desc.nullslast,id.asc`);
  } catch (e) {
    console.error('leaderboard fetch failed, keeping last-good snapshots:', e.message);
    return 0;
  }
  if (!Array.isArray(pools) || !Array.isArray(users)) return 0;
  const byPool = {};
  for (const u of users) (byPool[u.pool_id] = byPool[u.pool_id] || []).push(u);
  let changed = 0;
  for (const pool of pools) {
    const standings = (byPool[pool.id] || []).sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
    if (standings.length === 0) continue; // never overwrite a pool's file with an empty board
    const wrote = writeIfChanged(path.join(LB_DIR, `${pool.id}.json`), 'standings',
      { updatedAt: new Date().toISOString(), pool_id: pool.id, count: standings.length, standings });
    if (wrote) changed++;
  }
  console.log(`leaderboards: ${changed} pool file(s) updated of ${pools.length}${Array.isArray(poolIds) ? ' requested' : ''}.`);
  return changed;
}

async function main() {
  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SECRET_KEY'); process.exit(1); }
  // mode: 'matches' | 'leaderboards' | 'all' (default). Lets the 10-min match cron skip the
  // all-users read and the 30-min score cron do both.
  const MODE = (process.argv.slice(2).find(arg => !String(arg).startsWith('--')) || 'all').toLowerCase();
  const leaderboardPoolIds = requestedLeaderboardPoolIds();
  fs.mkdirSync(LB_DIR, { recursive: true });
  const m = MODE === 'leaderboards' ? 0 : await exportMatches();
  const l = MODE === 'matches' ? 0 : await exportLeaderboards({ poolIds: leaderboardPoolIds });
  console.log(`snapshot export done (mode=${MODE}). matches changed=${m}, leaderboards changed=${l}.`);
}

if (require.main === module) {
  main().catch((e) => { console.error('export-snapshots fatal:', e); process.exit(1); });
} else {
  module.exports = {
    exportMatches,
    exportLeaderboards,
    requestedLeaderboardPoolIds,
    postgrestInFilter,
    isPendingProviderFinal,
    sanitizeMatchForSnapshot,
    writeIfChanged,
    sbAll,
    __setFetch: (fn) => { globalThis.fetch = fn; },
  };
}
