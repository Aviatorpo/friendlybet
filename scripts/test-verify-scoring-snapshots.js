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

process.env.LEADERBOARD_POOL_IDS = ' pool-a,pool-b,pool-a ';
eq('requested pool ids are deduplicated and trimmed', V.requestedLeaderboardPoolIds(), ['pool-a', 'pool-b']);

console.log('\nScoring snapshot verifier tests passed');
