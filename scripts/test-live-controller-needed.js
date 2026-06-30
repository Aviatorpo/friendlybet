#!/usr/bin/env node
// Deterministic tests for the live-match controller preflight.

const assert = require('assert');
const ControllerNeeded = require('./live-controller-needed');

(() => {
  const nowMs = Date.parse('2026-06-30T20:00:00Z');
  const result = ControllerNeeded.summarize([
    {
      id: 1,
      status: 'SCHEDULED',
      match_date: '2026-06-30T21:00:00Z',
      home_team_code: 'FRA',
      away_team_code: 'SWE',
    },
    {
      id: 2,
      status: 'FINISHED',
      match_date: '2026-06-30T18:00:00Z',
      home_team_code: 'CIV',
      away_team_code: 'NOR',
    },
  ], nowMs);
  assert.strictEqual(result.needed, true, 'upcoming non-terminal match inside lead window should start controller');
  assert.strictEqual(result.candidates.length, 1);
  assert.ok(/FRA-SWE/.test(result.detail));

  const finishedOnly = ControllerNeeded.summarize([
    {
      id: 3,
      status: 'FINISHED',
      match_date: '2026-06-30T19:00:00Z',
      home_team_code: 'A',
      away_team_code: 'B',
    },
  ], nowMs);
  assert.strictEqual(finishedOnly.needed, false, 'finished-only windows should not burn long controller minutes');

  const tooFarAway = ControllerNeeded.summarize([
    {
      id: 4,
      status: 'SCHEDULED',
      match_date: '2026-06-30T22:00:01Z',
      home_team_code: 'A',
      away_team_code: 'B',
    },
  ], nowMs);
  assert.strictEqual(tooFarAway.needed, false, 'far future fixtures outside the lead window should not start controller');

  const activePastKickoff = ControllerNeeded.summarize([
    {
      id: 5,
      status: 'IN_PLAY',
      match_date: '2026-06-30T18:30:00Z',
      home_team_code: 'A',
      away_team_code: 'B',
    },
  ], nowMs);
  assert.strictEqual(activePastKickoff.needed, true, 'active non-terminal match inside lookback window should start controller');

  console.log('Live controller preflight tests passed');
})();
