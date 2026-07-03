#!/usr/bin/env node
// One-command readiness gate for live tournament completion. By default it can run
// from local public snapshots and repo wiring; production and live DB proof are
// enabled explicitly with environment variables.

const fs = require('fs');
const path = require('path');

const LOCAL_SUPABASE_SECRET_KEY = 'readiness-local';
const HAD_SUPABASE_SECRET_KEY = !!process.env.SUPABASE_SECRET_KEY;
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || LOCAL_SUPABASE_SECRET_KEY;

const LiveOpsAudit = require('./live-ops-audit');
const WCR = require('../share-assets/world-cup-rules.js');

const ROOT = path.resolve(__dirname, '..');
const LIVE_DB_SCHEDULED_GRACE_MS = 3 * 60 * 1000;
const LIVE_DB_SOURCE_STALE_MS = 3 * 60 * 1000;
const LIVE_DB_ACTIVE_WINDOW_MS = 4 * 60 * 60 * 1000;
const LIVE_POLLER_STALE_MS = 20 * 60 * 1000;
const FINAL_VERIFIER_STALE_MS = 45 * 60 * 1000;
const PUNDIT_WORKFLOW_STALE_MS = 35 * 60 * 1000;
const WORKFLOW_LIVENESS_PRE_MATCH_MS = 90 * 60 * 1000;

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

function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
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

function readLocalMatches() {
  try {
    const payload = JSON.parse(read(path.join('public-data', 'matches.json')));
    return Array.isArray(payload && payload.matches) ? payload.matches : [];
  } catch (_err) {
    return [];
  }
}

function readLocalFairPlayResolutions() {
  try {
    return JSON.parse(read(path.join('public-data', 'fair-play-resolutions.json')));
  } catch (_err) {
    return { version: 1, status: 'missing', resolutions: [] };
  }
}

async function auditPublicSnapshots(snapshots, nowMs, auditOptions = {}) {
  const matches = snapshots && snapshots.matches && Array.isArray(snapshots.matches.matches)
    ? snapshots.matches.matches
    : [];
  return LiveOpsAudit.audit({
    ...auditOptions,
    nowMs,
    matches,
    punditFeed: snapshots && snapshots.pundit || null,
    storiesPayload: snapshots && snapshots.stories || null,
    ignoreSnapshotLiveStatus: auditOptions.ignoreSnapshotLiveStatus !== false,
  });
}

async function loadPublicSnapshots(baseUrl, fetchImpl) {
  const base = normalizeBaseUrl(baseUrl);
  const snapshots = {
    matches: await fetchJson(`${base}/public-data/matches.json`, fetchImpl),
    pundit: await fetchJson(`${base}/public-data/pundit.json`, fetchImpl),
    stories: await fetchJson(`${base}/public-data/world-cup-stories.json`, fetchImpl),
  };
  try {
    snapshots.fairPlay = await fetchJson(`${base}/public-data/fair-play-resolutions.json`, fetchImpl);
  } catch (_err) {
    snapshots.fairPlay = { version: 1, status: 'missing', resolutions: [] };
  }
  return snapshots;
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

function summarizeLiveDbFreshness(matches, nowMs) {
  const stale = [];
  const active = [];
  for (const match of matches || []) {
    const kickoff = parseTime(match && match.match_date);
    if (!Number.isFinite(kickoff)) continue;
    const elapsed = nowMs - kickoff;
    if (elapsed < 0 || elapsed > LIVE_DB_ACTIVE_WINDOW_MS) continue;
    const status = String(match && match.status || '').toUpperCase();
    const key = `${match.home_team_code || '?'}-${match.away_team_code || '?'}`;
    active.push(key);
    if ((status === 'TIMED' || status === 'SCHEDULED') && elapsed > LIVE_DB_SCHEDULED_GRACE_MS) {
      stale.push(`${key}: still ${status} ${Math.round(elapsed / 60000)}m after kickoff`);
      continue;
    }
    if (['IN_PLAY', 'LIVE', 'PAUSED'].includes(status)) {
      const sourceUpdatedAt = parseTime(match.source_updated_at || match.last_updated);
      if (!Number.isFinite(sourceUpdatedAt) || nowMs - sourceUpdatedAt > LIVE_DB_SOURCE_STALE_MS) {
        const age = Number.isFinite(sourceUpdatedAt) ? `${Math.round((nowMs - sourceUpdatedAt) / 60000)}m old` : 'missing';
        stale.push(`${key}: live source update is ${age}`);
      }
    }
  }
  return {
    active: active.length,
    stale: stale.length,
    sample: stale.slice(0, 8),
  };
}

function isWorkflowLivenessRequired(matches, nowMs) {
  return (Array.isArray(matches) ? matches : []).some(match => {
    const kickoff = parseTime(match && match.match_date);
    if (!Number.isFinite(kickoff)) return false;
    return nowMs >= kickoff - WORKFLOW_LIVENESS_PRE_MATCH_MS
      && nowMs <= kickoff + LIVE_DB_ACTIVE_WINDOW_MS;
  });
}

async function fetchGitHubWorkflowRuns(workflowFile, options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const repo = options.repo || process.env.GITHUB_REPOSITORY || 'Aviatorpo/friendlybet';
  const branch = options.branch || process.env.GITHUB_REF_NAME || 'main';
  const token = options.token || process.env.GITHUB_TOKEN || '';
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?branch=${encodeURIComponent(branch)}&per_page=5`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'friendlybet-live-completion-readiness',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchImpl(url, { headers });
  if (!res || !res.ok) throw new Error(`GitHub workflow runs ${workflowFile} failed (${res && res.status})`);
  const payload = await res.json();
  return Array.isArray(payload && payload.workflow_runs) ? payload.workflow_runs : [];
}

function summarizeWorkflowLiveness(runs, nowMs, maxAgeMs, options = {}) {
  const required = options.required == null ? true : !!options.required;
  const latest = (runs || [])
    .map(run => ({
      id: run.id || run.databaseId || null,
      status: run.status || '',
      conclusion: run.conclusion || '',
      created_at: run.created_at || run.createdAt || '',
      created_ms: parseTime(run.created_at || run.createdAt),
    }))
    .filter(run => Number.isFinite(run.created_ms))
    .sort((a, b) => b.created_ms - a.created_ms)[0] || null;
  const ageMs = latest ? nowMs - latest.created_ms : Infinity;
  const healthyStatus = latest
    && (['queued', 'pending', 'in_progress', 'requested', 'waiting'].includes(latest.status)
      || latest.conclusion === 'success');
  return {
    ok: !required || (latest && ageMs <= maxAgeMs && healthyStatus),
    required,
    latest,
    age_minutes: Number.isFinite(ageMs) ? Math.round(ageMs / 60000) : null,
  };
}

function applyLocalPollerRecovery(liveness, nowMs, context = {}) {
  const recoveryAt = context.recoveryAt || process.env.LIVE_COMPLETION_LOCAL_POLLER_RECOVERY_AT || '';
  const recoveryMs = parseTime(recoveryAt);
  const liveDbFresh = context.liveDb && context.liveDb.ok && context.liveDb.freshness && context.liveDb.freshness.stale === 0;
  const productionFresh = !context.production || context.production.audit_ok === true;
  if (!liveness || liveness.ok || !liveness.required || !Number.isFinite(recoveryMs) || !liveDbFresh || !productionFresh) {
    return liveness;
  }
  const ageMs = nowMs - recoveryMs;
  if (ageMs < 0 || ageMs > LIVE_POLLER_STALE_MS) return liveness;
  return {
    ...liveness,
    ok: true,
    latest: {
      id: 'local-readiness-recovery',
      status: 'completed',
      conclusion: 'success',
      created_at: new Date(recoveryMs).toISOString(),
      created_ms: recoveryMs,
    },
    age_minutes: Math.round(ageMs / 60000),
    recovered_locally: true,
  };
}

function isGreenProductionSurface(context = {}, options = {}) {
  const production = context.production || null;
  const liveDb = context.liveDb || null;
  const skipPundit = !!options.skipPundit;
  return !!(
    production
    && production.audit_ok === true
    && (skipPundit || production.pundit_fresh === true)
    && production.result_recovery
    && production.result_recovery.candidates === 0
    && liveDb
    && liveDb.ok === true
    && liveDb.freshness
    && liveDb.freshness.stale === 0
    && liveDb.result_recovery
    && liveDb.result_recovery.candidates === 0
  );
}

function downgradeStaleWorkflowLiveness(liveness, reason) {
  if (!liveness || liveness.ok || !liveness.required) return liveness;
  return {
    ...liveness,
    ok: true,
    downgraded_after_green_surface: true,
    downgrade_reason: reason,
  };
}

function workflowLivenessDetail(liveness, workflowWindowDetail) {
  const latest = liveness && liveness.latest && liveness.latest.created_at || 'missing';
  const age = liveness && liveness.age_minutes != null ? `${liveness.age_minutes}m` : 'missing';
  const suffix = liveness && liveness.downgraded_after_green_surface
    ? `, warning only: ${liveness.downgrade_reason}`
    : '';
  return `latest=${latest}, age=${age}, ${workflowWindowDetail}${suffix}`;
}

function summarizeOfficialKnockoutReadiness(matches, fairPlayResolutions = null) {
  const seed = WCR.lateKnockoutSeedFromMatches(matches || [], { strict: true, fairPlayResolutions });
  if (!seed || !seed.ok) {
    const state = seed && seed.state;
    const complete = state && Array.isArray(state.completeGroups) ? state.completeGroups.length : 0;
    return {
      ok: false,
      active: complete === 12,
      reason: (seed && seed.reason) || 'groups-incomplete',
      detail: `completeGroups=${complete}/12${seed && seed.unresolved && seed.unresolved.length ? ` unresolved=${JSON.stringify(seed.unresolved).slice(0, 240)}` : ''}`
    };
  }
  const key = (seed.thirdPlaceAdvancers || []).slice().sort().join('');
  const annex = read('third-place-allocation.js');
  const ok = key.length === 8 && annex.includes(`"${key}"`);
  return {
    ok,
    active: true,
    reason: ok ? 'ready' : 'annex-c-missing',
    detail: `thirdPlaceGroups=${key || 'missing'}`
  };
}

async function runReadiness(options = {}) {
  const checks = [];
  const warnings = [];
  const nowMs = (options.auditOptions && options.auditOptions.nowMs) || Date.now();
  const allowStoryBacklog = Object.prototype.hasOwnProperty.call(options, 'allowStoryBacklog')
    ? !!options.allowStoryBacklog
    : process.env.LIVE_COMPLETION_ALLOW_STORY_BACKLOG !== '0';
  let fairPlayResolutions = options.fairPlayResolutions || readLocalFairPlayResolutions();
  const baseAuditOptions = {
    ...(options.auditOptions || {}),
    allowStoryBacklog,
    skipPundit: !!(options.auditOptions || {}).skipPundit || process.env.LIVE_COMPLETION_SKIP_PUNDIT === '1',
    ignoreSnapshotLiveStatus: (options.auditOptions || {}).ignoreSnapshotLiveStatus !== false,
  };
  const audit = await LiveOpsAudit.audit(baseAuditOptions);

  add(checks, 'snapshot live-ops audit is green', audit.ok, `recovery=${audit.result_recovery.candidates}, missingStories=${audit.stories.missing}`);
  add(checks, 'no unresolved result-recovery candidates', audit.result_recovery.candidates === 0, `candidates=${audit.result_recovery.candidates}`);
  add(checks, 'no missing stories for finished matches', allowStoryBacklog || audit.stories.missing === 0, `missing=${audit.stories.missing}${allowStoryBacklog ? ', warning-only' : ''}`);
  if (allowStoryBacklog && audit.stories.missing > 0) {
    addWarning(
      warnings,
      'story_backlog_warning_only',
      'Finished matches are missing Story of the World Cup cards, but result/scoring readiness is not blocked.',
      `missing=${audit.stories.missing}`
    );
  }
  const skipPundit = !!baseAuditOptions.skipPundit;
  add(checks, 'Pundit feed is fresh', skipPundit || !!audit.pundit.fresh, `freshUntil=${audit.pundit.freshUntil || 'missing'}${skipPundit ? ', warning-only' : ''}`);
  if (skipPundit && !audit.pundit.fresh) {
    addWarning(
      warnings,
      'pundit_stale_warning_only',
      'Pundit content is stale, but result/scoring readiness is not blocked.',
      `freshUntil=${audit.pundit.freshUntil || 'missing'}`
    );
  }
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
  const rules = read('share-assets/world-cup-rules.js');
  add(checks, 'scoring excludes provider-pending finals', (/filter\(isTerminalMatch\)/.test(scoring) || /WCR\.isTerminalMatch/.test(scoring)) && /isPendingProviderFinal/.test(rules), 'finished matches must use shared terminal-match rules');
  add(checks, 'group completion requires exactly six unique fixtures', (/terminalMatches\.length\s*===\s*6/.test(scoring) || /WCR\.groupIsComplete/.test(scoring)) && /terminalMatches\.length\s*===\s*6/.test(rules) && /terminalFixtures\.size\s*===\s*6/.test(rules), 'no 5-match, duplicate, or 7-row groups');

  const app = read('app.js');
  add(checks, 'pool Pundit invite buzz is gated by effective open state', /const poolOpenForNewBuzz\s*=\s*!poolLocked\s*&&\s*\(lateEntryOpen\s*\|\|\s*!tournamentStarted\)/.test(app), 'join/share copy must not leak after kickoff');

  const livePoller = read('.github/workflows/live-poller.yml');
  const verifier = read('.github/workflows/final-result-verifier.yml');
  const manual = read('.github/workflows/manual-match-results.yml');
  const storyPublish = read('.github/workflows/publish-world-cup-stories-prepared.yml');
  const testWorkflow = read('.github/workflows/test-scoring.yml');
  const generatePundit = read('.github/workflows/generate-pundit.yml');
  const readinessMonitor = read('.github/workflows/live-completion-readiness.yml');
  const liveController = read('.github/workflows/live-match-controller.yml');

  add(
    checks,
    'live poller covers group and knockout match days',
    livePoller.includes("cron: '2,7,12,17,22,27,32,37,42,47,52,57 * 11-28 6 *'")
      && livePoller.includes("cron: '2,7,12,17,22,27,32,37,42,47,52,57 16-23 29 6 *'")
      && livePoller.includes("cron: '2,7,12,17,22,27,32,37,42,47,52,57 0-2,18-23 19 7 *'"),
    '5-minute offset schedule required for group stage and knockout windows'
  );
  add(checks, 'live poller can push refreshed snapshots', /permissions:\s*\n\s+contents:\s*write/.test(livePoller), 'verified-final path must commit match, leaderboard, banter, and Pundit snapshots');
  add(
    checks,
    'verified finals publish all leaderboard snapshots for the result version',
    !livePoller.includes("steps.verify_results.outputs.changed == 'true' && steps.score_results.outputs.changed_pool_ids != ''")
      && !verifier.includes("steps.verify_results.outputs.changed == 'true' && steps.score_results.outputs.changed_pool_ids != ''")
      && (livePoller.match(/FORCE_ALL_LEADERBOARD_SNAPSHOTS:\s*'1'/g) || []).length >= 3
      && (verifier.match(/FORCE_ALL_LEADERBOARD_SNAPSHOTS:\s*'1'/g) || []).length >= 3,
    'a verified result must refresh/prove static leaderboard snapshots even when no user score changes'
  );
  add(
    checks,
    'final verifier covers group and knockout match days',
    verifier.includes("cron: '4,19,34,49 * 11-28 6 *'")
      && verifier.includes("cron: '4,19,34,49 16-23 29 6 *'")
      && verifier.includes("cron: '4,19,34,49 0-2,18-23 19 7 *'"),
    '15-minute offset schedule required for group stage and knockout windows'
  );
  add(
    checks,
    'final verifier auto-escalates approved emergency sources',
    verifier.includes('RESULT_AUTO_EMERGENCY_SOURCES')
      && verifier.includes('RESULT_AUTO_EMERGENCY_AFTER_MINUTES')
      && verifier.includes('RESULT_AUTO_EMERGENCY_SOURCE_MODE'),
    'scheduled verifier must automatically widen to approved source-family consensus after official-source delay'
  );
  add(
    checks,
    'live poller final handoff can auto-escalate approved emergency sources',
    livePoller.includes('RESULT_AUTO_EMERGENCY_SOURCES')
      && livePoller.includes('RESULT_AUTO_EMERGENCY_AFTER_MINUTES')
      && livePoller.includes('RESULT_AUTO_EMERGENCY_SOURCE_MODE'),
    'immediate post-final verifier handoff must not depend on manual emergency workflow input'
  );
  add(
    checks,
    'readiness monitor covers production during group and knockout match days',
    readinessMonitor.includes("cron: '6,16,26,36,46,56 * 11-28 6 *'")
      && readinessMonitor.includes("cron: '6,16,26,36,46,56 16-23 29 6 *'")
      && readinessMonitor.includes("cron: '6,16,26,36,46,56 0-2,18-23 19 7 *'")
      && readinessMonitor.includes('LIVE_COMPLETION_PUBLIC_BASE_URL: https://friendlybet.live')
      && readinessMonitor.includes("LIVE_COMPLETION_GITHUB_WORKFLOWS: '1'")
      && readinessMonitor.includes('node scripts/live-completion-readiness.js'),
    'scheduled monitor must audit production public snapshots every 10 minutes during live tournament windows'
  );
  add(
    checks,
    'readiness monitor audits live DB by default',
    readinessMonitor.includes('LIVE_COMPLETION_DB_SOURCE=supabase')
      && readinessMonitor.includes('SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}')
      && readinessMonitor.includes('check_db'),
    'scheduled monitor must query Supabase unless an operator explicitly opts out'
  );
  add(
    checks,
    'readiness monitor self-heals stale active live DB',
    readinessMonitor.includes('readiness-before.json')
      && readinessMonitor.includes("name==='live DB active match state is fresh'")
      && readinessMonitor.includes('node scripts/live-poller.js')
      && readinessMonitor.includes('running one live-poller recovery pass')
      && readinessMonitor.includes('FORCE_MATCH_SNAPSHOT=1 node scripts/export-snapshots.js matches')
      && readinessMonitor.includes('data: refresh match snapshot after readiness recovery')
      && readinessMonitor.includes('gh workflow run calculate-scores-v2.yml')
      && readinessMonitor.includes('force_leaderboard_export=true')
      && /permissions:\s*\n\s+contents:\s*write\s*\n\s+actions:\s*write/.test(readinessMonitor),
    'stale active match state should trigger one direct live-poller pass, publish the match snapshot, and then hand off to forced scoring/export'
  );
  add(
    checks,
    'readiness monitor keeps Pundit warning-only for critical result readiness',
    readinessMonitor.includes("LIVE_COMPLETION_SKIP_PUNDIT: '1'"),
    'content freshness must not block result/scoring readiness'
  );
  add(
    checks,
    'live match controller backs up dropped short poller cron',
    liveController.includes('node scripts/live-controller-needed.js')
      && liveController.includes('node scripts/live-poller.js')
      && liveController.includes('LIVE_POLL_CONTROLLER_MS')
      && liveController.includes("cron: '1,21,41")
      && liveController.includes("LIVE_CONTROLLER_LEAD_MINUTES: '120'")
      && liveController.includes('gh workflow run final-result-verifier.yml')
      && /actions:\s*write/.test(liveController),
    'long controller must pre-warm, preflight, poll, and dispatch the verified final scoring pipeline'
  );

  [
    ['final-result-verifier', verifier, 'FORCE_MATCH_SNAPSHOT', 'node scripts/generate-pundit.js'],
    ['live-poller', livePoller, 'FORCE_MATCH_SNAPSHOT', 'node scripts/world-cup-story-auto-needed.js'],
    ['manual-match-results', manual, 'FORCE_MATCH_SNAPSHOT', 'node scripts/world-cup-story-auto-needed.js'],
    ['publish-world-cup-stories-prepared', storyPublish, 'FORCE_MATCH_SNAPSHOT', 'node scripts/world-cup-story-auto-needed.js'],
  ].forEach(([name, text, first, later]) => {
    add(checks, `${name} exports match snapshot before dependent context`, ordered(text, first, later), `${first} before ${later}`);
  });

  add(checks, 'standalone Pundit workflow exports/audits before build', ordered(generatePundit, 'node scripts/export-snapshots.js matches', 'node scripts/generate-pundit.js') && ordered(generatePundit, 'node scripts/live-ops-audit.js', 'node scripts/generate-pundit.js'), 'matches export + audit before build');
  add(
    checks,
    'standalone Pundit workflow covers live group-stage transitions',
    generatePundit.includes("cron: '3,13,23,33,43,53 * 11-28 6 *'")
      && /git status --porcelain public-data\/pundit\.json/.test(generatePundit)
      && /match snapshot changed without a Pundit feed change/.test(generatePundit),
    '10-minute group-stage cadence, deploys keyed to Pundit changes'
  );

  [
    'node scripts/test-scoring.js',
    'node scripts/test-fifa-bracket.js',
    'node scripts/test-third-place-allocation.js',
    'node scripts/test-two-phase-knockout-wiring.js',
    'node scripts/test-live-ops-audit.js',
    'node scripts/live-ops-audit.js',
    'node scripts/test-fair-play-resolver.js',
    'node scripts/test-live-ux-state.js',
    'node scripts/test-live-state-watchdog.js',
    'node scripts/test-match-display-state.js',
    'node scripts/test-final-result-verifier.js',
    'node scripts/test-final-result-verifier-ledger.js',
    'node scripts/test-final-result-verifier-fallback.js',
    'node scripts/test-final-result-verifier-auto-emergency.js',
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
  let workflowContextMatches = null;
  const publicBaseUrl = options.publicBaseUrl || process.env.LIVE_COMPLETION_PUBLIC_BASE_URL || '';
  if (options.publicSnapshots || publicBaseUrl) {
    try {
      const snapshots = options.publicSnapshots || await loadPublicSnapshots(publicBaseUrl, options.fetch);
      if (snapshots.fairPlay) fairPlayResolutions = snapshots.fairPlay;
      workflowContextMatches = Array.isArray(snapshots && snapshots.matches && snapshots.matches.matches)
        ? snapshots.matches.matches
        : workflowContextMatches;
      production = summarizePublicSnapshots(snapshots, nowMs);
      const productionAudit = await auditPublicSnapshots(snapshots, nowMs, {
        ...(options.auditOptions || {}),
        allowStoryBacklog,
        skipPundit,
      });
      production.audit_ok = productionAudit.ok;
      production.result_recovery = productionAudit.result_recovery;
      production.watchdog = productionAudit.watchdog;
      if (allowStoryBacklog && productionAudit.stories && productionAudit.stories.missing > 0) {
        addWarning(
          warnings,
          'production_story_backlog_warning_only',
          'Production public snapshots are missing Story of the World Cup cards, but result/scoring readiness is not blocked.',
          `missing=${productionAudit.stories.missing}`
        );
      }
      add(checks, 'production public snapshots are readable', production.matches > 0 && production.stories > 0 && production.pundit_items > 0, `matches=${production.matches}, stories=${production.stories}, pundit=${production.pundit_items}`);
      add(checks, 'production Pundit feed is fresh', skipPundit || production.pundit_fresh, `freshUntil=${production.pundit_freshUntil || 'missing'}${skipPundit ? ', warning-only' : ''}`);
      if (skipPundit && !production.pundit_fresh) {
        addWarning(
          warnings,
          'production_pundit_stale_warning_only',
          'Production Pundit content is stale, but result/scoring readiness is not blocked.',
          `freshUntil=${production.pundit_freshUntil || 'missing'}`
        );
      }
      add(checks, 'production public snapshot audit is green', productionAudit.ok, `recovery=${productionAudit.result_recovery.candidates}, errors=${productionAudit.watchdog.errors.length}`);
    } catch (err) {
      add(checks, 'production public snapshots are readable', false, err.message);
    }
  }

  let liveDb = null;
  const shouldCheckDb = options.dbMatches || options.dbSource === 'supabase' || process.env.LIVE_COMPLETION_DB_SOURCE === 'supabase';
  if (shouldCheckDb) {
    try {
      const dbMatches = options.dbMatches || await fetchSupabaseMatches(supabaseConfig, options.fetch);
      workflowContextMatches = dbMatches;
      const dbAudit = await LiveOpsAudit.audit({
        ...(options.auditOptions || {}),
        matches: dbMatches,
        allowStoryBacklog,
        skipPundit,
        ignoreSnapshotLiveStatus: false,
      });
      liveDb = {
        source: options.dbMatches ? 'in-memory' : 'supabase',
        matches: dbMatches.length,
        ok: dbAudit.ok,
        freshness: summarizeLiveDbFreshness(dbMatches, nowMs),
        completed_groups: dbAudit.completed_groups,
        result_recovery: dbAudit.result_recovery,
        watchdog: dbAudit.watchdog,
      };
      if (allowStoryBacklog && dbAudit.stories && dbAudit.stories.missing > 0) {
        addWarning(
          warnings,
          'live_db_story_backlog_warning_only',
          'Live DB audit found finished matches without Story of the World Cup cards, but result/scoring readiness is not blocked.',
          `missing=${dbAudit.stories.missing}`
        );
      }
      add(checks, 'live DB matches are readable', dbMatches.length > 0, `matches=${dbMatches.length}`);
      add(checks, 'live DB match audit is green', dbAudit.ok, `recovery=${dbAudit.result_recovery.candidates}, errors=${dbAudit.watchdog.errors.length}`);
      add(checks, 'live DB active match state is fresh', liveDb.freshness.stale === 0, `active=${liveDb.freshness.active}, stale=${liveDb.freshness.stale}${liveDb.freshness.sample.length ? `, sample=${liveDb.freshness.sample.join('; ')}` : ''}`);
      const officialBracket = summarizeOfficialKnockoutReadiness(dbMatches, fairPlayResolutions);
      liveDb.official_knockout_readiness = officialBracket;
      add(checks, 'official knockout bracket is exact when groups are complete', !officialBracket.active || officialBracket.ok, officialBracket.detail);
    } catch (err) {
      add(checks, 'live DB matches are readable', false, err.message);
    }
  }

  let workflowLiveness = null;
  const shouldCheckWorkflowLiveness = options.workflowRuns || process.env.LIVE_COMPLETION_GITHUB_WORKFLOWS === '1';
  if (shouldCheckWorkflowLiveness) {
    try {
      const livePollerRuns = options.workflowRuns && options.workflowRuns.livePoller
        ? options.workflowRuns.livePoller
        : await fetchGitHubWorkflowRuns('live-poller.yml', { fetch: options.fetch });
      const finalVerifierRuns = options.workflowRuns && options.workflowRuns.finalResultVerifier
        ? options.workflowRuns.finalResultVerifier
        : await fetchGitHubWorkflowRuns('final-result-verifier.yml', { fetch: options.fetch });
      const punditRuns = options.workflowRuns && options.workflowRuns.pundit
        ? options.workflowRuns.pundit
        : await fetchGitHubWorkflowRuns('generate-pundit.yml', { fetch: options.fetch });
      const workflowRequired = isWorkflowLivenessRequired(workflowContextMatches || readLocalMatches(), nowMs);
      workflowLiveness = {
        required: workflowRequired,
        live_poller: summarizeWorkflowLiveness(livePollerRuns, nowMs, LIVE_POLLER_STALE_MS, { required: workflowRequired }),
        final_result_verifier: summarizeWorkflowLiveness(finalVerifierRuns, nowMs, FINAL_VERIFIER_STALE_MS, { required: workflowRequired }),
        pundit: summarizeWorkflowLiveness(punditRuns, nowMs, PUNDIT_WORKFLOW_STALE_MS, { required: workflowRequired && !skipPundit }),
      };
      workflowLiveness.live_poller = applyLocalPollerRecovery(workflowLiveness.live_poller, nowMs, {
        liveDb,
        production,
        recoveryAt: options.localPollerRecoveryAt,
      });
      const greenSurface = isGreenProductionSurface({ production, liveDb }, { skipPundit });
      if (greenSurface) {
        workflowLiveness.final_result_verifier = downgradeStaleWorkflowLiveness(
          workflowLiveness.final_result_verifier,
          'production snapshots and live DB are green'
        );
        workflowLiveness.pundit = downgradeStaleWorkflowLiveness(
          workflowLiveness.pundit,
          'production snapshots and live DB are green'
        );
      }
      if (workflowLiveness.live_poller.recovered_locally) {
        addWarning(
          warnings,
          'live_poller_recovered_by_readiness_monitor',
          'Live poller workflow liveness was stale, but the readiness monitor ran a direct poller recovery and the post-recovery DB/production audit is green.',
          'Investigate GitHub cron delivery if this repeats, but do not page users when live state is fresh.'
        );
      }
      if (workflowLiveness.final_result_verifier.downgraded_after_green_surface || workflowLiveness.pundit.downgraded_after_green_surface) {
        addWarning(
          warnings,
          'helper_workflow_liveness_downgraded_after_green_surface',
          'A helper workflow was stale or last failed, but production public snapshots and live DB checks were already green.',
          'Keep investigating repeated GitHub cron gaps, but do not send readiness-failure email when users are not seeing stale scores, missing stories, or stale Pundit.'
        );
      }
      const workflowWindowDetail = workflowRequired ? 'required' : 'not in live/final coverage window';
      add(checks, 'live poller workflow ran recently', workflowLiveness.live_poller.ok, workflowLivenessDetail(workflowLiveness.live_poller, workflowWindowDetail));
      add(checks, 'final verifier workflow ran recently', workflowLiveness.final_result_verifier.ok, workflowLivenessDetail(workflowLiveness.final_result_verifier, workflowWindowDetail));
      add(checks, 'Pundit workflow ran recently', workflowLiveness.pundit.ok, workflowLivenessDetail(workflowLiveness.pundit, workflowWindowDetail));
      if (!workflowRequired) {
        const staleOutsideWindow = [workflowLiveness.live_poller, workflowLiveness.final_result_verifier, workflowLiveness.pundit]
          .some(item => item && item.latest && item.required === false && item.ok === true && item.age_minutes != null);
        if (staleOutsideWindow) {
          addWarning(
            warnings,
            'workflow_liveness_outside_match_window',
            'Live poller/final-verifier recency is being reported as warning evidence outside the active match coverage window.',
            'The readiness monitor still fails this gate inside the 90-minute pre-match through 4-hour post-kickoff window.'
          );
        }
      }
    } catch (err) {
      add(checks, 'workflow liveness is readable', false, err.message);
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
    workflow_liveness: workflowLiveness,
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
    auditPublicSnapshots,
    summarizeLiveDbFreshness,
    isWorkflowLivenessRequired,
    summarizeWorkflowLiveness,
    applyLocalPollerRecovery,
    fetchGitHubWorkflowRuns,
  };
}
