// Test: final-result verifier failure paths with fake provider/ledger data.
// Run: node scripts/test-final-result-verifier-fallback.js

process.env.SUPABASE_SECRET_KEY = 'test-service-key';
process.env.RESULT_FALLBACK_SOURCES = 'espn,fifa';
process.env.RESULT_FALLBACK_SOURCE_MODE = 'rotate';
process.env.RESULT_FALLBACK_MIN_SOURCES = '2';
process.env.RESULT_FALLBACK_REQUIRED_SOURCES = 'espn,fifa';

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

const fifaFinal = {
  IdMatch: '400021443',
  Date: '2026-06-11T19:00:00Z',
  MatchStatus: 0,
  Home: { IdCountry: 'MEX', IdTeam: '43911', Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'Mexico' }] },
  Away: { IdCountry: 'RSA', IdTeam: '111', Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'South Africa' }] },
  Winner: null
};

async function runLedgerUnavailableFallback() {
  const calls = [];
  F.__setFetch(async (url, options = {}) => {
    const textUrl = String(url);
    const method = options.method || 'GET';
    calls.push(textUrl);
    if (textUrl.includes('/rest/v1/matches') && method === 'GET') {
      return { ok: true, text: async () => JSON.stringify([stuckMatch]) };
    }
    if (textUrl.includes('/rest/v1/result_verification_observations') && method === 'GET') {
      return { ok: false, status: 404, text: async () => 'table missing from schema cache' };
    }
    if (textUrl.includes('/rest/v1/result_verification_') && method === 'POST') {
      return { ok: true, text: async () => '[]' };
    }
    if (textUrl.includes('site.api.espn.com')) {
      return { ok: true, json: async () => ({ events: textUrl.includes('20260611') ? [espnFinal] : [] }) };
    }
    if (textUrl.includes('api.fifa.com')) {
      return { ok: true, json: async () => ({ Results: [fifaFinal] }) };
    }
    fail('unexpected fetch in fallback run', textUrl);
  });

  const result = await F.verifyFinalResults({ now: new Date('2026-06-11T21:10:00Z') });
  eq('ledger unavailable falls back to all sources and still verifies', {
    selected: result.report.selected_sources,
    rotationFallback: result.report.ledger.rotation_fallback,
    checked: result.checked,
    skipped: result.skipped,
    action: result.report.candidates[0].action,
    consensusOk: result.report.candidates[0].consensus.ok,
    sourceStatuses: Object.fromEntries(Object.entries(result.report.source_statuses).map(([k, v]) => [k, !!v.ok])),
  }, {
    selected: ['espn', 'fifa'],
    rotationFallback: 'ledger unavailable, checking all supported sources this run',
    checked: 1,
    skipped: 0,
    action: 'dry_run',
    consensusOk: true,
    sourceStatuses: { espn: true, fifa: true },
  });
  ok('both ESPN and FIFA were called after ledger read failed',
    calls.some(call => call.includes('site.api.espn.com')) && calls.some(call => call.includes('api.fifa.com')));
}

async function runConflictingSourcesRequireAttention() {
  F.__setFetch(async (url, options = {}) => {
    const textUrl = String(url);
    const method = options.method || 'GET';
    if (textUrl.includes('/rest/v1/matches') && method === 'GET') {
      return { ok: true, text: async () => JSON.stringify([stuckMatch]) };
    }
    if (textUrl.includes('/rest/v1/result_verification_observations') && method === 'GET') {
      return { ok: false, status: 404, text: async () => 'table missing from schema cache' };
    }
    if (textUrl.includes('/rest/v1/result_verification_') && method === 'POST') {
      return { ok: true, text: async () => '[]' };
    }
    if (textUrl.includes('site.api.espn.com')) {
      return { ok: true, json: async () => ({ events: textUrl.includes('20260611') ? [espnFinal] : [] }) };
    }
    if (textUrl.includes('api.fifa.com')) {
      return {
        ok: true,
        json: async () => ({ Results: [{ ...fifaFinal, Away: { ...fifaFinal.Away, Score: 2 } }] })
      };
    }
    fail('unexpected fetch in conflict run', textUrl);
  });

  const result = await F.verifyFinalResults({ now: new Date('2026-06-11T21:10:00Z') });
  eq('conflicting ESPN/FIFA result is skipped and needs attention', {
    checked: result.checked,
    updated: result.updated,
    skipped: result.skipped,
    attention: result.attention_skips,
    needsAttention: F.needsResultAttention(result),
    consensusOk: result.report.candidates[0].consensus.ok,
  }, {
    checked: 1,
    updated: 0,
    skipped: 1,
    attention: 1,
    needsAttention: true,
    consensusOk: false,
  });
}

runLedgerUnavailableFallback()
  .then(runConflictingSourcesRequireAttention)
  .then(() => {
    console.log('\nFinal result verifier fallback tests passed');
  })
  .catch(err => fail('fallback verifier tests', err && err.stack || err));
