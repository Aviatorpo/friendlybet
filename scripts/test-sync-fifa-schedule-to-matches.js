#!/usr/bin/env node

const assert = require('assert');
const bridge = require('./sync-fifa-schedule-to-matches');

const scheduleMatch = {
  fifa_match_id: '400021516',
  match_number: 76,
  stage: 'ROUND_OF_32',
  group_letter: null,
  match_date: '2026-06-29T17:00:00Z',
  status: 'SCHEDULED',
  home_team_code: 'BRA',
  away_team_code: 'JPN',
  home_score: null,
  away_score: null,
  venue: 'Miami Stadium'
};

{
  const row = bridge.normalizeScheduleRow(scheduleMatch);
  assert.strictEqual(row.external_id, '400021516');
  assert.strictEqual(row.stage, 'ROUND_OF_32');
  assert.strictEqual(row.home_team_code, 'BRA');
  assert.strictEqual(row.away_team_code, 'JPN');
  assert.strictEqual(row.status, 'SCHEDULED');
  assert.strictEqual(row.winner_code, null);
}

{
  const finished = bridge.normalizeScheduleRow({
    ...scheduleMatch,
    status: 'FINISHED',
    home_score: 0,
    away_score: 1
  });
  assert.strictEqual(finished.status, 'FINISHED');
  assert.strictEqual(finished.home_score, 0);
  assert.strictEqual(finished.away_score, 1);
  assert.strictEqual(finished.winner_code, 'JPN');
  assert.strictEqual(finished.live_source, 'fifa-schedule');
}

{
  const missing = bridge.imminentKnownMissing(
    [scheduleMatch],
    [],
    { now: new Date('2026-06-29T04:00:00Z'), failMissingKnownWithinHours: 36 }
  );
  assert.strictEqual(missing.length, 1, 'known upcoming schedule fixture missing from DB must fail bridge gate');
}

{
  const missing = bridge.imminentKnownMissing(
    [scheduleMatch],
    [{ external_id: '400021516', home_team_code: 'BRA', away_team_code: 'JPN' }],
    { now: new Date('2026-06-29T04:00:00Z'), failMissingKnownWithinHours: 36 }
  );
  assert.strictEqual(missing.length, 0, 'fixture present in scoring DB passes bridge gate');
}

{
  const missing = bridge.imminentKnownMissing(
    [scheduleMatch],
    [{ external_id: '400021516', home_team_code: null, away_team_code: null }],
    { now: new Date('2026-06-29T04:00:00Z'), failMissingKnownWithinHours: 36 }
  );
  assert.strictEqual(missing.length, 1, 'placeholder fixture must not satisfy scoreable known fixture gate');
}

{
  const placeholder = bridge.normalizeScheduleRow({
    ...scheduleMatch,
    fifa_match_id: '400021530',
    home_team_code: 'CAN',
    away_team_code: null,
    stage: 'ROUND_OF_16'
  }, { includePlaceholders: true });
  assert.strictEqual(placeholder.external_id, '400021530');
  assert.strictEqual(placeholder.home_team_code, 'CAN');
  assert.strictEqual(placeholder.away_team_code, null);
}

{
  const staleScheduled = bridge.normalizeScheduleRow({
    ...scheduleMatch,
    fifa_match_id: '400021517',
    status: 'SCHEDULED',
    home_score: null,
    away_score: null
  });
  const merged = bridge.mergeScheduleRowWithExisting(staleScheduled, {
    external_id: '400021517',
    home_team_code: 'RSA',
    away_team_code: 'CAN',
    home_score: 0,
    away_score: 2,
    status: 'FINISHED',
    winner_code: 'CAN',
    live_source: 'manual-verifier',
    source_updated_at: '2026-06-29T02:00:00.000Z'
  });
  assert.strictEqual(merged.status, 'FINISHED', 'stale schedule must not downgrade terminal DB result');
  assert.strictEqual(merged.home_score, 0);
  assert.strictEqual(merged.away_score, 2);
  assert.strictEqual(merged.winner_code, 'CAN');
  assert.strictEqual(merged.live_source, 'manual-verifier');
}

console.log('sync fifa schedule to matches tests passed');
