// Repair persisted pick multipliers from the authoritative pool scoring rules.
// Safe to rerun: it only PATCHes rows whose multiplier_applied is different.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const DRY_RUN = process.argv.includes('--dry-run') || process.env.REPAIR_MULTIPLIERS_DRY_RUN === '1';
const REST_PAGE_SIZE = 1000;
const PATCH_CHUNK_SIZE = 50;

process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'repair-script-import';
const Scoring = require('./calculate-scores-v2');

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SECRET_KEY');
  process.exit(1);
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

async function sbAll(table, query = '', pageSize = REST_PAGE_SIZE) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const page = await sb('GET', table, {
      query,
      headers: { Range: `${from}-${from + pageSize - 1}` }
    });
    if (!Array.isArray(page)) throw new Error(`Supabase GET ${table}: expected array`);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function sameNumber(a, b) {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na - nb) < 0.0001;
}

function chunk(rows, size) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

async function patchGrouped(table, updates) {
  const byMultiplier = new Map();
  updates.forEach(row => {
    const key = String(row.expected);
    if (!byMultiplier.has(key)) byMultiplier.set(key, []);
    byMultiplier.get(key).push(row.id);
  });

  let patched = 0;
  for (const [multiplier, ids] of byMultiplier.entries()) {
    for (const idChunk of chunk(ids, PATCH_CHUNK_SIZE)) {
      patched += idChunk.length;
      if (DRY_RUN) continue;
      await sb('PATCH', table, {
        query: `?id=in.(${idChunk.join(',')})`,
        data: { multiplier_applied: Number(multiplier) }
      });
    }
  }
  return patched;
}

function expectedMultiplier(pool, teamCode) {
  const rules = pool.scoring_rules || {};
  return Scoring.poolMultResolver(pool, rules)(teamCode, null);
}

async function main() {
  const pools = await sbAll('pools', '?select=id,code,use_multipliers,scoring_rules');
  const poolsById = new Map(pools.map(pool => [pool.id, pool]));

  const groupPicks = await sbAll('group_picks', '?select=id,pool_id,team_code,multiplier_applied');
  const knockoutPicks = await sbAll('knockout_picks', '?select=id,pool_id,predicted_winner,multiplier_applied');

  const groupUpdates = [];
  groupPicks.forEach(row => {
    const pool = poolsById.get(row.pool_id);
    if (!pool || !row.team_code) return;
    const expected = expectedMultiplier(pool, row.team_code);
    if (!sameNumber(row.multiplier_applied, expected)) {
      groupUpdates.push({ id: row.id, expected, current: row.multiplier_applied, pool_id: row.pool_id });
    }
  });

  const knockoutUpdates = [];
  knockoutPicks.forEach(row => {
    const pool = poolsById.get(row.pool_id);
    if (!pool || !row.predicted_winner) return;
    const expected = expectedMultiplier(pool, row.predicted_winner);
    if (!sameNumber(row.multiplier_applied, expected)) {
      knockoutUpdates.push({ id: row.id, expected, current: row.multiplier_applied, pool_id: row.pool_id });
    }
  });

  const changedPoolIds = new Set([...groupUpdates, ...knockoutUpdates].map(row => row.pool_id));
  const groupPatched = await patchGrouped('group_picks', groupUpdates);
  const knockoutPatched = await patchGrouped('knockout_picks', knockoutUpdates);

  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    pools: pools.length,
    groupPicks: groupPicks.length,
    knockoutPicks: knockoutPicks.length,
    groupPicksRepaired: groupPatched,
    knockoutPicksRepaired: knockoutPatched,
    affectedPools: changedPoolIds.size
  }, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('repair-pick-multipliers fatal:', err);
    process.exit(1);
  });
}

module.exports = { main, expectedMultiplier, sameNumber };
