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
const EN_FIXTURE_CONSEQUENCE = /\b(table|tables|group|prediction|predictions|predictors|pool|pools|pick|picks|picked|safe|sweating|points|qualify|qualification|places)\b/i;
const HE_FIXTURE_CONSEQUENCE = /(?:בית|בתים|תחזית|תחזיות|הימור|הימורים|נקודות|מקום|מקומות|עלייה|טבלה)/u;

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
  const finalPreKickoffBuffer = match({ id: 'm-buffer', match_date: '2026-06-23T12:10:00Z' });
  const items = pundit.build(now, { matchesPayload: { matches: [finalPreKickoffBuffer] }, newsPayload: { items: [] } });
  assert.ok(!items.some(item => item.id === 'fixture-m-buffer'), 'Feed must drop fixture commentary during the final pre-kickoff buffer');
}

{
  const fixtures = [
    match({ id: 'm-favorite-1', match_date: '2026-06-23T14:00:00Z', home_team_code: 'BRA', away_team_code: 'HAI' }),
    match({ id: 'm-favorite-2', match_date: '2026-06-23T14:10:00Z', home_team_code: 'MAR', away_team_code: 'ARG' }),
    match({ id: 'm-neutral', match_date: '2026-06-23T14:20:00Z', home_team_code: 'QAT', away_team_code: 'BIH' }),
  ];
  const items = pundit.build(now, { matchesPayload: { matches: fixtures }, newsPayload: { items: [] } })
    .filter(item => item.type === 'fixture');
  assert.ok(items.length >= 3, 'Future fixtures should produce fixture commentary');
  for (const item of items) {
    assert.ok(EN_FIXTURE_CONSEQUENCE.test(item.en), `${item.id} English fixture copy must include table/picks/pool consequence`);
    assert.ok(HE_FIXTURE_CONSEQUENCE.test(item.he), `${item.id} Hebrew fixture copy must include table/picks/pool consequence`);
  }
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

{
  const groups = {
    A: ['MEX', 'RSA', 'KOR', 'CZE'],
    B: ['CAN', 'BIH', 'QAT', 'SUI'],
    C: ['BRA', 'MAR', 'HAI', 'SCO'],
    D: ['USA', 'PAR', 'AUS', 'TUR'],
    E: ['GER', 'CUR', 'CIV', 'ECU'],
    F: ['NED', 'JPN', 'SWE', 'TUN'],
    G: ['BEL', 'EGY', 'IRN', 'NZL'],
    H: ['ESP', 'CPV', 'SAU', 'URU'],
    I: ['FRA', 'SEN', 'IRQ', 'NOR'],
    J: ['ARG', 'ALG', 'AUT', 'JOR'],
    K: ['POR', 'COD', 'UZB', 'COL'],
    L: ['ENG', 'CRO', 'GHA', 'PAN'],
  };
  const completeMatches = [];
  let idx = 0;
  for (const [group, teams] of Object.entries(groups)) {
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        completeMatches.push(match({
          id: `complete-${group}-${i}-${j}`,
          status: 'FINISHED',
          match_date: `2026-06-27T${String(idx % 24).padStart(2, '0')}:00:00Z`,
          group_letter: group,
          home_team_code: teams[i],
          away_team_code: teams[j],
          home_score: 1,
          away_score: 0,
          winner_code: teams[i],
        }));
        idx += 1;
      }
    }
  }
  const phaseNow = new Date('2026-06-28T06:00:00Z');
  assert.strictEqual(pundit.allGroupsComplete(completeMatches), true, 'All 12 complete groups must be detected');
  const items = pundit.build(phaseNow, { matchesPayload: { matches: completeMatches }, newsPayload: { items: [] } });
  const phase = items.find(item => item.id === 'phase-groups-complete-knockout-open');
  assert.ok(phase, 'Feed should include a group-complete knockout-open phase item');
  assert.ok(phase.en.includes('Group points are official') && phase.en.includes('bracket is the story now'), 'Phase item must anchor the feed to the current knockout story');
  assert.ok(phase.en.includes('two-phase') && phase.en.includes('one-phase'), 'Phase item must not claim the knockout window is open for every pool mode');
  assert.ok(phase.en.includes('June 28') && phase.en.includes('08:00 PM'), 'Phase item must include the exact first-knockout deadline');
  const knockoutWindow = items.find(item => item.id === 'phase-knockout-window');
  assert.ok(knockoutWindow, 'Feed should include a two-phase/knockout window card');
  assert.deepStrictEqual(knockoutWindow.mode_scopes, ['two_phase', 'late_knockout'], 'Knockout-window card must be hidden from one-phase pools');
  assert.ok(items.filter(item => item.type === 'phase').length >= 4, 'Post-groups feed should be a phase-aware desk, not one token line');
  assert.ok(!items.some(item => item.type === 'result'), 'Post-groups feed must not rotate old group-stage result cards');
}

console.log('Pundit live-state generation tests passed');
