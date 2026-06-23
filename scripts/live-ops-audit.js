#!/usr/bin/env node
// FriendlyBet live operations audit. Network-free by default: reads public
// snapshots and composes the same verifier/watchdog/scoring rules used in CI.

process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'audit-local';

const fs = require('fs');
const path = require('path');
const Watchdog = require('./live-state-watchdog');
const Scoring = require('./calculate-scores-v2');
const VerifierPreflight = require('./final-result-verifier-needed');

const ROOT = path.resolve(__dirname, '..');
const MATCHES_FILE = path.join(ROOT, 'public-data', 'matches.json');
const STORIES_FILE = path.join(ROOT, 'public-data', 'world-cup-stories.json');
const PUNDIT_FILE = path.join(ROOT, 'public-data', 'pundit.json');
const PUBLIC_SNAPSHOT_ACTIVE_WINDOW_MS = 4 * 60 * 60 * 1000;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function loadSnapshotMatches() {
  const payload = readJson(MATCHES_FILE, { matches: [] });
  return Array.isArray(payload.matches) ? payload.matches : [];
}

function isPublicSnapshotLiveStatusCandidate(match, nowMs) {
  const kickoff = parseTime(match && match.match_date);
  if (!Number.isFinite(kickoff)) return false;
  const elapsed = nowMs - kickoff;
  if (elapsed < 0 || elapsed > PUBLIC_SNAPSHOT_ACTIVE_WINDOW_MS) return false;
  const status = String(match && match.status || '').toUpperCase();
  return ['TIMED', 'SCHEDULED', 'IN_PLAY', 'LIVE', 'PAUSED'].includes(status);
}

function summarizeResultRecovery(matches, nowMs, options = {}) {
  const opts = {
    minAgeMinutes: options.minAgeMinutes || 95,
    lookbackHours: options.lookbackHours || 336,
  };
  const rawCandidates = (matches || []).filter(match => VerifierPreflight.isCandidate(match, nowMs, opts));
  const ignoredSnapshotLiveStatus = options.ignoreSnapshotLiveStatus
    ? rawCandidates.filter(match => isPublicSnapshotLiveStatusCandidate(match, nowMs))
    : [];
  const ignoredRows = new Set(ignoredSnapshotLiveStatus);
  const candidates = ignoredRows.size
    ? rawCandidates.filter(match => !ignoredRows.has(match))
    : rawCandidates;
  const due = candidates.filter(match => VerifierPreflight.isBackoffDue(match, nowMs, {
    enabled: !!options.backoff,
    minAgeMinutes: opts.minAgeMinutes,
    runEveryMinutes: options.runEveryMinutes || 15,
  }));
  return {
    candidates: candidates.length,
    due: due.length,
    waiting: candidates.length - due.length,
    ignored_snapshot_live_status: ignoredSnapshotLiveStatus.length,
    sample: candidates.slice(0, 8).map(match => ({
      id: match.id,
      external_id: match.external_id,
      match: `${match.home_team_code}-${match.away_team_code}`,
      status: match.status,
      match_date: match.match_date,
    })),
  };
}

function summarizeGroupCompletion(matches) {
  const byGroup = new Map();
  for (const match of matches || []) {
    if (!match || match.stage !== 'GROUP_STAGE' || !match.group_letter) continue;
    if (!byGroup.has(match.group_letter)) byGroup.set(match.group_letter, []);
    byGroup.get(match.group_letter).push(match);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([group, rows]) => ({
      group,
      fixtures: rows.length,
      scoreable_complete: Scoring.groupIsComplete(rows),
      terminal_fixtures: new Set(rows
        .filter(match => ['FINISHED', 'AWARDED'].includes(String(match.status || '').toUpperCase()))
        .filter(match => !Scoring.isPendingProviderFinal(match))
        .map(match => Scoring.groupMatchIdentity(match))).size,
    }));
}

function summarizeStories(matches, resultRecovery = null, storiesPayload = null) {
  const stories = storiesPayload || readJson(STORIES_FILE, { items: [] });
  const storyIds = new Set((Array.isArray(stories.items) ? stories.items : [])
    .map(story => story && story.match_id)
    .filter(Boolean));
  const finished = (matches || []).filter(match =>
    String(match && match.status || '').toUpperCase() === 'FINISHED'
    && match.home_score != null
    && match.away_score != null);
  const missing = finished.filter(match => !storyIds.has(match.id));
  return {
    stories: Array.isArray(stories.items) ? stories.items.length : 0,
    finished_matches: finished.length,
    missing: missing.length,
    blocked_by_result_recovery: resultRecovery ? resultRecovery.candidates : 0,
    sample: missing.slice(0, 8).map(match => ({
      id: match.id,
      match: `${match.home_team_code}-${match.away_team_code}`,
      score: `${match.home_score}-${match.away_score}`,
    })),
  };
}

function summarizePundit(nowMs, feedOverride = null) {
  const feed = feedOverride || readJson(PUNDIT_FILE, null);
  const freshUntil = parseTime(feed && feed.freshUntil);
  const updatedAt = parseTime(feed && feed.updatedAt);
  return {
    items: Array.isArray(feed && feed.items) ? feed.items.length : 0,
    updatedAt: feed && feed.updatedAt || null,
    freshUntil: feed && feed.freshUntil || null,
    fresh: Number.isFinite(freshUntil) && freshUntil > nowMs,
    updatedAt_valid: Number.isFinite(updatedAt),
  };
}

function withoutPunditWatchdogFindings(watchdog) {
  const isPunditFinding = finding =>
    /^public-data\/pundit\.json\b/.test(String(finding || ''))
    || /^Pundit feed\b/.test(String(finding || ''))
    || /^Pundit item\b/.test(String(finding || ''))
    || /^pundit-news\.json\b/.test(String(finding || ''));
  return {
    errors: (watchdog.errors || []).filter(finding => !isPunditFinding(finding)),
    warnings: (watchdog.warnings || []).filter(finding => !isPunditFinding(finding)),
  };
}

function withoutPublicSnapshotLiveStatusErrors(watchdog) {
  const isSnapshotLiveStatusFinding = finding =>
    /: scheduled status is stale \d+m after kickoff$/.test(String(finding || ''))
    || /: live status is stale \d+h after kickoff$/.test(String(finding || ''));
  const snapshotLiveStatusErrors = (watchdog.errors || []).filter(isSnapshotLiveStatusFinding);
  return {
    errors: (watchdog.errors || []).filter(finding => !isSnapshotLiveStatusFinding(finding)),
    warnings: [
      ...(watchdog.warnings || []),
      ...snapshotLiveStatusErrors.map(finding => `public snapshot live status: ${finding}`),
    ],
  };
}

async function audit(options = {}) {
  const nowMs = options.nowMs == null ? Date.now() : options.nowMs;
  if (!Number.isFinite(nowMs)) throw new Error('Invalid audit nowMs');
  const matches = options.matches || loadSnapshotMatches();
  const watchdogRaw = await Watchdog.audit({ matches, nowMs, punditFeed: options.punditFeed || null });
  let watchdog = options.skipPundit ? withoutPunditWatchdogFindings(watchdogRaw) : watchdogRaw;
  if (options.ignoreSnapshotLiveStatus) {
    watchdog = withoutPublicSnapshotLiveStatusErrors(watchdog);
  }
  const resultRecovery = summarizeResultRecovery(matches, nowMs, options);
  const groupCompletion = summarizeGroupCompletion(matches);
  const stories = summarizeStories(matches, resultRecovery, options.storiesPayload || null);
  const pundit = summarizePundit(nowMs, options.punditFeed || null);
  const completedGroups = groupCompletion.filter(group => group.scoreable_complete).length;
  const summary = {
    source: options.matches ? 'in-memory' : 'snapshot',
    checked_at: new Date(nowMs).toISOString(),
    matches: matches.length,
    completed_groups: completedGroups,
    result_recovery: resultRecovery,
    stories,
    pundit,
    watchdog: {
      errors: watchdog.errors,
      warnings: watchdog.warnings,
    },
  };
  summary.ok = summary.watchdog.errors.length === 0
    && resultRecovery.candidates === 0
    && stories.missing === 0
    && (options.skipPundit || pundit.fresh);
  return summary;
}

if (require.main === module) {
  audit({
    lookbackHours: parseInt(process.env.LIVE_OPS_RESULT_LOOKBACK_HOURS || '', 10) || 336,
    backoff: process.env.LIVE_OPS_RESULT_BACKOFF === '1',
    skipPundit: process.env.LIVE_OPS_SKIP_PUNDIT === '1',
    ignoreSnapshotLiveStatus: process.env.LIVE_OPS_IGNORE_SNAPSHOT_LIVE_STATUS === '1',
  }).then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  }).catch(err => {
    console.error('live ops audit fatal:', err.message);
    process.exit(1);
  });
} else {
  module.exports = {
    audit,
    summarizeGroupCompletion,
    summarizeResultRecovery,
    summarizeStories,
    summarizePundit,
    withoutPunditWatchdogFindings,
    withoutPublicSnapshotLiveStatusErrors,
  };
}
