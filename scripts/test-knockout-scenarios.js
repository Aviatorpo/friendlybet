const assert = require('assert');
const fs = require('fs');
const path = require('path');
process.env.SCORING_VERBOSE = '0';
const G = require('./generate-knockout-scenarios.js');
const S = require('./calculate-scores-v2.js');

function testTargetSelection() {
  const matches = [
    { id: 'g1', stage: 'GROUP_STAGE', home_team_code: 'BRA', away_team_code: 'JPN' },
    { id: 'm1', external_id: 'ext-1', stage: 'R16', home_team_code: 'BRA', away_team_code: 'JPN' },
    { id: 'm2', stage: 'R16', home_team_code: 'GER', away_team_code: 'PAR' },
  ];
  const found = G.findTargetMatches(matches, ['JPN-BRA', 'GER-PAR']);
  assert.deepStrictEqual(found.map(m => m.id), ['m1', 'm2']);
  assert.strictEqual(G.matchIdentity(found[0]), 'external:ext-1');
}

function testAutoTargetSelection() {
  const now = new Date('2026-06-30T12:00:00Z');
  const matches = [
    { id: 'g1', stage: 'GROUP_STAGE', status: 'TIMED', match_date: '2026-06-30T18:00:00Z', home_team_code: 'BRA', away_team_code: 'JPN' },
    { id: 'm1', stage: 'R16', status: 'TIMED', match_date: '2026-06-30T17:00:00Z', home_team_code: 'GER', away_team_code: 'PAR' },
    { id: 'm2', stage: 'R16', status: 'TIMED', match_date: '2026-07-02T17:00:00Z', home_team_code: 'NED', away_team_code: 'MAR' },
    { id: 'm3', stage: 'R16', status: 'FINISHED', match_date: '2026-06-30T13:00:00Z', home_team_code: 'ARG', away_team_code: 'USA', winner_code: 'ARG' },
  ];
  const found = G.resolveTargetMatches(matches, [], now, { lookaheadHours: 36, maxTargets: 2 });
  assert.deepStrictEqual(found.map(m => m.id), ['m1']);
}

function testSimulationAndBaseline() {
  const target = { id: 'm1', stage: 'R16', status: 'TIMED', home_team_code: 'BRA', away_team_code: 'JPN' };
  const matches = [
    { id: 'old', stage: 'GROUP_STAGE', status: 'FINISHED', home_team_code: 'A', away_team_code: 'B' },
    target,
  ];
  const simulated = G.simulateWinner(matches, target, 'BRA');
  const simTarget = simulated.find(m => m.id === 'm1');
  assert.strictEqual(simTarget.status, 'FINISHED');
  assert.strictEqual(simTarget.winner_code, 'BRA');
  assert.strictEqual(simTarget.home_score, 1);
  assert.strictEqual(simTarget.away_score, 0);
  assert.deepStrictEqual(G.finishedIdsExcluding(simulated, simTarget), ['id:old']);
}

async function testDryRunScoringUsesPoolRulesAndMultipliers() {
  const pool = {
    id: 'pool-1',
    betting_mode: 'single_phase',
    use_multipliers: true,
    scoring_rules: {
      ...S.DEFAULT_RULES_SINGLE,
      round_of_16: 7,
      team_multipliers: { BRA: 2 },
    },
  };
  const users = [{ id: 'u1', pool_id: 'pool-1', nickname: 'Ana', joined_at: '2026-01-01T00:00:00Z', total_score: 0 }];
  const target = { id: 'm1', stage: 'R16', status: 'TIMED', home_team_code: 'BRA', away_team_code: 'JPN', winner_code: null };
  const matches = G.simulateWinner([target], target, 'BRA');
  const collectScores = [];
  await S.scoreSinglePhasePool(pool, pool.scoring_rules, users, matches, new Map(), null, {
    groupState: S.buildGroupState(matches),
    pickIndexes: {
      groupPositionByUser: new Map(),
      knockoutByUser: new Map([['u1', [{ user_id: 'u1', bracket_position: 17, predicted_winner: 'BRA' }]]]),
      thirdPlaceByUser: new Map(),
    },
    heartbeat: false,
    collectScores,
    scenarioTimestamp: '2026-06-29T00:00:00Z',
  });
  assert.strictEqual(collectScores.length, 1);
  assert.strictEqual(collectScores[0].knockout_points, 14);
  assert.strictEqual(collectScores[0].total_score, 14);
  assert.strictEqual(collectScores[0].recovery_code_hash, undefined);
}

function testClientGuardSource() {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(app.includes('async function _applyVerifiedKnockoutScenarioUsers'), 'client must have scenario overlay helper');
  assert.ok(/_matchIsFinishedStatus\(m\) && _matchResolvedWinner\(m\)/.test(app), 'client scenario must require a resolved winner');
  assert.ok(app.includes('base_finished_match_ids'), 'client scenario must validate the generated finished-match baseline');
  assert.ok(app.includes("loadResultsData({ force: true, preferDb: true })"), 'score surfaces must refresh verified DB match state');
  assert.ok(app.includes('_applyVerifiedKnockoutScenarioUsers(state.currentPool.id, users)'), 'leaderboard must apply verified scenario rows');
}

(async () => {
  testTargetSelection();
  testAutoTargetSelection();
  testSimulationAndBaseline();
  await testDryRunScoringUsesPoolRulesAndMultipliers();
  testClientGuardSource();
  console.log('Knockout scenario tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
