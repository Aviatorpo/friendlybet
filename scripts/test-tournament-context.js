const assert = require('assert');
const {
  deriveTournamentContext,
  isTournamentMomentUsable,
  roundFromStage,
} = require('../lib/tournament-context');

const groupsComplete = { finished: 72, total: 72, completeGroups: 12, totalGroups: 12 };

function match(id, stage, status, matchDate, extra = {}) {
  return {
    id,
    stage,
    status,
    match_date: matchDate,
    home_team_code: extra.home_team_code || 'AAA',
    away_team_code: extra.away_team_code || 'BBB',
    home_score: extra.home_score == null ? 1 : extra.home_score,
    away_score: extra.away_score == null ? 0 : extra.away_score,
    winner_code: Object.prototype.hasOwnProperty.call(extra, 'winner_code') ? extra.winner_code : (extra.home_team_code || 'AAA'),
    status_detail: extra.status_detail || null,
    live_source: extra.live_source || null,
  };
}

function finishedRound(prefix, stage, total, datePrefix) {
  return Array.from({ length: total }, (_, i) => match(`${prefix}-${i + 1}`, stage, 'FINISHED', `${datePrefix}T12:00:00Z`, {
    home_team_code: `${prefix}H${i}`,
    away_team_code: `${prefix}A${i}`,
    winner_code: `${prefix}H${i}`,
  }));
}

function context(matches, now) {
  return deriveTournamentContext({ matches, groupProgress: groupsComplete, now });
}

assert.strictEqual(roundFromStage('ROUND_OF_16'), 'R16');
assert.strictEqual(roundFromStage('QUARTER_FINALS'), 'QF');
assert.strictEqual(roundFromStage('SEMI_FINALS'), 'SF');
assert.strictEqual(roundFromStage('THIRD_PLACE'), 'THIRD_PLACE');
assert.strictEqual(roundFromStage('FINAL'), 'FINAL');

{
  const matches = [
    ...finishedRound('r32', 'ROUND_OF_32', 16, '2026-07-03'),
    match('r16-1', 'ROUND_OF_16', 'FINISHED', '2026-07-04T17:00:00Z', { winner_code: 'AAA' }),
    match('r16-2', 'ROUND_OF_16', 'SCHEDULED', '2026-07-06T20:00:00Z', { home_score: null, away_score: null, winner_code: null }),
  ];
  const ctx = context(matches, '2026-07-05T12:00:00Z');
  assert.strictEqual(ctx.round, 'R16', 'R16 should be named when R32 is complete and R16 has verified activity');
  assert.strictEqual(ctx.exact, true, 'Verified R16 state should be exact');
  assert.strictEqual(ctx.dashboard.titleKey, 'dashboard.tournament.roundTitle');
}

{
  const matches = [
    ...finishedRound('r32', 'ROUND_OF_32', 16, '2026-07-03'),
    ...finishedRound('r16', 'ROUND_OF_16', 8, '2026-07-07'),
    match('qf-1', 'QUARTER_FINALS', 'SCHEDULED', '2026-07-09T20:00:00Z', { home_score: null, away_score: null, winner_code: null }),
  ];
  const ctx = context(matches, '2026-07-08T12:00:00Z');
  assert.strictEqual(ctx.round, 'QF', 'Rest day after R16 should point to the next verified scheduled round');
  assert.strictEqual(ctx.roundState, 'upcoming', 'Rest day before QF should use upcoming copy');
}

{
  const matches = [
    ...finishedRound('r32', 'ROUND_OF_32', 16, '2026-07-03'),
    ...finishedRound('r16', 'ROUND_OF_16', 8, '2026-07-07'),
    match('qf-1', 'QUARTER_FINALS', 'FINISHED', '2026-07-09T20:00:00Z', { winner_code: 'AAA' }),
    match('qf-2', 'QUARTER_FINALS', 'SCHEDULED', '2026-07-10T20:00:00Z', { home_score: null, away_score: null, winner_code: null }),
  ];
  const ctx = context(matches, '2026-07-10T12:00:00Z');
  assert.strictEqual(ctx.round, 'QF', 'QF should be current once QF results start landing');
  assert.strictEqual(ctx.roundState, 'live');
}

{
  const matches = [
    ...finishedRound('r32', 'ROUND_OF_32', 16, '2026-07-03'),
    ...finishedRound('r16', 'ROUND_OF_16', 8, '2026-07-07'),
    ...finishedRound('qf', 'QUARTER_FINALS', 4, '2026-07-11'),
    match('sf-1', 'SEMI_FINALS', 'SCHEDULED', '2026-07-14T19:00:00Z', { home_score: null, away_score: null, winner_code: null }),
  ];
  const ctx = context(matches, '2026-07-13T12:00:00Z');
  assert.strictEqual(ctx.round, 'SF', 'After QF completes, next context should be semi-finals');
  assert.strictEqual(ctx.roundState, 'upcoming');
}

{
  const matches = [
    ...finishedRound('r32', 'ROUND_OF_32', 16, '2026-07-03'),
    ...finishedRound('r16', 'ROUND_OF_16', 8, '2026-07-07'),
    ...finishedRound('qf', 'QUARTER_FINALS', 4, '2026-07-11'),
    ...finishedRound('sf', 'SEMI_FINALS', 2, '2026-07-15'),
    match('third', 'THIRD_PLACE', 'SCHEDULED', '2026-07-18T21:00:00Z', { home_score: null, away_score: null, winner_code: null }),
    match('final', 'FINAL', 'SCHEDULED', '2026-07-19T19:00:00Z', { home_score: null, away_score: null, winner_code: null }),
  ];
  const third = context(matches, '2026-07-18T22:00:00Z');
  assert.strictEqual(third.round, 'THIRD_PLACE', 'Third-place match should get its own stage');
  const final = context([
    ...matches.slice(0, -2),
    match('third', 'THIRD_PLACE', 'FINISHED', '2026-07-18T21:00:00Z', { winner_code: 'AAA' }),
    match('final', 'FINAL', 'SCHEDULED', '2026-07-19T19:00:00Z', { home_score: null, away_score: null, winner_code: null }),
  ], '2026-07-19T12:00:00Z');
  assert.strictEqual(final.round, 'FINAL', 'After third place, final should be next');
  assert.strictEqual(final.roundState, 'upcoming');
}

{
  const matches = [
    ...finishedRound('r32', 'ROUND_OF_32', 15, '2026-07-03'),
    match('r32-stale', 'ROUND_OF_32', 'SCHEDULED', '2026-07-03T18:00:00Z', { home_score: null, away_score: null, winner_code: null }),
    match('r16-1', 'ROUND_OF_16', 'SCHEDULED', '2026-07-05T20:00:00Z', { home_score: null, away_score: null, winner_code: null }),
  ];
  const ctx = context(matches, '2026-07-05T12:00:00Z');
  assert.strictEqual(ctx.exact, false, 'Stale earlier-round data must not produce an exact current-round claim');
  assert.strictEqual(ctx.leaderboardStatusKey, 'leaderboard.statusTournamentGeneric');
}

{
  const matches = [
    ...finishedRound('r32', 'ROUND_OF_32', 16, '2026-07-03'),
    match('r16-confirming', 'ROUND_OF_16', 'FINISHED', '2026-07-05T20:00:00Z', { home_score: 1, away_score: 1, winner_code: null }),
  ];
  const ctx = context(matches, '2026-07-05T22:30:00Z');
  assert.strictEqual(ctx.round, 'R16');
  assert.strictEqual(ctx.roundState, 'confirming', 'Finished knockout tie without winner_code must use confirming state');
  assert.strictEqual(ctx.dashboard.titleKey, 'dashboard.tournament.confirmingTitle');
}

{
  const usable = isTournamentMomentUsable(
    { schema_version: 1, round: 'R16', result_version: 'rv1', expires_at: '2026-07-05T12:15:00Z' },
    { result_version: 'rv1' },
    '2026-07-05T12:00:00Z'
  );
  assert.strictEqual(usable, true, 'Fresh matching tournament moment should be usable');
  const expired = isTournamentMomentUsable(
    { schema_version: 1, round: 'R16', result_version: 'rv1', expires_at: '2026-07-05T11:59:00Z' },
    { result_version: 'rv1' },
    '2026-07-05T12:00:00Z'
  );
  assert.strictEqual(expired, false, 'Expired tournament moment must be rejected');
  const mismatch = isTournamentMomentUsable(
    { schema_version: 1, round: 'R16', result_version: 'rv1', expires_at: '2026-07-05T12:15:00Z' },
    { result_version: 'rv2' },
    '2026-07-05T12:00:00Z'
  );
  assert.strictEqual(mismatch, false, 'Moment with a mismatched result version must be rejected');
}

console.log('test-tournament-context: ok');
