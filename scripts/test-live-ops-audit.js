#!/usr/bin/env node
// Deterministic tests for live-ops audit summaries. No network, no DB.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'test-key';

const Audit = require('./live-ops-audit');
const ROOT = path.resolve(__dirname, '..');

function assertOrdered(text, file, firstNeedle, laterNeedle, message) {
  const firstIdx = text.indexOf(firstNeedle);
  const laterIdx = text.indexOf(laterNeedle);
  assert.ok(firstIdx >= 0, `${file} missing ${firstNeedle}`);
  assert.ok(laterIdx >= 0, `${file} missing ${laterNeedle}`);
  assert.ok(firstIdx < laterIdx, message || `${file}: ${firstNeedle} must come before ${laterNeedle}`);
}

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok: ${name}`);
}

const groupAComplete = [
  ['MEX', 'RSA', 2, 0],
  ['KOR', 'CZE', 2, 1],
  ['MEX', 'KOR', 1, 0],
  ['CZE', 'RSA', 1, 1],
  ['CZE', 'MEX', 0, 2],
  ['RSA', 'KOR', 1, 3],
].map(([home, away, hs, as], idx) => ({
  id: `a${idx}`,
  stage: 'GROUP_STAGE',
  group_letter: 'A',
  home_team_code: home,
  away_team_code: away,
  home_score: hs,
  away_score: as,
  status: 'FINISHED',
  match_date: `2026-06-${11 + idx}T19:00:00Z`,
  winner_code: hs > as ? home : (as > hs ? away : null),
}));

check('group completion summary uses scoreable terminal fixtures', () => {
  const groups = Audit.summarizeGroupCompletion(groupAComplete);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].group, 'A');
  assert.strictEqual(groups[0].fixtures, 6);
  assert.strictEqual(groups[0].terminal_fixtures, 6);
  assert.strictEqual(groups[0].scoreable_complete, true);
});

check('pending provider final does not complete a group', () => {
  const pending = groupAComplete.map((match, idx) => idx === 5
    ? { ...match, live_source: 'espn-final', status_detail: 'ESPN final pending verification' }
    : match);
  const groups = Audit.summarizeGroupCompletion(pending);
  assert.strictEqual(groups[0].terminal_fixtures, 5);
  assert.strictEqual(groups[0].scoreable_complete, false);
});

check('result recovery summary finds old non-terminal candidates', () => {
  const nowMs = Date.parse('2026-06-23T12:00:00Z');
  const stale = [{
    id: 'stale-1',
    external_id: '537400',
    status: 'TIMED',
    match_date: '2026-06-23T03:00:00Z',
    home_team_code: 'JOR',
    away_team_code: 'ALG',
  }];
  const result = Audit.summarizeResultRecovery(stale, nowMs, {
    lookbackHours: 336,
    minAgeMinutes: 95,
    backoff: false,
  });
  assert.strictEqual(result.candidates, 1);
  assert.strictEqual(result.due, 1);
  assert.strictEqual(result.waiting, 0);
  assert.strictEqual(result.sample[0].match, 'JOR-ALG');
});

check('result recovery summary respects bounded lookback', () => {
  const nowMs = Date.parse('2026-06-23T12:00:00Z');
  const tooOld = [{
    id: 'old-1',
    status: 'TIMED',
    match_date: '2026-06-10T03:00:00Z',
    home_team_code: 'AAA',
    away_team_code: 'BBB',
  }];
  const result = Audit.summarizeResultRecovery(tooOld, nowMs, {
    lookbackHours: 96,
    minAgeMinutes: 95,
  });
  assert.strictEqual(result.candidates, 0);
});

check('public snapshot live-status mode ignores active-window recovery candidates only', () => {
  const nowMs = Date.parse('2026-06-23T12:00:00Z');
  const activeFrozen = {
    id: 'live-public-1',
    status: 'TIMED',
    match_date: '2026-06-23T10:00:00Z',
    home_team_code: 'POR',
    away_team_code: 'UZB',
  };
  const oldStale = {
    id: 'old-public-1',
    status: 'TIMED',
    match_date: '2026-06-22T10:00:00Z',
    home_team_code: 'MEX',
    away_team_code: 'KOR',
  };
  const filtered = Audit.summarizeResultRecovery([activeFrozen, oldStale], nowMs, {
    lookbackHours: 336,
    minAgeMinutes: 95,
    ignoreSnapshotLiveStatus: true,
  });
  assert.strictEqual(filtered.ignored_snapshot_live_status, 1);
  assert.strictEqual(filtered.candidates, 1);
  assert.strictEqual(filtered.sample[0].id, 'old-public-1');
});

check('story summary reports unresolved result recovery as story-blocking', () => {
  const stories = Audit.summarizeStories([], { candidates: 3 });
  assert.strictEqual(stories.missing, 0);
  assert.strictEqual(stories.blocked_by_result_recovery, 3);
});

check('verified-result workflows force match snapshot export before dependent context', () => {
  const files = {
    '.github/workflows/final-result-verifier.yml': [
      'node scripts/export-snapshots.js leaderboards',
      'node scripts/generate-pundit.js',
    ],
    '.github/workflows/live-poller.yml': [
      'node scripts/export-snapshots.js leaderboards',
      'node scripts/generate-pundit.js',
      'node scripts/world-cup-story-auto-needed.js',
    ],
    '.github/workflows/manual-match-results.yml': [
      'node scripts/generate-pundit.js',
      'node scripts/world-cup-story-auto-needed.js',
    ],
    '.github/workflows/publish-world-cup-stories-prepared.yml': [
      'node scripts/world-cup-story-auto-needed.js',
    ],
  };
  for (const [file, dependentSteps] of Object.entries(files)) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(text.includes('FORCE_MATCH_SNAPSHOT'), `${file} must force settled-result match snapshot export`);
    dependentSteps.forEach(step => {
      assertOrdered(text, file, 'FORCE_MATCH_SNAPSHOT', step, `${file} must force match snapshot export before ${step}`);
    });
  }
});

check('final-result verifier has continuous 15-minute recovery schedule', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/final-result-verifier.yml'), 'utf8');
  assert.ok(text.includes("cron: '4,19,34,49 * 11-28 6 *'"), 'final verifier must not have group-stage recovery gaps');
  assert.ok(text.includes("cron: '4,19,34,49 16-23 29 6 *'"), 'final verifier must cover first knockout match day');
  assert.ok(text.includes("cron: '4,19,34,49 0-2,18-23 19 7 *'"), 'final verifier must cover final match day');
});

check('final-result verifier uploads an audit report artifact', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/final-result-verifier.yml'), 'utf8');
  assert.ok(text.includes('RESULT_VERIFICATION_REPORT_PATH'), 'final verifier must write a structured report');
  assert.ok(text.includes('actions/upload-artifact@v4'), 'final verifier must upload the structured report');
  assert.ok(text.includes('final-result-verification-report.json'), 'final verifier must use a stable report artifact path');
});

check('scheduled final-result verifier rotates sources through the ledger', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/final-result-verifier.yml'), 'utf8');
  assert.ok(text.includes('RESULT_FALLBACK_SOURCE_MODE'), 'final verifier must choose a source mode explicitly');
  assert.ok(text.includes("github.event_name == 'schedule' && 'rotate' || 'all'"), 'scheduled verifier must rotate, manual verifier must check all sources');
  assert.ok(text.includes('RESULT_FALLBACK_OBSERVATION_TTL_MINUTES'), 'final verifier must bound ledger observation freshness');
});

check('live poller has continuous 5-minute group-stage coverage', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/live-poller.yml'), 'utf8');
  assert.ok(text.includes("cron: '2,7,12,17,22,27,32,37,42,47,52,57 * 11-28 6 *'"), 'live poller must not rely on narrow precomputed match windows');
  assert.ok(text.includes("cron: '2,7,12,17,22,27,32,37,42,47,52,57 16-23 29 6 *'"), 'live poller must cover first knockout match day');
  assert.ok(text.includes("cron: '2,7,12,17,22,27,32,37,42,47,52,57 0-2,18-23 19 7 *'"), 'live poller must cover final match day');
  assert.ok(/preflights first[\s\S]*calls providers only/.test(text), 'live poller workflow must document preflight as the cost control');
  assert.ok(/permissions:\s*\n\s+contents:\s*write/.test(text), 'live poller must be able to push refreshed match/Pundit/leaderboard snapshots after a verified final');
  assert.ok(text.includes('RESULT_VERIFICATION_REPORT_PATH'), 'live poller must write a structured final-verification report');
  assert.ok(text.includes('live-final-verification-report.json'), 'live poller must use a stable final-verification report path');
  assert.ok(/RESULT_FALLBACK_SOURCE_MODE:\s*all/.test(text), 'live full-time handoff must check all supported sources immediately');
});

check('FIFA schedule workflow bridges official schedule into scoring DB', () => {
  const file = '.github/workflows/update-fifa-world-cup-schedule.yml';
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.ok(text.includes('node scripts/update-fifa-world-cup-schedule.js --if-window'), 'schedule workflow must refresh official FIFA schedule');
  assert.ok(text.includes('node scripts/sync-fifa-schedule-to-matches.js --include-placeholders'), 'schedule workflow must bridge schedule rows into Supabase matches');
  assert.ok(text.includes('SUPABASE_SECRET_KEY'), 'schedule bridge must use the service key from GitHub secrets');
  assert.ok(text.includes('node scripts/export-snapshots.js matches'), 'schedule bridge must export public match snapshot after DB upsert');
  assertOrdered(text, file,
    'node scripts/update-fifa-world-cup-schedule.js --if-window',
    'node scripts/sync-fifa-schedule-to-matches.js --include-placeholders',
    'schedule refresh must happen before schedule-to-matches bridge');
  assertOrdered(text, file,
    'node scripts/sync-fifa-schedule-to-matches.js --include-placeholders',
    'node scripts/export-snapshots.js matches',
    'match snapshot export must happen after schedule bridge');
});

check('scheduled scoring/export failures fail loudly', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/calculate-scores-v2.yml'), 'utf8');
  assert.ok(!/score calculation skipped[\s\S]*exit 0/.test(text), 'scheduled scoring must not exit 0 after scoring failure');
  assert.ok(!/leaderboard snapshot export skipped[\s\S]*exit 0/.test(text), 'scheduled snapshot export must not exit 0 after export failure');
  assert.ok(/run:\s*node scripts\/calculate-scores-v2\.js/.test(text), 'scoring workflow must run scoring directly');
  assert.ok(/run:\s*node scripts\/export-snapshots\.js leaderboards/.test(text), 'scoring workflow must run snapshot export directly');
});

check('main scoring workflow runs the live snapshot audit on data changes', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/test-scoring.yml'), 'utf8');
  assert.ok(/run:\s*node scripts\/live-ops-audit\.js/.test(text), 'test workflow must run the real live-ops snapshot audit');
  assert.ok(text.includes('LIVE_OPS_IGNORE_SNAPSHOT_LIVE_STATUS'), 'test workflow static audit must not fail on intentionally frozen live public snapshots');
  ['app.js', 'styles.css', 'i18n.js', 'index.html', 'config.js', 'service-worker.js'].forEach(file => {
    assert.ok(text.includes(file), `test workflow must trigger when ${file} changes`);
  });
  assert.ok(text.includes('public-data/matches.json'), 'test workflow must trigger on match snapshot changes');
  assert.ok(text.includes('public-data/pundit.json'), 'test workflow must trigger on Pundit snapshot changes');
  assert.ok(text.includes('public-data/world-cup-stories.json'), 'test workflow must trigger on story snapshot changes');
  [
    '.github/workflows/calculate-scores-v2.yml',
    '.github/workflows/final-result-verifier.yml',
    '.github/workflows/generate-pundit.yml',
    '.github/workflows/live-poller.yml',
    '.github/workflows/manual-match-results.yml',
    '.github/workflows/publish-world-cup-stories-prepared.yml',
    '.github/workflows/update-fifa-world-cup-schedule.yml',
    '.github/workflows/test-scoring.yml',
  ].forEach(file => {
    assert.ok(text.includes(file), `test workflow must trigger when ${file} changes`);
  });
  assert.ok(
    (text.match(/'\.github\/workflows\/test-scoring\.yml'/g) || []).length >= 2,
    'test workflow must trigger on its own changes for both push and pull_request'
  );
});

check('pre-Pundit audit mode filters only Pundit watchdog findings', () => {
  const filtered = Audit.withoutPunditWatchdogFindings({
    errors: [
      'Pundit feed is stale or missing freshUntil',
      'Pundit item live-m1: live commentary references non-live match m1 (TIMED)',
      'public-data/pundit.json missing or invalid during tournament window',
      'm1: scheduled status is stale 120m after kickoff',
    ],
    warnings: [
      'pundit-news.json is empty during tournament window',
      'public-data/leaderboard directory is missing',
    ],
  });
  assert.deepStrictEqual(filtered.errors, ['m1: scheduled status is stale 120m after kickoff']);
  assert.deepStrictEqual(filtered.warnings, ['public-data/leaderboard directory is missing']);
});

check('public snapshot live-status mode demotes only frozen-live snapshot findings', () => {
  const filtered = Audit.withoutPublicSnapshotLiveStatusErrors({
    errors: [
      'POR-UZB: scheduled status is stale 35m after kickoff',
      'A-B: live status is stale 5h after kickoff',
      'public-data/world-cup-stories.json missing story for finished match m1',
    ],
    warnings: [
      'public-data/leaderboard directory is missing',
    ],
  });
  assert.deepStrictEqual(filtered.errors, [
    'public-data/world-cup-stories.json missing story for finished match m1',
  ]);
  assert.deepStrictEqual(filtered.warnings, [
    'public-data/leaderboard directory is missing',
    'public snapshot live status: POR-UZB: scheduled status is stale 35m after kickoff',
    'public snapshot live status: A-B: live status is stale 5h after kickoff',
  ]);
});

check('story backlog mode demotes missing story errors without hiding other errors', () => {
  const filtered = Audit.withoutStoryBacklogFindings({
    errors: [
      'World Cup stories missing for 8 finished match(es): a, b',
      'm1: scheduled status is stale 120m after kickoff',
    ],
    warnings: [],
  });
  assert.deepStrictEqual(filtered.errors, ['m1: scheduled status is stale 120m after kickoff']);
  assert.deepStrictEqual(filtered.warnings, ['story backlog: World Cup stories missing for 8 finished match(es): a, b']);
});

check('standalone Pundit workflow audits match state before build', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/generate-pundit.yml'), 'utf8');
  const exportIdx = text.indexOf('node scripts/export-snapshots.js matches');
  const storyWorkIdx = text.indexOf('node scripts/world-cup-story-auto-needed.js');
  const publishStoriesIdx = text.indexOf('node scripts/publish-world-cup-stories-auto.js');
  const auditIdx = text.indexOf('node scripts/live-ops-audit.js');
  const buildIdx = text.indexOf('node scripts/generate-pundit.js');
  const validateIdx = text.indexOf('node scripts/test-pundit-feed.js');
  assert.ok(exportIdx >= 0, 'generate-pundit workflow must export current match snapshot');
  assert.ok(storyWorkIdx > exportIdx, 'generate-pundit workflow must check prepared story work after export');
  assert.ok(publishStoriesIdx > storyWorkIdx, 'generate-pundit workflow must publish prepared stories before audit');
  assert.ok(auditIdx > exportIdx, 'generate-pundit workflow must export matches before audit');
  assert.ok(auditIdx > publishStoriesIdx, 'generate-pundit workflow must audit after prepared story publishing');
  assert.ok(auditIdx >= 0, 'generate-pundit workflow must run live-ops audit');
  assert.ok(buildIdx > auditIdx, 'generate-pundit workflow must audit before build');
  assert.ok(validateIdx > buildIdx, 'generate-pundit workflow must validate after build');
  assert.ok(text.includes("FORCE_MATCH_SNAPSHOT: '1'"), 'generate-pundit workflow must force a current match snapshot for the live desk');
  assert.ok(text.includes('LIVE_OPS_SKIP_PUNDIT'), 'generate-pundit audit must allow Pundit freshness refresh');
  assert.ok(text.includes('LIVE_OPS_IGNORE_SNAPSHOT_LIVE_STATUS'), 'generate-pundit audit must allow fresh active live snapshot rows while final verification waits');
  assert.ok(text.includes('LIVE_OPS_ALLOW_STORY_BACKLOG'), 'generate-pundit audit must let accepted story backlog refresh Pundit');
  assert.ok(text.includes("cron: '3,13,23,33,43,53 * 11-28 6 *'"), 'generate-pundit workflow must refresh Pundit near live group-stage transitions');
  assert.ok(/git status --porcelain public-data\/pundit\.json public-data\/world-cup-stories\.json story-assets/.test(text), 'generate-pundit workflow must key deploys on Pundit or story changes');
  assert.ok(/match snapshot changed without a Pundit feed change/.test(text), 'generate-pundit workflow must avoid committing match-only live churn');
  assert.ok(/commit-generated-snapshots\.sh[\s\S]*public-data\/matches\.json public-data\/pundit\.json/.test(text), 'generate-pundit workflow must stage matches with Pundit');
  assert.ok(/REGENERATE_COMMANDS:[\s\S]*LIVE_OPS_SKIP_PUNDIT=1 LIVE_OPS_IGNORE_SNAPSHOT_LIVE_STATUS=1 LIVE_OPS_ALLOW_STORY_BACKLOG=1 node scripts\/live-ops-audit\.js[\s\S]*node scripts\/generate-pundit\.js/.test(text), 'generate-pundit workflow must regenerate from current main after generated-data push conflicts');
});

check('readiness monitor can recover stale active live DB state', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/live-completion-readiness.yml'), 'utf8');
  assert.ok(text.includes('readiness-before.json'), 'readiness monitor must capture the first failing gate result');
  assert.ok(text.includes("name==='live DB active match state is fresh'"), 'readiness monitor must target stale active DB state only');
  assert.ok(text.includes('node scripts/live-poller.js'), 'readiness monitor must run one live-poller recovery pass');
  assert.ok(/timeout-minutes:\s*18/.test(text), 'readiness monitor timeout must allow a recovery poll and second gate');
});

check('final-result verifier commits exported match snapshot with Pundit', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/final-result-verifier.yml'), 'utf8');
  assert.ok(text.includes('node scripts/export-snapshots.js matches'), 'final verifier must export match snapshot after verified results');
  assert.ok(/git status --porcelain public-data\/matches\.json public-data\/leaderboard/.test(text), 'final verifier must include matches in changed snapshot check');
  assert.ok(/commit-generated-snapshots\.sh[\s\S]*public-data\/matches\.json public-data\/leaderboard/.test(text), 'final verifier must stage matches with scoring/Pundit snapshots');
  assert.ok(/REGENERATE_COMMANDS:[\s\S]*node scripts\/calculate-scores-v2\.js[\s\S]*node scripts\/generate-pundit\.js/.test(text), 'final verifier must regenerate scoring and Pundit snapshots after generated-data push conflicts');
});

check('story asset backlog cannot fail scoring/result workflows', () => {
  [
    '.github/workflows/final-result-verifier.yml',
    '.github/workflows/live-poller.yml',
  ].forEach(file => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(text.includes("LIVE_WATCHDOG_REQUIRE_NEWS: '0'"), `${file} must not fail result publication on empty editorial news`);
    assert.ok(text.includes("LIVE_WATCHDOG_SKIP_STORIES: '1'"), `${file} must not fail result publication on missing story assets`);
    assert.ok(text.includes('failed=0'), `${file} must track result failure separately`);
    assert.ok(/needs_attention[\s\S]*failed=1/.test(text), `${file} must still fail on unresolved result verification`);
    assert.ok(/::warning::World Cup story desk/.test(text), `${file} must warn, not fail, on missing story assets`);
    assert.ok(!/::error::World Cup story desk/.test(text), `${file} must not report story backlog as a workflow error`);
    assert.ok(/exit "\$failed"/.test(text), `${file} must exit only on result-verification failure`);
  });

  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/test-scoring.yml'), 'utf8');
  assert.ok(ci.includes("LIVE_OPS_ALLOW_STORY_BACKLOG: '1'"), 'app/scoring CI must not block hotfixes on accepted story backlog');

  const scoring = fs.readFileSync(path.join(ROOT, '.github/workflows/calculate-scores-v2.yml'), 'utf8');
  assert.ok(/Audit World Cup story image quality[\s\S]*continue-on-error:\s*true/.test(scoring), 'scoring workflow story image audit must be non-blocking');
  assert.ok(/Validate World Cup stories[\s\S]*continue-on-error:\s*true/.test(scoring), 'scoring workflow story validation must be non-blocking');
  assert.ok(/audit-world-cup-story-images\.py --scope stories \|\| true/.test(scoring), 'scoring regenerate path must not block on story image audit');
  assert.ok(/test-world-cup-stories\.js \|\| true/.test(scoring), 'scoring regenerate path must not block on story validation');
});

console.log(`\nLive-ops audit tests passed: ${passed}`);
