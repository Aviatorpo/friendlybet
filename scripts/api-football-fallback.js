// ============================================================
// FriendlyBet - external final-result fallback
// ============================================================
// Conservative multi-source recovery for matches that should be over but are
// still missing a final result from football-data.org. It can read API-Football
// ESPN's public scoreboard JSON, and FIFA's official calendar API. By default,
// a final write requires ESPN + FIFA to agree; API-Football is kept as an
// observational backup, not as the source of truth.
//
// Default mode is DRY RUN. It only writes to Supabase when called with --apply.
// Required for live use:
//   SUPABASE_URL, SUPABASE_SECRET_KEY, API_FOOTBALL_KEY
//
// API-Football direct host:
//   https://v3.football.api-sports.io
// Header:
//   x-apisports-key: <API_FOOTBALL_KEY>
// ============================================================

const { fbGuardDelete } = require('./lib-guard');
const { getTeamCode } = require('./smart-sync.js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.PROD_ANON_KEY;
const HAS_SERVICE_KEY = !!process.env.SUPABASE_SECRET_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const API_FOOTBALL_BASE = process.env.API_FOOTBALL_BASE || 'https://v3.football.api-sports.io';
const API_FOOTBALL_LEAGUE_ID = process.env.API_FOOTBALL_LEAGUE_ID || '1';
const API_FOOTBALL_SEASON = process.env.API_FOOTBALL_SEASON || '2026';
const ESPN_SCOREBOARD_BASE = process.env.ESPN_SCOREBOARD_BASE || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const FIFA_CALENDAR_BASE = process.env.FIFA_CALENDAR_BASE || 'https://api.fifa.com/api/v3/calendar/matches';
const FIFA_COMPETITION_ID = process.env.FIFA_COMPETITION_ID || '17';

const TERMINAL = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);
const API_FINAL = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const TEAM_CODE_RE = /^[A-Z]{3}$/;

const MIN_AGE_MINUTES = parseInt(process.env.RESULT_FALLBACK_MIN_AGE_MINUTES || '', 10) || 115;
const LOOKBACK_HOURS = parseInt(process.env.RESULT_FALLBACK_LOOKBACK_HOURS || '', 10) || 48;
const MAX_KICKOFF_DELTA_MS = (parseInt(process.env.RESULT_FALLBACK_MAX_KICKOFF_DELTA_HOURS || '', 10) || 12) * 60 * 60 * 1000;
const MIN_SOURCES = parseInt(process.env.RESULT_FALLBACK_MIN_SOURCES || '', 10) || 1;
const REQUIRED_SOURCES = String(process.env.RESULT_FALLBACK_REQUIRED_SOURCES || 'espn,fifa')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function _status(m) {
  return String((m && m.status) || '').toUpperCase();
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
  if (!m || TERMINAL.has(_status(m))) return false;
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

async function callApiFootball(endpoint) {
  const res = await fetchWithTimeout(`${API_FOOTBALL_BASE}${endpoint}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API-Football failed: ${res.status} - ${text}`);
  }
  const json = await res.json();
  if (json && json.errors && Object.keys(json.errors).length) {
    throw new Error(`API-Football errors: ${JSON.stringify(json.errors)}`);
  }
  return json;
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

function transformApiFootballFixture(fx) {
  const homeCode = normalizeTeamCode(fx && fx.teams && fx.teams.home && fx.teams.home.name);
  const awayCode = normalizeTeamCode(fx && fx.teams && fx.teams.away && fx.teams.away.name);
  const statusShort = String((fx && fx.fixture && fx.fixture.status && fx.fixture.status.short) || '').toUpperCase();
  const fixtureDate = fx && fx.fixture && fx.fixture.date;
  const homeGoals = fx && fx.goals ? fx.goals.home : null;
  const awayGoals = fx && fx.goals ? fx.goals.away : null;

  let winnerCode = null;
  if (fx && fx.teams && fx.teams.home && fx.teams.home.winner === true) winnerCode = homeCode;
  else if (fx && fx.teams && fx.teams.away && fx.teams.away.winner === true) winnerCode = awayCode;
  else if (typeof homeGoals === 'number' && typeof awayGoals === 'number') {
    if (homeGoals > awayGoals) winnerCode = homeCode;
    else if (awayGoals > homeGoals) winnerCode = awayCode;
  }

  return {
    api_id: fx && fx.fixture ? fx.fixture.id : null,
    homeCode,
    awayCode,
    statusShort,
    fixtureDate,
    homeScore: typeof homeGoals === 'number' ? homeGoals : null,
    awayScore: typeof awayGoals === 'number' ? awayGoals : null,
    winnerCode,
    rawHome: fx && fx.teams && fx.teams.home ? fx.teams.home.name : null,
    rawAway: fx && fx.teams && fx.teams.away ? fx.teams.away.name : null
  };
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

function fixtureMatchesDbMatch(dbMatch, apiMatch) {
  if (!dbMatch || !apiMatch) return false;
  if (dbMatch.home_team_code !== apiMatch.homeCode) return false;
  if (dbMatch.away_team_code !== apiMatch.awayCode) return false;
  const a = Date.parse(dbMatch.match_date);
  const b = Date.parse(apiMatch.fixtureDate);
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

function buildUpdateFromVerifiedFixture(apiMatch, nowIso = new Date().toISOString()) {
  if (!apiMatch) return { update: null, reason: 'missing api match' };
  if (!API_FINAL.has(apiMatch.statusShort)) return { update: null, reason: `not final (${apiMatch.statusShort || 'unknown'})` };
  if (apiMatch.homeScore == null || apiMatch.awayScore == null) return { update: null, reason: 'final status without numeric score' };
  return {
    update: {
      home_score: apiMatch.homeScore,
      away_score: apiMatch.awayScore,
      status: (apiMatch.statusShort === 'AWD' || apiMatch.statusShort === 'WO') ? 'AWARDED' : 'FINISHED',
      winner_code: apiMatch.winnerCode,
      last_updated: nowIso
    },
    reason: null
  };
}

const buildUpdateFromApiFixture = buildUpdateFromVerifiedFixture;

async function loadStuckMatches(now = new Date()) {
  const end = new Date(now.getTime() - MIN_AGE_MINUTES * 60 * 1000);
  const start = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const q = `?select=external_id,status,match_date,home_team_code,away_team_code&match_date=gte.${start.toISOString()}&match_date=lte.${end.toISOString()}&order=match_date.asc`;
  const rows = await callSupabase('GET', 'matches', null, q);
  return (rows || []).filter(m => isStuckCandidate(m, now.getTime()));
}

async function loadApiFootballFixturesFor(matches) {
  if (!matches.length) return [];
  const dates = matches.map(m => Date.parse(m.match_date)).filter(t => !isNaN(t)).sort((a, b) => a - b);
  const from = isoDate(dates[0]);
  const to = isoDate(dates[dates.length - 1]);
  const endpoint = `/fixtures?league=${encodeURIComponent(API_FOOTBALL_LEAGUE_ID)}&season=${encodeURIComponent(API_FOOTBALL_SEASON)}&from=${from}&to=${to}`;
  const json = await callApiFootball(endpoint);
  return Array.isArray(json.response) ? json.response : [];
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

function consensusUpdate(sourceUpdates, opts = {}) {
  const options = typeof opts === 'number' ? { minSources: opts, requiredSources: [] } : (opts || {});
  const requiredSources = Array.isArray(options.requiredSources) ? options.requiredSources : REQUIRED_SOURCES;
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
    .map(([key, sources]) => ({ key, sources }))
    .sort((a, b) => b.sources.length - a.sources.length);
  const best = winners.find(group => {
    const names = new Set(group.sources.map(s => String(s.source || '').toLowerCase()));
    return requiredSources.every(source => names.has(source));
  }) || (requiredSources.length ? null : winners[0]);
  if (!best || best.sources.length < minSources) {
    const req = requiredSources.length ? `; requires agreeing ${requiredSources.join('+')}` : '';
    return { update: null, reason: `${sourceUpdates.length} final source(s), ${minSources} required${req}` };
  }
  if (!requiredSources.length && winners[1] && winners[1].sources.length === best.sources.length) {
    return { update: null, reason: 'conflicting source consensus' };
  }
  return { update: best.sources[0].update, sources: best.sources };
}

async function verifyFinalResults(opts = {}) {
  const apply = !!opts.apply;
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY or PROD_ANON_KEY');
  if (apply && !HAS_SERVICE_KEY) throw new Error('Refusing --apply without SUPABASE_SECRET_KEY');

  const now = opts.now || new Date();
  let stuck = [];
  try {
    stuck = await loadStuckMatches(now);
  } catch (e) {
    console.warn(`Could not load stuck match candidates: ${e.message}`);
    return { checked: 0, updated: 0, skipped: 0, unavailable: true };
  }
  console.log(`Found ${stuck.length} stuck match candidate(s). apply=${apply ? 'true' : 'false'}`);
  if (!stuck.length) return { checked: 0, updated: 0, skipped: 0 };

  let apiFixtures = [];
  let espnEvents = [];
  let fifaMatches = [];
  if (API_FOOTBALL_KEY) {
    try {
      apiFixtures = await loadApiFootballFixturesFor(stuck);
      console.log(`Loaded ${apiFixtures.length} API-Football fixture(s). league=${API_FOOTBALL_LEAGUE_ID} season=${API_FOOTBALL_SEASON}`);
    } catch (e) {
      console.warn(`API-Football source unavailable: ${e.message}`);
    }
  } else {
    console.log('API_FOOTBALL_KEY missing - skipping API-Football source');
  }
  try {
    espnEvents = await loadEspnEventsFor(stuck);
    console.log(`Loaded ${espnEvents.length} ESPN event(s)`);
  } catch (e) {
    console.warn(`ESPN source unavailable: ${e.message}`);
  }
  try {
    fifaMatches = await loadFifaMatchesFor(stuck);
    console.log(`Loaded ${fifaMatches.length} FIFA match(es)`);
  } catch (e) {
    console.warn(`FIFA source unavailable: ${e.message}`);
  }

  let updated = 0;
  let skipped = 0;
  for (const dbMatch of stuck) {
    const label = `${dbMatch.home_team_code} vs ${dbMatch.away_team_code} (${dbMatch.external_id})`;
    const sourceUpdates = [];

    if (apiFixtures.length) {
      const found = findMatchingFixture(dbMatch, apiFixtures, transformApiFootballFixture);
      if (found.match) {
        const built = buildUpdateFromVerifiedFixture(found.match);
        if (built.update) sourceUpdates.push({ source: 'api-football', update: built.update, sourceId: found.match.api_id });
        else console.log(`OBSERVE ${label}: api-football ${built.reason}`);
      } else {
        console.log(`OBSERVE ${label}: api-football ${found.reason}`);
      }
    }

    if (espnEvents.length) {
      const found = findMatchingFixture(dbMatch, espnEvents, transformEspnEvent);
      if (found.match) {
        const built = buildUpdateFromVerifiedFixture(found.match);
        if (built.update) sourceUpdates.push({ source: 'espn', update: built.update, sourceId: found.match.api_id });
        else console.log(`OBSERVE ${label}: espn ${built.reason}`);
      } else {
        console.log(`OBSERVE ${label}: espn ${found.reason}`);
      }
    }

    if (fifaMatches.length) {
      const found = findMatchingFixture(dbMatch, fifaMatches, transformFifaMatch);
      if (found.match) {
        const built = buildUpdateFromVerifiedFixture(found.match);
        if (built.update) sourceUpdates.push({ source: 'fifa', update: built.update, sourceId: found.match.api_id });
        else console.log(`OBSERVE ${label}: fifa ${built.reason}`);
      } else {
        console.log(`OBSERVE ${label}: fifa ${found.reason}`);
      }
    }

    const agreed = consensusUpdate(sourceUpdates);
    if (!agreed.update) {
      skipped++;
      const sources = sourceUpdates.map(s => `${s.source}:${s.update.home_score}-${s.update.away_score}`).join(', ') || 'none';
      console.log(`SKIP ${label}: ${agreed.reason}; sources=${sources}`);
      continue;
    }

    const sourceNames = agreed.sources.map(s => `${s.source}#${s.sourceId || '?'}`).join(', ');
    console.log(`${apply ? 'APPLY' : 'DRY'} ${label}: ${agreed.update.home_score}-${agreed.update.away_score}, status=${agreed.update.status}, sources=${sourceNames}`);
    if (apply) {
      await callSupabase('PATCH', 'matches', agreed.update, `?external_id=eq.${encodeURIComponent(dbMatch.external_id)}`);
      updated++;
    }
  }

  return { checked: stuck.length, updated, skipped };
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  verifyFinalResults({ apply })
    .then(r => {
      console.log(`Done. checked=${r.checked} updated=${r.updated} skipped=${r.skipped}`);
    })
    .catch(err => {
      console.error('Fatal:', err.message);
      process.exit(1);
    });
} else {
  module.exports = {
    isStuckCandidate,
    transformApiFootballFixture,
    transformEspnEvent,
    transformFifaMatch,
    normalizeTeamCode,
    espnScoreboardDatesFor,
    findMatchingFixture,
    buildUpdateFromApiFixture,
    buildUpdateFromVerifiedFixture,
    consensusUpdate,
    verifyFinalResults,
    __setFetch: (fn) => { globalThis.fetch = fn; }
  };
}
