#!/usr/bin/env node
// One-command readiness gate for group-stage completion. By default it can run
// from local public snapshots and repo wiring; production and live DB proof are
// enabled explicitly with environment variables.

const fs = require('fs');
const path = require('path');

const LOCAL_SUPABASE_SECRET_KEY = 'readiness-local';
const HAD_SUPABASE_SECRET_KEY = !!process.env.SUPABASE_SECRET_KEY;
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || LOCAL_SUPABASE_SECRET_KEY;

const LiveOpsAudit = require('./live-ops-audit');

const ROOT = path.resolve(__dirname, '..');
const GROUP_STAGE_START_MS = Date.parse('2026-06-11T00:00:00Z');
const GROUP_STAGE_END_MS = Date.parse('2026-06-29T00:00:00Z');
const LIVE_DB_SCHEDULED_GRACE_MS = 12 * 60 * 1000;
const LIVE_DB_SOURCE_STALE_MS = 10 * 60 * 1000;
const LIVE_DB_ACTIVE_WINDOW_MS = 4 * 60 * 60 * 1000;
const LIVE_POLLER_STALE_MS = 20 * 60 * 1000;
const FINAL_VERIFIER_STALE_MS = 45 * 60 * 1000;
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

function isGroupStageWindow(nowMs) {
  return nowMs >= GROUP_STAGE_START_MS && nowMs < GROUP_STAGE_END_MS;
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

function isGroupStageMatch(match) {
  return String(match && match.stage || '').toUpperCase() === 'GROUP_STAGE'
    || !!(match && match.group_letter);
}

function isWorkflowLivenessRequired(matches, nowMs) {
  if (!isGroupStageWindow(nowMs)) return false;
  return (Array.isArray(matches) ? matches : []).some(match => {
    if (!isGroupStageMatch(match)) return false;
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
  const required = options.required !== false && isGroupStageWindow(nowMs);
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

async function runReadiness(options = {}) {
  const checks = [];
  const warnings = [];
  const nowMs = (options.auditOptions && options.auditOptions.nowMs) || Date.now();
  const baseAuditOptions = {
    ...(options.auditOptions || {}),
    ignoreSnapshotLiveStatus: (options.auditOptions || {}).ignoreSnapshotLiveStatus !== false,
  };
  const audit = await LiveOpsAudit.audit(baseAuditOptions);

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
  const readinessMonitor = read('.github/workflows/live-completion-readiness.yml');

  add(checks, 'live poller covers all group-stage match days', livePoller.includes("cron: '2,7,12,17,22,27,32,37,42,47,52,57 * 11-28 6 *'"), '5-minute offset June 11-28 schedule required');
  add(checks, 'live poller can push refreshed snapshots', /permissions:\s*\n\s+contents:\s*write/.test(livePoller), 'verified-final path must commit match, leaderboard, banter, and Pundit snapshots');
  add(checks, 'final verifier covers all group-stage match days', verifier.includes("cron: '4,19,34,49 * 11-28 6 *'"), '15-minute offset June 11-28 schedule required');
  add(
    checks,
    'readiness monitor covers production during group-stage match days',
    readinessMonitor.includes("cron: '6,16,26,36,46,56 * 11-28 6 *'")
      && readinessMonitor.includes('LIVE_COMPLETION_PUBLIC_BASE_URL: https://friendlybet.live')
      && readinessMonitor.includes("LIVE_COMPLETION_GITHUB_WORKFLOWS: '1'")
      && readinessMonitor.includes('node scripts/live-completion-readiness.js'),
    'scheduled monitor must audit production public snapshots every 10 minutes during June 11-28'
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
      && readinessMonitor.includes('running one live-poller recovery pass'),
    'stale active match state should trigger one direct live-poller pass before the monitor fails'
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
  let workflowContextMatches = null;
  const publicBaseUrl = options.publicBaseUrl || process.env.LIVE_COMPLETION_PUBLIC_BASE_URL || '';
  if (options.publicSnapshots || publicBaseUrl) {
    try {
      const snapshots = options.publicSnapshots || await loadPublicSnapshots(publicBaseUrl, options.fetch);
      workflowContextMatches = Array.isArray(snapshots && snapshots.matches && snapshots.matches.matches)
        ? snapshots.matches.matches
        : workflowContextMatches;
      production = summarizePublicSnapshots(snapshots, nowMs);
      const productionAudit = await auditPublicSnapshots(snapshots, nowMs, options.auditOptions || {});
      production.audit_ok = productionAudit.ok;
      production.result_recovery = productionAudit.result_recovery;
      production.watchdog = productionAudit.watchdog;
      add(checks, 'production public snapshots are readable', production.matches > 0 && production.stories > 0 && production.pundit_items > 0, `matches=${production.matches}, stories=${production.stories}, pundit=${production.pundit_items}`);
      add(checks, 'production Pundit feed is fresh', production.pundit_fresh, `freshUntil=${production.pundit_freshUntil || 'missing'}`);
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
      add(checks, 'live DB matches are readable', dbMatches.length > 0, `matches=${dbMatches.length}`);
      add(checks, 'live DB match audit is green', dbAudit.ok, `recovery=${dbAudit.result_recovery.candidates}, errors=${dbAudit.watchdog.errors.length}`);
      add(checks, 'live DB active match state is fresh', liveDb.freshness.stale === 0, `active=${liveDb.freshness.active}, stale=${liveDb.freshness.stale}${liveDb.freshness.sample.length ? `, sample=${liveDb.freshness.sample.join('; ')}` : ''}`);
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
      const workflowRequired = isWorkflowLivenessRequired(workflowContextMatches || readLocalMatches(), nowMs);
      workflowLiveness = {
        required: workflowRequired,
        live_poller: summarizeWorkflowLiveness(livePollerRuns, nowMs, LIVE_POLLER_STALE_MS, { required: workflowRequired }),
        final_result_verifier: summarizeWorkflowLiveness(finalVerifierRuns, nowMs, FINAL_VERIFIER_STALE_MS, { required: workflowRequired }),
      };
      const workflowWindowDetail = workflowRequired ? 'required' : 'not in live/final coverage window';
      add(checks, 'live poller workflow ran recently', workflowLiveness.live_poller.ok, `latest=${workflowLiveness.live_poller.latest && workflowLiveness.live_poller.latest.created_at || 'missing'}, age=${workflowLiveness.live_poller.age_minutes == null ? 'missing' : workflowLiveness.live_poller.age_minutes + 'm'}, ${workflowWindowDetail}`);
      add(checks, 'final verifier workflow ran recently', workflowLiveness.final_result_verifier.ok, `latest=${workflowLiveness.final_result_verifier.latest && workflowLiveness.final_result_verifier.latest.created_at || 'missing'}, age=${workflowLiveness.final_result_verifier.age_minutes == null ? 'missing' : workflowLiveness.final_result_verifier.age_minutes + 'm'}, ${workflowWindowDetail}`);
      if (!workflowRequired) {
        const staleOutsideWindow = [workflowLiveness.live_poller, workflowLiveness.final_result_verifier]
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
    fetchGitHubWorkflowRuns,
  };
}
