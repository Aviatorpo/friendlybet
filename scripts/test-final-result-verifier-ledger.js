// Test: final-result verifier can combine one current source with a fresh
// ledger observation from another source, then write new audit rows.
// Run: node scripts/test-final-result-verifier-ledger.js

process.env.SUPABASE_SECRET_KEY = 'test-service-key';
process.env.RESULT_FALLBACK_SOURCES = 'espn';
process.env.RESULT_FALLBACK_SOURCE_MODE = 'all';
process.env.RESULT_FALLBACK_MIN_SOURCES = '2';
process.env.RESULT_FALLBACK_REQUIRED_SOURCES = 'espn,fifa';
process.env.RESULT_FALLBACK_LEDGER_WRITE_DRY_RUN = '1';

const F = require('./final-result-verifier.js');

function fail(name, detail) {
  console.error('FAIL:', name);
  if (detail) console.error(detail);
  process.exit(1);
}

function ok(name, cond) {
  if (!cond) fail(name);
  console.log('ok:', name);
}

function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) fail(name, `  got:  ${g}\n  want: ${w}`);
  console.log('ok:', name);
}

const stuckMatch = {
  external_id: '537327',
  home_team_code: 'MEX',
  away_team_code: 'RSA',
  status: 'TIMED',
  match_date: '2026-06-11T19:00:00Z',
  home_score: null,
  away_score: null,
  winner_code: null,
  live_clock: null,
  live_period: null,
  status_detail: null,
  live_source: null
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

const ledgerRows = [{
  match_external_id: '537327',
  source: 'fifa',
  source_family: 'official:fifa',
  source_id: '400021443',
  observed_at: '2026-06-11T21:02:00.000Z',
  state: 'confirmed_result',
  status: 'FINISHED',
  home_score: 1,
  away_score: 1,
  winner_code: null,
  fixture_date: '2026-06-11T19:00:00.000Z',
  reason: null,
  update: null
}];

const writes = [];
const patches = [];

F.__setFetch(async (url, options = {}) => {
  const textUrl = String(url);
  const method = options.method || 'GET';
  if (textUrl.includes('/rest/v1/matches') && method === 'GET') {
    return {
      ok: true,
      text: async () => JSON.stringify([stuckMatch])
    };
  }
  if (textUrl.includes('/rest/v1/matches') && method === 'PATCH') {
    patches.push(JSON.parse(options.body || '{}'));
    return {
      ok: true,
      text: async () => '[]'
    };
  }
  if (textUrl.includes('/rest/v1/result_verification_observations') && method === 'GET') {
    return {
      ok: true,
      text: async () => JSON.stringify(ledgerRows)
    };
  }
  if (textUrl.includes('/rest/v1/result_verification_') && method === 'POST') {
    writes.push({
      url: textUrl,
      body: JSON.parse(options.body || '[]')
    });
    return {
      ok: true,
      text: async () => '[]'
    };
  }
  if (textUrl.includes('site.api.espn.com')) {
    return {
      ok: true,
      json: async () => ({ events: textUrl.includes('20260611') ? [espnFinal] : [] })
    };
  }
  fail('unexpected fetch', textUrl);
});

F.verifyFinalResults({ apply: true, now: new Date('2026-06-11T21:10:00Z') })
  .then(result => {
    eq('ledger-assisted apply run reaches consensus', {
      checked: result.checked,
      updated: result.updated,
      skipped: result.skipped,
      selected: result.report.selected_sources,
      ledgerRead: result.report.ledger.read,
      action: result.report.candidates[0].action,
      states: result.report.candidates[0].observations.map(item => `${item.source}:${item.state}`),
      families: result.report.candidates[0].consensus.agreeing_sources.map(item => item.family),
      verifiedUpdatedAt: result.report.candidates[0].verified_update.source_updated_at,
      patchUpdatedAt: patches[0] && patches[0].source_updated_at,
    }, {
      checked: 1,
      updated: 1,
      skipped: 0,
      selected: ['espn'],
      ledgerRead: { ok: true, rows: 1, ttl_minutes: 180 },
      action: 'applied',
      states: ['fifa:ledger_confirmed_result', 'espn:confirmed_result'],
      families: ['official:fifa', 'scoreboard:espn'],
      verifiedUpdatedAt: '2026-06-11T21:10:00.000Z',
      patchUpdatedAt: '2026-06-11T21:10:00.000Z',
    });
    ok('match result is patched once', patches.length === 1);
    ok('candidate and observation rows are written', writes.length === 2);
    ok('new current-source observation is written without duplicating ledger rows',
      writes.some(write => write.url.includes('/result_verification_observations') && write.body.length === 1 && write.body[0].source === 'espn'));
    console.log('\nFinal result verifier ledger tests passed');
  })
  .catch(err => fail('ledger-assisted verifier run', err && err.stack || err));
