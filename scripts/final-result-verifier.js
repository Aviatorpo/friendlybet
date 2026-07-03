// ============================================================
// FriendlyBet - ESPN + FIFA final-result verifier
// ============================================================
// Conservative multi-source recovery for matches that should be over but are
// still missing a final result. It reads ESPN's public scoreboard JSON and
// FIFA's official calendar feed.
// A normal final write requires ESPN + FIFA to agree; if FIFA is unavailable,
// the fallback path can use three independent source families without overruling
// an explicit FIFA disagreement.
//
// Default mode is DRY RUN. It only writes to Supabase when called with --apply.
// Required for live use:
//   SUPABASE_URL, SUPABASE_SECRET_KEY
// ============================================================

const fs = require('fs');
const path = require('path');
const { fbGuardDelete } = require('./lib-guard');
const { getTeamCode } = require('./smart-sync.js');
const WCR = require('../share-assets/world-cup-rules.js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.PROD_ANON_KEY;
const HAS_SERVICE_KEY = !!process.env.SUPABASE_SECRET_KEY;
const ESPN_SCOREBOARD_BASE = process.env.ESPN_SCOREBOARD_BASE || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const FIFA_CALENDAR_BASE = process.env.FIFA_CALENDAR_BASE || 'https://api.fifa.com/api/v3/calendar/matches';
const FIFA_COMPETITION_ID = process.env.FIFA_COMPETITION_ID || '17';
const USER_AGENT = process.env.RESULT_SOURCE_USER_AGENT || 'FriendlyBet result verifier (+https://friendlybet.live)';
const LIVE_SCORE_COMPETITION_URL = process.env.LIVE_SCORE_COMPETITION_URL || 'https://www.livescore.com/en/football/international/world-cup-2026/';
const FOX_WORLD_CUP_SCORES_URL = process.env.FOX_WORLD_CUP_SCORES_URL || 'https://www.foxsports.com/soccer/fifa-world-cup-men/scores';
const YAHOO_SCOREBOARD_BASE = process.env.YAHOO_SCOREBOARD_BASE || 'https://sports.yahoo.com/soccer/scoreboard/';
const GUARDIAN_SEARCH_BASE = process.env.GUARDIAN_SEARCH_BASE || 'https://content.guardianapis.com/search';
const AP_SEARCH_BASE = process.env.AP_SEARCH_BASE || 'https://apnews.com/search';
const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY || 'test';

function csvList(value, fallback = '') {
  return String(value || fallback)
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

const TERMINAL = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);
const RESULT_TERMINAL = new Set(['FINISHED', 'AWARDED']);
const LIVE_STATUSES = new Set(['IN_PLAY', 'LIVE', 'PAUSED']);
const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const TEAM_CODE_RE = /^[A-Z]{3}$/;

const MIN_AGE_MINUTES = parseInt(process.env.RESULT_FALLBACK_MIN_AGE_MINUTES || '', 10) || 95;
const STALE_LIVE_MIN_AGE_MINUTES = parseInt(process.env.RESULT_STALE_LIVE_MIN_AGE_MINUTES || '', 10) || 70;
const STALE_LIVE_SOURCE_MINUTES = parseInt(process.env.RESULT_STALE_LIVE_SOURCE_MINUTES || '', 10) || 10;
const LOOKBACK_HOURS = parseInt(process.env.RESULT_FALLBACK_LOOKBACK_HOURS || '', 10) || 336;
const MAX_KICKOFF_DELTA_MS = (parseInt(process.env.RESULT_FALLBACK_MAX_KICKOFF_DELTA_HOURS || '', 10) || 12) * 60 * 60 * 1000;
const MIN_SOURCES = parseInt(process.env.RESULT_FALLBACK_MIN_SOURCES || '', 10) || 1;
const REQUIRED_SOURCES = csvList(process.env.RESULT_FALLBACK_REQUIRED_SOURCES, 'fifa');
const CONSENSUS_FALLBACK_MIN_SOURCES = parseInt(process.env.RESULT_CONSENSUS_FALLBACK_MIN_SOURCES || '', 10) || 0;
const CONSENSUS_FALLBACK_BLOCK_SOURCES = csvList(process.env.RESULT_CONSENSUS_FALLBACK_BLOCK_SOURCES, 'fifa');
const ENABLED_SOURCES = csvList(process.env.RESULT_FALLBACK_SOURCES, 'espn,fifa');
const EMERGENCY_SOURCE_KEYS = ['livescore', 'fox', 'yahoo', 'guardian', 'ap', 'houston_chronicle', 'nypost'];
const AUTO_EMERGENCY_SOURCES = process.env.RESULT_AUTO_EMERGENCY_SOURCES === '1';
const AUTO_EMERGENCY_AFTER_MINUTES = parseInt(process.env.RESULT_AUTO_EMERGENCY_AFTER_MINUTES || '', 10) || 105;
const AUTO_EMERGENCY_SOURCE_MODE = String(process.env.RESULT_AUTO_EMERGENCY_SOURCE_MODE || 'all').trim().toLowerCase();
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
  livescore: 'scoreboard:livescore',
  yahoo: 'scoreboard:yahoo',
  ap: 'wire:ap',
  houston_chronicle: 'media:houston-chronicle',
  nypost: 'media:nypost',
};

const TEAM_NAMES_BY_CODE = {
  ARG: 'Argentina', AUS: 'Australia', AUT: 'Austria', BEL: 'Belgium', BRA: 'Brazil', CAN: 'Canada',
  CHI: 'Chile', CIV: 'Ivory Coast', COL: 'Colombia', CRC: 'Costa Rica', CRO: 'Croatia', CUR: 'Curacao',
  DEN: 'Denmark', ECU: 'Ecuador', EGY: 'Egypt', ENG: 'England', ESP: 'Spain', FRA: 'France',
  GER: 'Germany', GHA: 'Ghana', IRN: 'Iran', ITA: 'Italy', JAM: 'Jamaica', JPN: 'Japan',
  KOR: 'South Korea', MAR: 'Morocco', MEX: 'Mexico', NED: 'Netherlands', NGA: 'Nigeria',
  NOR: 'Norway', NZL: 'New Zealand', PAN: 'Panama', PAR: 'Paraguay', POL: 'Poland',
  POR: 'Portugal', QAT: 'Qatar', RSA: 'South Africa', SAU: 'Saudi Arabia', SCO: 'Scotland',
  SEN: 'Senegal', SRB: 'Serbia', SUI: 'Switzerland', SWE: 'Sweden', TUN: 'Tunisia',
  URU: 'Uruguay', USA: 'United States', WAL: 'Wales',
};

const ARTICLE_SOURCE_DOMAINS = {
  houston_chronicle: ['houstonchronicle.com'],
  nypost: ['nypost.com'],
  yahoo: ['sports.yahoo.com'],
  guardian: ['theguardian.com', 'guardianapis.com'],
  ap: ['apnews.com'],
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

function isKnockoutStage(stage) {
  const value = String(stage || '').trim().toUpperCase();
  return !!value && !['GROUP_STAGE', 'GROUP', 'LEAGUE'].includes(value);
}

function tiedScore(homeScore, awayScore) {
  return homeScore != null && awayScore != null && Number(homeScore) === Number(awayScore);
}

function needsFinalVerification(m) {
  const status = _status(m);
  if (!TERMINAL.has(status)) return true;
  if (!RESULT_TERMINAL.has(status)) return false;
  if (!hasNumericScore(m)) return true;
  return isKnockoutStage(m.stage) && tiedScore(m.home_score, m.away_score) && !m.winner_code;
}

function parseOptionalTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function isStaleLiveCandidate(m, nowMs = Date.now()) {
  if (!m || !LIVE_STATUSES.has(_status(m))) return false;
  const ko = parseOptionalTime(m.match_date);
  if (!Number.isFinite(ko)) return false;
  const ageMs = nowMs - ko;
  if (ageMs < STALE_LIVE_MIN_AGE_MINUTES * 60 * 1000) return false;
  if (ageMs > LOOKBACK_HOURS * 60 * 60 * 1000) return false;
  const sourceUpdated = parseOptionalTime(m.source_updated_at || m.last_updated);
  if (!Number.isFinite(sourceUpdated)) return true;
  return nowMs - sourceUpdated >= STALE_LIVE_SOURCE_MINUTES * 60 * 1000;
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

async function fetchText(url, label, timeoutMs = 25000) {
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    },
  }, timeoutMs);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${label} failed: ${res.status} - ${String(text).slice(0, 180)}`);
  }
  return await res.text();
}

async function fetchJson(url, label, timeoutMs = 25000) {
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
  }, timeoutMs);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${label} failed: ${res.status} - ${String(text).slice(0, 180)}`);
  }
  return await res.json();
}

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNextData(html) {
  const match = String(html || '').match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (_) {
    return null;
  }
}

function displayTeamName(code) {
  const normalized = canonicalTeamCode(code);
  return TEAM_NAMES_BY_CODE[normalized] || normalized || String(code || '');
}

function normalizeSearchText(value) {
  return stripTags(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function teamMentionVariants(code, name) {
  const normalized = canonicalTeamCode(code);
  const display = name || displayTeamName(normalized);
  const variants = new Set([normalized, display]);
  if (normalized === 'NED') variants.add('Holland');
  if (normalized === 'USA') variants.add('United States');
  if (normalized === 'KOR') variants.add('Korea');
  if (normalized === 'RSA') variants.add('South Africa');
  if (normalized === 'CIV') variants.add('Ivory Coast');
  return [...variants].map(normalizeSearchText).filter(Boolean);
}

function containsTeamMention(text, code, name) {
  const haystack = normalizeSearchText(text);
  return teamMentionVariants(code, name).some(variant => {
    if (TEAM_CODE_RE.test(String(variant || '').toUpperCase())) return new RegExp(`\\b${variant}\\b`, 'i').test(haystack);
    return haystack.includes(variant);
  });
}

function inferWinnerFromText(text, homeCode, awayCode, homeName = null, awayName = null) {
  const haystack = normalizeSearchText(text);
  const teams = [
    { code: canonicalTeamCode(homeCode), variants: teamMentionVariants(homeCode, homeName) },
    { code: canonicalTeamCode(awayCode), variants: teamMentionVariants(awayCode, awayName) },
  ];
  const wins = new Map();
  for (const team of teams) {
    let score = 0;
    for (const name of team.variants) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const positive = [
        `${escaped}\\s+(beat|beats|defeated|defeats|knocked out|knocks out|eliminated|eliminates)\\b`,
        `${escaped}\\s+(advance|advances|advanced|reach|reaches|reached|through)\\b`,
        `${escaped}\\s+(win|wins|won)\\b[^.]{0,80}\\b(penalties|penalty|shootout|pk|pks)\\b`,
        `\\b(penalties|penalty|shootout|pk|pks)\\b[^.]{0,80}${escaped}\\s+(advance|advances|advanced|through|win|wins|won)\\b`,
      ];
      for (const pattern of positive) {
        if (new RegExp(pattern, 'i').test(haystack)) score++;
      }
    }
    wins.set(team.code, score);
  }
  const homeWins = wins.get(canonicalTeamCode(homeCode)) || 0;
  const awayWins = wins.get(canonicalTeamCode(awayCode)) || 0;
  if (homeWins > 0 && awayWins === 0) return canonicalTeamCode(homeCode);
  if (awayWins > 0 && homeWins === 0) return canonicalTeamCode(awayCode);
  return null;
}

function firstScoreFromText(text) {
  const cleaned = normalizeSearchText(text)
    .replace(/\b(\d+)\s*-\s*(\d+)\s*(?:on\s+)?(?:pens?|penalties|pk|pks)\b/g, ' ');
  const match = cleaned.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\b/);
  if (!match) return { homeScore: null, awayScore: null };
  return { homeScore: parseInt(match[1], 10), awayScore: parseInt(match[2], 10) };
}

function emergencySourcesEnabled(options = {}) {
  return process.env.RESULT_EMERGENCY_SOURCES === '1' || options.emergencySources === true;
}

function candidateAgeMinutes(match, now = new Date()) {
  const ko = Date.parse(match && match.match_date);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(ko) || !Number.isFinite(nowMs)) return null;
  return Math.floor((nowMs - ko) / (60 * 1000));
}

function oldestCandidateAgeMinutes(matches, now = new Date()) {
  const ages = (matches || [])
    .map(match => candidateAgeMinutes(match, now))
    .filter(age => Number.isFinite(age));
  return ages.length ? Math.max(...ages) : null;
}

function shouldAutoEmergencyEscalate(matches, now = new Date(), options = {}) {
  const enabled = options.enabled == null ? AUTO_EMERGENCY_SOURCES : !!options.enabled;
  if (!enabled) return false;
  const afterMinutes = Math.max(1, Number(options.afterMinutes || AUTO_EMERGENCY_AFTER_MINUTES) || AUTO_EMERGENCY_AFTER_MINUTES);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return (matches || []).some(match => {
    const age = candidateAgeMinutes(match, now);
    return (Number.isFinite(age) && age >= afterMinutes) || isStaleLiveCandidate(match, nowMs);
  });
}

function sourcesWithEmergency(sources = ENABLED_SOURCES) {
  return [...new Set([...(sources || []), ...EMERGENCY_SOURCE_KEYS])];
}

function isStuckCandidate(m, nowMs = Date.now()) {
  if (!m || !needsFinalVerification(m)) return false;
  if (!m.home_team_code || !m.away_team_code || !m.match_date) return false;
  const ko = Date.parse(m.match_date);
  if (isNaN(ko)) return false;
  if (isStaleLiveCandidate(m, nowMs)) return true;
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
    headers: { 'User-Agent': USER_AGENT }
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
    headers: { 'User-Agent': USER_AGENT }
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

function parseLiveScoreDate(value) {
  const raw = String(value || '').trim();
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function extractLiveScoreEventsFromNextData(data) {
  const sections = data && data.props && data.props.pageProps && data.props.pageProps.initialData && data.props.pageProps.initialData.sections;
  const events = [];
  for (const section of Array.isArray(sections) ? sections : []) {
    for (const event of Array.isArray(section.events) ? section.events : []) events.push(event);
  }
  const initialEvent = data && data.props && data.props.pageProps && data.props.pageProps.initialEventData && data.props.pageProps.initialEventData.event;
  if (initialEvent) events.push(initialEvent);
  return events;
}

function transformLiveScoreEvent(event) {
  const home = event && (event.homeTeam || event.home || event.team1) || {};
  const away = event && (event.awayTeam || event.away || event.team2) || {};
  const homeName = home.name || home.teamName || event.homeTeamName || event.homeName;
  const awayName = away.name || away.teamName || event.awayTeamName || event.awayName;
  const homeCode = normalizeTeamCode(homeName, home.abbreviation || home.shortName || event.homeTeamCode);
  const awayCode = normalizeTeamCode(awayName, away.abbreviation || away.shortName || event.awayTeamCode);
  const homeScore = event && event.homeTeamScore != null ? parseInt(event.homeTeamScore, 10) : null;
  const awayScore = event && event.awayTeamScore != null ? parseInt(event.awayTeamScore, 10) : null;
  const penaltyHomeScore = event && event.penaltyHomeScore != null ? parseInt(event.penaltyHomeScore, 10) : null;
  const penaltyAwayScore = event && event.penaltyAwayScore != null ? parseInt(event.penaltyAwayScore, 10) : null;
  const statusText = String((event && (event.statusDescription || event.eventStatus || event.status)) || '').toUpperCase();
  const afterPenalties = event && event.isFinishedAfterPenalties === true || /PENALT/.test(statusText);
  const isPast = /PAST|FINISHED|FINAL/.test(statusText) || Number(event && event.overallStatusId) === 2;
  const statusShort = afterPenalties ? 'PEN' : (isPast ? 'FT' : statusText || null);

  let winnerCode = null;
  const winner = String(event && event.winner || '').toUpperCase();
  if (winner === 'HOME') winnerCode = homeCode;
  else if (winner === 'AWAY') winnerCode = awayCode;
  else if (Number.isFinite(penaltyHomeScore) && Number.isFinite(penaltyAwayScore) && penaltyHomeScore !== penaltyAwayScore) {
    winnerCode = penaltyHomeScore > penaltyAwayScore ? homeCode : awayCode;
  } else if (Number.isFinite(homeScore) && Number.isFinite(awayScore) && homeScore !== awayScore) {
    winnerCode = homeScore > awayScore ? homeCode : awayCode;
  }

  return {
    source: 'livescore',
    api_id: event && (event.id || event.eventId),
    homeCode,
    awayCode,
    statusShort,
    fixtureDate: parseLiveScoreDate(event && (event.startDateTimeString || event.startDate || event.date)),
    homeScore: Number.isFinite(homeScore) ? homeScore : null,
    awayScore: Number.isFinite(awayScore) ? awayScore : null,
    penaltyHomeScore: Number.isFinite(penaltyHomeScore) ? penaltyHomeScore : null,
    penaltyAwayScore: Number.isFinite(penaltyAwayScore) ? penaltyAwayScore : null,
    winnerCode,
    rawHome: homeName || null,
    rawAway: awayName || null,
  };
}

function parseFoxScoreRow(rowHtml) {
  const classMatch = String(rowHtml || '').match(/<div class="([^"]*score-team-row[^"]*)"/i);
  const titleMatches = [...String(rowHtml || '').matchAll(/title="([^"]+)"/g)].map(m => m[1]);
  const name = titleMatches[0] || null;
  const abbreviation = titleMatches.find(v => TEAM_CODE_RE.test(String(v || '').toUpperCase())) || null;
  const scoreHtml = (String(rowHtml || '').match(/<div class="score-team-score">([\s\S]*?)<\/div>/i) || [])[1] || '';
  const penalty = (scoreHtml.match(/scores-team-pk[^>]*>\s*(\d+)\s*</i) || [])[1];
  const visibleNumbers = stripTags(scoreHtml).match(/\d+/g) || [];
  const score = visibleNumbers.length ? parseInt(visibleNumbers[visibleNumbers.length - 1], 10) : null;
  return {
    name,
    abbreviation,
    score: Number.isFinite(score) ? score : null,
    penaltyScore: penalty != null ? parseInt(penalty, 10) : null,
    loser: /is-loser/.test(classMatch && classMatch[1] || ''),
  };
}

function parseFoxScoreCards(html) {
  const cards = [];
  const sections = String(html || '').split(/(?=<div[^>]+id="c12d\d{8}")/i);
  for (const section of sections) {
    const dateId = (section.match(/id="c12d(\d{4})(\d{2})(\d{2})"/i) || []);
    const fixtureDate = dateId.length ? `${dateId[1]}-${dateId[2]}-${dateId[3]}T12:00:00Z` : null;
    const links = section.match(/<a\b(?=[^>]*score-chip final)[\s\S]*?<\/a>/gi) || [];
    for (const block of links) {
      const rows = block.match(/<div class="[^"]*score-team-row[\s\S]*?(?=<div class="[^"]*score-team-row|<\/a>)/gi) || [];
      if (rows.length < 2) continue;
      const home = parseFoxScoreRow(rows[0]);
      const away = parseFoxScoreRow(rows[1]);
      const href = (block.match(/href="([^"]+)"/i) || [])[1] || null;
      cards.push({ fixtureDate, home, away, href });
    }
  }
  return cards;
}

function transformFoxScoreCard(card, dbMatch = null) {
  const homeCode = normalizeTeamCode(card && card.home && card.home.name, card && card.home && card.home.abbreviation);
  const awayCode = normalizeTeamCode(card && card.away && card.away.name, card && card.away && card.away.abbreviation);
  const homeScore = card && card.home ? card.home.score : null;
  const awayScore = card && card.away ? card.away.score : null;
  let winnerCode = null;
  if (card && card.home && card.away && card.home.loser !== card.away.loser) {
    winnerCode = card.home.loser ? awayCode : homeCode;
  } else if (homeScore != null && awayScore != null && homeScore !== awayScore) {
    winnerCode = homeScore > awayScore ? homeCode : awayCode;
  } else if (card && card.home && card.away && card.home.penaltyScore != null && card.away.penaltyScore != null && card.home.penaltyScore !== card.away.penaltyScore) {
    winnerCode = card.home.penaltyScore > card.away.penaltyScore ? homeCode : awayCode;
  }
  return {
    source: 'fox',
    api_id: card && card.href,
    homeCode,
    awayCode,
    statusShort: 'FT',
    fixtureDate: dbMatch && dbMatch.match_date || card && card.fixtureDate || null,
    homeScore,
    awayScore,
    penaltyHomeScore: card && card.home ? card.home.penaltyScore : null,
    penaltyAwayScore: card && card.away ? card.away.penaltyScore : null,
    winnerCode,
    rawHome: card && card.home && card.home.name || null,
    rawAway: card && card.away && card.away.name || null,
  };
}

function yahooDatesFor(matches) {
  const dates = new Set();
  for (const match of matches || []) {
    const t = Date.parse(match && match.match_date);
    if (!Number.isFinite(t)) continue;
    dates.add(isoDate(t - 12 * 60 * 60 * 1000));
    dates.add(isoDate(t));
    dates.add(isoDate(t + 12 * 60 * 60 * 1000));
  }
  return [...dates].sort();
}

function parseYahooScoreboard(html, dateYmd) {
  const text = String(html || '');
  const rows = [];
  const pattern = /name\\?":\\?"([^"\\]+?) vs\. ([^"\\]+?) \(Final: ([A-Z]{2,3}) (\d{1,2})-(\d{1,2}) ([A-Z]{2,3})\)[\s\S]{0,1200}?startDate\\?":\\?"([^"\\]+)/g;
  let match;
  while ((match = pattern.exec(text))) {
    const homeName = match[1];
    const awayName = match[2];
    const homeCode = normalizeTeamCode(homeName, match[3]);
    const awayCode = normalizeTeamCode(awayName, match[6]);
    const homeScore = parseInt(match[4], 10);
    const awayScore = parseInt(match[5], 10);
    const winnerCode = homeScore === awayScore
      ? inferWinnerFromText(text, homeCode, awayCode, homeName, awayName)
      : (homeScore > awayScore ? homeCode : awayCode);
    rows.push({
      source: 'yahoo',
      api_id: `yahoo-${dateYmd}-${homeCode}-${awayCode}`,
      homeCode,
      awayCode,
      statusShort: 'FT',
      fixtureDate: match[7],
      homeScore,
      awayScore,
      winnerCode,
      rawHome: homeName,
      rawAway: awayName,
    });
  }
  return rows;
}

function transformYahooRow(row) {
  return row || null;
}

function articleTextFor(row) {
  return stripTags([
    row && row.title,
    row && row.headline,
    row && row.description,
    row && row.trailText,
    row && row.bodyText,
    row && row.text,
  ].filter(Boolean).join(' '));
}

function articlePrimaryTextFor(row) {
  return stripTags([
    row && row.title,
    row && row.headline,
    row && row.description,
    row && row.trailText,
  ].filter(Boolean).join(' '));
}

function scoreForArticle(row, dbMatch) {
  if (hasNumericScore(dbMatch)) {
    return { homeScore: Number(dbMatch.home_score), awayScore: Number(dbMatch.away_score), fromDb: true };
  }
  return { ...firstScoreFromText(articlePrimaryTextFor(row)), fromDb: false };
}

function transformArticleResult(row, dbMatch = null) {
  if (!row || !dbMatch) return null;
  if (row.matchExternalId && String(row.matchExternalId) !== String(dbMatch.external_id || '')) return null;
  const homeCode = canonicalTeamCode(dbMatch.home_team_code);
  const awayCode = canonicalTeamCode(dbMatch.away_team_code);
  const homeName = displayTeamName(homeCode);
  const awayName = displayTeamName(awayCode);
  const primaryText = articlePrimaryTextFor(row);
  const text = articleTextFor(row);
  if (!containsTeamMention(primaryText, homeCode, homeName) || !containsTeamMention(primaryText, awayCode, awayName)) return null;
  const winnerCode = inferWinnerFromText(primaryText, homeCode, awayCode, homeName, awayName)
    || inferWinnerFromText(text, homeCode, awayCode, homeName, awayName);
  const score = scoreForArticle(row, dbMatch);
  const penaltyFinal = /\b(penalties|penalty shootout|shootout|spot-kicks|pk|pks)\b/i.test(text);
  const finalish = penaltyFinal || /\b(final|full[- ]time|beat|beats|defeated|defeats|advance|advances|advanced|knocked out|knocks out)\b/i.test(text);
  return {
    source: row.source,
    api_id: row.url || row.id || row.source_id || null,
    homeCode,
    awayCode,
    statusShort: finalish ? (penaltyFinal ? 'PEN' : 'FT') : null,
    fixtureDate: dbMatch.match_date || row.date || null,
    homeScore: score.homeScore,
    awayScore: score.awayScore,
    winnerCode,
    rawHome: homeName,
    rawAway: awayName,
  };
}

function normalizeTeamCode(name, fallbackCode) {
  const mapped = getTeamCode(name);
  if (mapped) return WCR.normalizeTeamCode(mapped);
  const raw = String(fallbackCode || name || '').trim().toUpperCase();
  return TEAM_CODE_RE.test(raw) ? WCR.normalizeTeamCode(raw) : null;
}

function canonicalTeamCode(code) {
  return WCR.normalizeTeamCode(code);
}

function fixtureMatchesDbMatch(dbMatch, sourceMatch) {
  if (!dbMatch || !sourceMatch) return false;
  if (canonicalTeamCode(dbMatch.home_team_code) !== canonicalTeamCode(sourceMatch.homeCode)) return false;
  if (canonicalTeamCode(dbMatch.away_team_code) !== canonicalTeamCode(sourceMatch.awayCode)) return false;
  const a = Date.parse(dbMatch.match_date);
  const b = Date.parse(sourceMatch.fixtureDate);
  if (isNaN(a) || isNaN(b)) return false;
  return Math.abs(a - b) <= MAX_KICKOFF_DELTA_MS;
}

function findMatchingFixture(dbMatch, sourceMatches, transform = x => x) {
  const matches = (sourceMatches || [])
    .map(row => transform(row, dbMatch))
    .filter(fx => fixtureMatchesDbMatch(dbMatch, fx));
  if (matches.length !== 1) return { match: null, reason: matches.length === 0 ? 'no exact fixture match' : 'multiple fixture matches' };
  return { match: matches[0], reason: null };
}

function buildUpdateFromVerifiedFixture(sourceMatch, nowIso = new Date().toISOString(), dbMatch = null) {
  if (!sourceMatch) return { update: null, reason: 'missing source match' };
  if (!FINAL_STATUSES.has(sourceMatch.statusShort)) return { update: null, reason: `not final (${sourceMatch.statusShort || 'unknown'})` };
  if (sourceMatch.homeScore == null || sourceMatch.awayScore == null) return { update: null, reason: 'final status without numeric score' };
  const winner = sourceMatch.winnerCode || null;
  if (winner && winner !== sourceMatch.homeCode && winner !== sourceMatch.awayCode) {
    return { update: null, reason: `winner ${winner} is not one of ${sourceMatch.homeCode}/${sourceMatch.awayCode}` };
  }
  if (sourceMatch.homeScore > sourceMatch.awayScore && winner && winner !== sourceMatch.homeCode) {
    return { update: null, reason: `winner ${winner} contradicts decisive home score` };
  }
  if (sourceMatch.awayScore > sourceMatch.homeScore && winner && winner !== sourceMatch.awayCode) {
    return { update: null, reason: `winner ${winner} contradicts decisive away score` };
  }
  if (isKnockoutStage(dbMatch && dbMatch.stage) && tiedScore(sourceMatch.homeScore, sourceMatch.awayScore) && !winner) {
    return { update: null, reason: 'knockout final draw without verified advancing team' };
  }
  return {
    update: {
      home_score: sourceMatch.homeScore,
      away_score: sourceMatch.awayScore,
      status: (sourceMatch.statusShort === 'AWD' || sourceMatch.statusShort === 'WO') ? 'AWARDED' : 'FINISHED',
      winner_code: winner,
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

function validateUpdateForDbMatch(update, dbMatch = {}) {
  if (!update) return 'missing update';
  if (!FINAL_STATUSES.has(String(update.status_detail || '').toUpperCase()) && !RESULT_TERMINAL.has(String(update.status || '').toUpperCase())) {
    return `not final (${update.status || update.status_detail || 'unknown'})`;
  }
  if (update.home_score == null || update.away_score == null) return 'final status without numeric score';
  const home = dbMatch.home_team_code || null;
  const away = dbMatch.away_team_code || null;
  const winner = update.winner_code || null;
  if (winner && winner !== home && winner !== away) return `winner ${winner} is not one of ${home}/${away}`;
  if (Number(update.home_score) > Number(update.away_score) && winner && winner !== home) return `winner ${winner} contradicts decisive home score`;
  if (Number(update.away_score) > Number(update.home_score) && winner && winner !== away) return `winner ${winner} contradicts decisive away score`;
  if (isKnockoutStage(dbMatch.stage) && tiedScore(update.home_score, update.away_score) && !winner) return 'knockout final draw without verified advancing team';
  return null;
}

async function loadStuckMatches(now = new Date()) {
  const end = now;
  const start = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const q = `?select=external_id,status,stage,match_date,home_team_code,away_team_code,home_score,away_score,winner_code,live_clock,live_period,status_detail,live_source,source_updated_at,last_updated&match_date=gte.${start.toISOString()}&match_date=lte.${end.toISOString()}&order=match_date.asc`;
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

async function loadLiveScoreEventsFor(matches) {
  if (!matches.length) return [];
  const html = await fetchText(LIVE_SCORE_COMPETITION_URL, 'LiveScore World Cup page');
  const data = extractNextData(html);
  if (!data) throw new Error('LiveScore page did not expose __NEXT_DATA__');
  const events = extractLiveScoreEventsFromNextData(data);
  const seen = new Set();
  return events.filter(event => {
    const key = String(event && (event.id || event.eventId || `${event.homeTeamName}-${event.awayTeamName}-${event.startDateTimeString}`));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadFoxScoreCardsFor(matches) {
  if (!matches.length) return [];
  const html = await fetchText(FOX_WORLD_CUP_SCORES_URL, 'FOX World Cup scores');
  return parseFoxScoreCards(html);
}

async function loadYahooRowsFor(matches) {
  if (!matches.length) return [];
  const rows = [];
  for (const ymd of yahooDatesFor(matches)) {
    const url = `${YAHOO_SCOREBOARD_BASE}?league=fifa.world_cup&date=${encodeURIComponent(ymd)}`;
    const html = await fetchText(url, `Yahoo World Cup scoreboard ${ymd}`);
    rows.push(...parseYahooScoreboard(html, ymd));
  }
  const seen = new Set();
  return rows.filter(row => {
    const key = row.api_id || `${row.homeCode}-${row.awayCode}-${row.fixtureDate}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceQueryForMatch(match) {
  const home = displayTeamName(match && match.home_team_code);
  const away = displayTeamName(match && match.away_team_code);
  return `${home} ${away} World Cup 2026 penalties advance`;
}

async function loadGuardianArticlesFor(matches) {
  const rows = [];
  for (const match of matches || []) {
    const qs = new URLSearchParams({
      q: sourceQueryForMatch(match),
      'api-key': GUARDIAN_API_KEY,
      'show-fields': 'headline,trailText,bodyText',
      'page-size': '5',
      section: 'football',
    });
    const json = await fetchJson(`${GUARDIAN_SEARCH_BASE}?${qs.toString()}`, 'Guardian content search');
    const results = json && json.response && Array.isArray(json.response.results) ? json.response.results : [];
    for (const item of results) {
      rows.push({
        source: 'guardian',
        id: item.id || item.webUrl,
        url: item.webUrl || item.id || null,
        matchExternalId: match.external_id,
        title: item.webTitle,
        headline: item.fields && item.fields.headline,
        trailText: item.fields && item.fields.trailText,
        bodyText: item.fields && item.fields.bodyText,
      });
    }
  }
  return rows;
}

function htmlAttribute(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function extractHtmlMetadata(html) {
  const text = String(html || '');
  const meta = prop => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
    const match = text.match(re);
    return match ? htmlAttribute(match[1]) : null;
  };
  const title = meta('og:title') || ((text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] && stripTags((text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]));
  const description = meta('og:description') || meta('description');
  return { title, description };
}

function articleUrlMatchesTeams(url, match) {
  if (!match) return true;
  const normalizedUrl = String(url || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const teamTokenOptions = code => {
    const name = displayTeamName(code).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const normalizedCode = String(canonicalTeamCode(code) || '').toLowerCase();
    return [name, normalizedCode].filter(Boolean);
  };
  return teamTokenOptions(match.home_team_code).some(token => normalizedUrl.includes(token))
    && teamTokenOptions(match.away_team_code).some(token => normalizedUrl.includes(token));
}

function extractArticleUrls(html, domain, dbMatch = null) {
  const urls = new Set();
  const text = String(html || '');
  const escapedDomain = String(domain || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hrefRe = /href=["']([^"']+)["']/gi;
  let hrefMatch;
  while ((hrefMatch = hrefRe.exec(text))) {
    let url = htmlAttribute(hrefMatch[1]);
    if (url.startsWith('/article/')) url = `https://${domain}${url}`;
    if (!new RegExp(`^https://(?:www\\.)?${escapedDomain}/article/`, 'i').test(url)) continue;
    if (!articleUrlMatchesTeams(url, dbMatch)) continue;
    urls.add(url.split('?')[0]);
    if (urls.size >= 5) break;
  }
  return [...urls];
}

async function loadApArticlesFor(matches) {
  const rows = [];
  for (const match of matches || []) {
    const qs = new URLSearchParams({ q: sourceQueryForMatch(match) });
    const html = await fetchText(`${AP_SEARCH_BASE}?${qs.toString()}`, 'AP News search');
    const urls = extractArticleUrls(html, 'apnews.com', match);
    for (const url of urls) {
      const articleHtml = await fetchText(url, 'AP News article');
      const metadata = extractHtmlMetadata(articleHtml);
      rows.push({
        source: 'ap',
        id: url,
        url,
        matchExternalId: match.external_id,
        title: metadata.title,
        description: metadata.description,
        text: articleHtml,
      });
    }
  }
  return rows;
}

function classifyHintUrl(url) {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch (_) {
    return null;
  }
  for (const [source, domains] of Object.entries(ARTICLE_SOURCE_DOMAINS)) {
    if (domains.some(domain => host === domain || host.endsWith(`.${domain}`))) return source;
  }
  return null;
}

function parseSourceHints(value = process.env.RESULT_EMERGENCY_SOURCE_HINTS || '') {
  const hints = [];
  const parts = String(value || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const explicit = part.match(/^([a-z_]+)=(https?:\/\/.+)$/i);
    const source = explicit ? explicit[1].toLowerCase() : classifyHintUrl(part);
    const url = explicit ? explicit[2] : part;
    if (!source || !/^https?:\/\//i.test(url)) continue;
    hints.push({ source, url });
  }
  return hints;
}

async function loadHintArticlesFor(source, matches) {
  const hints = parseSourceHints().filter(hint => hint.source === source);
  const rows = [];
  for (const hint of hints) {
    const html = await fetchText(hint.url, `${source} source hint`);
    const metadata = extractHtmlMetadata(html);
    for (const match of matches || []) {
      rows.push({
        source,
        id: hint.url,
        url: hint.url,
        matchExternalId: match.external_id,
        title: metadata.title,
        description: metadata.description,
        text: html,
      });
    }
  }
  return rows;
}

function sourceRegistry(options = {}) {
  const registry = {
    espn: {
      load: loadEspnEventsFor,
      transform: transformEspnEvent,
    },
    fifa: {
      load: loadFifaMatchesFor,
      transform: transformFifaMatch,
    },
  };
  if (emergencySourcesEnabled(options)) {
    Object.assign(registry, {
      livescore: {
        load: loadLiveScoreEventsFor,
        transform: transformLiveScoreEvent,
      },
      fox: {
        load: loadFoxScoreCardsFor,
        transform: transformFoxScoreCard,
      },
      yahoo: {
        load: loadYahooRowsFor,
        transform: transformYahooRow,
      },
      guardian: {
        load: loadGuardianArticlesFor,
        transform: transformArticleResult,
      },
      ap: {
        load: loadApArticlesFor,
        transform: transformArticleResult,
      },
      houston_chronicle: {
        load: matches => loadHintArticlesFor('houston_chronicle', matches),
        transform: transformArticleResult,
      },
      nypost: {
        load: matches => loadHintArticlesFor('nypost', matches),
        transform: transformArticleResult,
      },
    });
  }
  return registry;
}

function supportedSources(sources = ENABLED_SOURCES, options = {}) {
  const registry = sourceRegistry(options);
  return (sources || []).filter(source => registry[source]);
}

function sourcesForRun(now = new Date(), options = {}) {
  const sources = supportedSources(options.sources || ENABLED_SOURCES, options);
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

function resultAttentionAfterMinutes() {
  const configured = parseInt(process.env.RESULT_ATTENTION_AFTER_MINUTES || '', 10);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return Math.max(180, AUTO_EMERGENCY_AFTER_MINUTES + 60);
}

function requiredSourcesDisagree(sourceUpdates, requiredSources = REQUIRED_SOURCES) {
  const required = new Set((requiredSources || []).map(source => String(source || '').trim().toLowerCase()).filter(Boolean));
  if (!required.size) return false;
  const observed = new Map();
  for (const su of sourceUpdates || []) {
    const source = String(su && su.source || '').trim().toLowerCase();
    if (!required.has(source) || !su.update) continue;
    observed.set(source, resultKey(su.update));
  }
  if (observed.size < required.size) return false;
  return new Set(observed.values()).size > 1;
}

function requiredSourcesFromConsensus(consensus) {
  const match = /requires agreeing ([^;]+)/i.exec(String(consensus && consensus.reason || ''));
  if (!match) return [];
  return match[1]
    .split('+')
    .map(source => source.trim().toLowerCase())
    .filter(Boolean);
}

function skipNeedsAttention(sourceUpdates, consensus, match = null, now = new Date()) {
  if (!consensus || !consensus.reason) return false;
  if (/conflicting source consensus/i.test(consensus.reason)) return true;
  const waitingForRequiredSource = /requires agreeing/i.test(consensus.reason);
  if (waitingForRequiredSource) {
    const requiredSources = requiredSourcesFromConsensus(consensus);
    if (requiredSourcesDisagree(sourceUpdates, requiredSources.length ? requiredSources : REQUIRED_SOURCES)) return true;
    const age = match ? candidateAgeMinutes(match, now) : null;
    if (!Number.isFinite(age) || age < resultAttentionAfterMinutes()) return false;
    return (sourceUpdates || []).length > 0;
  }
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
    source_profile: process.env.RESULT_EMERGENCY_SOURCES === '1' ? 'manual_emergency' : 'normal',
    auto_emergency: {
      enabled: AUTO_EMERGENCY_SOURCES,
      after_minutes: AUTO_EMERGENCY_AFTER_MINUTES,
      active: false,
      oldest_candidate_age_minutes: null,
    },
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
  const autoEmergencyActive = shouldAutoEmergencyEscalate(stuck, now);
  const sourceOptions = { emergencySources: autoEmergencyActive };
  const runSources = autoEmergencyActive ? sourcesWithEmergency(ENABLED_SOURCES) : ENABLED_SOURCES;
  const runSourceMode = autoEmergencyActive ? AUTO_EMERGENCY_SOURCE_MODE : SOURCE_MODE;
  report.source_profile = autoEmergencyActive
    ? 'auto_emergency'
    : (process.env.RESULT_EMERGENCY_SOURCES === '1' ? 'manual_emergency' : 'normal');
  report.source_mode = runSourceMode;
  report.auto_emergency.active = autoEmergencyActive;
  report.auto_emergency.oldest_candidate_age_minutes = oldestCandidateAgeMinutes(stuck, now);
  report.enabled_sources = supportedSources(runSources, sourceOptions);

  let selectedSources = sourcesForRun(now, { sources: runSources, mode: runSourceMode, emergencySources: autoEmergencyActive });
  if (runSourceMode === 'rotate' && !ledger.available) {
    selectedSources = supportedSources(runSources, sourceOptions);
    report.ledger.rotation_fallback = 'ledger unavailable, checking all supported sources this run';
  }
  report.selected_sources = selectedSources;
  Object.assign(report.source_statuses, sourceStatusSkippedByRotation(supportedSources(runSources, sourceOptions), selectedSources));

  const registry = sourceRegistry(sourceOptions);
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
      const ledgerInvalid = validateUpdateForDbMatch(ledgerUpdate.update, dbMatch);
      if (ledgerInvalid) {
        decision.observations.push({
          source: row.source,
          state: 'ledger_rejected',
          source_id: row.source_id || null,
          observed_at: row.observed_at || null,
          reason: ledgerInvalid,
          from_ledger: true,
        });
        continue;
      }
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
        const built = buildUpdateFromVerifiedFixture(found.match, new Date().toISOString(), dbMatch);
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
      if (skipNeedsAttention(sourceUpdates, agreed, dbMatch, now)) attentionSkips++;
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
    isStaleLiveCandidate,
    needsFinalVerification,
    transformEspnEvent,
    transformFifaMatch,
    transformLiveScoreEvent,
    transformFoxScoreCard,
    transformYahooRow,
    transformArticleResult,
    parseFoxScoreCards,
    parseYahooScoreboard,
    parseSourceHints,
    inferWinnerFromText,
    firstScoreFromText,
    normalizeTeamCode,
    espnScoreboardDatesFor,
    findMatchingFixture,
    buildUpdateFromVerifiedFixture,
    validateUpdateForDbMatch,
    consensusUpdate,
    sourceFamily,
    isKnockoutStage,
    uniqueSourceFamilyCount,
    sourcesForRun,
    sourcesWithEmergency,
    shouldAutoEmergencyEscalate,
    candidateAgeMinutes,
    oldestCandidateAgeMinutes,
    ledgerRowToSourceUpdate,
    addSourceUpdateBySource,
    sourceUpdatesFromMap,
    matchKey,
    needsResultAttention,
    skipNeedsAttention,
    requiredSourcesDisagree,
    requiredSourcesFromConsensus,
    verifyFinalResults,
    __setFetch: (fn) => { globalThis.fetch = fn; }
  };
}
