#!/usr/bin/env node
// Verifies that public leaderboard snapshots match the canonical users table.
// This runs after scoring/export jobs so stale or truncated leaderboard data fails
// loudly before users keep seeing old scores.

const fs = require('fs');
const path = require('path');
const { assertQaIfRequested } = require('./qa-env');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
assertQaIfRequested();
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.PUBLIC_DATA_DIR
  ? path.resolve(ROOT, process.env.PUBLIC_DATA_DIR)
  : path.join(ROOT, 'public-data');
const LB_DIR = path.join(DATA_DIR, 'leaderboard');
const REST_PAGE_SIZE = 1000;
const PUBLIC_BASE_URL = String(process.env.SCORING_SNAPSHOT_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
const PUBLIC_RETRIES = Math.max(1, parseInt(process.env.SCORING_SNAPSHOT_PUBLIC_RETRIES || '', 10) || 1);
const PUBLIC_RETRY_MS = Math.max(0, parseInt(process.env.SCORING_SNAPSHOT_PUBLIC_RETRY_MS || '', 10) || 0);
const POOL_QUERY_BATCH_SIZE = Math.max(1, parseInt(process.env.SCORING_SNAPSHOT_POOL_QUERY_BATCH_SIZE || '', 10) || 50);
const REQUIRE_SCORE_HEARTBEAT_AFTER_RESULT =
  process.env.SCORING_REQUIRE_SCORE_HEARTBEAT_AFTER_RESULT === '1' ||
  process.env.SCORING_REQUIRE_SCORE_HEARTBEAT_AFTER_RESULT === 'true';
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

function csvList(value) {
  return String(value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function requestedLeaderboardPoolIds() {
  if (process.env.FORCE_ALL_LEADERBOARD_SNAPSHOTS === '1') return [];
  return [...new Set(csvList(process.env.LEADERBOARD_POOL_IDS || process.env.SCORING_SNAPSHOT_POOL_IDS))];
}

function postgrestInFilter(values) {
  return `in.(${values.map(v => encodeURIComponent(v)).join(',')})`;
}

function chunks(values, size = POOL_QUERY_BATCH_SIZE) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
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

async function loadRequestedPoolsAndUsers(poolIds) {
  if (!poolIds.length) {
    const [pools, users] = await Promise.all([
      sbAll('pools', '?select=id'),
      sbAll('users', `?select=${SAFE_USER_COLS}&order=total_score.desc.nullslast,id.asc`)
    ]);
    return { pools, users };
  }

  const pools = poolIds.map(id => ({ id }));
  const users = [];
  for (const batch of chunks(poolIds)) {
    users.push(...await sbAll(
      'users',
      `?select=${SAFE_USER_COLS}&pool_id=${postgrestInFilter(batch)}&order=total_score.desc.nullslast,id.asc`
    ));
  }
  return { pools, users };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function localMatchesResultVersion() {
  try {
    const payload = readJson(path.join(DATA_DIR, 'matches.json'));
    return payload && payload.result_version || null;
  } catch (_) {
    return null;
  }
}

function timestampMs(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function scoreableResultRows(payload) {
  const matches = Array.isArray(payload && payload.matches) ? payload.matches : [];
  return matches.filter(match => {
    const status = String(match && match.status || '').toUpperCase();
    return (status === 'FINISHED' || status === 'AWARDED')
      && match.home_score != null
      && match.away_score != null;
  });
}

function localLatestScoreableResultUpdateMs() {
  try {
    const payload = readJson(path.join(DATA_DIR, 'matches.json'));
    let latest = NaN;
    for (const match of scoreableResultRows(payload)) {
      const candidate = Math.max(
        timestampMs(match.source_updated_at),
        timestampMs(match.last_updated),
        timestampMs(match.match_date)
      );
      if (Number.isFinite(candidate) && (!Number.isFinite(latest) || candidate > latest)) latest = candidate;
    }
    return latest;
  } catch (_) {
    return NaN;
  }
}

function userRequiresScoreHeartbeat(user, cutoffMs) {
  if (!Number.isFinite(cutoffMs)) return false;
  const joinedMs = timestampMs(user && user.joined_at);
  return !Number.isFinite(joinedMs) || joinedMs <= cutoffMs;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function verifyPoolSnapshot(label, poolId, dbUsers, snapshot, opts = {}) {
  const errors = [];
  const standings = Array.isArray(snapshot && snapshot.standings) ? snapshot.standings : [];
  if (opts.resultVersion && snapshot && snapshot.result_version !== opts.resultVersion) {
    errors.push(`${label} pool ${poolId} result_version mismatch: expected=${opts.resultVersion} snapshot=${snapshot.result_version || 'missing'}`);
  }
  if (opts.requirePointsState && snapshot && snapshot.points_state !== 'current_for_result_version') {
    errors.push(`${label} pool ${poolId} points_state mismatch: expected=current_for_result_version snapshot=${snapshot.points_state || 'missing'}`);
  }
  if (standings.length !== dbUsers.length) {
    errors.push(`${label} pool ${poolId} count mismatch: db=${dbUsers.length} snapshot=${standings.length}`);
  }

  const byId = new Map();
  const seenSnapshotIds = new Set();
  for (const user of standings) {
    if (!user || !user.id) continue;
    if (seenSnapshotIds.has(user.id)) {
      errors.push(`${label} pool ${poolId} duplicate user ${user.id} in snapshot`);
      continue;
    }
    seenSnapshotIds.add(user.id);
    byId.set(user.id, user);
  }
  let verifiedUsers = 0;
  let nonZeroUsers = 0;
  let poolTotal = 0;
  for (const dbUser of dbUsers) {
    const snapUser = byId.get(dbUser.id);
    if (!snapUser) {
      errors.push(`${label} pool ${poolId} missing user ${dbUser.id} in snapshot`);
      continue;
    }
    if (!rowsMatch(dbUser, snapUser)) {
      errors.push(`${label} pool ${poolId} user ${dbUser.id} score mismatch: db=${JSON.stringify(comparableScoreRow(dbUser))} snapshot=${JSON.stringify(comparableScoreRow(snapUser))}`);
    }
    if (opts.scoreFreshAfterMs && userRequiresScoreHeartbeat(dbUser, opts.scoreFreshAfterMs)) {
      const scoreMs = timestampMs(dbUser.last_score_calc);
      if (!Number.isFinite(scoreMs) || scoreMs < opts.scoreFreshAfterMs) {
        errors.push(`${label} pool ${poolId} user ${dbUser.id} last_score_calc stale: expected>=${new Date(opts.scoreFreshAfterMs).toISOString()} actual=${dbUser.last_score_calc || 'missing'}`);
      }
    }
    const total = scoreNumber(dbUser.total_score);
    poolTotal += total;
    if (total > 0) nonZeroUsers++;
    verifiedUsers++;
  }

  return {
    errors,
    verifiedUsers,
    nonZeroUsers,
    nonZeroPool: poolTotal > 0,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return await res.json();
}

function publicLeaderboardUrl(poolId) {
  const sep = PUBLIC_BASE_URL.includes('?') ? '&' : '?';
  return `${PUBLIC_BASE_URL}/public-data/leaderboard/${encodeURIComponent(poolId)}.json${sep}cb=${Date.now()}`;
}

function publicMatchesUrl() {
  const sep = PUBLIC_BASE_URL.includes('?') ? '&' : '?';
  return `${PUBLIC_BASE_URL}/public-data/matches.json${sep}cb=${Date.now()}`;
}

async function verifyPublicSnapshots(pools, usersByPool, expectedResultVersion = null) {
  if (!PUBLIC_BASE_URL) return { errors: [], verifiedPools: 0, verifiedUsers: 0 };
  let lastErrors = [];
  let lastVerifiedPools = 0;
  let lastVerifiedUsers = 0;

  for (let attempt = 1; attempt <= PUBLIC_RETRIES; attempt++) {
    const errors = [];
    let verifiedPools = 0;
    let verifiedUsers = 0;
    let publicResultVersion = null;
    try {
      const publicMatches = await fetchJson(publicMatchesUrl());
      publicResultVersion = publicMatches && publicMatches.result_version || null;
      if (expectedResultVersion && publicResultVersion !== expectedResultVersion) {
        errors.push(`public matches result_version mismatch: expected=${expectedResultVersion} snapshot=${publicResultVersion || 'missing'}`);
      }
    } catch (err) {
      errors.push(`public matches fetch failed: ${err.message}`);
    }

    for (const pool of pools) {
      const dbUsers = usersByPool.get(pool.id) || [];
      if (!dbUsers.length) continue;
      let snapshot;
      try {
        snapshot = await fetchJson(publicLeaderboardUrl(pool.id));
      } catch (err) {
        errors.push(`public pool ${pool.id} fetch failed: ${err.message}`);
        continue;
      }
      const checked = verifyPoolSnapshot('public', pool.id, dbUsers, snapshot, {
        resultVersion: publicResultVersion || expectedResultVersion,
        requirePointsState: !!(publicResultVersion || expectedResultVersion),
        scoreFreshAfterMs: REQUIRE_SCORE_HEARTBEAT_AFTER_RESULT ? localLatestScoreableResultUpdateMs() : null,
      });
      errors.push(...checked.errors);
      verifiedPools++;
      verifiedUsers += checked.verifiedUsers;
    }

    lastErrors = errors;
    lastVerifiedPools = verifiedPools;
    lastVerifiedUsers = verifiedUsers;
    if (!errors.length) break;
    if (attempt < PUBLIC_RETRIES && PUBLIC_RETRY_MS > 0) await sleep(PUBLIC_RETRY_MS);
  }

  return { errors: lastErrors, verifiedPools: lastVerifiedPools, verifiedUsers: lastVerifiedUsers };
}

async function main() {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY');
  const poolIds = requestedLeaderboardPoolIds();

  const { pools, users } = await loadRequestedPoolsAndUsers(poolIds);

  const usersByPool = new Map();
  for (const user of users) {
    if (!user.pool_id) continue;
    if (!usersByPool.has(user.pool_id)) usersByPool.set(user.pool_id, []);
    usersByPool.get(user.pool_id).push(user);
  }

  const errors = [];
  const resultVersion = localMatchesResultVersion();
  const scoreFreshAfterMs = REQUIRE_SCORE_HEARTBEAT_AFTER_RESULT ? localLatestScoreableResultUpdateMs() : null;
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

    const checked = verifyPoolSnapshot('local', pool.id, dbUsers, snapshot, {
      resultVersion,
      requirePointsState: !!resultVersion,
      scoreFreshAfterMs,
    });
    errors.push(...checked.errors);
    verifiedUsers += checked.verifiedUsers;
    nonZeroUsers += checked.nonZeroUsers;
    if (checked.nonZeroPool) nonZeroPools++;
    verifiedPools++;
  }

  let publicVerifiedPools = 0;
  let publicVerifiedUsers = 0;
  if (!errors.length && PUBLIC_BASE_URL) {
    const publicResult = await verifyPublicSnapshots(pools, usersByPool, resultVersion);
    publicVerifiedPools = publicResult.verifiedPools;
    publicVerifiedUsers = publicResult.verifiedUsers;
    errors.push(...publicResult.errors);
  }

  console.log(JSON.stringify({
    requestedPools: poolIds.length ? poolIds.length : 'all',
    verifiedPools,
    verifiedUsers,
    nonZeroPools,
    nonZeroUsers,
    resultVersion,
    scoreFreshAfter: Number.isFinite(scoreFreshAfterMs) ? new Date(scoreFreshAfterMs).toISOString() : null,
    publicVerifiedPools,
    publicVerifiedUsers,
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
    requestedLeaderboardPoolIds,
    verifyPoolSnapshot,
    verifyPublicSnapshots,
    localMatchesResultVersion,
    timestampMs,
    userRequiresScoreHeartbeat,
    rowsMatch,
    scoreNumber,
    sbAll,
    chunks,
    loadRequestedPoolsAndUsers,
    __setFetch: (fn) => { globalThis.fetch = fn; },
  };
}
