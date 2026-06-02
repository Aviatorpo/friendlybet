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
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SECRET_KEY'); process.exit(1); }

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public-data');
const LB_DIR = path.join(OUT_DIR, 'leaderboard');

// Columns safe to expose publicly on the leaderboard. NEVER include recovery_code_hash.
const SAFE_USER_COLS = [
  'id', 'pool_id', 'nickname', 'is_admin',
  'total_score', 'group_points', 'knockout_points', 'bonus_points',
  'groups_score', 'knockout_score', 'bonus_score',
  'predictions_submitted_at', 'created_at', 'last_score_calc'
].join(',');

async function sb(table, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase GET ${table} ${res.status}: ${await res.text()}`);
  return res.json();
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

async function exportMatches() {
  let matches;
  try {
    matches = await sb('matches', '?select=*&order=match_date.asc,id.asc');
  } catch (e) {
    console.error('matches fetch failed, keeping last-good snapshot:', e.message);
    return 0;
  }
  // Last-good guard: an empty result during an API hiccup must not wipe a good file.
  if (!Array.isArray(matches) || matches.length === 0) {
    console.warn('matches fetch empty, keeping last-good snapshot.');
    return 0;
  }
  const wrote = writeIfChanged(path.join(OUT_DIR, 'matches.json'), 'matches',
    { updatedAt: new Date().toISOString(), count: matches.length, matches });
  console.log(`matches.json: ${wrote ? 'updated' : 'unchanged'} (${matches.length} rows)`);
  return wrote ? 1 : 0;
}

async function exportLeaderboards() {
  let pools, users;
  try {
    pools = await sb('pools', '?select=id');
    users = await sb('users', `?select=${SAFE_USER_COLS}&order=total_score.desc.nullslast`);
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
  console.log(`leaderboards: ${changed} pool file(s) updated of ${pools.length}.`);
  return changed;
}

// mode: 'matches' | 'leaderboards' | 'all' (default). Lets the 10-min match cron skip the
// all-users read and the 30-min score cron do both.
const MODE = (process.argv[2] || 'all').toLowerCase();
(async () => {
  fs.mkdirSync(LB_DIR, { recursive: true });
  const m = MODE === 'leaderboards' ? 0 : await exportMatches();
  const l = MODE === 'matches' ? 0 : await exportLeaderboards();
  console.log(`snapshot export done (mode=${MODE}). matches changed=${m}, leaderboards changed=${l}.`);
})().catch((e) => { console.error('export-snapshots fatal:', e); process.exit(1); });
