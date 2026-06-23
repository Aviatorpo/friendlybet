#!/usr/bin/env node
// One-command readiness gate for group-stage completion. It stays network-free:
// the live truth comes from public snapshots, and the operational proof comes
// from workflow/playbook/test wiring in the current tree.

const fs = require('fs');
const path = require('path');

const LOCAL_SUPABASE_SECRET_KEY = 'readiness-local';
const HAD_SUPABASE_SECRET_KEY = !!process.env.SUPABASE_SECRET_KEY;
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || LOCAL_SUPABASE_SECRET_KEY;

const LiveOpsAudit = require('./live-ops-audit');

const ROOT = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function add(checks, name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail });
}

function addWarning(warnings, code, message, detail = '') {
  warnings.push({ code, message, detail });
}

function firstIndex(text, needle) {
  return text.indexOf(needle);
}

function ordered(text, firstNeedle, laterNeedle) {
  const first = firstIndex(text, firstNeedle);
  const later = firstIndex(text, laterNeedle);
  return first >= 0 && later >= 0 && first < later;
}

function parseAppVersion(text) {
  const match = /APP_VERSION:\s*'([^']+)'/.exec(text);
  return match ? match[1] : null;
}

function parseSwVersion(text) {
  const match = /friendlybet-v([^']+)/.exec(text);
  return match ? match[1] : null;
}

function parseFooterVersion(text) {
  const match = /<span class="menu-version">v([^<]+)<\/span>/.exec(text);
  return match ? match[1] : null;
}

function parseSupabaseConfig(text) {
  const urlMatch = /SUPABASE_URL:\s*'([^']+)'/.exec(text);
  const keyMatch = /SUPABASE_PUBLISHABLE_KEY:\s*'([^']+)'/.exec(text);
  return {
    url: urlMatch ? urlMatch[1] : null,
    key: keyMatch ? keyMatch[1] : null,
  };
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

async function fetchJson(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const res = await fetchImpl(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res || !res.ok) throw new Error(`GET ${url} failed with ${res && res.status}`);
  return res.json();
}

function summarizePublicSnapshots(snapshots, nowMs) {
  const matches = snapshots && snapshots.matches;
  const pundit = snapshots && snapshots.pundit;
  const stories = snapshots && snapshots.stories;
  const punditFreshUntil = Date.parse((pundit && pundit.freshUntil) || '');
  return {
    matches: Array.isArray(matches && matches.matches) ? matches.matches.length : 0,
    stories: Array.isArray(stories && stories.items) ? stories.items.length : 0,
    pundit_items: Array.isArray(pundit && pundit.items) ? pundit.items.length : 0,
    pundit_fresh: Number.isFinite(punditFreshUntil) && punditFreshUntil > nowMs,
    matches_updatedAt: (matches && matches.updatedAt) || null,
    pundit_freshUntil: (pundit && pundit.freshUntil) || null,
    stories_updatedAt: (stories && (stories.updated_at || stories.updatedAt)) || null,
  };
}

async function loadPublicSnapshots(baseUrl, fetchImpl) {
  const base = normalizeBaseUrl(baseUrl);
  return {
    matches: await fetchJson(`${base}/public-data/matches.json`, fetchImpl),
    pundit: await fetchJson(`${base}/public-data/pundit.json`, fetchImpl),
    stories: await fetchJson(`${base}/public-data/world-cup-stories.json`, fetchImpl),
  };
}

async function fetchSupabaseMatches(config, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const url = normalizeBaseUrl(process.env.SUPABASE_URL || config.url || '');
  const secretKey = HAD_SUPABASE_SECRET_KEY ? process.env.SUPABASE_SECRET_KEY : '';
  const key = secretKey
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || config.key;
  if (!url || !key) throw new Error('Supabase URL/key missing');
  const endpoint = `${url}/rest/v1/matches?select=*&order=match_date.asc,id.asc`;
  const res = await fetchImpl(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  if (!res || !res.ok) throw new Error(`Supabase matches readiness failed (${res && res.status})`);
  const matches = await res.json();
  if (!Array.isArray(matches)) throw new Error('Supabase matches readiness returned a non-array payload');
  return matches;
}

async function runReadiness(options = {}) {
  const checks = [];
  const warnings = [];
  const nowMs = (options.auditOptions && options.auditOptions.nowMs) || Date.now();
  const audit = await LiveOpsAudit.audit(options.auditOptions || {});

  add(checks, 'snapshot live-ops audit is green', audit.ok, `recovery=${audit.result_recovery.candidates}, missingStories=${audit.stories.missing}`);
  add(checks, 'no unresolved result-recovery candidates', audit.result_recovery.candidates === 0, `candidates=${audit.result_recovery.candidates}`);
  add(checks, 'no missing stories for finished matches', audit.stories.missing === 0, `missing=${audit.stories.missing}`);
  add(checks, 'Pundit feed is fresh', !!audit.pundit.fresh, `freshUntil=${audit.pundit.freshUntil || 'missing'}`);
  add(checks, 'watchdog has no errors', audit.watchdog.errors.length === 0, `errors=${audit.watchdog.errors.length}`);

  const config = read('config.js');
  const serviceWorker = read('service-worker.js');
  const index = read('index.html');
  const appVersion = parseAppVersion(config);
  const swVersion = parseSwVersion(serviceWorker);
  const footerVersion = parseFooterVersion(index);
  const supabaseConfig = parseSupabaseConfig(config);
  add(
    checks,
    'PWA/app versions match',
    !!appVersion && appVersion === swVersion && appVersion === footerVersion,
    `config=${appVersion || 'missing'}, sw=${swVersion || 'missing'}, footer=${footerVersion || 'missing'}`
  );

  const scoring = read('scripts/calculate-scores-v2.js');
  add(checks, 'scoring excludes provider-pending finals', /filter\(isTerminalMatch\)/.test(scoring) && /isPendingProviderFinal/.test(scoring), 'finished matches must use isTerminalMatch');
  add(checks, 'group completion requires exactly six unique fixtures', /terminalMatches\.length\s*===\s*6/.test(scoring) && /terminalFixtures\.size\s*===\s*6/.test(scoring), 'no 5-match, duplicate, or 7-row groups');

  const app = read('app.js');
  add(checks, 'pool Pundit invite buzz is gated by effective open state', /const poolOpenForNewBuzz\s*=\s*!poolLocked\s*&&\s*\(lateEntryOpen\s*\|\|\s*!tournamentStarted\)/.test(app), 'join/share copy must not leak after kickoff');

  const livePoller = read('.github/workflows/live-poller.yml');
  const verifier = read('.github/workflows/final-result-verifier.yml');
  const manual = read('.github/workflows/manual-match-results.yml');
  const storyPublish = read('.github/workflows/publish-world-cup-stories-prepared.yml');
  const testWorkflow = read('.github/workflows/test-scoring.yml');
  const generatePundit = read('.github/workflows/generate-pundit.yml');

  add(checks, 'live poller covers all group-stage match days', livePoller.includes("cron: '*/5 * 11-28 6 *'"), '5-minute June 11-28 schedule required');
  add(checks, 'final verifier covers all group-stage match days', verifier.includes("cron: '*/15 * 11-28 6 *'"), '15-minute June 11-28 schedule required');

  [
    ['final-result-verifier', verifier, 'FORCE_MATCH_SNAPSHOT', 'node scripts/generate-pundit.js'],
    ['live-poller', livePoller, 'FORCE_MATCH_SNAPSHOT', 'node scripts/world-cup-story-auto-needed.js'],
    ['manual-match-results', manual, 'FORCE_MATCH_SNAPSHOT', 'node scripts/world-cup-story-auto-needed.js'],
    ['publish-world-cup-stories-prepared', storyPublish, 'FORCE_MATCH_SNAPSHOT', 'node scripts/world-cup-story-auto-needed.js'],
  ].forEach(([name, text, first, later]) => {
    add(checks, `${name} exports match snapshot before dependent context`, ordered(text, first, later), `${first} before ${later}`);
  });

  add(checks, 'standalone Pundit workflow exports/audits before build', ordered(generatePundit, 'node scripts/export-snapshots.js matches', 'node scripts/generate-pundit.js') && ordered(generatePundit, 'node scripts/live-ops-audit.js', 'node scripts/generate-pundit.js'), 'matches export + audit before build');

  [
    'node scripts/test-scoring.js',
    'node scripts/test-live-ops-audit.js',
    'node scripts/live-ops-audit.js',
    'node scripts/test-live-ux-state.js',
    'node scripts/test-live-state-watchdog.js',
    'node scripts/test-match-display-state.js',
    'node scripts/test-pundit-client-staleness.js',
    'node scripts/test-generate-pundit-live-state.js',
    'node scripts/test-banter.js',
  ].forEach(command => {
    add(checks, `CI runs ${command}`, testWorkflow.includes(command), 'test-scoring workflow');
  });

  const playbook = read('.codex/company/playbooks/live-scoring-operations.md');
  add(checks, 'playbook records screenshot fallback rule', /browser screenshots are unavailable[\s\S]*test-live-ux-state[\s\S]*screenshot gap explicitly/.test(playbook), 'visual proof gap must be named');
  const visualProof = read('scripts/live-ux-visual-proof.js');
  add(
    checks,
    'visual proof harness covers official scoring states',
    [
      'live-no-official',
      'first-official-zero',
      'several-official',
      'groups-complete',
      'LIVE_UX_VISUAL_STRICT',
      'hardOverflows',
      'overlaps',
    ].every(needle => visualProof.includes(needle)),
    'browser-backed screenshots must cover live/no-official, official-zero, several-groups, and groups-complete'
  );

  let production = null;
  const publicBaseUrl = options.publicBaseUrl || process.env.LIVE_COMPLETION_PUBLIC_BASE_URL || '';
  if (options.publicSnapshots || publicBaseUrl) {
    try {
      const snapshots = options.publicSnapshots || await loadPublicSnapshots(publicBaseUrl, options.fetch);
      production = summarizePublicSnapshots(snapshots, nowMs);
      add(checks, 'production public snapshots are readable', production.matches > 0 && production.stories > 0 && production.pundit_items > 0, `matches=${production.matches}, stories=${production.stories}, pundit=${production.pundit_items}`);
      add(checks, 'production Pundit feed is fresh', production.pundit_fresh, `freshUntil=${production.pundit_freshUntil || 'missing'}`);
    } catch (err) {
      add(checks, 'production public snapshots are readable', false, err.message);
    }
  }

  let liveDb = null;
  const shouldCheckDb = options.dbMatches || options.dbSource === 'supabase' || process.env.LIVE_COMPLETION_DB_SOURCE === 'supabase';
  if (shouldCheckDb) {
    try {
      const dbMatches = options.dbMatches || await fetchSupabaseMatches(supabaseConfig, options.fetch);
      const dbAudit = await LiveOpsAudit.audit({
        ...(options.auditOptions || {}),
        matches: dbMatches,
      });
      liveDb = {
        source: options.dbMatches ? 'in-memory' : 'supabase',
        matches: dbMatches.length,
        ok: dbAudit.ok,
        completed_groups: dbAudit.completed_groups,
        result_recovery: dbAudit.result_recovery,
        watchdog: dbAudit.watchdog,
      };
      add(checks, 'live DB matches are readable', dbMatches.length > 0, `matches=${dbMatches.length}`);
      add(checks, 'live DB match audit is green', dbAudit.ok, `recovery=${dbAudit.result_recovery.candidates}, errors=${dbAudit.watchdog.errors.length}`);
    } catch (err) {
      add(checks, 'live DB matches are readable', false, err.message);
    }
  }

  if (process.env.LIVE_COMPLETION_SCREENSHOT_VERIFIED !== '1') {
    addWarning(
      warnings,
      'browser_screenshot_unverified',
      'Browser screenshot/pixel verification has not been proven in this run.',
      'Set LIVE_COMPLETION_SCREENSHOT_VERIFIED=1 only after real dashboard/leaderboard screenshots cover live-no-official, first official group, several groups, and groups-complete states.'
    );
  }

  if (!liveDb && !HAD_SUPABASE_SECRET_KEY && process.env.LIVE_COMPLETION_DB_VERIFIED !== '1') {
    addWarning(
      warnings,
      'live_db_unverified',
      'Live Supabase/provider state was not queried in this run; readiness used local public-data snapshots.',
      'Run with SUPABASE_SECRET_KEY or set LIVE_COMPLETION_DB_VERIFIED=1 only after a separate live DB/provider check succeeds.'
    );
  }

  if (!production && process.env.LIVE_COMPLETION_PUBLIC_VERIFIED !== '1') {
    addWarning(
      warnings,
      'production_public_snapshot_unverified',
      'Production public snapshots were not fetched in this run.',
      'Run with LIVE_COMPLETION_PUBLIC_BASE_URL=https://friendlybet.live or set LIVE_COMPLETION_PUBLIC_VERIFIED=1 only after a separate production public-data check succeeds.'
    );
  }

  return {
    checked_at: new Date(nowMs).toISOString(),
    ok: checks.every(check => check.ok),
    checks,
    warnings,
    live_db: liveDb,
    production,
    audit: {
      completed_groups: audit.completed_groups,
      result_recovery: audit.result_recovery,
      stories: audit.stories,
      pundit: audit.pundit,
      watchdog: audit.watchdog,
    },
  };
}

if (require.main === module) {
  runReadiness().then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  }).catch(err => {
    console.error('live completion readiness fatal:', err.message);
    process.exit(1);
  });
} else {
  module.exports = {
    runReadiness,
    parseAppVersion,
    parseSwVersion,
    parseFooterVersion,
    parseSupabaseConfig,
    ordered,
    normalizeBaseUrl,
    summarizePublicSnapshots,
    loadPublicSnapshots,
    fetchSupabaseMatches,
  };
}
