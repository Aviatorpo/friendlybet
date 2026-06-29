// Restore group/bonus score components from public leaderboard snapshots while
// preserving the current DB knockout score. Intended for targeted recovery when
// a knockout recalculation accidentally downgrades historical group components.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://friendlybet.live').replace(/\/$/, '');
const POOL_IDS = csvList(process.env.RESTORE_POOL_IDS || process.env.SCORING_POOL_IDS || process.argv[2] || '');
const DRY_RUN = process.argv.includes('--dry-run') || process.env.RESTORE_SCORES_DRY_RUN === '1';

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SECRET_KEY');
  process.exit(1);
}
if (!POOL_IDS.length) {
  console.error('Missing RESTORE_POOL_IDS/SCORING_POOL_IDS');
  process.exit(1);
}

function csvList(value) {
  return String(value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function scoreNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function sb(method, table, options = {}) {
  const { query = '', data, headers = {} } = options;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'PATCH' ? 'return=minimal' : 'return=representation',
      ...headers
    },
    body: data ? JSON.stringify(data) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function fetchSnapshot(poolId) {
  const res = await fetch(`${PUBLIC_BASE_URL}/public-data/leaderboard/${poolId}.json?cb=${Date.now()}`, {
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`snapshot ${poolId} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const standings = json.standings || [];
  if (!Array.isArray(standings) || standings.length === 0) {
    throw new Error(`snapshot ${poolId}: no standings`);
  }
  return standings;
}

async function restorePool(poolId) {
  const [snapshotRows, dbUsers] = await Promise.all([
    fetchSnapshot(poolId),
    sb('GET', 'users', {
      query: `?pool_id=eq.${poolId}&select=id,pool_id,nickname,total_score,group_points,knockout_points,bonus_points,groups_score,knockout_score,bonus_score`
    })
  ]);
  const snapshotByUser = new Map(snapshotRows.map(row => [row.id, row]));
  let patched = 0;
  const now = new Date().toISOString();

  for (const user of dbUsers || []) {
    const snap = snapshotByUser.get(user.id);
    if (!snap) continue;
    const groupPoints = scoreNumber(snap.group_points ?? snap.groups_score);
    const bonusPoints = scoreNumber(snap.bonus_points ?? snap.bonus_score);
    const knockoutPoints = scoreNumber(user.knockout_points ?? user.knockout_score);
    const total = groupPoints + knockoutPoints + bonusPoints;
    const needsPatch =
      scoreNumber(user.group_points ?? user.groups_score) !== groupPoints ||
      scoreNumber(user.bonus_points ?? user.bonus_score) !== bonusPoints ||
      scoreNumber(user.total_score) !== total ||
      scoreNumber(user.knockout_points ?? user.knockout_score) !== knockoutPoints;
    if (!needsPatch) continue;
    patched++;
    if (DRY_RUN) continue;
    await sb('PATCH', 'users', {
      query: `?id=eq.${user.id}`,
      data: {
        total_score: total,
        group_points: groupPoints,
        knockout_points: knockoutPoints,
        bonus_points: bonusPoints,
        groups_score: groupPoints,
        knockout_score: knockoutPoints,
        bonus_score: bonusPoints,
        last_score_calc: now
      }
    });
  }

  return { poolId, users: (dbUsers || []).length, patched };
}

async function main() {
  const results = [];
  for (const poolId of POOL_IDS) results.push(await restorePool(poolId));
  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    pools: POOL_IDS.length,
    patchedUsers: results.reduce((sum, row) => sum + row.patched, 0),
    results
  }, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('restore-score-components-from-snapshots fatal:', err);
    process.exit(1);
  });
}

module.exports = { main, restorePool };
