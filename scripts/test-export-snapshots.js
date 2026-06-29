#!/usr/bin/env node
// Deterministic tests for public snapshot sanitization. No network, no DB.

const assert = require('assert');
const Export = require('./export-snapshots');
const { isPendingProviderFinal, sanitizeMatchForSnapshot } = Export;

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok: ${name}`);
}

check('clean verified final removes public live residue', () => {
  const raw = {
    id: 'm1',
    status: 'FINISHED',
    match_date: '2026-06-23T09:00:00Z',
    home_score: 2,
    away_score: 0,
    winner_code: 'MEX',
    live_clock: "90'+5'",
    live_period: 2,
    live_source: 'espn',
    status_detail: 'Full Time',
    source_updated_at: '2026-06-23T11:01:00Z',
  };
  const clean = sanitizeMatchForSnapshot(raw);
  assert.strictEqual(clean.live_clock, null);
  assert.strictEqual(clean.live_period, null);
  assert.strictEqual(clean.live_source, null);
  assert.strictEqual(clean.status_detail, null);
  assert.strictEqual(clean.source_updated_at, raw.source_updated_at);
  assert.strictEqual(raw.live_source, 'espn');
});

check('pending provider final keeps residue for verifier and watchdog', () => {
  const pending = {
    id: 'm2',
    status: 'FINISHED',
    home_score: 1,
    away_score: 0,
    winner_code: 'USA',
    live_source: 'espn-final',
    status_detail: 'ESPN final pending verification',
  };
  const clean = sanitizeMatchForSnapshot(pending);
  assert.strictEqual(isPendingProviderFinal(clean), true);
  assert.strictEqual(clean.live_source, 'espn-final');
  assert.strictEqual(clean.status_detail, 'ESPN final pending verification');
});

check('live match keeps live fields', () => {
  const live = {
    id: 'm3',
    status: 'IN_PLAY',
    home_score: 1,
    away_score: 1,
    live_clock: "63'",
    live_period: 2,
    live_source: 'espn',
    status_detail: "63'",
  };
  assert.deepStrictEqual(sanitizeMatchForSnapshot(live), live);
});

check('scheduled match remains unchanged', () => {
  const scheduled = {
    id: 'm4',
    status: 'TIMED',
    match_date: '2026-06-24T19:00:00Z',
    home_score: null,
    away_score: null,
    status_detail: null,
  };
  assert.deepStrictEqual(sanitizeMatchForSnapshot(scheduled), scheduled);
});

check('leaderboard pool filter parses CLI and env safely', () => {
  assert.deepStrictEqual(Export.requestedLeaderboardPoolIds(['leaderboards', '--pool-ids=p1,p2'], {}), ['p1', 'p2']);
  assert.deepStrictEqual(Export.requestedLeaderboardPoolIds(['leaderboards'], { LEADERBOARD_POOL_IDS: 'p3, p4' }), ['p3', 'p4']);
  assert.strictEqual(Export.requestedLeaderboardPoolIds(['leaderboards'], {}), null);
  assert.strictEqual(Export.requestedLeaderboardPoolIds(['leaderboards'], { LEADERBOARD_POOL_IDS: '' }), null);
  assert.deepStrictEqual(Export.requestedLeaderboardPoolIds(['leaderboards', '--pool-ids='], {}), []);
});

check('leaderboard pool filter uses PostgREST in syntax', () => {
  assert.strictEqual(Export.postgrestInFilter('pool_id', ['p1', 'p2']), 'pool_id=in.(p1,p2)');
});

(async () => {
  console.log('\n== integration: export sbAll paginates beyond 100 pages ==');
  const ranges = [];
  Export.__setFetch(async (_url, opts) => {
    const range = opts.headers.Range;
    ranges.push(range);
    const [fromText] = range.split('-');
    const from = Number(fromText);
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: from + i }));
    return {
      ok: true,
      json: async () => (from < 100000 ? fullPage : [{ id: 100000 }])
    };
  });
  const rows = await Export.sbAll('users', '?select=id');
  assert.strictEqual(rows.length, 100001);
  assert.strictEqual(ranges.includes('100000-100999'), true);
  passed++;
  console.log('ok: export sbAll fetches page 101 instead of truncating at 100k rows');

  console.log(`\nExport snapshot tests passed: ${passed}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
