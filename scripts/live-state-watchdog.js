#!/usr/bin/env node
// ============================================================
// FriendlyBet live-state watchdog
// ============================================================
// Deterministic operational audit for the live World Cup experience. It catches
// states that users should not have to report manually: stale Pundit feeds,
// finished matches with live/provider residue, missing result stories, and
// missing leaderboard snapshots after official scores exist.
//
// Default source is public-data snapshots. Set LIVE_WATCHDOG_SOURCE=supabase
// with SUPABASE_SECRET_KEY / publishable key to audit current DB match rows.
// ============================================================

const fs = require('fs');
const path = require('path');
const {
  storyCoverageSet,
  storyCoversMatch,
} = require('./world-cup-story-coverage');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public-data');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const PUNDIT_FILE = path.join(DATA_DIR, 'pundit.json');
const NEWS_FILE = path.join(DATA_DIR, 'pundit-news.json');
const STORIES_FILE = path.join(DATA_DIR, 'world-cup-stories.json');
const LEADERBOARD_DIR = path.join(DATA_DIR, 'leaderboard');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TERMINAL_SCORE_STATUSES = new Set(['FINISHED', 'AWARDED']);
const LIVE_STATUSES = new Set(['IN_PLAY', 'LIVE', 'PAUSED']);
const SCHEDULED_STATUSES = new Set(['TIMED', 'SCHEDULED']);
const WATCHDOG_MATCH_COLS = [
  'id',
  'external_id',
  'status',
  'stage',
  'match_date',
  'home_team_code',
  'away_team_code',
  'home_score',
  'away_score',
  'winner_code',
  'live_clock',
  'live_period',
  'status_detail',
  'live_source',
  'source_updated_at',
  'last_updated'
].join(',');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function matchKey(match) {
  return match && (match.id || match.external_id || `${match.match_date}|${match.home_team_code}|${match.away_team_code}`);
}

function hasProblematicLiveResidue(match) {
  const source = String((match && match.live_source) || '').toLowerCase();
  const detail = String((match && match.status_detail) || '').trim().toLowerCase();
  if (match && (match.live_clock != null || match.live_period != null)) return true;
  if (source === 'espn-final' || detail.includes('pending verification')) return true;
  if (source === 'espn') return true;
  if (detail && !['ft', 'full time', 'final'].includes(detail)) return true;
  return false;
}

function isPendingProviderFinal(match) {
  const source = String((match && match.live_source) || '').toLowerCase();
  const detail = String((match && match.status_detail) || '').trim().toLowerCase();
  return source === 'espn-final' || detail.includes('pending verification');
}

function isDraw(match) {
  return match && match.home_score != null && match.away_score != null && Number(match.home_score) === Number(match.away_score);
}

function isKnockoutStage(stage) {
  const value = String(stage || '').trim().toUpperCase();
  return !!value && !['GROUP_STAGE', 'GROUP', 'LEAGUE'].includes(value);
}

function tournamentWindow(matches, nowMs) {
  const times = (matches || []).map(m => parseTime(m && m.match_date)).filter(Number.isFinite);
  if (!times.length) return false;
  const first = Math.min(...times);
  const last = Math.max(...times);
  return nowMs >= first - DAY_MS && nowMs <= last + 2 * DAY_MS;
}

async function fetchSupabaseMatches() {
  if (!SUPABASE_KEY) throw new Error('LIVE_WATCHDOG_SOURCE=supabase requires a Supabase key');
  const endpoint = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/matches?select=${WATCHDOG_MATCH_COLS}&order=match_date.asc,id.asc`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase matches watchdog failed (${res.status}): ${(await res.text()).slice(0, 180)}`);
  const matches = await res.json();
  if (!Array.isArray(matches)) throw new Error('Supabase matches watchdog returned a non-array payload');
  return { source: 'supabase', matches };
}

async function loadMatches() {
  if (process.env.LIVE_WATCHDOG_SOURCE === 'supabase') return fetchSupabaseMatches();
  const payload = readJson(MATCHES_FILE, { matches: [] });
  return { source: 'snapshot', matches: Array.isArray(payload.matches) ? payload.matches : [] };
}

function auditMatches(matches, nowMs, errors, warnings) {
  const residueGraceMs = (parseInt(process.env.LIVE_WATCHDOG_FINAL_GRACE_MINUTES || '', 10) || 110) * 60 * 1000;
  const liveWindowPastMs = (parseInt(process.env.LIVE_WATCHDOG_LIVE_STALE_MINUTES || '', 10) || 260) * 60 * 1000;
  const scheduledWindowPastMs = (parseInt(process.env.LIVE_WATCHDOG_SCHEDULED_STALE_MINUTES || '', 10) || 35) * 60 * 1000;
  for (const match of matches || []) {
    const key = matchKey(match);
    const status = String(match && match.status || '').toUpperCase();
    const kickoff = parseTime(match && match.match_date);
    if (!Number.isFinite(kickoff)) {
      warnings.push(`${key}: missing/invalid kickoff time`);
      continue;
    }
    if (TERMINAL_SCORE_STATUSES.has(status)) {
      if (match.home_score == null || match.away_score == null) {
        errors.push(`${key}: ${status} without numeric score`);
      }
      if (!isDraw(match) && !match.winner_code) {
        errors.push(`${key}: ${status} non-draw without winner_code`);
      }
      if (isDraw(match) && isKnockoutStage(match.stage) && !match.winner_code) {
        errors.push(`${key}: ${status} tied knockout without verified advancing team`);
      }
      if (nowMs - kickoff >= residueGraceMs && hasProblematicLiveResidue(match)) {
        errors.push(`${key}: finished match still has live/provider residue (${match.live_source || '-'} / ${match.status_detail || '-'} / ${match.live_clock || '-'})`);
      }
    }
    if (LIVE_STATUSES.has(status) && nowMs - kickoff > liveWindowPastMs) {
      errors.push(`${key}: live status is stale ${Math.round((nowMs - kickoff) / HOUR_MS)}h after kickoff`);
    }
    if (SCHEDULED_STATUSES.has(status) && nowMs - kickoff > scheduledWindowPastMs) {
      errors.push(`${key}: scheduled status is stale ${Math.round((nowMs - kickoff) / 60000)}m after kickoff`);
    }
  }
}

function feedItemMatchId(item) {
  const id = String((item && item.id) || '');
  const match = id.match(/^(live|fixture|result|verify)-(.+)$/);
  return match ? { type: match[1], matchId: match[2] } : null;
}

function auditPunditItemMatchState(feed, matches, nowMs, errors) {
  const byId = new Map((matches || []).map(match => [String(match && match.id), match]));
  const scheduledWindowPastMs = (parseInt(process.env.LIVE_WATCHDOG_SCHEDULED_STALE_MINUTES || '', 10) || 35) * 60 * 1000;
  const liveWindowPastMs = (parseInt(process.env.LIVE_WATCHDOG_LIVE_STALE_MINUTES || '', 10) || 260) * 60 * 1000;
  for (const item of (feed && Array.isArray(feed.items) ? feed.items : [])) {
    const ref = feedItemMatchId(item);
    if (!ref) continue;
    const match = byId.get(String(ref.matchId));
    if (!match) continue;
    const key = matchKey(match);
    const status = String(match && match.status || '').toUpperCase();
    const kickoff = parseTime(match && match.match_date);
    const elapsed = Number.isFinite(kickoff) ? nowMs - kickoff : NaN;
    if (ref.type === 'live') {
      if (!LIVE_STATUSES.has(status)) errors.push(`Pundit item ${item.id}: live commentary references non-live match ${key} (${status || 'unknown'})`);
      else if (Number.isFinite(elapsed) && elapsed > liveWindowPastMs) errors.push(`Pundit item ${item.id}: live commentary references stale live match ${key}`);
    }
    if (ref.type === 'fixture') {
      if (!SCHEDULED_STATUSES.has(status)) errors.push(`Pundit item ${item.id}: fixture commentary references non-scheduled match ${key} (${status || 'unknown'})`);
      else if (Number.isFinite(kickoff) && kickoff <= nowMs) errors.push(`Pundit item ${item.id}: fixture commentary references past-kickoff match ${key}`);
    }
    if (ref.type === 'result') {
      if (!TERMINAL_SCORE_STATUSES.has(status) || isPendingProviderFinal(match)) errors.push(`Pundit item ${item.id}: result commentary references unverified match ${key} (${status || 'unknown'})`);
    }
    if (ref.type === 'verify') {
      const staleScheduled = SCHEDULED_STATUSES.has(status) && Number.isFinite(elapsed) && elapsed > scheduledWindowPastMs;
      const staleLive = LIVE_STATUSES.has(status) && Number.isFinite(elapsed) && elapsed > liveWindowPastMs;
      if (!staleScheduled && !staleLive && !isPendingProviderFinal(match)) errors.push(`Pundit item ${item.id}: verification commentary references match without recovery state ${key} (${status || 'unknown'})`);
    }
  }
}

function auditPundit(matches, nowMs, errors, warnings, feedOverride = null) {
  if (!tournamentWindow(matches, nowMs)) return;
  const feed = feedOverride || readJson(PUNDIT_FILE, null);
  if (!feed) {
    errors.push('public-data/pundit.json missing or invalid during tournament window');
    return;
  }
  const freshUntil = parseTime(feed.freshUntil);
  const updatedAt = parseTime(feed.updatedAt);
  if (!Array.isArray(feed.items) || feed.items.length === 0) errors.push('Pundit feed is empty during tournament window');
  if (!Number.isFinite(updatedAt)) errors.push('Pundit feed missing updatedAt');
  if (!Number.isFinite(freshUntil) || freshUntil <= nowMs) errors.push('Pundit feed is stale or missing freshUntil');

  const news = readJson(NEWS_FILE, { items: [] });
  const newsItems = Array.isArray(news.items) ? news.items : [];
  if (newsItems.length === 0) {
    const msg = 'pundit-news.json is empty during tournament window';
    if (process.env.LIVE_WATCHDOG_REQUIRE_NEWS === '1') errors.push(msg);
    else warnings.push(msg);
  }
  auditPunditItemMatchState(feed, matches, nowMs, errors);
}

function auditStories(matches, errors) {
  const stories = readJson(STORIES_FILE, { items: [] });
  const storyCoverage = storyCoverageSet(Array.isArray(stories.items) ? stories.items : [], matches || []);
  const finished = (matches || []).filter(m =>
    String(m && m.status || '').toUpperCase() === 'FINISHED'
    && m.home_score != null
    && m.away_score != null);
  const missing = finished.filter(m => !storyCoversMatch(storyCoverage, m));
  if (missing.length) {
    errors.push(`World Cup stories missing for ${missing.length} finished match(es): ${missing.slice(0, 8).map(matchKey).join(', ')}`);
  }
}

function auditLeaderboardSnapshots(errors, warnings) {
  if (!fs.existsSync(LEADERBOARD_DIR)) {
    warnings.push('public-data/leaderboard directory is missing');
    return;
  }
  const files = fs.readdirSync(LEADERBOARD_DIR).filter(name => name.endsWith('.json'));
  if (!files.length) {
    warnings.push('no public leaderboard snapshots found');
    return;
  }
  for (const file of files) {
    const payload = readJson(path.join(LEADERBOARD_DIR, file), null);
    if (!payload || !Array.isArray(payload.standings)) {
      errors.push(`${file}: invalid leaderboard snapshot`);
      continue;
    }
    if (payload.standings.length && payload.standings.some(row => row.recovery_code_hash || row.recovery_code)) {
      errors.push(`${file}: unsafe recovery data leaked into leaderboard snapshot`);
    }
  }
}

async function audit(opts = {}) {
  const nowMs = opts.nowMs == null
    ? (process.env.LIVE_WATCHDOG_NOW ? Date.parse(process.env.LIVE_WATCHDOG_NOW) : Date.now())
    : opts.nowMs;
  if (!Number.isFinite(nowMs)) throw new Error('Invalid LIVE_WATCHDOG_NOW');
  const loaded = opts.matches ? { source: 'in-memory', matches: opts.matches } : await loadMatches();
  const errors = [];
  const warnings = [];
  auditMatches(loaded.matches, nowMs, errors, warnings);
  auditPundit(loaded.matches, nowMs, errors, warnings, opts.punditFeed || null);
  if (process.env.LIVE_WATCHDOG_SKIP_STORIES !== '1') auditStories(loaded.matches, errors);
  if (process.env.LIVE_WATCHDOG_SKIP_LEADERBOARDS !== '1') auditLeaderboardSnapshots(errors, warnings);
  return { source: loaded.source, checkedMatches: loaded.matches.length, errors, warnings };
}

if (require.main === module) {
  audit().then(result => {
    console.log(`live-state watchdog: source=${result.source} matches=${result.checkedMatches}`);
    result.warnings.forEach(w => console.warn(`warning: ${w}`));
    if (result.errors.length) {
      console.error('live-state watchdog FAILED:');
      result.errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }
    console.log('live-state watchdog OK');
  }).catch(err => {
    console.error('live-state watchdog fatal:', err.message);
    process.exit(1);
  });
} else {
  module.exports = {
    audit,
    auditMatches,
    auditPundit,
    auditPunditItemMatchState,
    hasProblematicLiveResidue,
    isPendingProviderFinal,
    isKnockoutStage,
    tournamentWindow,
  };
}
