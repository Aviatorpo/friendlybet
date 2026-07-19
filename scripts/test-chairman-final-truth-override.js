#!/usr/bin/env node
// Deterministic tests for the final-night chairman break-glass override.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const O = require('./chairman-final-truth-override.js');
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok: ${name}`);
}

const ACK_ENV = {
  CHAIRMAN_FINAL_ACK: O.ACK_PHRASE,
  CHAIRMAN_FINAL_WINNER_CODE: 'ARG',
  CHAIRMAN_FINAL_HOME_SCORE: '1',
  CHAIRMAN_FINAL_AWAY_SCORE: '1',
  CHAIRMAN_FINAL_RESULT_METHOD: 'penalties',
  CHAIRMAN_FINAL_HOME_PENALTIES: '3',
  CHAIRMAN_FINAL_AWAY_PENALTIES: '4',
  CHAIRMAN_FINAL_GOLDEN_BOOT: 'messi',
  CHAIRMAN_FINAL_OPERATOR_NOTE: 'Eyal confirmed final truth',
};

const candidates = [
  {
    candidate_key: 'messi',
    player_id: 'eef85a8f-8dec-4ecc-85e8-8a731f5ed527',
    player_name: 'Lionel Messi',
    team_code: 'ARG',
  },
  {
    candidate_key: 'mbappe',
    player_id: '8c339bd2-3fc2-49f2-a755-622f406a01dc',
    player_name: 'Kylian Mbappe',
    team_code: 'FRA',
  },
];

const finalFixture = {
  external_id: '400021543',
  stage: 'FINAL',
  match_date: '2026-07-19T19:00:00+00:00',
  home_team_code: 'ESP',
  away_team_code: 'ARG',
  status: 'TIMED',
  home_score: null,
  away_score: null,
  winner_code: null,
};

check('requires explicit final truth acknowledgement', () => {
  assert.throws(
    () => O.normalizeOverrideInput({ ...ACK_ENV, CHAIRMAN_FINAL_ACK: 'NO' }, [], candidates),
    /Missing acknowledgement phrase/
  );
});

check('normalizes Messi penalty override input', () => {
  const input = O.normalizeOverrideInput(ACK_ENV, ['--apply'], candidates);
  assert.strictEqual(input.apply, true);
  assert.strictEqual(input.winnerCode, 'ARG');
  assert.strictEqual(input.homeScore, 1);
  assert.strictEqual(input.awayScore, 1);
  assert.strictEqual(input.resultMethod, 'penalties');
  assert.strictEqual(input.statusDetail, 'PEN');
  assert.strictEqual(input.homePenalties, 3);
  assert.strictEqual(input.awayPenalties, 4);
  assert.strictEqual(input.goldenBoot.player_id, candidates[0].player_id);
});

check('normalizes Mbappe by player id', () => {
  const input = O.normalizeOverrideInput({
    ...ACK_ENV,
    CHAIRMAN_FINAL_WINNER_CODE: 'ESP',
    CHAIRMAN_FINAL_HOME_SCORE: '2',
    CHAIRMAN_FINAL_AWAY_SCORE: '0',
    CHAIRMAN_FINAL_RESULT_METHOD: 'regular',
    CHAIRMAN_FINAL_HOME_PENALTIES: '',
    CHAIRMAN_FINAL_AWAY_PENALTIES: '',
    CHAIRMAN_FINAL_GOLDEN_BOOT: candidates[1].player_id,
  }, [], candidates);
  assert.strictEqual(input.goldenBoot.candidate_key, 'mbappe');
  assert.strictEqual(input.statusDetail, 'FT');
});

check('rejects non-Messi-or-Mbappe Golden Boot', () => {
  assert.throws(
    () => O.normalizeOverrideInput({ ...ACK_ENV, CHAIRMAN_FINAL_GOLDEN_BOOT: 'Haaland' }, [], candidates),
    /Golden Boot must be Messi or Mbappe/
  );
});

check('rejects decisive-score winner contradiction', () => {
  assert.throws(
    () => O.normalizeOverrideInput({
      ...ACK_ENV,
      CHAIRMAN_FINAL_WINNER_CODE: 'ARG',
      CHAIRMAN_FINAL_HOME_SCORE: '2',
      CHAIRMAN_FINAL_AWAY_SCORE: '1',
      CHAIRMAN_FINAL_RESULT_METHOD: 'regular',
      CHAIRMAN_FINAL_HOME_PENALTIES: '',
      CHAIRMAN_FINAL_AWAY_PENALTIES: '',
    }, [], candidates),
    /winner must be ESP/
  );
});

check('rejects penalty winner contradiction', () => {
  assert.throws(
    () => O.normalizeOverrideInput({
      ...ACK_ENV,
      CHAIRMAN_FINAL_WINNER_CODE: 'ARG',
      CHAIRMAN_FINAL_HOME_PENALTIES: '5',
      CHAIRMAN_FINAL_AWAY_PENALTIES: '4',
    }, [], candidates),
    /Penalty-score winner contradicts/
  );
});

check('validates exact final fixture identity and teams', () => {
  const input = O.normalizeOverrideInput(ACK_ENV, [], candidates);
  assert.strictEqual(O.validateFinalFixture(finalFixture, input), true);
  assert.throws(
    () => O.validateFinalFixture({ ...finalFixture, home_team_code: 'FRA' }, input),
    /must be ESP-ARG/
  );
  assert.throws(
    () => O.validateFinalFixture({ ...finalFixture, stage: 'SEMI_FINALS' }, input),
    /not stage FINAL/
  );
});

check('builds final match patch without user-private fields', () => {
  const input = O.normalizeOverrideInput(ACK_ENV, [], candidates);
  const patch = O.buildMatchPatch(input, '2026-07-19T22:10:00.000Z');
  assert.deepStrictEqual(Object.keys(patch).sort(), [
    'away_score',
    'home_score',
    'last_updated',
    'live_clock',
    'live_period',
    'live_source',
    'source_updated_at',
    'status',
    'status_detail',
    'winner_code',
  ].sort());
  assert.strictEqual(patch.status, 'FINISHED');
  assert.strictEqual(patch.winner_code, 'ARG');
  assert.strictEqual(patch.live_source.endsWith('chairman-final-truth'), true);
});

check('detects idempotent reapply without timestamp-only changes', () => {
  const input = O.normalizeOverrideInput(ACK_ENV, [], candidates);
  const patch = O.buildMatchPatch(input, '2026-07-19T22:10:00.000Z');
  const alreadyApplied = {
    ...finalFixture,
    home_score: 1,
    away_score: 1,
    status: 'FINISHED',
    winner_code: 'ARG',
    live_clock: null,
    live_period: null,
    status_detail: 'PEN',
    live_source: 'chairman-final-truth',
    source_updated_at: '2026-07-19T22:05:00.000Z',
    last_updated: '2026-07-19T22:05:00.000Z',
  };
  assert.deepStrictEqual(O.changedMatchFields(alreadyApplied, patch), []);
});

check('workflow requires manual Golden Boot and avoids automatic resolver', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/chairman-final-truth-override.yml'), 'utf8');
  assert.ok(workflow.includes('workflow_dispatch'), 'workflow must be manually runnable');
  assert.ok(workflow.includes(O.ACK_PHRASE), 'workflow must require the explicit acknowledgement phrase');
  assert.ok(workflow.includes('refs/heads/main'), 'workflow must refuse production override runs from non-main refs');
  assert.ok(workflow.includes('CHAIRMAN_FINAL_GOLDEN_BOOT'), 'workflow must pass the manual Golden Boot value');
  assert.ok(workflow.includes('node scripts/chairman-final-truth-override.js --apply'), 'workflow must apply through the final-specific script');
  assert.ok(!workflow.includes('resolve-final-golden-boot.js'), 'manual final truth workflow must not try to auto-resolve Golden Boot');
  assert.ok(workflow.includes('FORCE_ALL_LEADERBOARD_SNAPSHOTS'), 'workflow must publish all leaderboards for the final result version');
  assert.ok(workflow.includes('SCORING_SNAPSHOT_PUBLIC_RETRIES: 30'), 'workflow must enforce the five-minute public proof window');
});

console.log(`\nChairman final truth override tests passed: ${passed}`);
