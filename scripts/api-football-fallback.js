// ============================================================
// FriendlyBet - API-Football final-result fallback
// ============================================================
// Conservative second-source recovery for matches that should be over but are
// still missing a final result from football-data.org.
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

const TERMINAL = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);
const API_FINAL = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);

const MIN_AGE_MINUTES = parseInt(process.env.RESULT_FALLBACK_MIN_AGE_MINUTES || '', 10) || 115;
const LOOKBACK_HOURS = parseInt(process.env.RESULT_FALLBACK_LOOKBACK_HOURS || '', 10) || 48;
const MAX_KICKOFF_DELTA_MS = (parseInt(process.env.RESULT_FALLBACK_MAX_KICKOFF_DELTA_HOURS || '', 10) || 12) * 60 * 60 * 1000;

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function _status(m) {
  return String((m && m.status) || '').toUpperCase();
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
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
  const res = await fetch(`${API_FOOTBALL_BASE}${endpoint}`, {
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

function transformApiFootballFixture(fx) {
  const homeCode = getTeamCode(fx && fx.teams && fx.teams.home && fx.teams.home.name);
  const awayCode = getTeamCode(fx && fx.teams && fx.teams.away && fx.teams.away.name);
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

function fixtureMatchesDbMatch(dbMatch, apiMatch) {
  if (!dbMatch || !apiMatch) return false;
  if (dbMatch.home_team_code !== apiMatch.homeCode) return false;
  if (dbMatch.away_team_code !== apiMatch.awayCode) return false;
  const a = Date.parse(dbMatch.match_date);
  const b = Date.parse(apiMatch.fixtureDate);
  if (isNaN(a) || isNaN(b)) return false;
  return Math.abs(a - b) <= MAX_KICKOFF_DELTA_MS;
}

function findMatchingFixture(dbMatch, apiFixtures) {
  const matches = (apiFixtures || [])
    .map(transformApiFootballFixture)
    .filter(fx => fixtureMatchesDbMatch(dbMatch, fx));
  if (matches.length !== 1) return { match: null, reason: matches.length === 0 ? 'no exact fixture match' : 'multiple fixture matches' };
  return { match: matches[0], reason: null };
}

function buildUpdateFromApiFixture(apiMatch, nowIso = new Date().toISOString()) {
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

async function loadStuckMatches(now = new Date()) {
  const end = new Date(now.getTime() - MIN_AGE_MINUTES * 60 * 1000);
  const start = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const q = `?select=*&match_date=gte.${start.toISOString()}&match_date=lte.${end.toISOString()}&order=match_date.asc`;
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

async function verifyFinalResults(opts = {}) {
  const apply = !!opts.apply;
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY or PROD_ANON_KEY');
  if (apply && !HAS_SERVICE_KEY) throw new Error('Refusing --apply without SUPABASE_SECRET_KEY');
  if (!API_FOOTBALL_KEY) throw new Error('Missing API_FOOTBALL_KEY');

  const now = opts.now || new Date();
  const stuck = await loadStuckMatches(now);
  console.log(`Found ${stuck.length} stuck match candidate(s). apply=${apply ? 'true' : 'false'}`);
  if (!stuck.length) return { checked: 0, updated: 0, skipped: 0 };

  const fixtures = await loadApiFootballFixturesFor(stuck);
  console.log(`Loaded ${fixtures.length} API-Football fixture(s). league=${API_FOOTBALL_LEAGUE_ID} season=${API_FOOTBALL_SEASON}`);

  let updated = 0;
  let skipped = 0;
  for (const dbMatch of stuck) {
    const label = `${dbMatch.home_team_code} vs ${dbMatch.away_team_code} (${dbMatch.external_id})`;
    const found = findMatchingFixture(dbMatch, fixtures);
    if (!found.match) {
      skipped++;
      console.log(`SKIP ${label}: ${found.reason}`);
      continue;
    }
    const built = buildUpdateFromApiFixture(found.match);
    if (!built.update) {
      skipped++;
      console.log(`SKIP ${label}: ${built.reason}`);
      continue;
    }

    console.log(`${apply ? 'APPLY' : 'DRY'} ${label}: ${built.update.home_score}-${built.update.away_score}, status=${built.update.status}, source=api-football fixture=${found.match.api_id}`);
    if (apply) {
      await callSupabase('PATCH', 'matches', built.update, `?external_id=eq.${encodeURIComponent(dbMatch.external_id)}`);
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
    findMatchingFixture,
    buildUpdateFromApiFixture,
    verifyFinalResults,
    __setFetch: (fn) => { globalThis.fetch = fn; }
  };
}
