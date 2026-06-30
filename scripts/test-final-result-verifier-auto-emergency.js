// Test: scheduled verifier auto-escalates to approved emergency source families
// without requiring manual workflow input.
// Run: node scripts/test-final-result-verifier-auto-emergency.js

process.env.SUPABASE_SECRET_KEY = 'test-service-key';
process.env.RESULT_FALLBACK_LEDGER = '0';
process.env.RESULT_FALLBACK_SOURCES = 'espn,fifa';
process.env.RESULT_FALLBACK_SOURCE_MODE = 'rotate';
process.env.RESULT_FALLBACK_MIN_SOURCES = '2';
process.env.RESULT_FALLBACK_REQUIRED_SOURCES = 'espn,fifa';
process.env.RESULT_CONSENSUS_FALLBACK_MIN_SOURCES = '3';
process.env.RESULT_AUTO_EMERGENCY_SOURCES = '1';
process.env.RESULT_AUTO_EMERGENCY_AFTER_MINUTES = '105';
process.env.RESULT_AUTO_EMERGENCY_SOURCE_MODE = 'all';

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

const penaltyMatch = {
  external_id: '400021599',
  home_team_code: 'GER',
  away_team_code: 'PAR',
  status: 'TIMED',
  stage: 'ROUND_OF_32',
  match_date: '2026-06-29T20:00:00Z',
  home_score: null,
  away_score: null,
  winner_code: null,
  live_clock: null,
  live_period: null,
  status_detail: null,
  live_source: null,
};

const foxHtml = `
  <div id="c12d20260629">
    <a class="score-chip final" href="/soccer/fifa-world-cup-men-germany-vs-paraguay-jun-29-2026-game-boxscore-111">
      <div class="score-team-row is-loser">
        <span class="score-team-logo" title="Germany">Germany</span>
        <span title="GER">GER</span>
        <div class="score-team-score"><span class="scores-text"><span class="scores-team-pk">3</span> 1</span></div>
      </div>
      <div class="score-team-row">
        <span class="score-team-logo" title="Paraguay">Paraguay</span>
        <span title="PAR">PAR</span>
        <div class="score-team-score"><span class="scores-text"><span class="scores-team-pk">4</span> 1</span></div>
      </div>
    </a>
  </div>`;

const yahooHtml = 'x name\\":\\"Germany vs. Paraguay (Final: GER 1-1 PAR) y startDate\\":\\"2026-06-29T20:00:00Z\\" Paraguay wins on penalties and advances to the Round of 16';

async function run() {
  F.__setFetch(async (url, options = {}) => {
    const textUrl = String(url);
    const method = options.method || 'GET';
    if (textUrl.includes('/rest/v1/matches') && method === 'GET') {
      return { ok: true, text: async () => JSON.stringify([penaltyMatch]) };
    }
    if (textUrl.includes('site.api.espn.com')) {
      return { ok: true, json: async () => ({ events: [] }) };
    }
    if (textUrl.includes('api.fifa.com')) {
      return { ok: true, json: async () => ({ Results: [] }) };
    }
    if (textUrl.includes('livescore.com')) {
      return { ok: true, text: async () => '<html></html>' };
    }
    if (textUrl.includes('foxsports.com')) {
      return { ok: true, text: async () => foxHtml };
    }
    if (textUrl.includes('sports.yahoo.com')) {
      return { ok: true, text: async () => (textUrl.includes('date=2026-06-29') ? yahooHtml : '') };
    }
    if (textUrl.includes('content.guardianapis.com')) {
      return {
        ok: true,
        json: async () => ({
          response: {
            results: [{
              id: 'football/live/germany-paraguay',
              webUrl: 'https://www.theguardian.com/football/live/germany-paraguay',
              webTitle: 'Paraguay beat Germany on penalties to reach last 16 of World Cup 2026',
              fields: {
                headline: 'Paraguay beat Germany on penalties to reach last 16',
                trailText: 'Paraguay advanced after a 1-1 draw.',
                bodyText: 'Paraguay beat Germany after a 1-1 draw and advanced to the Round of 16.',
              },
            }],
          },
        }),
      };
    }
    if (textUrl.includes('apnews.com')) {
      return { ok: true, text: async () => '<html></html>' };
    }
    fail('unexpected fetch in auto-emergency run', textUrl);
  });

  const result = await F.verifyFinalResults({ now: new Date('2026-06-29T22:00:00Z') });
  const candidate = result.report.candidates[0];
  eq('auto emergency verifier uses approved source shelf and fallback consensus', {
    checked: result.checked,
    skipped: result.skipped,
    sourceProfile: result.report.source_profile,
    autoActive: result.report.auto_emergency.active,
    sourceMode: result.report.source_mode,
    action: candidate.action,
    consensusOk: candidate.consensus.ok,
    familyCount: candidate.consensus.family_count,
    winner: candidate.verified_update && candidate.verified_update.winner_code,
  }, {
    checked: 1,
    skipped: 0,
    sourceProfile: 'auto_emergency',
    autoActive: true,
    sourceMode: 'all',
    action: 'dry_run',
    consensusOk: true,
    familyCount: 3,
    winner: 'PAR',
  });
  ok('manual emergency input was not required',
    process.env.RESULT_EMERGENCY_SOURCES !== '1' && result.report.selected_sources.includes('guardian'));
}

run()
  .then(() => console.log('\nFinal result verifier auto-emergency tests passed'))
  .catch(err => fail('auto-emergency verifier tests', err && err.stack || err));
