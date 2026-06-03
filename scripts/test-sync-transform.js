// ============================================================
// Test: smart-sync performSync() transform + upsert
// ============================================================
// Proves the API payload -> DB row transform is correct: team-name mapping,
// group_letter parsing, status passthrough, fullTime scores, winner_code
// (incl. penalty shootout via score.winner), and that unmapped/TBD matches are
// dropped (never upserted). Mocks both the football-data fetch and Supabase.
// Run: node scripts/test-sync-transform.js   (no DB / no secrets)
// ============================================================

process.env.SUPABASE_SECRET_KEY = 'test';
process.env.FOOTBALL_DATA_TOKEN = 'test';
const S = require('./smart-sync.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}`); cond ? pass++ : fail++; };

// Realistic football-data /competitions/WC/matches payload.
const PAYLOAD = { matches: [
  { id: 101, stage: 'GROUP_STAGE', group: 'GROUP_A', utcDate: '2026-06-11T16:00:00Z', status: 'FINISHED',
    homeTeam: { name: 'Mexico' }, awayTeam: { name: 'South Korea' },
    score: { winner: 'HOME_TEAM', duration: 'REGULAR', fullTime: { home: 2, away: 1 } } },
  // Knockout decided on PENALTIES: fullTime tied, winner is the shootout winner.
  { id: 102, stage: 'LAST_32', group: null, utcDate: '2026-07-01T19:00:00Z', status: 'FINISHED',
    homeTeam: { name: 'Brazil' }, awayTeam: { name: 'Croatia' },
    score: { winner: 'AWAY_TEAM', duration: 'PENALTY_SHOOTOUT', fullTime: { home: 1, away: 1 }, penalties: { home: 2, away: 4 } } },
  // Live in-play match.
  { id: 103, stage: 'GROUP_STAGE', group: 'GROUP_L', utcDate: '2026-06-12T16:00:00Z', status: 'IN_PLAY',
    homeTeam: { name: 'England' }, awayTeam: { name: 'Croatia' },
    score: { winner: null, duration: 'REGULAR', fullTime: { home: 0, away: 0 } } },
  // Türkiye/Turkey + Ivory Coast naming edge.
  { id: 104, stage: 'GROUP_STAGE', group: 'GROUP_D', utcDate: '2026-06-13T16:00:00Z', status: 'TIMED',
    homeTeam: { name: 'Turkey' }, awayTeam: { name: 'United States' },
    score: { winner: null, duration: 'REGULAR', fullTime: { home: null, away: null } } },
  // TBD knockout slot - must be DROPPED (unmapped placeholder name).
  { id: 105, stage: 'FINAL', group: null, utcDate: '2026-07-19T19:00:00Z', status: 'TIMED',
    homeTeam: { name: 'Winner Semi-final 1' }, awayTeam: { name: null },
    score: { winner: null, duration: 'REGULAR', fullTime: { home: null, away: null } } },
] };

const captured = [];
const HEADERS = { get: (k) => (k === 'X-Requests-Available-Minute' ? '8' : null) }; // stub like a real Response
S.__setFetch(async (url, opts) => {
  const method = (opts && opts.method) || 'GET';
  if (url.includes('api.football-data.org')) return { ok: true, headers: HEADERS, json: async () => PAYLOAD };
  if (url.includes('/rest/v1/matches') && url.includes('select=winner_code')) return { ok: true, headers: HEADERS, json: async () => [] }; // column exists
  if (url.includes('/rest/v1/matches') && method === 'POST') { captured.push(...JSON.parse(opts.body)); return { ok: true, headers: HEADERS, json: async () => [] }; }
  return { ok: true, headers: HEADERS, json: async () => [] };
});

(async () => {
  const n = await S.performSync();
  const byId = Object.fromEntries(captured.map(r => [r.external_id, r]));

  console.log('\n== performSync transform ==');
  ok('upserts 4 valid matches (TBD dropped)', n === 4 && captured.length === 4);
  ok('TBD/unmapped match 105 dropped', !byId['105']);

  const g = byId['101'];
  ok('group: MEX vs KOR mapped', g && g.home_team_code === 'MEX' && g.away_team_code === 'KOR');
  ok('group_letter "GROUP_A" -> "A"', g && g.group_letter === 'A');
  ok('group score 2-1 + status FINISHED', g && g.home_score === 2 && g.away_score === 1 && g.status === 'FINISHED');
  ok('group winner_code HOME -> MEX', g && g.winner_code === 'MEX');

  const p = byId['102'];
  ok('penalty KO: BRA vs CRO, fullTime 1-1', p && p.home_team_code === 'BRA' && p.away_team_code === 'CRO' && p.home_score === 1 && p.away_score === 1);
  ok('penalty KO winner_code = CRO (away shootout win, NOT null)', p && p.winner_code === 'CRO');
  ok('knockout group_letter null', p && p.group_letter === null);

  const live = byId['103'];
  ok('live: status IN_PLAY, winner_code null', live && live.status === 'IN_PLAY' && live.winner_code === null);

  const tur = byId['104'];
  ok('Turkey -> TUR, USA mapped', tur && tur.home_team_code === 'TUR' && tur.away_team_code === 'USA');
  ok('null fullTime scores -> null (not 0)', tur && tur.home_score === null && tur.away_score === null);

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('fatal:', e); process.exit(1); });
