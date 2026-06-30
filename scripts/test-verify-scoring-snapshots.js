// Test: scoring snapshot verifier row comparison and pool filtering.
// Run: node scripts/test-verify-scoring-snapshots.js

const V = require('./verify-scoring-snapshots.js');

function ok(name, cond) {
  if (!cond) {
    console.error('FAIL:', name);
    process.exit(1);
  }
  console.log('ok:', name);
}

function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error(`FAIL: ${name}\n  got:  ${g}\n  want: ${w}`);
    process.exit(1);
  }
  console.log('ok:', name);
}

const dbUser = {
  id: 'user-1',
  total_score: 8,
  group_points: 5,
  knockout_points: 2,
  bonus_points: 1
};

ok('matching score rows pass', V.rowsMatch(dbUser, {
  id: 'user-1',
  total_score: 8,
  groups_score: 5,
  knockout_score: 2,
  bonus_score: 1
}));

ok('mismatching score rows fail', !V.rowsMatch(dbUser, {
  id: 'user-1',
  total_score: 9,
  group_points: 5,
  knockout_points: 2,
  bonus_points: 1
}));

eq('pool snapshot verifier reports exact mismatch', V.verifyPoolSnapshot('local', 'pool-1', [dbUser], {
  standings: [{ ...dbUser, total_score: 9 }]
}).errors, [
  'local pool pool-1 user user-1 score mismatch: db={"total_score":8,"group_points":5,"knockout_points":2,"bonus_points":1} snapshot={"total_score":9,"group_points":5,"knockout_points":2,"bonus_points":1}'
]);

eq('pool snapshot verifier rejects duplicate users', V.verifyPoolSnapshot('local', 'pool-1', [dbUser], {
  standings: [dbUser, dbUser]
}).errors, [
  'local pool pool-1 count mismatch: db=1 snapshot=2',
  'local pool pool-1 duplicate user user-1 in snapshot'
]);

eq('pool snapshot verifier rejects stale result version metadata', V.verifyPoolSnapshot('local', 'pool-1', [dbUser], {
  result_version: 'rv_old',
  points_state: 'current_for_result_version',
  standings: [dbUser]
}, { resultVersion: 'rv_new', requirePointsState: true }).errors, [
  'local pool pool-1 result_version mismatch: expected=rv_new snapshot=rv_old'
]);

eq('pool snapshot verifier requires current points state when versioned', V.verifyPoolSnapshot('local', 'pool-1', [dbUser], {
  result_version: 'rv_new',
  points_state: 'updating',
  standings: [dbUser]
}, { resultVersion: 'rv_new', requirePointsState: true }).errors, [
  'local pool pool-1 points_state mismatch: expected=current_for_result_version snapshot=updating'
]);

process.env.LEADERBOARD_POOL_IDS = ' pool-a,pool-b,pool-a ';
delete process.env.FORCE_ALL_LEADERBOARD_SNAPSHOTS;
eq('requested pool ids are deduplicated and trimmed', V.requestedLeaderboardPoolIds(), ['pool-a', 'pool-b']);
process.env.FORCE_ALL_LEADERBOARD_SNAPSHOTS = '1';
eq('force-all snapshot verification ignores requested pool ids', V.requestedLeaderboardPoolIds(), []);
delete process.env.FORCE_ALL_LEADERBOARD_SNAPSHOTS;

(async () => {
  const urls = [];
  V.__setFetch(async (url) => {
    urls.push(url);
    return { ok: true, json: async () => [] };
  });
  await V.loadRequestedPoolsAndUsers(Array.from({ length: 55 }, (_, i) => `pool-${i}`));
  const userUrls = urls.filter(url => url.includes('/rest/v1/users?'));
  eq('large pool verification fetches users in batches', userUrls.length, 2);
  ok('first user batch excludes pool 50', userUrls[0].includes('pool-49') && !userUrls[0].includes('pool-50'));
  ok('second user batch starts at pool 50', userUrls[1].includes('pool-50'));

  console.log('\nScoring snapshot verifier tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
