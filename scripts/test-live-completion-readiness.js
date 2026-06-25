#!/usr/bin/env node
// Deterministic tests for the group-stage completion readiness gate.

const assert = require('assert');

const Readiness = require('./live-completion-readiness');

(async () => {
  assert.strictEqual(Readiness.parseAppVersion("APP_VERSION: '2.10.88'"), '2.10.88');
  assert.strictEqual(Readiness.parseSwVersion("const CACHE_VERSION = 'friendlybet-v2.10.88';"), '2.10.88');
  assert.strictEqual(Readiness.parseFooterVersion('<span class="menu-version">v2.10.88</span>'), '2.10.88');
  assert.deepStrictEqual(Readiness.parseSupabaseConfig("SUPABASE_URL: 'https://x.supabase.co'\nSUPABASE_PUBLISHABLE_KEY: 'pk'"), {
    url: 'https://x.supabase.co',
    key: 'pk',
  });
  let supabaseFetchUrl = '';
  let supabaseAuth = '';
  const fetchedMatches = await Readiness.fetchSupabaseMatches(
    { url: 'https://x.supabase.co', key: 'publishable-from-config' },
    async (url, options) => {
      supabaseFetchUrl = url;
      supabaseAuth = options.headers.Authorization;
      return {
        ok: true,
        json: async () => [{ id: 'm1' }],
      };
    }
  );
  assert.strictEqual(fetchedMatches.length, 1);
  assert.strictEqual(
    supabaseFetchUrl,
    'https://x.supabase.co/rest/v1/matches?select=*&order=match_date.asc,id.asc'
  );
  assert.strictEqual(supabaseAuth, 'Bearer publishable-from-config');
  assert.strictEqual(Readiness.ordered('a\nb\nc', 'a', 'c'), true);
  assert.strictEqual(Readiness.ordered('a\nb\nc', 'c', 'a'), false);
  assert.strictEqual(Readiness.normalizeBaseUrl('https://friendlybet.live///'), 'https://friendlybet.live');

  const result = await Readiness.runReadiness({
    auditOptions: { nowMs: Date.parse('2026-06-23T12:00:00Z') },
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result.checks.filter(check => !check.ok), null, 2));
  assert.ok(Array.isArray(result.warnings), 'readiness result must expose evidence warnings');
  assert.ok(
    result.warnings.some(warning => warning.code === 'browser_screenshot_unverified'),
    'local readiness must warn when browser screenshot proof is missing'
  );
  assert.ok(
    result.warnings.some(warning => warning.code === 'live_db_unverified'),
    'local readiness must warn when live DB/provider proof is missing'
  );
  assert.ok(
    result.warnings.some(warning => warning.code === 'production_public_snapshot_unverified'),
    'local readiness must warn when production public snapshots were not fetched'
  );

  const productionResult = await Readiness.runReadiness({
    auditOptions: { nowMs: Date.parse('2026-06-23T12:00:00Z') },
    publicSnapshots: {
      matches: {
        updatedAt: '2026-06-23T11:00:00Z',
        matches: [{
          id: 1,
          status: 'TIMED',
          match_date: '2026-06-23T11:20:00Z',
          home_team_code: 'POR',
          away_team_code: 'UZB',
        }],
      },
      stories: { updated_at: '2026-06-23T11:00:00Z', items: [{ id: 's1' }] },
      pundit: { updatedAt: '2026-06-23T11:00:00Z', freshUntil: '2026-06-23T17:00:00Z', items: [{ id: 'p1' }] },
    },
  });
  assert.strictEqual(productionResult.ok, true, JSON.stringify(productionResult.checks.filter(check => !check.ok), null, 2));
  assert.strictEqual(productionResult.production.matches, 1);
  assert.ok(
    !productionResult.warnings.some(warning => warning.code === 'production_public_snapshot_unverified'),
    'production public snapshot warning must clear when production snapshots are checked'
  );
  assert.ok(
    productionResult.checks.some(check => check.name === 'production public snapshots are readable' && check.ok),
    'readiness must prove production public snapshots are readable when provided'
  );
  assert.ok(
    productionResult.checks.some(check => check.name === 'production Pundit feed is fresh' && check.ok),
    'readiness must verify production Pundit freshness when production snapshots are provided'
  );
  assert.ok(
    productionResult.checks.some(check => check.name === 'production public snapshot audit is green' && check.ok),
    'readiness must run the live-ops audit against production public snapshots without failing on frozen active-match status'
  );
  assert.ok(
    productionResult.production.watchdog.warnings.some(warning => /public snapshot live status/.test(warning)),
    'frozen public snapshot live status must be preserved as warning evidence'
  );

  const dbResult = await Readiness.runReadiness({
    auditOptions: { nowMs: Date.parse('2026-06-23T12:00:00Z') },
    dbMatches: [
      { id: 'db1', status: 'TIMED', match_date: '2026-06-24T12:00:00Z', home_team_code: 'A', away_team_code: 'B', stage: 'GROUP_STAGE', group_letter: 'A' },
    ],
  });
  assert.strictEqual(dbResult.ok, true, JSON.stringify(dbResult.checks.filter(check => !check.ok), null, 2));
  assert.strictEqual(dbResult.live_db.matches, 1);
  assert.ok(
    !dbResult.warnings.some(warning => warning.code === 'live_db_unverified'),
    'live DB warning must clear when DB matches are audited'
  );
  assert.ok(
    dbResult.checks.some(check => check.name === 'live DB matches are readable' && check.ok),
    'readiness must prove live DB matches are readable when provided'
  );
  assert.ok(
    dbResult.checks.some(check => check.name === 'live DB match audit is green' && check.ok),
    'readiness must audit live DB matches when provided'
  );
  assert.strictEqual(dbResult.live_db.freshness.stale, 0, 'future DB matches should not be treated as stale live state');

  const staleDbResult = await Readiness.runReadiness({
    auditOptions: { nowMs: Date.parse('2026-06-23T12:00:00Z') },
    dbMatches: [
      { id: 'db-stale', status: 'TIMED', match_date: '2026-06-23T11:20:00Z', home_team_code: 'POR', away_team_code: 'UZB', stage: 'GROUP_STAGE', group_letter: 'K' },
    ],
  });
  assert.strictEqual(staleDbResult.ok, false, 'stale live DB scheduled rows must remain a hard readiness failure');
  assert.ok(
    staleDbResult.checks.some(check => check.name === 'live DB match audit is green' && !check.ok),
    'live DB audit must not use the public snapshot live-status demotion'
  );
  assert.ok(
    staleDbResult.checks.some(check => check.name === 'live DB active match state is fresh' && !check.ok),
    'live DB freshness check must fail stale active rows'
  );

  const staleDbFreshness = Readiness.summarizeLiveDbFreshness([
    { status: 'TIMED', match_date: '2026-06-23T11:40:00Z', home_team_code: 'NED', away_team_code: 'SWE' },
  ], Date.parse('2026-06-23T12:00:00Z'));
  assert.strictEqual(staleDbFreshness.stale, 1, 'TIMED match 20 minutes after kickoff must be stale for live DB freshness');

  const freshWorkflowResult = await Readiness.runReadiness({
    auditOptions: { nowMs: Date.parse('2026-06-23T12:00:00Z') },
    workflowRuns: {
      livePoller: [{ id: 1, status: 'completed', conclusion: 'success', created_at: '2026-06-23T11:50:00Z' }],
      finalResultVerifier: [{ id: 2, status: 'completed', conclusion: 'success', created_at: '2026-06-23T11:30:00Z' }],
      pundit: [{ id: 3, status: 'completed', conclusion: 'success', created_at: '2026-06-23T11:45:00Z' }],
    },
  });
  assert.strictEqual(freshWorkflowResult.ok, true, JSON.stringify(freshWorkflowResult.checks.filter(check => !check.ok), null, 2));
  assert.ok(
    freshWorkflowResult.checks.some(check => check.name === 'live poller workflow ran recently' && check.ok),
    'readiness must verify live-poller workflow liveness when workflow runs are provided'
  );
  assert.ok(
    freshWorkflowResult.checks.some(check => check.name === 'Pundit workflow ran recently' && check.ok),
    'readiness must verify Pundit workflow liveness when workflow runs are provided'
  );

  const staleWorkflowOutsideMatchWindow = await Readiness.runReadiness({
    auditOptions: { nowMs: Date.parse('2026-06-23T12:00:00Z') },
    dbMatches: [
      { id: 'future-db1', status: 'TIMED', match_date: '2026-06-23T19:00:00Z', home_team_code: 'A', away_team_code: 'B', stage: 'GROUP_STAGE', group_letter: 'A' },
    ],
    workflowRuns: {
      livePoller: [{ id: 1, status: 'completed', conclusion: 'success', created_at: '2026-06-23T09:00:00Z' }],
      finalResultVerifier: [{ id: 2, status: 'completed', conclusion: 'success', created_at: '2026-06-23T09:00:00Z' }],
      pundit: [{ id: 3, status: 'completed', conclusion: 'success', created_at: '2026-06-23T09:00:00Z' }],
    },
  });
  assert.strictEqual(staleWorkflowOutsideMatchWindow.ok, true, JSON.stringify(staleWorkflowOutsideMatchWindow.checks.filter(check => !check.ok), null, 2));
  assert.strictEqual(staleWorkflowOutsideMatchWindow.workflow_liveness.required, false, 'workflow liveness must not hard-fail outside a real match coverage window');
  assert.ok(
    staleWorkflowOutsideMatchWindow.warnings.some(warning => warning.code === 'workflow_liveness_outside_match_window'),
    'stale workflow recency outside match windows must remain visible as warning evidence'
  );

  const staleWorkflowInsideMatchWindow = await Readiness.runReadiness({
    auditOptions: { nowMs: Date.parse('2026-06-23T12:00:00Z') },
    dbMatches: [
      { id: 'soon-db1', status: 'TIMED', match_date: '2026-06-23T12:30:00Z', home_team_code: 'A', away_team_code: 'B', stage: 'GROUP_STAGE', group_letter: 'A' },
    ],
    workflowRuns: {
      livePoller: [{ id: 1, status: 'completed', conclusion: 'success', created_at: '2026-06-23T09:00:00Z' }],
      finalResultVerifier: [{ id: 2, status: 'completed', conclusion: 'success', created_at: '2026-06-23T09:00:00Z' }],
      pundit: [{ id: 3, status: 'completed', conclusion: 'success', created_at: '2026-06-23T09:00:00Z' }],
    },
  });
  assert.strictEqual(staleWorkflowInsideMatchWindow.ok, false, 'stale workflow history must hard-fail inside a live match coverage window');
  assert.strictEqual(staleWorkflowInsideMatchWindow.workflow_liveness.required, true, 'workflow liveness must be required near kickoff');
  assert.strictEqual(
    Readiness.isWorkflowLivenessRequired(
      [{ id: 'soon-db1', match_date: '2026-06-23T12:30:00Z', stage: 'GROUP_STAGE' }],
      Date.parse('2026-06-23T12:00:00Z')
    ),
    true
  );
  assert.strictEqual(
    Readiness.isWorkflowLivenessRequired(
      [{ id: 'future-db1', match_date: '2026-06-23T19:00:00Z', stage: 'GROUP_STAGE' }],
      Date.parse('2026-06-23T12:00:00Z')
    ),
    false
  );

  const staleHelperWorkflowsWithGreenProduction = await Readiness.runReadiness({
    auditOptions: { nowMs: Date.parse('2026-06-23T12:00:00Z') },
    publicSnapshots: {
      matches: {
        updatedAt: '2026-06-23T11:55:00Z',
        matches: [{
          id: 'soon-public1',
          status: 'TIMED',
          match_date: '2026-06-23T12:30:00Z',
          home_team_code: 'A',
          away_team_code: 'B',
          stage: 'GROUP_STAGE',
          group_letter: 'A',
        }],
      },
      stories: { updated_at: '2026-06-23T11:55:00Z', items: [{ id: 's1' }] },
      pundit: { updatedAt: '2026-06-23T11:55:00Z', freshUntil: '2026-06-23T17:00:00Z', items: [{ id: 'p1' }] },
    },
    dbMatches: [
      {
        id: 'soon-db1',
        status: 'TIMED',
        match_date: '2026-06-23T12:30:00Z',
        home_team_code: 'A',
        away_team_code: 'B',
        stage: 'GROUP_STAGE',
        group_letter: 'A',
      },
    ],
    workflowRuns: {
      livePoller: [{ id: 1, status: 'completed', conclusion: 'success', created_at: '2026-06-23T11:50:00Z' }],
      finalResultVerifier: [{ id: 2, status: 'completed', conclusion: 'failure', created_at: '2026-06-23T11:00:00Z' }],
      pundit: [{ id: 3, status: 'completed', conclusion: 'failure', created_at: '2026-06-23T11:00:00Z' }],
    },
  });
  assert.strictEqual(staleHelperWorkflowsWithGreenProduction.ok, true, JSON.stringify(staleHelperWorkflowsWithGreenProduction.checks.filter(check => !check.ok), null, 2));
  assert.strictEqual(staleHelperWorkflowsWithGreenProduction.workflow_liveness.required, true, 'workflow liveness remains evaluated near kickoff');
  assert.strictEqual(
    staleHelperWorkflowsWithGreenProduction.workflow_liveness.final_result_verifier.downgraded_after_green_surface,
    true,
    'stale final verifier liveness should become warning-only after green production and DB proof'
  );
  assert.strictEqual(
    staleHelperWorkflowsWithGreenProduction.workflow_liveness.pundit.downgraded_after_green_surface,
    true,
    'stale Pundit liveness should become warning-only after green production and DB proof'
  );
  assert.ok(
    staleHelperWorkflowsWithGreenProduction.warnings.some(warning => warning.code === 'helper_workflow_liveness_downgraded_after_green_surface'),
    'downgraded helper workflow liveness must stay visible as warning evidence'
  );

  const recoveredPollerInsideMatchWindow = await Readiness.runReadiness({
    auditOptions: { nowMs: Date.parse('2026-06-23T12:00:00Z') },
    dbMatches: [
      {
        id: 'live-db1',
        status: 'IN_PROGRESS',
        match_date: '2026-06-23T11:30:00Z',
        home_team_code: 'A',
        away_team_code: 'B',
        stage: 'GROUP_STAGE',
        group_letter: 'A',
        source_updated_at: '2026-06-23T11:59:00Z',
      },
    ],
    workflowRuns: {
      livePoller: [{ id: 1, status: 'completed', conclusion: 'success', created_at: '2026-06-23T09:00:00Z' }],
      finalResultVerifier: [{ id: 2, status: 'completed', conclusion: 'success', created_at: '2026-06-23T11:50:00Z' }],
      pundit: [{ id: 3, status: 'completed', conclusion: 'success', created_at: '2026-06-23T11:45:00Z' }],
    },
    localPollerRecoveryAt: '2026-06-23T11:59:30Z',
  });
  assert.strictEqual(recoveredPollerInsideMatchWindow.ok, true, JSON.stringify(recoveredPollerInsideMatchWindow.checks.filter(check => !check.ok), null, 2));
  assert.strictEqual(recoveredPollerInsideMatchWindow.workflow_liveness.live_poller.recovered_locally, true, 'local readiness recovery must count as live-poller evidence only after fresh DB proof');
  assert.ok(
    recoveredPollerInsideMatchWindow.warnings.some(warning => warning.code === 'live_poller_recovered_by_readiness_monitor'),
    'local live-poller recovery should stay visible as warning evidence'
  );

  const staleWorkflow = Readiness.summarizeWorkflowLiveness(
    [{ id: 1, status: 'completed', conclusion: 'success', created_at: '2026-06-23T09:00:00Z' }],
    Date.parse('2026-06-23T12:00:00Z'),
    20 * 60 * 1000
  );
  assert.strictEqual(staleWorkflow.ok, false, 'stale live-poller workflow history must fail during group-stage window');

  const pendingWorkflow = Readiness.summarizeWorkflowLiveness(
    [{ id: 2, status: 'pending', conclusion: '', created_at: '2026-06-23T11:55:00Z' }],
    Date.parse('2026-06-23T12:00:00Z'),
    20 * 60 * 1000
  );
  assert.strictEqual(pendingWorkflow.ok, true, 'fresh pending scheduled workflow run must count as live liveness evidence');

  const requiredChecks = [
    'snapshot live-ops audit is green',
    'PWA/app versions match',
    'scoring excludes provider-pending finals',
    'group completion requires exactly six unique fixtures',
    'pool Pundit invite buzz is gated by effective open state',
    'live poller covers all group-stage match days',
    'live poller can push refreshed snapshots',
    'final verifier covers all group-stage match days',
    'readiness monitor covers production during group-stage match days',
    'readiness monitor audits live DB by default',
    'readiness monitor self-heals stale active live DB',
    'standalone Pundit workflow covers live group-stage transitions',
    'playbook records screenshot fallback rule',
    'visual proof harness covers official scoring states',
  ];
  const names = new Set(result.checks.map(check => check.name));
  requiredChecks.forEach(name => assert.ok(names.has(name), `missing readiness check: ${name}`));

  console.log(`Live completion readiness tests passed: ${result.checks.length} checks`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
