// Test: ESPN/FIFA final-result verifier transforms only exact, final fixtures and
// requires consensus before updating.
// Run: node scripts/test-final-result-verifier.js

process.env.PROD_ANON_KEY = 'test';

const F = require('./final-result-verifier.js');

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

const db = {
  external_id: '537327',
  home_team_code: 'MEX',
  away_team_code: 'RSA',
  status: 'TIMED',
  match_date: '2026-06-11T19:00:00Z'
};

const espnFinal = {
  id: '760415',
  date: '2026-06-11T19:00Z',
  competitions: [{
    startDate: '2026-06-11T19:00Z',
    status: { type: { name: 'STATUS_FINAL', state: 'post', completed: true } },
    competitors: [
      { homeAway: 'home', score: '1', winner: false, team: { displayName: 'Mexico', abbreviation: 'MEX' } },
      { homeAway: 'away', score: '1', winner: false, team: { displayName: 'South Africa', abbreviation: 'RSA' } }
    ]
  }]
};

const espnLive = {
  ...espnFinal,
  competitions: [{
    ...espnFinal.competitions[0],
    status: { type: { name: 'STATUS_SECOND_HALF', state: 'in', completed: false } }
  }]
};

const fifaFinal = {
  IdMatch: '400021443',
  Date: '2026-06-11T19:00:00Z',
  MatchStatus: 0,
  Home: { IdCountry: 'MEX', IdTeam: '43911', Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'Mexico' }] },
  Away: { IdCountry: 'RSA', IdTeam: '111', Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'South Africa' }] },
  Winner: null
};

ok('stuck candidate after age threshold', F.isStuckCandidate(db, Date.parse('2026-06-11T21:10:00Z')));
ok('not stuck before age threshold', !F.isStuckCandidate(db, Date.parse('2026-06-11T20:00:00Z')));
ok('finished match with complete clean result is not stuck',
  !F.isStuckCandidate({ ...db, status: 'FINISHED', home_score: 1, away_score: 1 }, Date.parse('2026-06-11T21:10:00Z')));
ok('finished match missing score is still recoverable',
  F.isStuckCandidate({ ...db, status: 'FINISHED', home_score: null, away_score: null }, Date.parse('2026-06-11T21:10:00Z')));
ok('finished match with live residue is still recoverable',
  F.isStuckCandidate({ ...db, status: 'FINISHED', home_score: 1, away_score: 1, live_clock: "90'+4'" }, Date.parse('2026-06-11T21:10:00Z')));

const espnTransformed = F.transformEspnEvent(espnFinal);
eq('transform ESPN final event', {
  homeCode: espnTransformed.homeCode,
  awayCode: espnTransformed.awayCode,
  statusShort: espnTransformed.statusShort,
  homeScore: espnTransformed.homeScore,
  awayScore: espnTransformed.awayScore,
  winnerCode: espnTransformed.winnerCode
}, {
  homeCode: 'MEX',
  awayCode: 'RSA',
  statusShort: 'FT',
  homeScore: 1,
  awayScore: 1,
  winnerCode: null
});

ok('finds exact ESPN fixture', !!F.findMatchingFixture(db, [espnFinal], F.transformEspnEvent).match);
ok('rejects non-matching ESPN fixture', !F.findMatchingFixture(db, [{
  ...espnFinal,
  competitions: [{
    ...espnFinal.competitions[0],
    competitors: [
      { homeAway: 'home', score: '1', winner: true, team: { displayName: 'Canada', abbreviation: 'CAN' } },
      { homeAway: 'away', score: '1', winner: false, team: { displayName: 'South Africa', abbreviation: 'RSA' } }
    ]
  }]
}], F.transformEspnEvent).match);

eq('builds final update', F.buildUpdateFromVerifiedFixture(espnTransformed, '2026-06-11T21:00:00Z').update, {
  home_score: 1,
  away_score: 1,
  status: 'FINISHED',
  winner_code: null,
  live_clock: null,
  live_period: null,
  status_detail: null,
  live_source: null,
  source_updated_at: '2026-06-11T21:00:00Z',
  last_updated: '2026-06-11T21:00:00Z'
});

ok('does not build update from ESPN live event',
  !F.buildUpdateFromVerifiedFixture(F.transformEspnEvent(espnLive)).update);

eq('fetches adjacent ESPN scoreboard dates for late UTC kickoff',
  F.espnScoreboardDatesFor([{ match_date: '2026-06-12T02:00:00.000Z' }]),
  ['20260611', '20260612', '20260613']);

eq('accepts ESPN abbreviation fallback when display name is missing',
  F.normalizeTeamCode(null, 'KOR'),
  'KOR');

const fifaTransformed = F.transformFifaMatch(fifaFinal);
eq('transform FIFA final match', {
  homeCode: fifaTransformed.homeCode,
  awayCode: fifaTransformed.awayCode,
  statusShort: fifaTransformed.statusShort,
  homeScore: fifaTransformed.homeScore,
  awayScore: fifaTransformed.awayScore,
  winnerCode: fifaTransformed.winnerCode
}, {
  homeCode: 'MEX',
  awayCode: 'RSA',
  statusShort: 'FT',
  homeScore: 1,
  awayScore: 1,
  winnerCode: null
});

const espnUpdate = F.buildUpdateFromVerifiedFixture(espnTransformed, '2026-06-11T21:00:00Z').update;
const fifaUpdate = F.buildUpdateFromVerifiedFixture(fifaTransformed, '2026-06-11T21:00:00Z').update;
ok('ESPN alone is not enough by default', !F.consensusUpdate([{ source: 'espn', update: espnUpdate }]).update);
ok('ESPN alone is enough only with explicit emergency override', !!F.consensusUpdate([
  { source: 'espn', update: espnUpdate }
], { minSources: 1, requiredSources: [] }).update);
ok('ESPN + FIFA agreeing produce the default consensus', !!F.consensusUpdate([
  { source: 'espn', update: espnUpdate },
  { source: 'fifa', update: fifaUpdate }
]).update);
ok('conflicting sources do not produce consensus', !F.consensusUpdate([
  { source: 'fifa', update: fifaUpdate },
  { source: 'espn', update: { ...espnUpdate, away_score: 2 } }
], 2).update);
ok('unresolved checked candidates require operational attention',
  F.needsResultAttention({ checked: 2, updated: 1, skipped: 1 }));
ok('clean verifier run does not require operational attention',
  !F.needsResultAttention({ checked: 2, updated: 2, skipped: 0 }));
ok('provider unavailability requires operational attention',
  F.needsResultAttention({ checked: 0, updated: 0, skipped: 0, unavailable: true }));

console.log('\nFinal result verifier tests passed');
