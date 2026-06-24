#!/usr/bin/env node
// Verifies that public leaderboard snapshots match the canonical users table.
// This runs after scoring/export jobs so stale or truncated leaderboard data fails
// loudly before users keep seeing old scores.

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const ROOT = path.resolve(__dirname, '..');
const LB_DIR = path.join(ROOT, 'public-data', 'leaderboard');
const REST_PAGE_SIZE = 1000;
const SAFE_USER_COLS = [
  'id', 'pool_id', 'nickname', 'total_score',
  'group_points', 'knockout_points', 'bonus_points',
  'groups_score', 'knockout_score', 'bonus_score',
  'predictions_submitted_at', 'joined_at', 'last_score_calc'
].join(',');

function scoreNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function comparableScoreRow(row) {
  return {
    total_score: scoreNumber(row.total_score),
    group_points: scoreNumber(row.group_points ?? row.groups_score),
    knockout_points: scoreNumber(row.knockout_points ?? row.knockout_score),
    bonus_points: scoreNumber(row.bonus_points ?? row.bonus_score),
  };
}

function rowsMatch(dbUser, snapshotUser) {
  const db = comparableScoreRow(dbUser);
  const snap = comparableScoreRow(snapshotUser);
  return db.total_score === snap.total_score
    && db.group_points === snap.group_points
    && db.knockout_points === snap.knockout_points
    && db.bonus_points === snap.bonus_points;
}

async function main() {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY');

  const [pools, users] = await Promise.all([
    sbAll('pools', '?select=id'),
    sbAll('users', `?select=${SAFE_USER_COLS}&order=total_score.desc.nullslast`)
  ]);

  const usersByPool = new Map();
  for (const user of users) {
    if (!user.pool_id) continue;
    if (!usersByPool.has(user.pool_id)) usersByPool.set(user.pool_id, []);
    usersByPool.get(user.pool_id).push(user);
  }

  const errors = [];
  let verifiedPools = 0;
  let verifiedUsers = 0;
  let nonZeroPools = 0;
  let nonZeroUsers = 0;

  for (const pool of pools) {
    const dbUsers = usersByPool.get(pool.id) || [];
    if (!dbUsers.length) continue;

    const file = path.join(LB_DIR, `${pool.id}.json`);
    if (!fs.existsSync(file)) {
      errors.push(`missing leaderboard snapshot for pool ${pool.id} (${dbUsers.length} users)`);
      continue;
    }

    let snapshot;
    try {
      snapshot = readJson(file);
    } catch (err) {
      errors.push(`invalid leaderboard snapshot for pool ${pool.id}: ${err.message}`);
      continue;
    }

    const standings = Array.isArray(snapshot.standings) ? snapshot.standings : [];
    if (standings.length !== dbUsers.length) {
      errors.push(`pool ${pool.id} count mismatch: db=${dbUsers.length} snapshot=${standings.length}`);
    }

    const byId = new Map(standings.map(user => [user.id, user]));
    let poolTotal = 0;
    for (const dbUser of dbUsers) {
      const snapUser = byId.get(dbUser.id);
      if (!snapUser) {
        errors.push(`pool ${pool.id} missing user ${dbUser.id} in snapshot`);
        continue;
      }
      if (!rowsMatch(dbUser, snapUser)) {
        errors.push(`pool ${pool.id} user ${dbUser.id} score mismatch: db=${JSON.stringify(comparableScoreRow(dbUser))} snapshot=${JSON.stringify(comparableScoreRow(snapUser))}`);
      }
      const total = scoreNumber(dbUser.total_score);
      poolTotal += total;
      if (total > 0) nonZeroUsers++;
      verifiedUsers++;
    }
    if (poolTotal > 0) nonZeroPools++;
    verifiedPools++;
  }

  console.log(JSON.stringify({
    verifiedPools,
    verifiedUsers,
    nonZeroPools,
    nonZeroUsers,
    errors: errors.slice(0, 20),
    errorCount: errors.length
  }, null, 2));

  if (errors.length) {
    throw new Error(`scoring snapshot verification failed with ${errors.length} error(s)`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
} else {
  module.exports = {
    comparableScoreRow,
    rowsMatch,
    scoreNumber,
    sbAll,
    __setFetch: (fn) => { globalThis.fetch = fn; },
  };
}
