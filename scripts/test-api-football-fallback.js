// Test: API-Football fallback transforms only exact, final fixtures.
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

ok('finds exact fixture', !!F.findMatchingFixture(db, [wrongFixture, finalFixture]).match);
ok('rejects non-matching fixture', !F.findMatchingFixture(db, [wrongFixture]).match);

eq('builds final update', F.buildUpdateFromApiFixture(transformed, '2026-06-11T21:00:00Z').update, {
  home_score: 1,
  away_score: 1,
  status: 'FINISHED',
  winner_code: null,
  last_updated: '2026-06-11T21:00:00Z'
});

ok('does not build update from live fixture',
  !F.buildUpdateFromApiFixture(F.transformApiFootballFixture(liveFixture)).update);

console.log('\nAPI-Football fallback tests passed');
