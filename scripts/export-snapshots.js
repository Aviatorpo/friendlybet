// ============================================================
// FriendlyBet - CDN snapshot exporter (Pillar 1 + 2)
// ============================================================
// Reads the canonical data from Supabase and writes static JSON snapshots into
// public-data/ so the browser can fetch them from Vercel's edge CDN instead of
// hammering Postgres on every refresh during a kickoff/goal spike.
//
//   public-data/matches.json                -> all matches (public-safe allowlist)
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
const crypto = require('crypto');
const { assertQaIfRequested } = require('./qa-env');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
assertQaIfRequested();

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.PUBLIC_DATA_DIR
  ? path.resolve(ROOT, process.env.PUBLIC_DATA_DIR)
  : path.join(ROOT, 'public-data');
const LB_DIR = path.join(OUT_DIR, 'leaderboard');

// Columns safe to expose publicly on the leaderboard. NEVER include recovery_code_hash.
const SAFE_USER_COLS = [
  'id', 'pool_id', 'nickname', 'is_admin',
  'total_score', 'group_points', 'knockout_points', 'bonus_points',
  'groups_score', 'knockout_score', 'bonus_score',
  'predictions_submitted_at', 'joined_at', 'last_score_calc'
].join(',');

const SAFE_MATCH_COLS = [
  'id',
  'external_id',
  'stage',
  'group_letter',
  'home_team_code',
  'away_team_code',
  'home_score',
  'away_score',
  'status',
  'match_date',
  'venue',
  'winner_code',
  'scorers',
  'live_clock',
  'live_period',
  'status_detail',
  'live_source',
  'source_updated_at',
  'last_updated'
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
  if (env.FORCE_ALL_LEADERBOARD_SNAPSHOTS === '1') return null;
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

function stableComparable(value) {
  if (Array.isArray(value)) return value.map(stableComparable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .filter(key => key !== 'updatedAt' && key !== 'published_at')
    .sort()
    .reduce((out, key) => {
      out[key] = stableComparable(value[key]);
      return out;
    }, {});
}

// Write only if the meaningful payload changed (ignores the volatile updatedAt stamp), so a
// no-op run produces no git diff -> no needless Vercel redeploy. Returns true if written.
function writeIfChanged(file, payloadKey, payload) {
  const prev = readJson(file);
  const sameData = prev && JSON.stringify(stableComparable(prev)) === JSON.stringify(stableComparable(payload));
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

function logicalMatchKey(match) {
  const dateMs = Date.parse(match && match.match_date);
  const dateKey = Number.isFinite(dateMs) ? new Date(dateMs).toISOString() : String(match && match.match_date || '');
  return [
    dateKey,
    String(match && match.home_team_code || '').toUpperCase(),
    String(match && match.away_team_code || '').toUpperCase(),
  ].join('|');
}

function timestampMs(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : 0;
}

function snapshotMatchRank(match) {
  const status = String(match && match.status || '').toUpperCase();
  let rank = 0;
  if (/^4000/.test(String(match && match.external_id || ''))) rank += 1000; // FIFA WC match ids.
  if (match && match.venue) rank += 80;
  if (FINAL_STATUSES.has(status)) rank += 60;
  if (match && match.home_score != null && match.away_score != null) rank += 40;
  if (!isPendingProviderFinal(match)) rank += 30;
  if (match && match.winner_code) rank += 10;
  if (match && match.scorers && Array.isArray(match.scorers) && match.scorers.length) rank += 5;
  return rank;
}

function preferSnapshotMatch(a, b) {
  const ar = snapshotMatchRank(a);
  const br = snapshotMatchRank(b);
  if (ar !== br) return br > ar ? b : a;
  const at = Math.max(timestampMs(a && a.source_updated_at), timestampMs(a && a.last_updated));
  const bt = Math.max(timestampMs(b && b.source_updated_at), timestampMs(b && b.last_updated));
  if (at !== bt) return bt > at ? b : a;
  return String(b && b.external_id || '').localeCompare(String(a && a.external_id || '')) > 0 ? b : a;
}

function dedupeMatchesForSnapshot(matches) {
  const byKey = new Map();
  for (const match of matches || []) {
    const key = logicalMatchKey(match);
    const existing = byKey.get(key);
    byKey.set(key, existing ? preferSnapshotMatch(existing, match) : match);
  }
  return [...byKey.values()].sort((a, b) =>
    timestampMs(a && a.match_date) - timestampMs(b && b.match_date)
    || String(a && a.id || '').localeCompare(String(b && b.id || ''))
  );
}

function resultFact(match) {
  return {
    external_id: String(match.external_id || match.id || ''),
    stage: match.stage || null,
    home_team_code: match.home_team_code || null,
    away_team_code: match.away_team_code || null,
    home_score: match.home_score == null ? null : Number(match.home_score),
    away_score: match.away_score == null ? null : Number(match.away_score),
    status: String(match.status || '').toUpperCase(),
    winner_code: match.winner_code || null,
  };
}

function resultVersionFromMatches(matches) {
  const facts = (matches || [])
    .filter(match => {
      const status = String(match && match.status || '').toUpperCase();
      return FINAL_STATUSES.has(status)
        && match.home_score != null
        && match.away_score != null
        && !isPendingProviderFinal(match);
    })
    .map(resultFact)
    .sort((a, b) => String(a.external_id).localeCompare(String(b.external_id)));
  const digest = crypto.createHash('sha256').update(JSON.stringify(facts)).digest('hex').slice(0, 20);
  return `rv_${facts.length}_${digest}`;
}

function matchSourceState(matches) {
  const pending = (matches || []).some(match => {
    const status = String(match && match.status || '').toUpperCase();
    const tiedKnockout = match
      && match.stage
      && match.stage !== 'GROUP_STAGE'
      && match.home_score != null
      && match.away_score != null
      && Number(match.home_score) === Number(match.away_score)
      && !match.winner_code;
    return isPendingProviderFinal(match) || (FINAL_STATUSES.has(status) && tiedKnockout);
  });
  return pending ? 'verification_pending' : 'verified_snapshot';
}

function resultPublicationMetadata(matches) {
  return {
    result_version: resultVersionFromMatches(matches),
    source_state: matchSourceState(matches),
  };
}

async function fetchSnapshotMatches() {
  const rows = await sbAll('matches', `?select=${SAFE_MATCH_COLS}&order=match_date.asc,id.asc`);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('matches fetch empty');
  return dedupeMatchesForSnapshot(rows.map(sanitizeMatchForSnapshot));
}

async function exportMatches() {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY');
  let matches;
  try {
    matches = await fetchSnapshotMatches();
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
  const publishedAt = new Date().toISOString();
  const metadata = resultPublicationMetadata(matches);

  const wrote = writeIfChanged(matchesFile, 'matches',
    {
      updatedAt: publishedAt,
      published_at: publishedAt,
      ...metadata,
      points_state: 'match_snapshot',
      count: matches.length,
      matches
    });
  console.log(`matches.json: ${wrote ? 'updated' : 'unchanged'} (${matches.length} rows)`);
  return wrote ? 1 : 0;
}

async function exportLeaderboards(opts = {}) {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY');
  let resultMetadata;
  try {
    resultMetadata = resultPublicationMetadata(await fetchSnapshotMatches());
  } catch (e) {
    console.error('leaderboard result metadata failed, keeping last-good snapshots:', e.message);
    return 0;
  }
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
    const publishedAt = new Date().toISOString();
    const wrote = writeIfChanged(path.join(LB_DIR, `${pool.id}.json`), 'standings',
      {
        updatedAt: publishedAt,
        published_at: publishedAt,
        ...resultMetadata,
        points_state: 'current_for_result_version',
        pool_id: pool.id,
        count: standings.length,
        standings
      });
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
    dedupeMatchesForSnapshot,
    resultVersionFromMatches,
    resultPublicationMetadata,
    logicalMatchKey,
    writeIfChanged,
    sbAll,
    SAFE_MATCH_COLS,
    __setFetch: (fn) => { globalThis.fetch = fn; },
  };
}
