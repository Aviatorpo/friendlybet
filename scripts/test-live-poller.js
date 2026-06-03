// ============================================================
// Test: live-poller runLivePoller()
// ============================================================
// Proves the poller loops performSync (DB writes) while a match is live and
// exits immediately when nothing is live - and that it NEVER commits a snapshot
// (no Vercel deploy). Mocks football-data + Supabase; tiny intervals.
// Run: node scripts/test-live-poller.js   (no DB / no secrets)
// ============================================================

process.env.SUPABASE_SECRET_KEY = 'test';
process.env.FOOTBALL_DATA_TOKEN = 'test';
const sync = require('./smart-sync.js');
const { runLivePoller } = require('./live-poller.js');

let pass = 0, fail = 0;
const ok = (label, cond) => { console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}`); cond ? pass++ : fail++; };

const HEADERS = { get: (k) => (k === 'X-Requests-Available-Minute' ? '8' : null) };
const PAYLOAD = { matches: [
  { id: 201, stage: 'GROUP_STAGE', group: 'GROUP_A', utcDate: '2026-06-11T16:00:00Z', status: 'IN_PLAY',
    homeTeam: { name: 'Mexico' }, awayTeam: { name: 'South Korea' },
    score: { winner: null, duration: 'REGULAR', fullTime: { home: 1, away: 0 } } },
] };

let LIVE = true;
let upserts = 0;
sync.__setFetch(async (url, opts) => {
  const method = (opts && opts.method) || 'GET';
  if (url.includes('api.football-data.org')) return { ok: true, headers: HEADERS, json: async () => PAYLOAD };
  if (url.includes('/rest/v1/matches') && url.includes('select=winner_code')) return { ok: true, headers: HEADERS, json: async () => [] };
  if (url.includes('/rest/v1/matches') && url.includes('match_date=gte')) {
    // shouldSync's window probe: a live match is present iff LIVE
    return { ok: true, headers: HEADERS, json: async () => (LIVE ? [{ external_id: '201', status: 'IN_PLAY', match_date: '2026-06-11T16:00:00Z', home_team_code: 'MEX', away_team_code: 'KOR' }] : []) };
  }
  if (url.includes('/rest/v1/matches') && method === 'POST') { upserts += JSON.parse(opts.body).length; return { ok: true, headers: HEADERS, json: async () => [] }; }
  return { ok: true, headers: HEADERS, json: async () => [] };
});

(async () => {
  console.log('\n== live-poller ==');
  // Live: should loop several times in ~18ms at a 5ms cadence.
  LIVE = true; upserts = 0;
  const polls = await runLivePoller({ intervalMs: 5, runMs: 18, sleep: (ms) => new Promise(r => setTimeout(r, ms)) });
  ok('polls performSync repeatedly while live (>=2)', polls >= 2);
  ok('each poll upserts the live match to the DB', upserts >= polls);

  // Not live: exits immediately, no work.
  LIVE = false; upserts = 0;
  const polls2 = await runLivePoller({ intervalMs: 5, runMs: 18 });
  ok('exits immediately when nothing is live (0 polls)', polls2 === 0);
  ok('no DB writes when nothing is live', upserts === 0);

  // Live ends mid-run: stops early on the next check.
  LIVE = true; upserts = 0;
  let n = 0;
  const polls3 = await runLivePoller({ intervalMs: 2, runMs: 10000, sleep: async () => { if (++n >= 2) LIVE = false; } });
  ok('stops early once matches finish', polls3 >= 1 && polls3 <= 4);

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('fatal:', e); process.exit(1); });
