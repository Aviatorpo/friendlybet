// ============================================================
// FriendlyBet - ESPN + FIFA final-result verifier
// ============================================================
// Conservative multi-source recovery for matches that should be over but are
// still missing a final result. It reads ESPN's public scoreboard JSON and
// FIFA's official calendar feed. A final write requires ESPN + FIFA to agree.
//
// Default mode is DRY RUN. It only writes to Supabase when called with --apply.
// Required for live use:
//   SUPABASE_URL, SUPABASE_SECRET_KEY
// ============================================================

const fs = require('fs');
const path = require('path');
const { fbGuardDelete } = require('./lib-guard');
const { getTeamCode } = require('./smart-sync.js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.PROD_ANON_KEY;
const HAS_SERVICE_KEY = !!process.env.SUPABASE_SECRET_KEY;
const ESPN_SCOREBOARD_BASE = process.env.ESPN_SCOREBOARD_BASE || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const FIFA_CALENDAR_BASE = process.env.FIFA_CALENDAR_BASE || 'https://api.fifa.com/api/v3/calendar/matches';
const FIFA_COMPETITION_ID = process.env.FIFA_COMPETITION_ID || '17';

function csvList(value, fallback = '') {
  return String(value || fallback)
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

const TERMINAL = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);
const RESULT_TERMINAL = new Set(['FINISHED', 'AWARDED']);
const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const TEAM_CODE_RE = /^[A-Z]{3}$/;

const MIN_AGE_MINUTES = parseInt(process.env.RESULT_FALLBACK_MIN_AGE_MINUTES || '', 10) || 95;
const LOOKBACK_HOURS = parseInt(process.env.RESULT_FALLBACK_LOOKBACK_HOURS || '', 10) || 336;
const MAX_KICKOFF_DELTA_MS = (parseInt(process.env.RESULT_FALLBACK_MAX_KICKOFF_DELTA_HOURS || '', 10) || 12) * 60 * 60 * 1000;
const MIN_SOURCES = parseInt(process.env.RESULT_FALLBACK_MIN_SOURCES || '', 10) || 1;
const REQUIRED_SOURCES = csvList(process.env.RESULT_FALLBACK_REQUIRED_SOURCES, 'espn,fifa');
const CONSENSUS_FALLBACK_MIN_SOURCES = parseInt(process.env.RESULT_CONSENSUS_FALLBACK_MIN_SOURCES || '', 10) || 0;
const CONSENSUS_FALLBACK_BLOCK_SOURCES = csvList(process.env.RESULT_CONSENSUS_FALLBACK_BLOCK_SOURCES, 'fifa');
const ENABLED_SOURCES = csvList(process.env.RESULT_FALLBACK_SOURCES, 'espn,fifa');
const SOURCE_MODE = String(process.env.RESULT_FALLBACK_SOURCE_MODE || 'all').trim().toLowerCase();
const SOURCE_ROTATION_MINUTES = parseInt(process.env.RESULT_FALLBACK_ROTATION_MINUTES || '', 10) || 15;
const OBSERVATION_TTL_MINUTES = parseInt(process.env.RESULT_FALLBACK_OBSERVATION_TTL_MINUTES || '', 10) || 180;
const LEDGER_ENABLED = process.env.RESULT_FALLBACK_LEDGER !== '0';
const LEDGER_WRITE_DRY_RUN = process.env.RESULT_FALLBACK_LEDGER_WRITE_DRY_RUN === '1';
const CANDIDATE_LEDGER_TABLE = 'result_verification_candidates';
const OBSERVATION_LEDGER_TABLE = 'result_verification_observations';
const SOURCE_FAMILIES = {
  espn: 'scoreboard:espn',
  fifa: 'official:fifa',
  fifa_calendar: 'official:fifa',
  fifa_report: 'official:fifa',
  bbc: 'scoreboard:bbc',
  guardian: 'media:guardian',
  fox: 'scoreboard:fox',
  cbs: 'scoreboard:cbs',
};

function setGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
}

function writeJsonReport(file, payload) {
  if (!file) return;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function _status(m) {
  return String((m && m.status) || '').toUpperCase();
}

function hasNumericScore(m) {
  return m && m.home_score != null && m.away_score != null;
}

function hasLiveResidue(m) {
  return !!(m && (
    m.live_clock != null ||
    m.live_period != null ||
    m.status_detail != null ||
    m.live_source != null
  ));
}

function needsFinalVerification(m) {
  const status = _status(m);
  if (!TERMINAL.has(status)) return true;
  if (!RESULT_TERMINAL.has(status)) return false;
  return !hasNumericScore(m) || hasLiveResidue(m);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isStuckCandidate(m, nowMs = Date.now()) {
  if (!m || !needsFinalVerification(m)) return false;
  if (!m.home_team_code || !m.away_team_code || !m.match_date) return false;
  const ko = Date.parse(m.match_date);
  if (isNaN(ko)) return false;
  return nowMs - ko >= MIN_AGE_MINUTES * 60 * 1000;
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
    throw new Error(`Supabase ${method} ${table} failed: ${res.status} - ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function isLedgerUnavailableError(err) {
  const msg = String(err && err.message || '');
  return /result_verification_|PGRST205|PGRST116|404|42P01|does not exist|schema cache/i.test(msg);
}

async function tryLedgerCall(report, label, fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    const entry = {
      ok: false,
      operation: label,
      error: err.message,
      degraded: isLedgerUnavailableError(err),
    };
    report.ledger.operations.push(entry);
    if (!entry.degraded) console.warn(`Result verifier ledger ${label} failed: ${err.message}`);
    return { ok: false, error: err };
  }
}

async function callEspnScoreboard(dateYmd) {
  const res = await fetchWithTimeout(`${ESPN_SCOREBOARD_BASE}?dates=${encodeURIComponent(dateYmd)}`, {
    headers: { 'User-Agent': 'FriendlyBet result verifier (+https://friendlybet.live)' }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ESPN scoreboard failed: ${res.status} - ${text.slice(0, 180)}`);
  }
  return await res.json();
}

async function callFifaCalendar(fromYmd, toYmd) {
  const qs = new URLSearchParams({
    language: 'en',
    count: '100',
    idCompetition: FIFA_COMPETITION_ID,
    from: fromYmd,
    to: toYmd
  });
  const res = await fetchWithTimeout(`${FIFA_CALENDAR_BASE}?${qs.toString()}`, {
    headers: { 'User-Agent': 'FriendlyBet result verifier (+https://friendlybet.live)' }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FIFA calendar failed: ${res.status} - ${text.slice(0, 180)}`);
  }
  return await res.json();
}

function transformEspnEvent(event) {
  const comp = event && event.competitions && event.competitions[0];
  const competitors = (comp && comp.competitors) || [];
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');
  const homeCode = normalizeTeamCode(home && home.team && (home.team.displayName || home.team.name || home.team.abbreviation), home && home.team && home.team.abbreviation);
  const awayCode = normalizeTeamCode(away && away.team && (away.team.displayName || away.team.name || away.team.abbreviation), away && away.team && away.team.abbreviation);
  const status = (comp && comp.status) || (event && event.status) || {};
  const type = status.type || {};
  const completed = type.completed === true || String(type.state || '').toLowerCase() === 'post';
  const statusShort = completed ? 'FT' : String(type.name || '').toUpperCase();
  const fixtureDate = (comp && (comp.startDate || comp.date)) || (event && event.date);
  const homeScore = home && home.score != null && home.score !== '' ? parseInt(home.score, 10) : null;
  const awayScore = away && away.score != null && away.score !== '' ? parseInt(away.score, 10) : null;

  let winnerCode = null;
  if (home && home.winner === true) winnerCode = homeCode;
  else if (away && away.winner === true) winnerCode = awayCode;
  else if (Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
    if (homeScore > awayScore) winnerCode = homeCode;
    else if (awayScore > homeScore) winnerCode = awayCode;
  }

  return {
    source: 'espn',
    api_id: event && event.id,
    homeCode,
    awayCode,
    statusShort,
    fixtureDate,
    homeScore: Number.isFinite(homeScore) ? homeScore : null,
    awayScore: Number.isFinite(awayScore) ? awayScore : null,
    winnerCode,
    rawHome: home && home.team ? (home.team.displayName || home.team.name) : null,
    rawAway: away && away.team ? (away.team.displayName || away.team.name) : null
  };
}

function localizedName(arr) {
  const items = Array.isArray(arr) ? arr : [];
  return (items.find(x => /^en/i.test(String(x.Locale || ''))) || items[0] || {}).Description || null;
}

function transformFifaMatch(match) {
  const home = match && match.Home;
  const away = match && match.Away;
  const homeCode = normalizeTeamCode(localizedName(home && home.TeamName), home && home.IdCountry);
  const awayCode = normalizeTeamCode(localizedName(away && away.TeamName), away && away.IdCountry);
  const homeScore = home && typeof home.Score === 'number' ? home.Score : null;
  const awayScore = away && typeof away.Score === 'number' ? away.Score : null;
  const isFinal = Number(match && match.MatchStatus) === 0 && homeScore != null && awayScore != null;

  let winnerCode = null;
  if (isFinal && match && match.Winner && home && match.Winner === home.IdTeam) winnerCode = homeCode;
  else if (isFinal && match && match.Winner && away && match.Winner === away.IdTeam) winnerCode = awayCode;
  else if (isFinal) {
    if (homeScore > awayScore) winnerCode = homeCode;
    else if (awayScore > homeScore) winnerCode = awayCode;
  }

  return {
    source: 'fifa',
    api_id: match && match.IdMatch,
    homeCode,
    awayCode,
    statusShort: isFinal ? 'FT' : 'SCHEDULED',
    fixtureDate: match && match.Date,
    homeScore,
    awayScore,
    winnerCode,
    rawHome: localizedName(home && home.TeamName) || (home && home.IdCountry),
    rawAway: localizedName(away && away.TeamName) || (away && away.IdCountry)
  };
}

function normalizeTeamCode(name, fallbackCode) {
  const mapped = getTeamCode(name);
  if (mapped) return mapped;
  const raw = String(fallbackCode || name || '').trim().toUpperCase();
  return TEAM_CODE_RE.test(raw) ? raw : null;
}

function fixtureMatchesDbMatch(dbMatch, sourceMatch) {
  if (!dbMatch || !sourceMatch) return false;
  if (dbMatch.home_team_code !== sourceMatch.homeCode) return false;
  if (dbMatch.away_team_code !== sourceMatch.awayCode) return false;
  const a = Date.parse(dbMatch.match_date);
  const b = Date.parse(sourceMatch.fixtureDate);
  if (isNaN(a) || isNaN(b)) return false;
  return Math.abs(a - b) <= MAX_KICKOFF_DELTA_MS;
}

function findMatchingFixture(dbMatch, sourceMatches, transform = x => x) {
  const matches = (sourceMatches || [])
    .map(transform)
    .filter(fx => fixtureMatchesDbMatch(dbMatch, fx));
  if (matches.length !== 1) return { match: null, reason: matches.length === 0 ? 'no exact fixture match' : 'multiple fixture matches' };
  return { match: matches[0], reason: null };
}

function buildUpdateFromVerifiedFixture(sourceMatch, nowIso = new Date().toISOString()) {
  if (!sourceMatch) return { update: null, reason: 'missing source match' };
  if (!FINAL_STATUSES.has(sourceMatch.statusShort)) return { update: null, reason: `not final (${sourceMatch.statusShort || 'unknown'})` };
  if (sourceMatch.homeScore == null || sourceMatch.awayScore == null) return { update: null, reason: 'final status without numeric score' };
  return {
    update: {
      home_score: sourceMatch.homeScore,
      away_score: sourceMatch.awayScore,
      status: (sourceMatch.statusShort === 'AWD' || sourceMatch.statusShort === 'WO') ? 'AWARDED' : 'FINISHED',
      winner_code: sourceMatch.winnerCode,
      live_clock: null,
      live_period: null,
      status_detail: null,
      live_source: null,
      source_updated_at: nowIso,
      last_updated: nowIso
    },
    reason: null
  };
}

async function loadStuckMatches(now = new Date()) {
  const end = new Date(now.getTime() - MIN_AGE_MINUTES * 60 * 1000);
  const start = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const q = `?select=external_id,status,match_date,home_team_code,away_team_code,home_score,away_score,winner_code,live_clock,live_period,status_detail,live_source&match_date=gte.${start.toISOString()}&match_date=lte.${end.toISOString()}&order=match_date.asc`;
  const rows = await callSupabase('GET', 'matches', null, q);
  return (rows || []).filter(m => isStuckCandidate(m, now.getTime()));
}

async function loadEspnEventsFor(matches) {
  if (!matches.length) return [];
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

async function loadFifaMatchesFor(matches) {
  if (!matches.length) return [];
  const dates = matches.map(m => Date.parse(m.match_date)).filter(t => !isNaN(t)).sort((a, b) => a - b);
  const from = isoDate(dates[0] - 24 * 60 * 60 * 1000);
  const to = isoDate(dates[dates.length - 1] + 24 * 60 * 60 * 1000);
  const json = await callFifaCalendar(from, to);
  return Array.isArray(json.Results) ? json.Results : [];
}

function sourceRegistry() {
  return {
    espn: {
      load: loadEspnEventsFor,
      transform: transformEspnEvent,
    },
    fifa: {
      load: loadFifaMatchesFor,
      transform: transformFifaMatch,
    },
  };
}

function supportedSources(sources = ENABLED_SOURCES) {
  const registry = sourceRegistry();
  return (sources || []).filter(source => registry[source]);
}

function sourcesForRun(now = new Date(), options = {}) {
  const sources = supportedSources(options.sources || ENABLED_SOURCES);
  const mode = String(options.mode || SOURCE_MODE || 'all').toLowerCase();
  if (mode !== 'rotate') return sources;
  if (sources.length <= 1) return sources;
  const rotationMinutes = Math.max(1, Number(options.rotationMinutes || SOURCE_ROTATION_MINUTES) || 15);
  const bucket = Math.floor(now.getTime() / (rotationMinutes * 60 * 1000));
  return [sources[bucket % sources.length]];
}

function matchKey(match) {
  return `${match && match.home_team_code || '?'}-${match && match.away_team_code || '?'}-${match && match.match_date || '?'}`;
}

function sourceUpdateKey(update) {
  if (!update) return '';
  return resultKey(update);
}

function ledgerRowToSourceUpdate(row) {
  if (!row || row.state !== 'confirmed_result') return null;
  if (row.home_score == null || row.away_score == null || !row.status) return null;
  return {
    source: row.source,
    sourceId: row.source_id || null,
    observedAt: row.observed_at || null,
    fromLedger: true,
    update: {
      home_score: row.home_score,
      away_score: row.away_score,
      status: row.status,
      winner_code: row.winner_code || null,
      live_clock: null,
      live_period: null,
      status_detail: null,
      live_source: null,
      source_updated_at: row.observed_at || new Date().toISOString(),
      last_updated: row.observed_at || new Date().toISOString(),
    },
  };
}

function addSourceUpdateBySource(map, sourceUpdate, sourceState = 'current') {
  if (!sourceUpdate || !sourceUpdate.source || !sourceUpdate.update) return;
  const key = String(sourceUpdate.source).toLowerCase();
  const existing = map.get(key);
  if (!existing || sourceState === 'current') map.set(key, sourceUpdate);
}

function sourceUpdatesFromMap(map) {
  return [...map.values()];
}

function updateWithFreshTimestamps(update, nowIso) {
  if (!update) return update;
  return {
    ...update,
    source_updated_at: nowIso,
    last_updated: nowIso,
  };
}

function sourceStatusSkippedByRotation(allSources, selectedSources) {
  const selected = new Set(selectedSources);
  const out = {};
  for (const source of allSources) {
    if (!selected.has(source)) out[source] = { ok: true, skipped: true, reason: 'source rotation' };
  }
  return out;
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
    // ESPN's soccer scoreboard date is not always the UTC calendar date. Late
    // UTC kickoffs can appear under the previous US-local scoreboard day, so
    // fetch the neighboring days but keep strict fixture matching afterward.
    dates.add(ymdUtc(t - 24 * 60 * 60 * 1000));
    dates.add(ymdUtc(t));
    dates.add(ymdUtc(t + 24 * 60 * 60 * 1000));
  }
  return [...dates].sort();
}

function resultKey(update) {
  return `${update.status}|${update.home_score}|${update.away_score}|${update.winner_code || ''}`;
}

function sourceFamily(source) {
  const key = String(source || '').trim().toLowerCase();
  return SOURCE_FAMILIES[key] || `source:${key || 'unknown'}`;
}

function uniqueSourceFamilyCount(sourceUpdates) {
  return new Set((sourceUpdates || []).map(s => sourceFamily(s && s.source))).size;
}

function consensusUpdate(sourceUpdates, opts = {}) {
  const options = typeof opts === 'number' ? { minSources: opts, requiredSources: [] } : (opts || {});
  const requiredSources = Array.isArray(options.requiredSources) ? options.requiredSources : REQUIRED_SOURCES;
  const fallbackMinSources = Number(options.fallbackMinSources == null ? CONSENSUS_FALLBACK_MIN_SOURCES : options.fallbackMinSources) || 0;
  const fallbackBlockSources = Array.isArray(options.fallbackBlockSources)
    ? options.fallbackBlockSources
    : CONSENSUS_FALLBACK_BLOCK_SOURCES;
  const minSources = Math.max(
    options.minSources == null ? MIN_SOURCES : options.minSources,
    requiredSources.length || 0
  );
  const groups = new Map();
  for (const su of sourceUpdates || []) {
    if (!su || !su.update || !su.source) continue;
    const key = resultKey(su.update);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(su);
  }
  const winners = [...groups.entries()]
    .map(([key, sources]) => ({ key, sources, familyCount: uniqueSourceFamilyCount(sources) }))
    .sort((a, b) => b.familyCount - a.familyCount || b.sources.length - a.sources.length);
  const best = winners.find(group => {
    const names = new Set(group.sources.map(s => String(s.source || '').toLowerCase()));
    return requiredSources.every(source => names.has(source));
  }) || (requiredSources.length ? null : winners[0]);
  if (!best || best.familyCount < minSources) {
    const fallbackBest = winners[0] || null;
    const fallbackTie = fallbackBest && winners[1] && winners[1].familyCount === fallbackBest.familyCount && winners[1].key !== fallbackBest.key;
    const blockFamilies = new Set((fallbackBlockSources || []).map(sourceFamily));
    const blockedByExplicitSource = fallbackBest && (sourceUpdates || []).some(su => {
      if (!su || !su.source || !su.update) return false;
      return blockFamilies.has(sourceFamily(su.source)) && resultKey(su.update) !== fallbackBest.key;
    });
    if (requiredSources.length && fallbackMinSources > 0 && fallbackBest && fallbackBest.familyCount >= fallbackMinSources && !fallbackTie && !blockedByExplicitSource) {
      return {
        update: fallbackBest.sources[0].update,
        sources: fallbackBest.sources,
        familyCount: fallbackBest.familyCount,
        groups: winners,
        fallback: true,
      };
    }
    const req = requiredSources.length ? `; requires agreeing ${requiredSources.join('+')}` : '';
    const fallback = fallbackMinSources > 0
      ? `; fallback requires ${fallbackMinSources} independent agreeing families${blockedByExplicitSource ? ' and no explicit blocked-source disagreement' : ''}`
      : '';
    return {
      update: null,
      reason: `${uniqueSourceFamilyCount(sourceUpdates)} independent final source family/families, ${minSources} required${req}${fallback}`,
      groups: winners,
    };
  }
  if (!requiredSources.length && winners[1] && winners[1].familyCount === best.familyCount) {
    return { update: null, reason: 'conflicting source consensus', groups: winners };
  }
  return { update: best.sources[0].update, sources: best.sources, familyCount: best.familyCount, groups: winners };
}

function needsResultAttention(result) {
  if (!result) return false;
  if (result.unavailable) return true;
  return (Number(result.attention_skips) || 0) > 0;
}

function skipNeedsAttention(sourceUpdates, consensus) {
  if (!consensus || !consensus.reason) return false;
  if (/conflicting source consensus/i.test(consensus.reason)) return true;
  const minSources = parseInt(process.env.RESULT_FALLBACK_MIN_SOURCES || '', 10) || 2;
  return (sourceUpdates || []).length >= minSources;
}

function ledgerEnabledForRead() {
  return LEDGER_ENABLED && HAS_SERVICE_KEY;
}

function ledgerEnabledForWrite(apply) {
  return LEDGER_ENABLED && HAS_SERVICE_KEY && (apply || LEDGER_WRITE_DRY_RUN);
}

async function loadRecentLedgerObservations(matches, now, report) {
  const byExternalId = new Map();
  if (!ledgerEnabledForRead() || !matches.length) {
    report.ledger.read = { ok: false, skipped: true, reason: ledgerEnabledForRead() ? 'no matches' : 'ledger disabled or missing service key' };
    return { available: false, byExternalId };
  }
  const ids = [...new Set(matches.map(m => String(m.external_id || '').trim()).filter(Boolean))];
  if (!ids.length) {
    report.ledger.read = { ok: false, skipped: true, reason: 'no external ids' };
    return { available: false, byExternalId };
  }
  const since = new Date(now.getTime() - OBSERVATION_TTL_MINUTES * 60 * 1000).toISOString();
  const inList = ids.map(id => encodeURIComponent(id)).join(',');
  const query = `?select=match_external_id,source,source_family,source_id,observed_at,state,status,home_score,away_score,winner_code,fixture_date,reason,update&match_external_id=in.(${inList})&observed_at=gte.${encodeURIComponent(since)}&order=observed_at.desc`;
  const result = await tryLedgerCall(report, 'read observations', () => callSupabase('GET', OBSERVATION_LEDGER_TABLE, null, query));
  if (!result.ok) {
    report.ledger.read = { ok: false, error: result.error.message, degraded: isLedgerUnavailableError(result.error) };
    return { available: false, byExternalId };
  }
  const rows = Array.isArray(result.value) ? result.value : [];
  for (const row of rows) {
    const id = String(row.match_external_id || '');
    if (!byExternalId.has(id)) byExternalId.set(id, []);
    byExternalId.get(id).push(row);
  }
  report.ledger.read = {
    ok: true,
    rows: rows.length,
    ttl_minutes: OBSERVATION_TTL_MINUTES,
  };
  return { available: true, byExternalId };
}

function observationLedgerRow(match, observation, nowIso) {
  const update = observation && observation.update || null;
  return {
    match_external_id: String(match.external_id || ''),
    match_key: matchKey(match),
    source: observation.source,
    source_family: sourceFamily(observation.source),
    source_id: observation.source_id || null,
    observed_at: nowIso,
    state: observation.state,
    status: update && update.status || null,
    home_score: update && update.home_score != null ? update.home_score : null,
    away_score: update && update.away_score != null ? update.away_score : null,
    winner_code: update && update.winner_code || null,
    fixture_date: observation.fixture_date || match.match_date || null,
    reason: observation.reason || null,
    update,
  };
}

function candidateLedgerRow(decision, nowIso) {
  const match = decision.match || {};
  return {
    external_id: String(match.external_id || ''),
    match_key: `${match.home_team_code || '?'}-${match.away_team_code || '?'}-${match.match_date || '?'}`,
    match_date: match.match_date || null,
    home_team_code: match.home_team_code || null,
    away_team_code: match.away_team_code || null,
    current_status: match.current_status || null,
    last_checked_at: nowIso,
    resolved_at: decision.consensus && decision.consensus.ok && decision.action === 'applied' ? nowIso : null,
    latest_action: decision.action || null,
    latest_consensus: decision.consensus || null,
    latest_summary: {
      observations: (decision.observations || []).map(item => ({
        source: item.source,
        state: item.state,
        source_id: item.source_id || null,
        reason: item.reason || null,
      })),
      verified_update: decision.verified_update || null,
    },
  };
}

async function recordLedgerDecision(decision, nowIso, report, apply) {
  if (!ledgerEnabledForWrite(apply)) {
    report.ledger.write = report.ledger.write || { ok: false, skipped: true, reason: ledgerEnabledForWrite(apply) ? 'no decision' : 'ledger writes disabled' };
    return;
  }
  const observationRows = (decision.observations || [])
    .filter(observation => observation.source && !observation.from_ledger)
    .map(observation => observationLedgerRow(decision.match, observation, nowIso));
  const candidateRow = candidateLedgerRow(decision, nowIso);
  if (!candidateRow.external_id) return;

  const candidateResult = await tryLedgerCall(report, 'upsert candidate', () =>
    callSupabase('POST', CANDIDATE_LEDGER_TABLE, [candidateRow], '?on_conflict=external_id'));
  const observationResult = observationRows.length
    ? await tryLedgerCall(report, 'insert observations', () => callSupabase('POST', OBSERVATION_LEDGER_TABLE, observationRows))
    : { ok: true, value: [] };
  report.ledger.write = {
    ok: candidateResult.ok && observationResult.ok,
    candidate: candidateResult.ok,
    observations: observationRows.length,
    degraded: (!candidateResult.ok && isLedgerUnavailableError(candidateResult.error))
      || (!observationResult.ok && isLedgerUnavailableError(observationResult.error)),
  };
}

async function verifyFinalResults(opts = {}) {
  const apply = !!opts.apply;
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY or PROD_ANON_KEY');
  if (apply && !HAS_SERVICE_KEY) throw new Error('Refusing --apply without SUPABASE_SECRET_KEY');

  const now = opts.now || new Date();
  const report = {
    checked_at: now.toISOString(),
    apply,
    min_sources: MIN_SOURCES,
    required_sources: REQUIRED_SOURCES,
    enabled_sources: supportedSources(),
    source_mode: SOURCE_MODE,
    selected_sources: [],
    source_statuses: {},
    ledger: {
      enabled: LEDGER_ENABLED,
      ttl_minutes: OBSERVATION_TTL_MINUTES,
      operations: [],
    },
    candidates: [],
    summary: null,
  };
  let stuck = [];
  try {
    stuck = await loadStuckMatches(now);
  } catch (e) {
    console.warn(`Could not load stuck match candidates: ${e.message}`);
    report.load_error = e.message;
    const result = { checked: 0, updated: 0, skipped: 0, unavailable: true, report };
    report.summary = { ...result, report: undefined };
    return result;
  }
  console.log(`Found ${stuck.length} stuck match candidate(s). apply=${apply ? 'true' : 'false'}`);
  if (!stuck.length) {
    const result = { checked: 0, updated: 0, skipped: 0, report };
    report.summary = { ...result, report: undefined };
    return result;
  }

  const ledger = await loadRecentLedgerObservations(stuck, now, report);
  let selectedSources = sourcesForRun(now);
  if (SOURCE_MODE === 'rotate' && !ledger.available) {
    selectedSources = supportedSources();
    report.ledger.rotation_fallback = 'ledger unavailable, checking all supported sources this run';
  }
  report.selected_sources = selectedSources;
  Object.assign(report.source_statuses, sourceStatusSkippedByRotation(supportedSources(), selectedSources));

  const registry = sourceRegistry();
  const sourceFixtures = new Map();
  for (const source of selectedSources) {
    const loader = registry[source];
    if (!loader) {
      report.source_statuses[source] = { ok: false, error: 'unsupported source' };
      continue;
    }
    try {
      const rows = await loader.load(stuck);
      sourceFixtures.set(source, rows);
      console.log(`Loaded ${rows.length} ${source.toUpperCase()} fixture(s)`);
      report.source_statuses[source] = { ok: true, loaded: rows.length };
    } catch (e) {
      console.warn(`${source.toUpperCase()} source unavailable: ${e.message}`);
      report.source_statuses[source] = { ok: false, error: e.message };
    }
  }

  let updated = 0;
  let skipped = 0;
  let waiting = 0;
  let attentionSkips = 0;
  for (const dbMatch of stuck) {
    const label = `${dbMatch.home_team_code} vs ${dbMatch.away_team_code} (${dbMatch.external_id})`;
    const sourceUpdatesBySource = new Map();
    const decision = {
      match: {
        external_id: dbMatch.external_id || null,
        home_team_code: dbMatch.home_team_code || null,
        away_team_code: dbMatch.away_team_code || null,
        match_date: dbMatch.match_date || null,
        current_status: dbMatch.status || null,
      },
      observations: [],
      consensus: null,
      action: null,
    };

    const ledgerRows = ledger.byExternalId.get(String(dbMatch.external_id || '')) || [];
    for (const row of ledgerRows) {
      const ledgerUpdate = ledgerRowToSourceUpdate(row);
      if (!ledgerUpdate) continue;
      addSourceUpdateBySource(sourceUpdatesBySource, ledgerUpdate, 'ledger');
      decision.observations.push({
        source: row.source,
        state: 'ledger_confirmed_result',
        source_id: row.source_id || null,
        observed_at: row.observed_at || null,
        update: ledgerUpdate.update,
        from_ledger: true,
      });
    }

    for (const source of selectedSources) {
      const rows = sourceFixtures.get(source) || [];
      if (!rows.length) continue;
      const loader = registry[source];
      const found = findMatchingFixture(dbMatch, rows, loader.transform);
      if (found.match) {
        const built = buildUpdateFromVerifiedFixture(found.match);
        if (built.update) {
          const sourceUpdate = { source, update: built.update, sourceId: found.match.api_id };
          addSourceUpdateBySource(sourceUpdatesBySource, sourceUpdate, 'current');
          decision.observations.push({
            source,
            state: 'confirmed_result',
            source_id: found.match.api_id || null,
            fixture_date: found.match.fixtureDate || null,
            update: built.update,
          });
        } else {
          console.log(`OBSERVE ${label}: ${source} ${built.reason}`);
          decision.observations.push({
            source,
            state: 'not_scoreable',
            source_id: found.match.api_id || null,
            fixture_date: found.match.fixtureDate || null,
            reason: built.reason,
          });
        }
      } else {
        console.log(`OBSERVE ${label}: ${source} ${found.reason}`);
        decision.observations.push({ source, state: 'no_matching_fixture', reason: found.reason });
      }
    }

    const sourceUpdates = sourceUpdatesFromMap(sourceUpdatesBySource);
    const agreed = consensusUpdate(sourceUpdates);
    decision.consensus = {
      ok: !!agreed.update,
      reason: agreed.update ? null : agreed.reason,
      family_count: agreed.familyCount || 0,
      agreeing_sources: (agreed.sources || []).map(source => ({
        source: source.source,
        family: sourceFamily(source.source),
        source_id: source.sourceId || null,
      })),
      groups: (agreed.groups || []).map(group => ({
        key: group.key,
        family_count: group.familyCount,
        sources: group.sources.map(source => ({
          source: source.source,
          family: sourceFamily(source.source),
          source_id: source.sourceId || null,
        })),
      })),
    };
    if (!agreed.update) {
      skipped++;
      if (skipNeedsAttention(sourceUpdates, agreed)) attentionSkips++;
      else waiting++;
      const sources = sourceUpdates.map(s => `${s.source}:${s.update.home_score}-${s.update.away_score}`).join(', ') || 'none';
      console.log(`SKIP ${label}: ${agreed.reason}; sources=${sources}`);
      decision.action = 'skipped';
      report.candidates.push(decision);
      await recordLedgerDecision(decision, now.toISOString(), report, apply);
      continue;
    }

    const sourceNames = agreed.sources.map(s => `${s.source}#${s.sourceId || '?'}`).join(', ');
    const verifiedUpdate = updateWithFreshTimestamps(agreed.update, now.toISOString());
    console.log(`${apply ? 'APPLY' : 'DRY'} ${label}: ${verifiedUpdate.home_score}-${verifiedUpdate.away_score}, status=${verifiedUpdate.status}, sources=${sourceNames}`);
    decision.action = apply ? 'applied' : 'dry_run';
    decision.verified_update = verifiedUpdate;
    if (apply) {
      await callSupabase('PATCH', 'matches', verifiedUpdate, `?external_id=eq.${encodeURIComponent(dbMatch.external_id)}`);
      updated++;
    }
    report.candidates.push(decision);
    await recordLedgerDecision(decision, now.toISOString(), report, apply);
  }

  const result = { checked: stuck.length, updated, skipped, waiting, attention_skips: attentionSkips, report };
  report.summary = { ...result, report: undefined };
  return result;
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  const reportArg = process.argv.find(arg => arg.startsWith('--report='));
  const reportPath = reportArg ? reportArg.slice('--report='.length) : process.env.RESULT_VERIFICATION_REPORT_PATH;
  verifyFinalResults({ apply })
    .then(r => {
      writeJsonReport(reportPath, r.report || null);
      console.log(`Done. checked=${r.checked} updated=${r.updated} skipped=${r.skipped}`);
      setGithubOutput('checked', String(r.checked || 0));
      setGithubOutput('updated', String(r.updated || 0));
      setGithubOutput('skipped', String(r.skipped || 0));
      setGithubOutput('waiting', String(r.waiting || 0));
      setGithubOutput('attention_skips', String(r.attention_skips || 0));
      setGithubOutput('unavailable', r.unavailable ? 'true' : 'false');
      setGithubOutput('needs_attention', needsResultAttention(r) ? 'true' : 'false');
      setGithubOutput('changed', r.updated > 0 ? 'true' : 'false');
    })
    .catch(err => {
      console.error('Fatal:', err.message);
      process.exit(1);
    });
} else {
  module.exports = {
    isStuckCandidate,
    needsFinalVerification,
    transformEspnEvent,
    transformFifaMatch,
    normalizeTeamCode,
    espnScoreboardDatesFor,
    findMatchingFixture,
    buildUpdateFromVerifiedFixture,
    consensusUpdate,
    sourceFamily,
    uniqueSourceFamilyCount,
    sourcesForRun,
    ledgerRowToSourceUpdate,
    addSourceUpdateBySource,
    sourceUpdatesFromMap,
    matchKey,
    needsResultAttention,
    skipNeedsAttention,
    verifyFinalResults,
    __setFetch: (fn) => { globalThis.fetch = fn; }
  };
}
