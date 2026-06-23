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
      matches: { updatedAt: '2026-06-23T11:00:00Z', matches: [{ id: 1 }] },
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
    'readiness must run the live-ops audit against production public snapshots'
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

  const requiredChecks = [
    'snapshot live-ops audit is green',
    'PWA/app versions match',
    'scoring excludes provider-pending finals',
    'group completion requires exactly six unique fixtures',
    'pool Pundit invite buzz is gated by effective open state',
    'live poller covers all group-stage match days',
    'final verifier covers all group-stage match days',
    'readiness monitor covers production during group-stage match days',
    'readiness monitor audits live DB by default',
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
