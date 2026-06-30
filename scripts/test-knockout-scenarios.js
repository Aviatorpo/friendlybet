const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
process.env.SCORING_VERBOSE = '0';
const G = require('./generate-knockout-scenarios.js');
const S = require('./calculate-scores-v2.js');
const R = require('./knockout-scenario-readiness.js');

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

function testAutoNextSelectsOnlyFirstUnresolvedKnownKnockout() {
  const matches = [
    { id: 'group', stage: 'GROUP_STAGE', status: 'TIMED', match_date: '2026-06-29T15:00:00Z', home_team_code: 'BRA', away_team_code: 'JPN' },
    { id: 'done', stage: 'R16', status: 'FINISHED', winner_code: 'BRA', match_date: '2026-06-29T17:00:00Z', home_team_code: 'BRA', away_team_code: 'JPN' },
    { id: 'next', stage: 'R16', status: 'TIMED', match_date: '2026-06-30T17:00:00Z', home_team_code: 'GER', away_team_code: 'PAR' },
    { id: 'later', stage: 'R16', status: 'TIMED', match_date: '2026-07-01T17:00:00Z', home_team_code: 'NED', away_team_code: 'MAR' },
  ];
  assert.strictEqual(G.shouldAutoSelectNext([]), true);
  assert.strictEqual(G.shouldAutoSelectNext(['auto-next']), true);
  assert.strictEqual(G.shouldAutoSelectNext(['GER-PAR']), false);
  assert.strictEqual(G.findNextScenarioMatch(matches).id, 'next');
  assert.deepStrictEqual(G.findTargetMatches(matches, ['auto-next']).map(m => m.id), ['next']);
}

function testAutoNextDoesNotSkipEarlierUnresolvedFixture() {
  const matches = [
    { id: 'done', stage: 'R16', status: 'FINISHED', winner_code: 'BRA', match_date: '2026-06-29T17:00:00Z', home_team_code: 'BRA', away_team_code: 'JPN' },
    { id: 'unknown-side', stage: 'R16', status: 'TIMED', match_date: '2026-06-30T16:00:00Z', home_team_code: 'ESP', away_team_code: null },
    { id: 'next', stage: 'R16', status: 'TIMED', match_date: '2026-06-30T17:00:00Z', home_team_code: 'GER', away_team_code: 'PAR' },
  ];
  assert.strictEqual(G.findNextScenarioMatch(matches), null);
  assert.deepStrictEqual(G.findTargetMatches(matches, ['auto-next']), []);
}

function testAutoNextDoesNotSkipEarlierPendingFinal() {
  const matches = [
    { id: 'pending', stage: 'R16', status: 'FINISHED', winner_code: 'BRA', live_source: 'espn-final', status_detail: 'ESPN final pending verification', match_date: '2026-06-30T16:00:00Z', home_team_code: 'BRA', away_team_code: 'JPN' },
    { id: 'next', stage: 'R16', status: 'TIMED', match_date: '2026-06-30T17:00:00Z', home_team_code: 'GER', away_team_code: 'PAR' },
  ];
  assert.strictEqual(G.findNextScenarioMatch(matches), null);
  assert.deepStrictEqual(G.findTargetMatches(matches, ['auto-next']), []);
}

function testAutoNextIgnoresThirdPlacePlayoff() {
  const matches = [
    { id: 'third', stage: 'THIRD_PLACE', status: 'TIMED', match_date: '2026-07-18T17:00:00Z', home_team_code: 'BRA', away_team_code: 'GER' },
    { id: 'final', stage: 'FINAL', status: 'TIMED', match_date: '2026-07-19T17:00:00Z', home_team_code: 'ARG', away_team_code: 'FRA' },
  ];
  assert.strictEqual(G.isKnockoutStage(matches[0]), false);
  assert.strictEqual(G.findNextScenarioMatch(matches).id, 'final');
  assert.deepStrictEqual(G.findTargetMatches(matches, ['auto-next']).map(m => m.id), ['final']);
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
  assert.strictEqual(collectScores[0].recovery_code, undefined);
  assert.strictEqual(collectScores[0].password, undefined);
  assert.strictEqual(collectScores[0].email, undefined);
}

function testClientGuardSource() {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '..', 'i18n.js'), 'utf8');
  assert.ok(app.includes('async function _applyVerifiedKnockoutScenarioUsers'), 'client must have scenario overlay helper');
  assert.ok(/_matchIsFinishedStatus\(m\) && _matchResolvedWinner\(m\)/.test(app), 'client scenario must require a resolved winner');
  assert.ok(app.includes('base_finished_match_ids'), 'client scenario must validate the generated finished-match baseline');
  assert.ok(app.includes("fetch('/public-data/knockout-scenarios/manifest.json', { cache: 'no-store' })"), 'client must not use cached scenario manifest data');
  assert.ok(app.includes("fetch(url, { cache: 'no-store' })"), 'client must not use cached scenario leaderboard data');
  assert.ok(app.includes('String(payload.pool_id || \'\') !== String(poolId)'), 'client must validate scenario pool id');
  assert.ok(app.includes('String(payload.winner_code || \'\') !== String(candidate.winnerCode)'), 'client must validate scenario winner');
  assert.ok(app.includes('_scenarioStandingsMatchCurrentUsers(payload.standings, currentUsers)'), 'client must reject scenario rows for a stale user set');
  assert.ok(app.includes("loadResultsData({ force: true, preferDb: true })"), 'score surfaces must refresh verified DB match state');
  assert.ok(app.includes('_applyVerifiedKnockoutScenarioUsers(state.currentPool.id, users)'), 'leaderboard must apply verified scenario rows');
  assert.ok(i18n.includes('Finalizing official data - showing the last official standings'), 'leaderboard pending-result message must say last official standings');
  assert.ok(i18n.includes('For now, the points shown are the last official standings'), 'dashboard pending-result message must say last official standings');
  assert.ok(i18n.includes('Theoretical table only'), 'projection UI must be clearly labeled theoretical');
  assert.ok(i18n.includes('No projection points are counted'), 'projection UI must say projected points do not count');
}

function testScenarioReadinessGate() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-scenario-ready-'));
  try {
    const match = {
      id: 'm-next',
      external_id: 'ext-next',
      stage: 'R16',
      status: 'TIMED',
      match_date: '2026-06-30T17:00:00Z',
      home_team_code: 'GER',
      away_team_code: 'PAR',
    };
    const entry = {
      scenario_key: 'ext-next',
      match,
      winners: ['GER', 'PAR'],
      GER_pool_count: 1,
      PAR_pool_count: 1,
    };
    fs.mkdirSync(path.join(tmp, 'ext-next', 'GER'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'ext-next', 'PAR'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'ext-next', 'GER', 'pool-1.json'), '{}');
    fs.writeFileSync(path.join(tmp, 'ext-next', 'PAR', 'pool-1.json'), '{}');

    const ready = R.evaluateReadiness([match], { matches: [entry] }, {
      scenarioDir: tmp,
      now: new Date('2026-06-30T12:00:00Z'),
      failWithinHours: 24,
    });
    assert.strictEqual(ready.ok, true);
    assert.strictEqual(ready.status, 'ready');

    fs.unlinkSync(path.join(tmp, 'ext-next', 'PAR', 'pool-1.json'));
    const missingNear = R.evaluateReadiness([match], { matches: [entry] }, {
      scenarioDir: tmp,
      now: new Date('2026-06-30T12:00:00Z'),
      failWithinHours: 24,
    });
    assert.strictEqual(missingNear.ok, false);
    assert.strictEqual(missingNear.status, 'missing_scenario_files');

    const missingFar = R.evaluateReadiness([match], { matches: [] }, {
      scenarioDir: tmp,
      now: new Date('2026-06-20T12:00:00Z'),
      failWithinHours: 24,
    });
    assert.strictEqual(missingFar.ok, true);
    assert.strictEqual(missingFar.status, 'missing_manifest_entry');

    const blocked = R.evaluateReadiness([
      { id: 'unknown', stage: 'R16', status: 'TIMED', match_date: '2026-06-30T16:00:00Z', home_team_code: 'ESP', away_team_code: null },
      match,
    ], { matches: [entry] }, {
      scenarioDir: tmp,
      now: new Date('2026-06-30T12:00:00Z'),
      failWithinHours: 24,
    });
    assert.strictEqual(blocked.ok, false);
    assert.strictEqual(blocked.status, 'blocked');
    assert.match(blocked.blocker, /missing one or both teams/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  testTargetSelection();
  testAutoNextSelectsOnlyFirstUnresolvedKnownKnockout();
  testAutoNextDoesNotSkipEarlierUnresolvedFixture();
  testAutoNextDoesNotSkipEarlierPendingFinal();
  testAutoNextIgnoresThirdPlacePlayoff();
  testSimulationAndBaseline();
  await testDryRunScoringUsesPoolRulesAndMultipliers();
  testClientGuardSource();
  testScenarioReadinessGate();
  console.log('Knockout scenario tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
