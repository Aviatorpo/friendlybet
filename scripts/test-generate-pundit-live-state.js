const assert = require('assert');
const pundit = require('./generate-pundit');

function match(overrides) {
  return {
    id: 'm1',
    status: 'TIMED',
    match_date: '2026-06-23T11:00:00Z',
    home_team_code: 'NED',
    away_team_code: 'SWE',
    stage: 'GROUP_STAGE',
    group_letter: 'F',
    home_score: null,
    away_score: null,
    ...overrides,
  };
}

const now = new Date('2026-06-23T12:00:00Z');

{
  const staleScheduled = match();
  assert.strictEqual(pundit.shouldTreatAsLive(staleScheduled, now), false, 'Stale TIMED row must not become live commentary');
  assert.strictEqual(pundit.shouldTreatAsVerification(staleScheduled, now), true, 'Stale TIMED row must become verification commentary');
  const items = pundit.build(now, { matchesPayload: { matches: [staleScheduled] }, newsPayload: { items: [] } });
  assert.ok(items.some(item => item.type === 'verification' && item.id === 'verify-m1'), 'Feed should include verification item for stale TIMED row');
  assert.ok(!items.some(item => item.type === 'live' && item.id === 'live-m1'), 'Feed must not include live item for stale TIMED row');
  assert.ok(!items.some(item => item.type === 'fixture' && item.id === 'fixture-m1'), 'Feed must not include fixture item for stale TIMED row');
}

{
  const kickoffGrace = match({ id: 'm2', match_date: '2026-06-23T11:40:00Z' });
  assert.strictEqual(pundit.shouldTreatAsLive(kickoffGrace, now), false, 'TIMED row inside kickoff grace should stay silent, not inferred live');
  assert.strictEqual(pundit.shouldTreatAsVerification(kickoffGrace, now), false, 'TIMED row inside kickoff grace is not stale yet');
  const items = pundit.build(now, { matchesPayload: { matches: [kickoffGrace] }, newsPayload: { items: [] } });
  assert.ok(!items.some(item => item.id === 'live-m2'), 'Kickoff-grace TIMED row must not produce live commentary');
  assert.ok(!items.some(item => item.id === 'verify-m2'), 'Kickoff-grace TIMED row must not produce verification commentary yet');
}

{
  const actualLive = match({ id: 'm3', status: 'IN_PLAY', match_date: '2026-06-23T11:50:00Z' });
  assert.strictEqual(pundit.shouldTreatAsLive(actualLive, now), true, 'Actual live status should produce live commentary');
  const items = pundit.build(now, { matchesPayload: { matches: [actualLive] }, newsPayload: { items: [] } });
  assert.ok(items.some(item => item.type === 'live' && item.id === 'live-m3'), 'Feed should include live item for actual live status');
}

{
  const pendingFinal = match({
    id: 'm4',
    status: 'FINISHED',
    match_date: '2026-06-23T10:00:00Z',
    home_score: 1,
    away_score: 0,
    live_source: 'espn-final',
    status_detail: 'ESPN final pending verification',
  });
  assert.strictEqual(pundit.isPendingProviderFinal(pendingFinal), true, 'ESPN final residue must be detected');
  assert.strictEqual(pundit.shouldTreatAsVerification(pendingFinal, now), true, 'Provider-pending final must become verification commentary');
  const items = pundit.build(now, { matchesPayload: { matches: [pendingFinal] }, newsPayload: { items: [] } });
  assert.ok(items.some(item => item.type === 'verification' && item.id === 'verify-m4'), 'Feed should include verification item for pending final');
  assert.ok(!items.some(item => item.type === 'result' && item.id === 'result-m4'), 'Pending provider final must not become result commentary');
}

console.log('Pundit live-state generation tests passed');
