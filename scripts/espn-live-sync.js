// ============================================================
// FriendlyBet - ESPN live score sync
// ============================================================
// Primary live-display source. Reads active/near-kickoff matches from Supabase,
// fetches ESPN's public World Cup scoreboard, matches fixtures by teams + kickoff
// timestamp, and patches the DB with live score/status plus provider clock fields
// when the optional migration exists.
//
// This script updates match reference data only. It never writes picks/users.
// ============================================================

const { fbGuardDelete } = require('./lib-guard');
const { getTeamCode } = require('./smart-sync.js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.PROD_ANON_KEY;
const ESPN_SCOREBOARD_BASE = process.env.ESPN_SCOREBOARD_BASE || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

const TERMINAL = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);
const TEAM_CODE_RE = /^[A-Z]{3}$/;
const MAX_KICKOFF_DELTA_MS = (parseInt(process.env.ESPN_LIVE_MAX_KICKOFF_DELTA_HOURS || '', 10) || 12) * 60 * 60 * 1000;

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callSupabase(method, table, data = null, query = '') {
  fbGuardDelete(method, table);
  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates'
    },
    body: data ? JSON.stringify(data) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} failed: ${res.status} - ${text.slice(0, 240)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function matchesHasLiveColumns() {
  try {
    await callSupabase('GET', 'matches', null, '?select=live_clock,source_updated_at&limit=1');
    return true;
  } catch (_) {
    return false;
  }
}

function normalizeTeamCode(name, fallbackCode) {
  const mapped = getTeamCode(name);
  if (mapped) return mapped;
  const raw = String(fallbackCode || name || '').trim().toUpperCase();
  return TEAM_CODE_RE.test(raw) ? raw : null;
}

function looksLikeRunningClock(eventStatus = {}) {
  const type = eventStatus.type || {};
  const text = `${String(eventStatus.displayClock || '')} ${String(type.shortDetail || type.detail || type.description || '')}`.toUpperCase();
  if (/\b(HT|HALF[-\s]?TIME)\b/.test(text)) return false;
  const minute = Number(((text.match(/\b(\d{1,3})\s*'?/) || [])[1]));
  if (Number.isFinite(minute) && minute >= 46) return true;
  const period = Number(eventStatus.period);
  return Number.isFinite(period) && period >= 2 && Number.isFinite(minute);
}

function mapEspnStatus(eventStatus = {}) {
  const type = eventStatus.type || {};
  const state = String(type.state || '').toLowerCase();
  const name = String(type.name || '').toUpperCase();
  const desc = String(type.description || type.detail || type.shortDetail || '').toUpperCase();
  if (type.completed === true || state === 'post') return 'FINISHED';
  if (name.includes('POSTPONED') || desc.includes('POSTPONED')) return 'POSTPONED';
  if (name.includes('CANCELED') || name.includes('CANCELLED') || desc.includes('CANCELED') || desc.includes('CANCELLED')) return 'CANCELLED';
  if (state === 'in' && looksLikeRunningClock(eventStatus)) return 'IN_PLAY';
  if (/\b(HT|HALF[-_\s]?TIME)\b/.test(`${name} ${desc}`)) return 'PAUSED';
  if (state === 'in' || name.includes('IN_PROGRESS') || name.includes('FIRST_HALF') || name.includes('SECOND_HALF')) return 'IN_PLAY';
  return 'TIMED';
}

function transformEspnEvent(event) {
  const comp = event && event.competitions && event.competitions[0];
  const competitors = (comp && comp.competitors) || [];
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');
  const statusObj = (comp && comp.status) || (event && event.status) || {};
  const type = statusObj.type || {};
  const status = mapEspnStatus(statusObj);
  const liveOrFinal = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED' || status === 'AWARDED';
  const homeScore = home && home.score != null && home.score !== '' ? parseInt(home.score, 10) : null;
  const awayScore = away && away.score != null && away.score !== '' ? parseInt(away.score, 10) : null;
  const homeCode = normalizeTeamCode(home && home.team && (home.team.displayName || home.team.name), home && home.team && home.team.abbreviation);
  const awayCode = normalizeTeamCode(away && away.team && (away.team.displayName || away.team.name), away && away.team && away.team.abbreviation);

  let winnerCode = null;
  if (home && home.winner === true) winnerCode = homeCode;
  else if (away && away.winner === true) winnerCode = awayCode;
  else if (status === 'FINISHED' && Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
    if (homeScore > awayScore) winnerCode = homeCode;
    else if (awayScore > homeScore) winnerCode = awayCode;
  }

  const displayClock = String(statusObj.displayClock || '').trim();
  return {
    source: 'espn',
    api_id: event && event.id,
    homeCode,
    awayCode,
    fixtureDate: (comp && (comp.startDate || comp.date)) || (event && event.date),
    status,
    homeScore: liveOrFinal && Number.isFinite(homeScore) ? homeScore : null,
    awayScore: liveOrFinal && Number.isFinite(awayScore) ? awayScore : null,
    winnerCode,
    liveClock: liveOrFinal && displayClock && displayClock !== "0'" ? displayClock : null,
    period: Number.isFinite(statusObj.period) ? statusObj.period : null,
    statusDetail: type.shortDetail || type.detail || type.description || type.name || status,
    rawHome: home && home.team ? (home.team.displayName || home.team.name || home.team.abbreviation) : null,
    rawAway: away && away.team ? (away.team.displayName || away.team.name || away.team.abbreviation) : null
  };
}

function fixtureMatchesDbMatch(dbMatch, apiMatch) {
  if (!dbMatch || !apiMatch) return false;
  if (dbMatch.home_team_code !== apiMatch.homeCode) return false;
  if (dbMatch.away_team_code !== apiMatch.awayCode) return false;
  const a = Date.parse(dbMatch.match_date);
  const b = Date.parse(apiMatch.fixtureDate);
  if (isNaN(a) || isNaN(b)) return false;
  return Math.abs(a - b) <= MAX_KICKOFF_DELTA_MS;
}

function ymdUtc(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function espnScoreboardDatesFor(matches) {
  const dates = new Set();
  for (const m of matches || []) {
    const t = Date.parse(m && m.match_date);
    if (isNaN(t)) continue;
    dates.add(ymdUtc(t - 24 * 60 * 60 * 1000));
    dates.add(ymdUtc(t));
    dates.add(ymdUtc(t + 24 * 60 * 60 * 1000));
  }
  return [...dates].sort();
}

async function callEspnScoreboard(dateYmd) {
  const res = await fetchWithTimeout(`${ESPN_SCOREBOARD_BASE}?dates=${encodeURIComponent(dateYmd)}`, {
    headers: { 'User-Agent': 'FriendlyBet live score sync (+https://friendlybet.live)' }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ESPN scoreboard failed: ${res.status} - ${text.slice(0, 180)}`);
  }
  return await res.json();
}

async function loadEspnEventsFor(matches) {
  const dates = espnScoreboardDatesFor(matches);
  const all = [];
  const seen = new Set();
  for (const ymd of dates) {
    const json = await callEspnScoreboard(ymd);
    for (const event of (Array.isArray(json.events) ? json.events : [])) {
      const key = String((event && event.id) || JSON.stringify(event && { name: event.name, date: event.date }));
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(event);
    }
  }
  return all;
}

async function loadCandidateMatches(now = new Date()) {
  const start = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 15 * 60 * 1000);
  const q = `?select=id,external_id,status,match_date,home_team_code,away_team_code,source_updated_at,last_updated` +
            `&match_date=gte.${start.toISOString()}&match_date=lte.${end.toISOString()}&order=match_date.asc`;
  const rows = await callSupabase('GET', 'matches', null, q);
  return (rows || []).filter(m => !TERMINAL.has(String(m.status || '').toUpperCase()));
}

function buildPatch(espnMatch, opts = {}) {
  const nowIso = opts.nowIso || new Date().toISOString();
  const patch = {
    status: espnMatch.status,
    last_updated: nowIso
  };
  if (espnMatch.status !== 'TIMED') {
    patch.home_score = espnMatch.homeScore;
    patch.away_score = espnMatch.awayScore;
    patch.winner_code = espnMatch.winnerCode;
  }
  if (opts.includeLiveColumns) {
    const terminal = espnMatch.status === 'FINISHED' || espnMatch.status === 'AWARDED';
    patch.live_clock = terminal ? null : espnMatch.liveClock;
    patch.live_period = terminal ? null : espnMatch.period;
    // Keep ESPN-only final writes visibly audit-pending for the final verifier.
    // The ESPN+FIFA verifier clears these fields once the result is confirmed.
    patch.status_detail = terminal ? 'ESPN final pending verification' : espnMatch.statusDetail;
    patch.live_source = terminal ? 'espn-final' : 'espn';
    patch.source_updated_at = nowIso;
  }
  return patch;
}

let heartbeatWarned = false;
async function writeLiveHeartbeat(dbMatch, patch, opts = {}) {
  if (!dbMatch || !dbMatch.id || opts.dryRun || opts.skipHeartbeat) return;
  const nowIso = opts.nowIso || new Date().toISOString();
  const sourceMs = Date.parse(patch && patch.source_updated_at || nowIso);
  const nowMs = Date.parse(nowIso);
  const sourceAgeSeconds = Number.isFinite(sourceMs) && Number.isFinite(nowMs)
    ? Math.max(0, Math.round((nowMs - sourceMs) / 1000))
    : null;
  const payload = [{
    match_id: dbMatch.id,
    external_id: dbMatch.external_id || null,
    controller_owner: process.env.GITHUB_RUN_ID ? `github:${process.env.GITHUB_RUN_ID}` : 'local-live-sync',
    last_provider_poll_at: nowIso,
    last_successful_live_write_at: nowIso,
    last_status: patch && patch.status || dbMatch.status || null,
    source_age_seconds: sourceAgeSeconds,
    updated_at: nowIso
  }];
  try {
    await callSupabase('POST', 'match_live_heartbeats', payload, '?on_conflict=match_id');
  } catch (err) {
    if (!heartbeatWarned) {
      heartbeatWarned = true;
      console.warn(`Live heartbeat write skipped: ${err.message}`);
    }
  }
}

async function syncEspnLive(opts = {}) {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY or PROD_ANON_KEY');
  const now = opts.now || new Date();
  const candidates = opts.matches || await loadCandidateMatches(now);
  console.log(`ESPN live sync: ${candidates.length} candidate match(es).`);
  if (!candidates.length) return { checked: 0, updated: 0, skipped: 0, applied: [] };

  const includeLiveColumns = opts.includeLiveColumns != null ? !!opts.includeLiveColumns : await matchesHasLiveColumns();
  if (!includeLiveColumns) console.warn('ESPN live sync: live display columns missing - updating score/status only.');

  const rawEvents = opts.espnEvents || await loadEspnEventsFor(candidates);
  const events = rawEvents.map(transformEspnEvent);
  let updated = 0;
  let skipped = 0;
  let finalDetected = 0;
  const applied = [];
  const nowIso = now.toISOString();

  for (const dbMatch of candidates) {
    const matches = events.filter(e => fixtureMatchesDbMatch(dbMatch, e));
    const label = `${dbMatch.home_team_code} vs ${dbMatch.away_team_code} (${dbMatch.external_id})`;
    if (matches.length !== 1) {
      skipped++;
      console.log(`ESPN live sync skip ${label}: ${matches.length ? 'multiple matching ESPN events' : 'no matching ESPN event'}`);
      continue;
    }
    const patch = buildPatch(matches[0], { nowIso, includeLiveColumns });
    if (patch.status === 'FINISHED' || patch.status === 'AWARDED' || patch.live_source === 'espn-final') {
      finalDetected++;
    }
    console.log(`ESPN live sync apply ${label}: status=${patch.status}, score=${patch.home_score ?? '-'}-${patch.away_score ?? '-'}, clock=${patch.live_clock || '-'}`);
    if (!opts.dryRun) {
      await callSupabase('PATCH', 'matches', patch, `?external_id=eq.${encodeURIComponent(dbMatch.external_id)}`);
      await writeLiveHeartbeat(dbMatch, patch, { nowIso, skipHeartbeat: opts.skipHeartbeat });
    }
    applied.push({
      match_id: dbMatch.id || null,
      external_id: dbMatch.external_id,
      status: patch.status,
      home_score: patch.home_score,
      away_score: patch.away_score,
      live_clock: patch.live_clock || null,
      source_updated_at: patch.source_updated_at || nowIso
    });
    updated++;
  }

  return { checked: candidates.length, updated, skipped, finalDetected, applied };
}

if (require.main === module) {
  syncEspnLive({ dryRun: process.argv.includes('--dry-run') })
    .then(r => console.log(`ESPN live sync done. checked=${r.checked} updated=${r.updated} skipped=${r.skipped}`))
    .catch(err => { console.error('Fatal:', err.message); process.exit(1); });
} else {
  module.exports = {
    buildPatch,
    espnScoreboardDatesFor,
    fixtureMatchesDbMatch,
    mapEspnStatus,
    normalizeTeamCode,
    syncEspnLive,
    transformEspnEvent,
    writeLiveHeartbeat,
    __setFetch: (fn) => { globalThis.fetch = fn; }
  };
}
