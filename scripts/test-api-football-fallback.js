// Test: external result fallback transforms only exact, final fixtures and
// requires consensus before updating.
// Run: node scripts/test-api-football-fallback.js

process.env.FOOTBALL_DATA_TOKEN = 'test';
process.env.API_FOOTBALL_KEY = 'test';
process.env.PROD_ANON_KEY = 'test';

const F = require('./api-football-fallback.js');

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

const finalFixture = {
  fixture: { id: 123, date: '2026-06-11T19:00:00+00:00', status: { short: 'FT' } },
  teams: {
    home: { name: 'Mexico', winner: false },
    away: { name: 'South Africa', winner: false }
  },
  goals: { home: 1, away: 1 }
};

const liveFixture = {
  ...finalFixture,
  fixture: { id: 123, date: '2026-06-11T19:00:00+00:00', status: { short: '2H' } },
  goals: { home: 1, away: 0 }
};

const wrongFixture = {
  ...finalFixture,
  teams: {
    home: { name: 'Canada', winner: true },
    away: { name: 'South Africa', winner: false }
  }
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

const transformed = F.transformApiFootballFixture(finalFixture);
eq('transform final fixture', {
  homeCode: transformed.homeCode,
  awayCode: transformed.awayCode,
  statusShort: transformed.statusShort,
  homeScore: transformed.homeScore,
  awayScore: transformed.awayScore,
  winnerCode: transformed.winnerCode
}, {
  homeCode: 'MEX',
  awayCode: 'RSA',
  statusShort: 'FT',
  homeScore: 1,
  awayScore: 1,
  winnerCode: null
});

ok('finds exact fixture', !!F.findMatchingFixture(db, [wrongFixture, finalFixture], F.transformApiFootballFixture).match);
ok('rejects non-matching fixture', !F.findMatchingFixture(db, [wrongFixture], F.transformApiFootballFixture).match);

eq('builds final update', F.buildUpdateFromApiFixture(transformed, '2026-06-11T21:00:00Z').update, {
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

ok('does not build update from live fixture',
  !F.buildUpdateFromApiFixture(F.transformApiFootballFixture(liveFixture)).update);

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

const apiUpdate = F.buildUpdateFromApiFixture(transformed, '2026-06-11T21:00:00Z').update;
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
ok('two agreeing sources produce consensus', !!F.consensusUpdate([
  { source: 'api-football', update: apiUpdate },
  { source: 'espn', update: espnUpdate }
], 2).update);
ok('conflicting sources do not produce consensus', !F.consensusUpdate([
  { source: 'api-football', update: apiUpdate },
  { source: 'espn', update: { ...espnUpdate, away_score: 2 } }
], 2).update);

console.log('\nExternal result fallback tests passed');
