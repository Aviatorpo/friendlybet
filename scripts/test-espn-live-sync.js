// Test: ESPN live sync transforms provider clock/status safely.
// Run: node scripts/test-espn-live-sync.js

process.env.SUPABASE_SECRET_KEY = 'test';

const E = require('./espn-live-sync.js');

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log(`${cond ? 'ok' : 'FAIL'}: ${name}`);
  cond ? pass++ : fail++;
}
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error(`FAIL: ${name}\n  got:  ${g}\n  want: ${w}`);
    fail++;
  } else {
    console.log(`ok: ${name}`);
    pass++;
  }
}

const liveEvent = {
  id: '760999',
  date: '2026-06-12T19:00Z',
  competitions: [{
    startDate: '2026-06-12T19:00Z',
    status: {
      clock: 1260,
      displayClock: "21'",
      period: 1,
      type: { name: 'STATUS_FIRST_HALF', state: 'in', completed: false, shortDetail: "21'" }
    },
    competitors: [
      { homeAway: 'home', score: '1', winner: false, team: { displayName: 'Canada', abbreviation: 'CAN' } },
      { homeAway: 'away', score: '0', winner: false, team: { displayName: 'Bosnia-Herzegovina', abbreviation: 'BIH' } }
    ]
  }]
};

const transformed = E.transformEspnEvent(liveEvent);
eq('transform ESPN live event', {
  homeCode: transformed.homeCode,
  awayCode: transformed.awayCode,
  status: transformed.status,
  homeScore: transformed.homeScore,
  awayScore: transformed.awayScore,
  liveClock: transformed.liveClock,
  period: transformed.period
}, {
  homeCode: 'CAN',
  awayCode: 'BIH',
  status: 'IN_PLAY',
  homeScore: 1,
  awayScore: 0,
  liveClock: "21'",
  period: 1
});

ok('fixture match accepts same teams and kickoff',
  E.fixtureMatchesDbMatch({ home_team_code: 'CAN', away_team_code: 'BIH', match_date: '2026-06-12T19:00:00Z' }, transformed));

eq('build patch includes live display fields', E.buildPatch(transformed, {
  nowIso: '2026-06-12T19:21:00.000Z',
  includeLiveColumns: true
}), {
  status: 'IN_PLAY',
  last_updated: '2026-06-12T19:21:00.000Z',
  home_score: 1,
  away_score: 0,
  winner_code: null,
  live_clock: "21'",
  live_period: 1,
  status_detail: "21'",
  live_source: 'espn',
  source_updated_at: '2026-06-12T19:21:00.000Z'
});

const finalEvent = {
  ...liveEvent,
  competitions: [{
    ...liveEvent.competitions[0],
    status: {
      clock: 5400,
      displayClock: 'FT',
      period: 2,
      type: { name: 'STATUS_FINAL', state: 'post', completed: true, shortDetail: 'FT' }
    },
    competitors: [
      { homeAway: 'home', score: '1', winner: true, team: { displayName: 'Canada', abbreviation: 'CAN' } },
      { homeAway: 'away', score: '0', winner: false, team: { displayName: 'Bosnia-Herzegovina', abbreviation: 'BIH' } }
    ]
  }]
};

eq('build final patch keeps audit residue for verifier', E.buildPatch(E.transformEspnEvent(finalEvent), {
  nowIso: '2026-06-12T21:00:00.000Z',
  includeLiveColumns: true
}), {
  status: 'FINISHED',
  last_updated: '2026-06-12T21:00:00.000Z',
  home_score: 1,
  away_score: 0,
  winner_code: 'CAN',
  live_clock: null,
  live_period: null,
  status_detail: 'ESPN final pending verification',
  live_source: 'espn-final',
  source_updated_at: '2026-06-12T21:00:00.000Z'
});

eq('fetches adjacent ESPN scoreboard dates',
  E.espnScoreboardDatesFor([{ match_date: '2026-06-13T01:00:00.000Z' }]),
  ['20260612', '20260613', '20260614']);

console.log(`\nESPN live sync tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
