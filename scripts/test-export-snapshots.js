#!/usr/bin/env node
// Deterministic tests for public snapshot sanitization. No network, no DB.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Export = require('./export-snapshots');
const {
  isPendingProviderFinal,
  sanitizeMatchForSnapshot,
  dedupeMatchesForSnapshot,
  resultPublicationMetadata,
  resultVersionFromMatches,
  writeIfChanged,
} = Export;

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
  assert.strictEqual(Export.requestedLeaderboardPoolIds(['leaderboards'], { LEADERBOARD_POOL_IDS: 'p3', FORCE_ALL_LEADERBOARD_SNAPSHOTS: '1' }), null);
  assert.strictEqual(Export.requestedLeaderboardPoolIds(['leaderboards'], {}), null);
  assert.strictEqual(Export.requestedLeaderboardPoolIds(['leaderboards'], { LEADERBOARD_POOL_IDS: '' }), null);
  assert.deepStrictEqual(Export.requestedLeaderboardPoolIds(['leaderboards', '--pool-ids='], {}), []);
});

check('leaderboard pool filter uses PostgREST in syntax', () => {
  assert.strictEqual(Export.postgrestInFilter('pool_id', ['p1', 'p2']), 'pool_id=in.(p1,p2)');
});

check('match export uses public allowlist, not select=*', () => {
  assert.ok(Export.SAFE_MATCH_COLS.includes('winner_code'));
  assert.ok(Export.SAFE_MATCH_COLS.includes('stage'));
  assert.ok(!Export.SAFE_MATCH_COLS.includes('*'));
  assert.ok(!Export.SAFE_MATCH_COLS.includes('latest_consensus'));
  assert.ok(!Export.SAFE_MATCH_COLS.includes('raw_payload'));
});

check('deduped match snapshot prefers official enriched fixture row', () => {
  const legacy = {
    id: 'old',
    external_id: '537327',
    status: 'FINISHED',
    match_date: '2026-06-11T19:00:00Z',
    home_team_code: 'MEX',
    away_team_code: 'RSA',
    home_score: 2,
    away_score: 0,
    winner_code: 'MEX',
    last_updated: '2026-06-18T10:13:41Z',
  };
  const official = {
    ...legacy,
    id: 'new',
    external_id: '400021443',
    venue: 'Mexico City Stadium',
    source_updated_at: '2026-06-30T11:59:48Z',
  };
  const rows = dedupeMatchesForSnapshot([legacy, official]);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].external_id, '400021443');
});

check('result version follows scoreable match facts, not volatile timestamps', () => {
  const base = [{
    id: 'm1',
    external_id: '400021443',
    stage: 'GROUP_STAGE',
    status: 'FINISHED',
    match_date: '2026-06-11T19:00:00Z',
    home_team_code: 'MEX',
    away_team_code: 'RSA',
    home_score: 2,
    away_score: 0,
    winner_code: 'MEX',
    last_updated: '2026-06-18T10:13:41Z',
  }];
  assert.strictEqual(resultVersionFromMatches(base), resultVersionFromMatches([{ ...base[0], last_updated: '2026-06-30T11:59:48Z' }]));
  assert.notStrictEqual(resultVersionFromMatches(base), resultVersionFromMatches([{ ...base[0], away_score: 1 }]));
});

check('publication metadata marks unresolved tied knockout as pending', () => {
  const meta = resultPublicationMetadata([{
    external_id: '400021599',
    stage: 'ROUND_OF_32',
    status: 'FINISHED',
    home_team_code: 'GER',
    away_team_code: 'PAR',
    home_score: 1,
    away_score: 1,
    winner_code: null,
  }]);
  assert.strictEqual(meta.source_state, 'verification_pending');
  assert.ok(/^rv_1_/.test(meta.result_version));
});

check('writeIfChanged writes metadata-only result-version changes', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fb-export-'));
  const file = path.join(tmpDir, 'leaderboard.json');
  const first = {
    updatedAt: '2026-06-29T20:00:00Z',
    published_at: '2026-06-29T20:00:00Z',
    result_version: 'rv_a',
    standings: [{ id: 'u1', total_score: 10 }],
  };
  const second = {
    ...first,
    updatedAt: '2026-06-29T20:01:00Z',
    published_at: '2026-06-29T20:01:00Z',
  };
  const third = {
    ...second,
    result_version: 'rv_b',
  };
  assert.strictEqual(writeIfChanged(file, 'standings', first), true);
  assert.strictEqual(writeIfChanged(file, 'standings', second), false);
  assert.strictEqual(writeIfChanged(file, 'standings', third), true);
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
