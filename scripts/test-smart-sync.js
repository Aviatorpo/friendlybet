// ============================================================
// Test: smart-sync shouldSync() live-window logic
// ============================================================
// Proves a live match is detected for its WHOLE duration (the old +/-15min
// window only caught the first ~15 min after kickoff, freezing live scores).
// The mock emulates the DB's match_date range filter from the query string.
// Run: node scripts/test-smart-sync.js   (no DB / no secrets)
// ============================================================

process.env.SUPABASE_SECRET_KEY = 'test';
process.env.FOOTBALL_DATA_TOKEN = 'test';
const S = require('./smart-sync.js');

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = got === want;
  console.log(`${ok ? '✓' : '✗ FAIL'}  ${label}  got=${got}${ok ? '' : ` want=${want}`}`);
  ok ? pass++ : fail++;
};

const NOW = Date.now();
const at = (mins) => new Date(NOW + mins * 60000).toISOString(); // mins relative to now (neg=past)
const M = (mins, status) => ({ match_date: at(mins), status, home_team_code: 'AAA', away_team_code: 'BBB', external_id: 'x' + mins });

// Install a fake fetch that emulates Supabase's match_date gte/lte filtering.
let DATASET = [];
let forceError = false;
S.__setFetch(async (url) => {
  if (forceError) return { ok: false, status: 500, text: async () => 'boom' };
  const gte = decodeURIComponent((url.match(/match_date=gte\.([^&]+)/) || [])[1] || '');
  const lte = decodeURIComponent((url.match(/match_date=lte\.([^&]+)/) || [])[1] || '');
  const lo = gte ? Date.parse(gte) : -Infinity;
  const hi = lte ? Date.parse(lte) : Infinity;
  const rows = DATASET.filter(m => { const t = Date.parse(m.match_date); return t >= lo && t <= hi; });
  return { ok: true, json: async () => rows };
});

async function check(label, dataset, expected, opts = {}) {
  DATASET = dataset; forceError = !!opts.error;
  const got = await S.shouldSync();
  eq(label, got, expected);
  forceError = false;
}

(async () => {
  console.log('\n== shouldSync live-window ==');
  // THE FIX: a match live for 30 min must still trigger a sync.
  await check('IN_PLAY, kickoff 30 min ago -> SYNC (regression: was missed)', [M(-30, 'IN_PLAY')], true);
  await check('IN_PLAY, kickoff 10 min ago -> SYNC', [M(-10, 'IN_PLAY')], true);
  await check('IN_PLAY, kickoff 100 min ago (deep in 2nd half) -> SYNC', [M(-100, 'IN_PLAY')], true);
  await check('PAUSED (halftime), kickoff 50 min ago -> SYNC', [M(-50, 'PAUSED')], true);
  await check('SCHEDULED, starts in 10 min -> SYNC (pre-warm)', [M(10, 'TIMED')], true);
  await check('SCHEDULED but kicked off 20 min ago, DB not yet IN_PLAY -> SYNC (catches missed kickoff)', [M(-20, 'TIMED')], true);

  console.log('\n== shouldSync should SKIP ==');
  await check('SCHEDULED, starts in 2h -> skip (outside window)', [M(120, 'TIMED')], false);
  await check('FINISHED, kickoff 1h ago -> skip (terminal)', [M(-60, 'FINISHED')], false);
  await check('IN_PLAY but kickoff 5h ago (stale/impossible) -> skip (outside 4h window)', [M(-300, 'IN_PLAY')], false);
  await check('no matches at all -> skip', [], false);
  await check('all matches in window FINISHED -> skip', [M(-60, 'FINISHED'), M(-30, 'FINISHED')], false);

  console.log('\n== shouldSync mixed / safety ==');
  await check('one FINISHED + one live -> SYNC', [M(-90, 'FINISHED'), M(-30, 'IN_PLAY')], true);
  await check('DB error -> SYNC anyway (fail-safe)', [M(-30, 'IN_PLAY')], true, { error: true });

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})();
