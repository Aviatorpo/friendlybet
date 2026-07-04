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

check('public snapshot live-status mode ignores bounded match-day recovery candidates only', () => {
  const nowMs = Date.parse('2026-06-23T12:00:00Z');
  const activeFrozen = {
    id: 'live-public-1',
    status: 'TIMED',
    match_date: '2026-06-23T10:00:00Z',
    home_team_code: 'POR',
    away_team_code: 'UZB',
  };
  const delayedFrozen = {
    id: 'live-public-2',
    status: 'PAUSED',
    match_date: '2026-06-23T06:45:00Z',
    home_team_code: 'SUI',
    away_team_code: 'ALG',
  };
  const oldStale = {
    id: 'old-public-1',
    status: 'TIMED',
    match_date: '2026-06-22T10:00:00Z',
    home_team_code: 'MEX',
    away_team_code: 'KOR',
  };
  const filtered = Audit.summarizeResultRecovery([activeFrozen, delayedFrozen, oldStale], nowMs, {
    lookbackHours: 336,
    minAgeMinutes: 95,
    ignoreSnapshotLiveStatus: true,
  });
  assert.strictEqual(filtered.ignored_snapshot_live_status, 2);
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

check('verified-result workflows publish all leaderboard snapshots for a new result version', () => {
  for (const file of ['.github/workflows/final-result-verifier.yml', '.github/workflows/live-poller.yml']) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(
      !text.includes("steps.verify_results.outputs.changed == 'true' && steps.score_results.outputs.changed_pool_ids != ''"),
      `${file} must not skip leaderboard publication when a verified result changes but no score changes`
    );
    assert.ok(
      (text.match(/FORCE_ALL_LEADERBOARD_SNAPSHOTS:\s*'1'/g) || []).length >= 3,
      `${file} must export, verify, commit, and prove all leaderboard snapshots for the new result version`
    );
  }
});

check('scoring workflow commits critical public snapshots before backup tail', () => {
  const file = '.github/workflows/calculate-scores-v2.yml';
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assertOrdered(text, file, 'Generate knockout scoring scenarios', 'Commit critical public snapshots if changed');
  assertOrdered(text, file, 'Commit critical public snapshots if changed', 'Encrypted critical-data backup after finished matches');
  assert.ok(
    /commit-generated-snapshots\.sh "data: refresh critical public scoring snapshots"[\s\S]*public-data\/matches\.json[\s\S]*public-data\/leaderboard[\s\S]*public-data\/knockout-scenarios/.test(text),
    'scoring workflow must push public match, leaderboard, and scenario snapshots before backup/content work'
  );
  assert.ok(
    /name: Prove public scoring snapshots[\s\S]*timeout-minutes:\s*12/.test(text),
    'public scoring proof must be bounded so Actions do not hang indefinitely after publication'
  );
  assertOrdered(
    text,
    file,
    'Prove public scoring snapshots',
    'Check knockout scenario readiness',
    'public scoring proof must run before non-critical knockout scenario readiness'
  );
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

check('final-result verifier auto-escalates approved emergency sources without manual input', () => {
  const verifier = fs.readFileSync(path.join(ROOT, '.github/workflows/final-result-verifier.yml'), 'utf8');
  const livePoller = fs.readFileSync(path.join(ROOT, '.github/workflows/live-poller.yml'), 'utf8');
  [verifier, livePoller].forEach((text, idx) => {
    const label = idx === 0 ? 'final verifier' : 'live poller';
    assert.ok(text.includes("RESULT_AUTO_EMERGENCY_SOURCES: '1'"), `${label} must enable automatic emergency source escalation`);
    assert.ok(text.includes('RESULT_AUTO_EMERGENCY_AFTER_MINUTES'), `${label} must bound when emergency escalation starts`);
    assert.ok(text.includes('RESULT_AUTO_EMERGENCY_SOURCE_MODE: all'), `${label} must check the approved emergency shelf once escalation is active`);
  });
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

check('verified-result workflows refresh next hidden knockout scenarios', () => {
  [
    '.github/workflows/calculate-scores-v2.yml',
    '.github/workflows/final-result-verifier.yml',
    '.github/workflows/live-poller.yml',
    '.github/workflows/manual-match-results.yml',
  ].forEach(file => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(text.includes('node scripts/sync-fifa-schedule-to-matches.js --include-placeholders'), `${file} must bridge known knockout fixtures before scenario generation`);
    assertOrdered(text, file,
      'node scripts/sync-fifa-schedule-to-matches.js --include-placeholders',
      'node scripts/generate-knockout-scenarios.js',
      `${file} must bridge fixtures before generating hidden scenarios`);
    assert.ok(text.includes('node scripts/generate-knockout-scenarios.js'), `${file} must generate next knockout scenario files`);
    assert.ok(text.includes('node scripts/knockout-scenario-readiness.js'), `${file} must check next knockout scenario readiness`);
    assert.ok(
      text.includes('public-data/knockout-scenarios') ||
        /commit-generated-snapshots\.sh[\s\S]*public-data/.test(text),
      `${file} must commit next knockout scenario files`
    );
    assertOrdered(
      text,
      file,
      'Prove public scoring snapshots',
      'Check knockout scenario readiness',
      `${file} must prove public scoring before non-critical scenario readiness`
    );
  });
});

check('manual knockout scenario repair workflow is strict and self-contained', () => {
  const file = '.github/workflows/repair-knockout-scenarios.yml';
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.ok(/workflow_dispatch:/.test(text), 'repair workflow must be manually runnable');
  assert.ok(text.includes('node scripts/update-fifa-world-cup-schedule.js'), 'repair workflow must refresh FIFA schedule');
  assert.ok(text.includes('node scripts/sync-fifa-schedule-to-matches.js --include-placeholders'), 'repair workflow must bridge schedule into matches');
  assert.ok(text.includes('node scripts/export-snapshots.js matches'), 'repair workflow must export match snapshot');
  assert.ok(text.includes('node scripts/generate-knockout-scenarios.js'), 'repair workflow must regenerate hidden scenarios');
  assert.ok(text.includes('node scripts/knockout-scenario-readiness.js'), 'repair workflow must enforce scenario readiness');
  assert.ok(text.includes('public-data/world-cup-schedule.json public-data/matches.json public-data/knockout-scenarios'), 'repair workflow must commit schedule, matches, and scenarios together');
});

check('FIFA schedule workflow bridges official schedule into scoring DB', () => {
  const file = '.github/workflows/update-fifa-world-cup-schedule.yml';
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.ok(text.includes('node scripts/update-fifa-world-cup-schedule.js --if-window'), 'schedule workflow must refresh official FIFA schedule');
  assert.ok(text.includes('node scripts/sync-fifa-schedule-to-matches.js --include-placeholders'), 'schedule workflow must bridge schedule rows into Supabase matches');
  assert.ok(text.includes('SUPABASE_SECRET_KEY'), 'schedule bridge must use the service key from GitHub secrets');
  assert.ok(text.includes('node scripts/export-snapshots.js matches'), 'schedule bridge must export public match snapshot after DB upsert');
  assert.ok(/permissions:\s*\n\s+contents:\s*write\s*\n\s+actions:\s*write/.test(text), 'schedule bridge must be allowed to dispatch forced scoring after scoreable result changes');
  assert.ok(text.includes("steps.schedule_bridge.outputs.scoreable_result_changed == 'true'"), 'schedule bridge must key scoring dispatch to scoreable result_version changes');
  assert.ok(text.includes('gh workflow run calculate-scores-v2.yml'), 'schedule bridge must dispatch forced scoring when it changes scoreable match truth');
  assert.ok(text.includes('force_leaderboard_export=true'), 'schedule bridge dispatch must force all leaderboard publication/proof');
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
  assertOrdered(
    text,
    '.github/workflows/calculate-scores-v2.yml',
    'node scripts/calculate-scores-v2.js --critical',
    'node scripts/export-snapshots.js matches',
    'scoring workflow must force the match snapshot before proving leaderboard result_version'
  );
  assertOrdered(
    text,
    '.github/workflows/calculate-scores-v2.yml',
    'node scripts/export-snapshots.js matches',
    'node scripts/export-snapshots.js leaderboards',
    'scoring workflow must publish matches before leaderboards'
  );
  assertOrdered(
    text,
    '.github/workflows/calculate-scores-v2.yml',
    'node scripts/export-snapshots.js leaderboards',
    'node scripts/verify-scoring-snapshots.js',
    'scoring workflow must prove snapshots after export'
  );
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
    '.github/workflows/repair-knockout-scenarios.yml',
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
  assert.ok(text.includes("cron: '3,13,23,33,43,53 0-7,15-23 1 7 *'"), 'generate-pundit workflow must refresh Pundit during knockout live windows');
  assert.ok(text.includes("cron: '3,13,23,33,43,53 0-2,18-23 19 7 *'"), 'generate-pundit workflow must refresh Pundit through final day');
  assert.ok(/Publish prepared World Cup stories[\s\S]*continue-on-error:\s*true/.test(text), 'generate-pundit workflow must not let story publishing block Pundit freshness');
  assert.ok(/git status --porcelain public-data\/pundit\.json public-data\/world-cup-stories\.json story-assets/.test(text), 'generate-pundit workflow must key deploys on Pundit or story changes');
  assert.ok(/match snapshot changed without a Pundit feed change/.test(text), 'generate-pundit workflow must avoid committing match-only live churn');
  assert.ok(/commit-generated-snapshots\.sh[\s\S]*public-data\/matches\.json public-data\/pundit\.json/.test(text), 'generate-pundit workflow must stage matches with Pundit');
  assert.ok(/Validate generated Pundit feed[\s\S]*continue-on-error:\s*true/.test(text), 'standalone Pundit validation must not create critical-path failure emails');
  assert.ok(/Report Pundit validation warning[\s\S]*::warning::Generated Pundit feed failed/.test(text), 'standalone Pundit validation failures must remain visible as warnings');
  assert.ok(/Commit feed if changed[\s\S]*if:\s*steps\.pundit_validation\.outcome == 'success'/.test(text), 'standalone Pundit workflow must keep the last good feed when validation fails');
  assert.ok(/REGENERATE_COMMANDS:[\s\S]*LIVE_OPS_SKIP_PUNDIT=1 LIVE_OPS_IGNORE_SNAPSHOT_LIVE_STATUS=1 LIVE_OPS_ALLOW_STORY_BACKLOG=1 node scripts\/live-ops-audit\.js[\s\S]*node scripts\/generate-pundit\.js/.test(text), 'generate-pundit workflow must regenerate from current main after generated-data push conflicts');
  assert.ok(/REGENERATE_COMMANDS:[\s\S]*if \[ -f public-data\/pundit-news\.json \]/.test(text), 'generate-pundit regenerate path must not fail when optional Pundit news is absent');
});

check('prepared story workflow has automatic knockout retry coverage', () => {
  const file = '.github/workflows/publish-world-cup-stories-prepared.yml';
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.ok(/schedule:/.test(text), 'prepared story workflow must have an automatic schedule');
  assert.ok(text.includes("cron: '5,20,35,50 0-7,15-23 1 7 *'"), 'prepared story workflow must cover knockout live/post-final windows');
  assert.ok(text.includes("cron: '5,20,35,50 0-2,18-23 19 7 *'"), 'prepared story workflow must cover final day');
  assert.ok(text.includes("cron: '11 */4 * * *'"), 'prepared story workflow must have a quiet backlog retry');
  assert.ok(/timeout-minutes:\s*20/.test(text), 'prepared story workflow must be bounded');
  assertOrdered(text, file, 'node scripts/export-snapshots.js matches', 'node scripts/world-cup-story-auto-needed.js');
  assertOrdered(text, file, 'node scripts/publish-world-cup-stories-auto.js', 'node scripts/test-world-cup-stories.js');
  assert.ok(/REGENERATE_COMMANDS:[\s\S]*FORCE_MATCH_SNAPSHOT=1 node scripts\/export-snapshots\.js matches[\s\S]*node scripts\/world-cup-story-auto-needed\.js[\s\S]*node scripts\/publish-world-cup-stories-auto\.js[\s\S]*node scripts\/test-world-cup-stories\.js/.test(text), 'prepared story workflow must regenerate from a fresh match snapshot after generated-data push conflicts');
});

check('story base prebuild is automatic, bounded, and covers knockout matches', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/prebuild-world-cup-story-bases.yml'), 'utf8');
  assert.ok(/schedule:/.test(workflow), 'story prebuild must run automatically');
  assert.ok(workflow.includes("cron: '17 */6 * * *'"), 'story prebuild must run on a bounded recurring schedule');
  assert.ok(!workflow.includes('OPENAI_API_KEY'), 'production story prebuild must not use the OpenAI Images API');
  assert.ok(workflow.includes('WC_STORY_MATCH_SOURCE: snapshot'), 'story prebuild must use the exported snapshot, not raw provider rows');
  assert.ok(workflow.includes("WC_STORY_PREBUILD_GENERATE: '1'"), 'story prebuild must enable generation ahead of matches');
  assert.ok(workflow.includes("WC_STORY_PREBUILD_LIMIT: ${{ inputs.limit || '6' }}"), 'story prebuild must keep generation cost bounded');
  assert.ok(workflow.includes("WC_STORY_AUDIT_SKIP_UNINDEXED_BASES: '1'"), 'story prebuild must not fail on old unindexed base assets');
  assertOrdered(workflow, '.github/workflows/prebuild-world-cup-story-bases.yml', 'python3 -m pip install --user pillow pypdf', 'node scripts/prebuild-world-cup-story-outcome-bases.js');

  const prebuild = fs.readFileSync(path.join(ROOT, 'scripts/prebuild-world-cup-story-outcome-bases.js'), 'utf8');
  assert.ok(prebuild.includes("process.env.WC_STORY_MATCH_SOURCE = process.env.WC_STORY_MATCH_SOURCE || 'snapshot'"), 'prebuild script must default to snapshot source');
  assert.ok(!prebuild.includes('requestImageBuffer'), 'scheduled story prebuild script must not call image-generation APIs');
  assert.ok(prebuild.includes('renderLocalOutcomeBase'), 'scheduled story prebuild must render local deterministic bases');
  assert.ok(prebuild.includes('function possibleOutcomes(match)'), 'prebuild must model possible outcomes per match type');
  assert.ok(prebuild.includes("status === 'FINISHED'"), 'prebuild must backfill the actual outcome for finished matches missing story bases');
  assert.ok(prebuild.includes('outcomeFor(match)'), 'prebuild must use canonical outcome resolution for finished story backfill');
  assert.ok(prebuild.includes('matchesWithStories'), 'prebuild must avoid regenerating bases for matches that already have stories');
  assert.ok(prebuild.includes('LOCAL_DETERMINISTIC_OUTCOME_BASE'), 'prebuild must mark local deterministic base metadata');
  assert.ok(prebuild.includes("String(match.stage || '').toUpperCase() !== 'GROUP_STAGE'"), 'prebuild must treat knockout matches differently from group matches');

  const coverage = fs.readFileSync(path.join(ROOT, 'scripts/check-world-cup-story-base-coverage.js'), 'utf8');
  assert.ok(coverage.includes("process.env.WC_STORY_MATCH_SOURCE = process.env.WC_STORY_MATCH_SOURCE || 'snapshot'"), 'coverage audit must default to snapshot source');
  assert.ok(coverage.includes("String(match.stage || '').toUpperCase() !== 'GROUP_STAGE'"), 'coverage audit must include knockout matches');

  const imageAudit = fs.readFileSync(path.join(ROOT, 'scripts/audit-world-cup-story-images.py'), 'utf8');
  assert.ok(imageAudit.includes('WC_STORY_AUDIT_SKIP_UNINDEXED_BASES'), 'image audit must support indexed-base mode for scheduled prebuild');
  assert.ok(imageAudit.includes('LOCAL_DETERMINISTIC_OUTCOME_BASE'), 'image audit must support local deterministic base metadata');

  const processStoryImage = fs.readFileSync(path.join(ROOT, 'scripts/process-story-image.py'), 'utf8');
  assert.ok(processStoryImage.includes('outcome-base'), 'process-story-image must support local outcome-base rendering');
});

check('story publisher does not fail the live desk on broad base-audit backlog', () => {
  const text = fs.readFileSync(path.join(ROOT, 'scripts/publish-world-cup-stories-auto.js'), 'utf8');
  assert.ok(text.includes("process.env.WC_STORY_MATCH_SOURCE = process.env.WC_STORY_MATCH_SOURCE || 'snapshot'"), 'story publisher must use the exported match snapshot by default');
  assert.ok(text.includes('World Cup story base audit failed; continuing'), 'story publisher must warn, not stop, on broad base-audit backlog');
  assertOrdered(text, 'scripts/publish-world-cup-stories-auto.js', "['scripts/audit-world-cup-story-images.py', '--scope', 'bases']", "['node', 'scripts/generate-world-cup-stories.js']");
  assertOrdered(text, 'scripts/publish-world-cup-stories-auto.js', "['node', 'scripts/generate-world-cup-stories.js']", "['scripts/audit-world-cup-story-images.py', '--scope', 'stories']");

  const needed = fs.readFileSync(path.join(ROOT, 'scripts/world-cup-story-auto-needed.js'), 'utf8');
  assert.ok(needed.includes("process.env.WC_STORY_MATCH_SOURCE = process.env.WC_STORY_MATCH_SOURCE || 'snapshot'"), 'story preflight must use the exported match snapshot by default');
});

check('readiness monitor can recover stale active live DB state', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/live-completion-readiness.yml'), 'utf8');
  assert.ok(text.includes('readiness-before.json'), 'readiness monitor must capture the first failing gate result');
  assert.ok(text.includes("name==='live DB active match state is fresh'"), 'readiness monitor must target stale active DB state only');
  assert.ok(text.includes("name==='score publication is current for latest result_version'"), 'readiness monitor must target stale score publication as recoverable work');
  assert.ok(text.includes('node scripts/live-poller.js'), 'readiness monitor must run one live-poller recovery pass');
  assert.ok(text.includes('stale_score_publication'), 'readiness monitor must track score-publication failures separately from live polling');
  assert.ok(text.includes('force_leaderboard_export=true'), 'readiness score-publication recovery must force all leaderboard publication/proof');
  assert.ok(/timeout-minutes:\s*18/.test(text), 'readiness monitor timeout must allow a recovery poll and second gate');
});

check('final-result verifier commits exported match snapshot with Pundit', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github/workflows/final-result-verifier.yml'), 'utf8');
  assert.ok(text.includes('node scripts/export-snapshots.js matches'), 'final verifier must export match snapshot after verified results');
  assert.ok(/git status --porcelain[\s\S]*public-data\/matches\.json[\s\S]*public-data\/leaderboard/.test(text), 'final verifier must include matches in changed snapshot check');
  assert.ok(/commit-generated-snapshots\.sh[\s\S]*public-data\/matches\.json[\s\S]*public-data\/leaderboard/.test(text), 'final verifier must stage matches with scoring/Pundit snapshots');
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
    assert.ok(/Report post-final Pundit warning[\s\S]*::warning::Post-final Pundit refresh failed/.test(text), `${file} must warn, not fail, on post-final Pundit quality failures`);
    assert.ok(/Commit post-final content if changed[\s\S]*continue-on-error:\s*true/.test(text), `${file} post-final content commits must not fail critical result publication`);
  });

  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/test-scoring.yml'), 'utf8');
  assert.ok(ci.includes("LIVE_OPS_ALLOW_STORY_BACKLOG: '1'"), 'app/scoring CI must not block hotfixes on accepted story backlog');

  const scoring = fs.readFileSync(path.join(ROOT, '.github/workflows/calculate-scores-v2.yml'), 'utf8');
  assert.ok(/Audit World Cup story image quality[\s\S]*continue-on-error:\s*true/.test(scoring), 'scoring workflow story image audit must be non-blocking');
  assert.ok(/Validate World Cup stories[\s\S]*continue-on-error:\s*true/.test(scoring), 'scoring workflow story validation must be non-blocking');
  assert.ok(/audit-world-cup-story-images\.py --scope stories \|\| true/.test(scoring), 'scoring regenerate path must not block on story image audit');
  assert.ok(/test-world-cup-stories\.js \|\| true/.test(scoring), 'scoring regenerate path must not block on story validation');
});

check('join flow does not create fake pending approvals for open pools', () => {
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.ok(app.includes('const requiresApproval = !!(state.currentPool && state.currentPool.approve_before_betting);'), 'frontend join fallback must read approve_before_betting');
  assert.ok(app.includes("approval_status: requiresApproval ? 'pending' : 'approved'"), 'frontend join fallback must approve users in non-approval pools');
  assert.ok(app.includes('approved_at: requiresApproval ? null : new Date().toISOString()'), 'frontend join fallback must stamp auto-approved users');

  const migration = fs.readFileSync(path.join(ROOT, 'migrations/2026-07-03-fix-join-approval-status.sql'), 'utf8');
  assert.ok(migration.includes('v_requires_approval := coalesce(v_pool.approve_before_betting, false);'), 'join_pool RPC must read approve_before_betting');
  assert.ok(migration.includes("v_approval_status := case when v_requires_approval then 'pending' else 'approved' end;"), 'join_pool RPC must approve users in non-approval pools');
  assert.ok(migration.includes("p.code = '287ZF'"), 'data repair must be scoped to pool 287ZF');
  assert.ok(migration.includes("u.approval_status = 'pending'"), 'data repair must only touch pending approval rows');
});

console.log(`\nLive-ops audit tests passed: ${passed}`);
