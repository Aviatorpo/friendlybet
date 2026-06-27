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

const TERMINAL = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);
const RESULT_TERMINAL = new Set(['FINISHED', 'AWARDED']);
const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const TEAM_CODE_RE = /^[A-Z]{3}$/;

const MIN_AGE_MINUTES = parseInt(process.env.RESULT_FALLBACK_MIN_AGE_MINUTES || '', 10) || 95;
const LOOKBACK_HOURS = parseInt(process.env.RESULT_FALLBACK_LOOKBACK_HOURS || '', 10) || 336;
const MAX_KICKOFF_DELTA_MS = (parseInt(process.env.RESULT_FALLBACK_MAX_KICKOFF_DELTA_HOURS || '', 10) || 12) * 60 * 60 * 1000;
const MIN_SOURCES = parseInt(process.env.RESULT_FALLBACK_MIN_SOURCES || '', 10) || 1;
const REQUIRED_SOURCES = String(process.env.RESULT_FALLBACK_REQUIRED_SOURCES || 'espn,fifa')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);
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
    const req = requiredSources.length ? `; requires agreeing ${requiredSources.join('+')}` : '';
    return {
      update: null,
      reason: `${uniqueSourceFamilyCount(sourceUpdates)} independent final source family/families, ${minSources} required${req}`,
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
    source_statuses: {},
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

  let espnEvents = [];
  let fifaMatches = [];
  try {
    espnEvents = await loadEspnEventsFor(stuck);
    console.log(`Loaded ${espnEvents.length} ESPN event(s)`);
    report.source_statuses.espn = { ok: true, loaded: espnEvents.length };
  } catch (e) {
    console.warn(`ESPN source unavailable: ${e.message}`);
    report.source_statuses.espn = { ok: false, error: e.message };
  }
  try {
    fifaMatches = await loadFifaMatchesFor(stuck);
    console.log(`Loaded ${fifaMatches.length} FIFA match(es)`);
    report.source_statuses.fifa = { ok: true, loaded: fifaMatches.length };
  } catch (e) {
    console.warn(`FIFA source unavailable: ${e.message}`);
    report.source_statuses.fifa = { ok: false, error: e.message };
  }

  let updated = 0;
  let skipped = 0;
  let waiting = 0;
  let attentionSkips = 0;
  for (const dbMatch of stuck) {
    const label = `${dbMatch.home_team_code} vs ${dbMatch.away_team_code} (${dbMatch.external_id})`;
    const sourceUpdates = [];
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

    if (espnEvents.length) {
      const found = findMatchingFixture(dbMatch, espnEvents, transformEspnEvent);
      if (found.match) {
        const built = buildUpdateFromVerifiedFixture(found.match);
        if (built.update) {
          sourceUpdates.push({ source: 'espn', update: built.update, sourceId: found.match.api_id });
          decision.observations.push({ source: 'espn', state: 'confirmed_result', source_id: found.match.api_id || null, update: built.update });
        } else {
          console.log(`OBSERVE ${label}: espn ${built.reason}`);
          decision.observations.push({ source: 'espn', state: 'not_scoreable', source_id: found.match.api_id || null, reason: built.reason });
        }
      } else {
        console.log(`OBSERVE ${label}: espn ${found.reason}`);
        decision.observations.push({ source: 'espn', state: 'no_matching_fixture', reason: found.reason });
      }
    }

    if (fifaMatches.length) {
      const found = findMatchingFixture(dbMatch, fifaMatches, transformFifaMatch);
      if (found.match) {
        const built = buildUpdateFromVerifiedFixture(found.match);
        if (built.update) {
          sourceUpdates.push({ source: 'fifa', update: built.update, sourceId: found.match.api_id });
          decision.observations.push({ source: 'fifa', state: 'confirmed_result', source_id: found.match.api_id || null, update: built.update });
        } else {
          console.log(`OBSERVE ${label}: fifa ${built.reason}`);
          decision.observations.push({ source: 'fifa', state: 'not_scoreable', source_id: found.match.api_id || null, reason: built.reason });
        }
      } else {
        console.log(`OBSERVE ${label}: fifa ${found.reason}`);
        decision.observations.push({ source: 'fifa', state: 'no_matching_fixture', reason: found.reason });
      }
    }

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
      continue;
    }

    const sourceNames = agreed.sources.map(s => `${s.source}#${s.sourceId || '?'}`).join(', ');
    console.log(`${apply ? 'APPLY' : 'DRY'} ${label}: ${agreed.update.home_score}-${agreed.update.away_score}, status=${agreed.update.status}, sources=${sourceNames}`);
    decision.action = apply ? 'applied' : 'dry_run';
    decision.verified_update = agreed.update;
    if (apply) {
      await callSupabase('PATCH', 'matches', agreed.update, `?external_id=eq.${encodeURIComponent(dbMatch.external_id)}`);
      updated++;
    }
    report.candidates.push(decision);
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
    needsResultAttention,
    skipNeedsAttention,
    verifyFinalResults,
    __setFetch: (fn) => { globalThis.fetch = fn; }
  };
}
