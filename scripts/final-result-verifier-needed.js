#!/usr/bin/env node
/*
 * Cheap preflight for the final-result verifier workflow.
 *
 * The expensive provider checks should run only when at least one non-terminal
 * match is old enough to plausibly need final-result recovery.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MATCHES_PATH = path.join(ROOT, 'public-data', 'matches.json');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || 'sb_publishable_Aj_p7rZjAat_-ros9gzD_g_AsPtotpU';

const TERMINAL = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);
const LIVE_STATUSES = new Set(['IN_PLAY', 'LIVE', 'PAUSED']);
const MIN_AGE_MINUTES = parseInt(process.env.RESULT_FALLBACK_MIN_AGE_MINUTES || '', 10) || 95;
const STALE_LIVE_MIN_AGE_MINUTES = parseInt(process.env.RESULT_STALE_LIVE_MIN_AGE_MINUTES || '', 10) || 70;
const STALE_LIVE_SOURCE_MINUTES = parseInt(process.env.RESULT_STALE_LIVE_SOURCE_MINUTES || '', 10) || 10;
const LOOKBACK_HOURS = parseInt(process.env.RESULT_FALLBACK_LOOKBACK_HOURS || '', 10) || 336;
const BACKOFF_ENABLED = process.env.RESULT_FALLBACK_BACKOFF === '1';
const RUN_EVERY_MINUTES = parseInt(process.env.RESULT_FALLBACK_RUN_EVERY_MINUTES || '', 10) || 15;

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
  }
  console.log(`${name}=${value}`);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

async function fetchMatchesFromSupabase() {
  const endpoint = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/matches?select=id,external_id,status,match_date,home_team_code,away_team_code,home_score,away_score,winner_code,live_clock,live_period,status_detail,live_source,source_updated_at,last_updated&order=match_date.asc,id.asc`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase matches preflight failed (${res.status}): ${body.slice(0, 180)}`);
  }
  const matches = await res.json();
  if (!Array.isArray(matches)) throw new Error('Supabase matches preflight returned a non-array payload');
  return { source: 'supabase', matches };
}

async function loadMatchesPayload() {
  if (process.env.RESULT_PREFLIGHT_SOURCE === 'snapshot') {
    return { source: 'snapshot', ...readJson(MATCHES_PATH, { matches: [] }) };
  }
  try {
    return await fetchMatchesFromSupabase();
  } catch (err) {
    console.warn(`Supabase preflight unavailable; falling back to snapshot: ${err.message}`);
    return { source: 'snapshot', ...readJson(MATCHES_PATH, { matches: [] }) };
  }
}

function isCandidate(match, nowMs, options = {}) {
  if (!match || !needsFinalVerification(match)) return false;
  const kickoff = Date.parse(match.match_date || '');
  if (!Number.isFinite(kickoff)) return false;
  const ageMs = nowMs - kickoff;
  const minAgeMinutes = options.minAgeMinutes || MIN_AGE_MINUTES;
  const lookbackHours = options.lookbackHours || LOOKBACK_HOURS;
  if (isStaleLiveCandidate(match, nowMs, options)) return true;
  return ageMs >= minAgeMinutes * 60 * 1000
    && ageMs <= lookbackHours * 60 * 60 * 1000;
}

function _status(match) {
  return String((match && match.status) || '').toUpperCase();
}

function hasNumericScore(match) {
  return match && match.home_score != null && match.away_score != null;
}

function hasLiveResidue(match) {
  return !!(match && (
    match.live_clock != null ||
    match.live_period != null ||
    match.status_detail != null ||
    match.live_source != null
  ));
}

function parseOptionalTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function isStaleLiveCandidate(match, nowMs, options = {}) {
  if (!match || !LIVE_STATUSES.has(_status(match))) return false;
  const kickoff = parseOptionalTime(match.match_date);
  if (!Number.isFinite(kickoff)) return false;
  const ageMs = nowMs - kickoff;
  const lookbackHours = options.lookbackHours || LOOKBACK_HOURS;
  if (ageMs < (options.staleLiveMinAgeMinutes || STALE_LIVE_MIN_AGE_MINUTES) * 60 * 1000) return false;
  if (ageMs > lookbackHours * 60 * 60 * 1000) return false;
  const sourceUpdated = parseOptionalTime(match.source_updated_at || match.last_updated);
  if (!Number.isFinite(sourceUpdated)) return true;
  return nowMs - sourceUpdated >= (options.staleLiveSourceMinutes || STALE_LIVE_SOURCE_MINUTES) * 60 * 1000;
}

function needsFinalVerification(match) {
  const status = _status(match);
  if (!TERMINAL.has(status)) return true;
  if (status !== 'FINISHED' && status !== 'AWARDED') return false;
  return !hasNumericScore(match) || hasLiveResidue(match);
}

function backoffIntervalMinutes(ageMinutes) {
  if (ageMinutes < 150) return 15;
  if (ageMinutes < 300) return 30;
  return 60;
}

function isBackoffDue(match, nowMs, options = {}) {
  if (!isCandidate(match, nowMs, options)) return false;
  if (isStaleLiveCandidate(match, nowMs, options)) return true;
  if (!options.enabled) return true;
  const kickoff = Date.parse(match.match_date || '');
  const ageMinutes = Math.floor((nowMs - kickoff) / 60000);
  const elapsed = ageMinutes - (options.minAgeMinutes || MIN_AGE_MINUTES);
  if (elapsed < 0) return false;
  const interval = backoffIntervalMinutes(ageMinutes);
  const windowMinutes = Math.max(1, options.runEveryMinutes || RUN_EVERY_MINUTES);
  const currentBucket = Math.floor(elapsed / interval);
  const previousBucket = Math.floor((elapsed - windowMinutes) / interval);
  return currentBucket !== previousBucket;
}

async function main() {
  const nowMs = process.env.RESULT_PREFLIGHT_NOW
    ? Date.parse(process.env.RESULT_PREFLIGHT_NOW)
    : Date.now();
  if (!Number.isFinite(nowMs)) throw new Error('Invalid RESULT_PREFLIGHT_NOW');

  const payload = await loadMatchesPayload();
  const candidates = (payload.matches || []).filter(match => isCandidate(match, nowMs, {
    minAgeMinutes: MIN_AGE_MINUTES,
    lookbackHours: LOOKBACK_HOURS,
  }));
  const dueCandidates = candidates.filter(match => isBackoffDue(match, nowMs, {
    enabled: BACKOFF_ENABLED,
    minAgeMinutes: MIN_AGE_MINUTES,
    runEveryMinutes: RUN_EVERY_MINUTES,
  }));
  const waitingCandidates = candidates.filter(match => !dueCandidates.includes(match));
  setOutput('needed', dueCandidates.length ? 'true' : 'false');
  setOutput('candidate_count', String(candidates.length));
  setOutput('due_count', String(dueCandidates.length));
  setOutput('waiting_count', String(waitingCandidates.length));
  setOutput('source', payload.source || 'unknown');

  if (candidates.length) {
    console.log('Final-result verifier candidates:');
    for (const match of candidates.slice(0, 10)) {
      const due = dueCandidates.includes(match) ? 'due' : 'waiting';
      const staleLive = isStaleLiveCandidate(match, nowMs) ? ', stale-live' : '';
      console.log(`- ${match.home_team_code}-${match.away_team_code} ${match.status} ${match.match_date} (${due}${staleLive})`);
    }
  } else {
    console.log('No final-result verifier candidates in the current match window.');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
} else {
  module.exports = {
    isCandidate,
    isBackoffDue,
    backoffIntervalMinutes,
    isStaleLiveCandidate,
    needsFinalVerification,
  };
}
