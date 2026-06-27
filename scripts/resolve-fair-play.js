#!/usr/bin/env node
// ============================================================
// FriendlyBet - automatic fair-play/team-conduct resolver
// ============================================================
// Runs only when the shared World Cup rules engine says fair-play/team-conduct
// data can affect group ranking or the best-third cutoff. It consumes structured
// source evidence, never article prose, and blocks/retries instead of guessing.
// ============================================================
const fs = require('fs');
const path = require('path');
const WCR = require('../share-assets/world-cup-rules.js');
const { getTeamCode } = require('./smart-sync.js');

const ROOT = path.resolve(__dirname, '..');
const MATCHES_FILE = path.join(ROOT, 'public-data', 'matches.json');
const OUT_FILE = path.join(ROOT, 'public-data', 'fair-play-resolutions.json');
const LOCAL_EVIDENCE_FILE = path.join(ROOT, 'public-data', 'fair-play-source-evidence.json');
const ESPN_SCOREBOARD_BASE = process.env.ESPN_SCOREBOARD_BASE || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const ESPN_SUMMARY_BASE = process.env.ESPN_SUMMARY_BASE || 'https://site.web.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
const MIN_CONSENSUS_SOURCES = 3;
const RESOLVED_STATUSES = new Set(['official', 'official_resolved', 'consensus_fallback', 'consensus_resolved', 'conduct_equal_use_fifa_ranking']);
const BLOCKED_STATUSES = new Set(['blocked_retrying', 'blocked_no_consensus', 'blocked_missing_data']);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function dateYmd(value) {
  const ms = parseTime(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10).replace(/-/g, '') : null;
}

function normalizeTeamCode(name, fallback) {
  const raw = String(fallback || name || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(raw)) {
    if (raw === 'CUW') return 'CUR';
    return raw;
  }
  const code = getTeamCode(name || fallback || '');
  return code === 'CUW' ? 'CUR' : code;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function groupMatchIdentity(match) {
  return `${match.group_letter || match.group || ''}:${[match.home_team_code, match.away_team_code].sort().join('-')}`;
}

function sourceKey(source) {
  return String(source || '').trim().toLowerCase();
}

function teamOrderFromScores(teams, conductScores) {
  return (teams || []).slice().sort((a, b) => {
    const av = Number(conductScores && conductScores[a]);
    const bv = Number(conductScores && conductScores[b]);
    const ac = Number.isFinite(av) ? av : -Infinity;
    const bc = Number.isFinite(bv) ? bv : -Infinity;
    return (bc - ac) || (WCR.fifaRankOf(a) - WCR.fifaRankOf(b)) || a.localeCompare(b);
  });
}

function equivalentOrderKey(teams, conductScores) {
  return teamOrderFromScores(teams, conductScores).join(',');
}

function exactScoresKey(teams, conductScores) {
  return (teams || []).slice().sort().map(code => `${code}:${Number(conductScores[code])}`).join('|');
}

function usableEvidenceForTeams(evidence, teams) {
  const source = sourceKey(evidence && evidence.source);
  const scores = evidence && evidence.conductScores;
  if (!source || !scores || typeof scores !== 'object') return null;
  const conductScores = {};
  for (const team of teams || []) {
    const n = Number(scores[team]);
    if (!Number.isFinite(n)) return null;
    conductScores[team] = n;
  }
  return {
    source,
    mode: String(evidence.mode || evidence.status || ''),
    sourceUrl: evidence.sourceUrl || evidence.url || null,
    conductScores,
    effectiveOrder: Array.isArray(evidence.effectiveOrder) ? evidence.effectiveOrder.filter(t => teams.includes(t)) : teamOrderFromScores(teams, conductScores),
    rawStatus: evidence.status || null
  };
}

function normalizeLocalEvidence(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.sources)) return payload.sources;
  if (Array.isArray(payload.evidence)) return payload.evidence;
  return [];
}

async function loadExternalEvidenceUrls(fetchImpl = globalThis.fetch) {
  const urls = String(process.env.FAIR_PLAY_SOURCE_EVIDENCE_URLS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const out = [];
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json', 'User-Agent': 'FriendlyBet fair-play resolver (+https://friendlybet.live)' } });
      if (!res.ok) continue;
      out.push(...normalizeLocalEvidence(await res.json()));
    } catch (_) {
      // Evidence URLs are optional; a failed source simply cannot count.
    }
  }
  return out;
}

function unresolvedScopes(matches, fairPlayResolutions = null) {
  const seed = WCR.lateKnockoutSeedFromMatches(matches || [], { strict: true, fairPlayResolutions });
  const state = seed && seed.state;
  const completeGroups = state && Array.isArray(state.completeGroups) ? state.completeGroups.length : 0;
  const unresolved = (seed && seed.unresolved) || [];
  return {
    seed,
    state,
    completeGroups,
    active: completeGroups === 12 && unresolved.length > 0,
    unresolved: unresolved.filter(item => /fair-play|verification/i.test(String(item && item.type || '')))
  };
}

function matchesForTeams(matches, teams) {
  const wanted = new Set(teams || []);
  return (matches || []).filter(m =>
    String(m.stage || '').toUpperCase() === 'GROUP_STAGE'
    && WCR.isTerminalMatch(m)
    && (wanted.has(m.home_team_code) || wanted.has(m.away_team_code)));
}

function transformEspnEvent(event) {
  const comp = event && event.competitions && event.competitions[0];
  const competitors = comp && comp.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
  return {
    id: event && event.id,
    date: (comp && (comp.startDate || comp.date)) || (event && event.date),
    homeCode: normalizeTeamCode(home && home.team && (home.team.displayName || home.team.name), home && home.team && home.team.abbreviation),
    awayCode: normalizeTeamCode(away && away.team && (away.team.displayName || away.team.name), away && away.team && away.team.abbreviation)
  };
}

function findEspnEvent(dbMatch, events) {
  const target = groupMatchIdentity(dbMatch);
  const start = parseTime(dbMatch.match_date);
  return (events || [])
    .map(transformEspnEvent)
    .filter(e => e.id && groupMatchIdentity({ group_letter: dbMatch.group_letter, home_team_code: e.homeCode, away_team_code: e.awayCode }) === target)
    .sort((a, b) => Math.abs(parseTime(a.date) - start) - Math.abs(parseTime(b.date) - start))[0] || null;
}

function statsFromEspnSummary(summary) {
  const out = {};
  const teams = summary && summary.boxscore && summary.boxscore.teams || [];
  for (const row of teams) {
    const code = normalizeTeamCode(row && row.team && (row.team.displayName || row.team.name), row && row.team && row.team.abbreviation);
    if (!code) continue;
    const stats = {};
    for (const stat of row.statistics || []) {
      const name = String(stat.name || stat.label || '').trim();
      const value = Number(stat.value != null ? stat.value : stat.displayValue);
      if (name && Number.isFinite(value)) stats[name] = value;
    }
    if (stats.yellowCards == null || stats.redCards == null) continue;
    out[code] = {
      yellowCards: Number(stats.yellowCards),
      redCards: Number(stats.redCards)
    };
  }
  return out;
}

async function collectEspnEvidence(matches, teams, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return { source: 'espn', status: 'unavailable', reason: 'fetch unavailable' };
  const teamMatches = matchesForTeams(matches, teams);
  const byDate = new Map();
  for (const match of teamMatches) {
    const ymd = dateYmd(match.match_date);
    if (!ymd) continue;
    if (!byDate.has(ymd)) byDate.set(ymd, []);
    byDate.get(ymd).push(match);
  }
  const totals = Object.fromEntries((teams || []).map(team => [team, 0]));
  const seen = new Set();
  const sourceUrls = [];
  for (const [ymd, rows] of byDate.entries()) {
    const scoreUrl = `${ESPN_SCOREBOARD_BASE}?dates=${encodeURIComponent(ymd)}`;
    const res = await fetchWithTimeout(scoreUrl, { headers: { 'User-Agent': 'FriendlyBet fair-play resolver (+https://friendlybet.live)' } });
    if (!res.ok) return { source: 'espn', status: 'unavailable', reason: `scoreboard ${res.status}` };
    const scoreboard = await res.json();
    for (const match of rows) {
      const event = findEspnEvent(match, scoreboard.events || []);
      if (!event) return { source: 'espn', status: 'incomplete', reason: `missing ESPN event for ${match.home_team_code}-${match.away_team_code}` };
      const summaryUrl = `${ESPN_SUMMARY_BASE}?event=${encodeURIComponent(event.id)}`;
      const sumRes = await fetchWithTimeout(summaryUrl, { headers: { 'User-Agent': 'FriendlyBet fair-play resolver (+https://friendlybet.live)' } });
      if (!sumRes.ok) return { source: 'espn', status: 'unavailable', reason: `summary ${sumRes.status}` };
      const stats = statsFromEspnSummary(await sumRes.json());
      sourceUrls.push(summaryUrl);
      for (const team of teams || []) {
        if (team !== match.home_team_code && team !== match.away_team_code) continue;
        const s = stats[team];
        if (!s) return { source: 'espn', status: 'incomplete', reason: `missing card stats for ${team}` };
        if (s.redCards > 0) return { source: 'espn', status: 'ambiguous', reason: `red-card type is ambiguous for ${team}` };
        totals[team] += (s.yellowCards * -1);
        seen.add(`${team}:${match.id || match.external_id || groupMatchIdentity(match)}`);
      }
    }
  }
  const expected = (teams || []).reduce((n, team) => n + teamMatches.filter(m => m.home_team_code === team || m.away_team_code === team).length, 0);
  if (seen.size !== expected) return { source: 'espn', status: 'incomplete', reason: `covered ${seen.size}/${expected} team-match rows` };
  return {
    source: 'espn',
    status: 'ok',
    conductScores: totals,
    effectiveOrder: teamOrderFromScores(teams, totals),
    sourceUrl: sourceUrls[0] || null,
    sourceUrls
  };
}

function resolveConsensus(scope, sourceEvidence) {
  const teams = (scope.teams || []).slice().sort();
  const usable = [];
  for (const evidence of sourceEvidence || []) {
    const row = usableEvidenceForTeams(evidence, teams);
    if (row) usable.push(row);
  }
  const official = usable.find(row => /^official|^fifa/i.test(row.mode) || /^fifa/.test(row.source));
  if (official) {
    return {
      status: 'official_resolved',
      conductScores: official.conductScores,
      effectiveOrder: teamOrderFromScores(teams, official.conductScores),
      agreeingSources: 1,
      sourceCount: usable.length,
      sources: [official]
    };
  }
  const buckets = new Map();
  for (const row of usable) {
    const exactKey = exactScoresKey(teams, row.conductScores);
    const orderKey = equivalentOrderKey(teams, row.conductScores);
    const key = exactKey || `order:${orderKey}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  const best = Array.from(buckets.values()).sort((a, b) => b.length - a.length)[0] || [];
  if (best.length >= MIN_CONSENSUS_SOURCES) {
    const conductScores = best[0].conductScores;
    const values = teams.map(team => conductScores[team]);
    const tiedConduct = values.every(value => value === values[0]);
    return {
      status: tiedConduct ? 'conduct_equal_use_fifa_ranking' : 'consensus_resolved',
      conductScores,
      effectiveOrder: teamOrderFromScores(teams, conductScores),
      agreeingSources: best.length,
      sourceCount: usable.length,
      sources: best
    };
  }
  return {
    status: usable.length > 0 ? 'blocked_no_consensus' : 'blocked_retrying',
    conductScores: {},
    effectiveOrder: [],
    agreeingSources: best.length,
    sourceCount: usable.length,
    sources: usable,
    reason: usable.length > 0 ? `only ${best.length}/${usable.length} structured sources agreed` : 'no usable structured fair-play sources yet'
  };
}

function scopeId(scope) {
  const teams = (scope.teams || []).slice().sort().join('-');
  const groups = (scope.groups || []).slice().sort().join('');
  const kind = String(scope.type || '').includes('third-place') ? 'third-place-cutoff' : `group-${scope.group || groups || 'ranking'}`;
  return `wc2026-${kind}-${teams}`;
}

async function resolveFairPlay(options = {}) {
  const nowIso = options.nowIso || new Date().toISOString();
  const matches = options.matches || readJson(MATCHES_FILE, { matches: [] }).matches || [];
  const existing = options.existingResolutions || readJson(OUT_FILE, { version: 1, resolutions: [] });
  const unresolved = unresolvedScopes(matches, existing);
  const checks = [];
  if (!unresolved.active || unresolved.unresolved.length === 0) {
    return {
      version: 1,
      updatedAt: existing.updatedAt || null,
      status: unresolved.completeGroups === 12 ? 'not_needed' : 'idle',
      resolutions: (existing.resolutions || []).filter(r => RESOLVED_STATUSES.has(String(r.status || '').toLowerCase())),
      checks,
      completeGroups: unresolved.completeGroups
    };
  }

  const localEvidence = normalizeLocalEvidence(readJson(LOCAL_EVIDENCE_FILE, { sources: [] }));
  const urlEvidence = options.skipExternalEvidenceUrls ? [] : await loadExternalEvidenceUrls(options.fetch || globalThis.fetch);
  const resolutions = [];
  for (const scope of unresolved.unresolved) {
    const teams = (scope.teams || []).filter(Boolean);
    const sourceEvidence = [...localEvidence, ...urlEvidence].filter(e => {
      const eTeams = e && (e.teams || Object.keys(e.conductScores || {}));
      return teams.every(team => (eTeams || []).includes(team));
    });
    if (options.fetchEspn !== false) {
      try {
        const espn = await collectEspnEvidence(matches, teams, options.fetch || globalThis.fetch);
        sourceEvidence.push(espn);
        checks.push({ source: 'espn', status: espn.status, reason: espn.reason || null, teams });
      } catch (err) {
        sourceEvidence.push({ source: 'espn', status: 'unavailable', reason: err.message });
        checks.push({ source: 'espn', status: 'unavailable', reason: err.message, teams });
      }
    }
    const result = resolveConsensus(scope, sourceEvidence);
    resolutions.push({
      id: scopeId(scope),
      status: result.status,
      scope: String(scope.type || '').includes('third-place') ? 'third_place_cutoff' : 'group_ranking',
      group: scope.group || null,
      groups: scope.groups || [],
      teams,
      conductScores: result.conductScores,
      effectiveOrder: result.effectiveOrder,
      sourceCount: result.sourceCount,
      agreeingSources: result.agreeingSources,
      sourceNames: (result.sources || []).map(s => s.source),
      reason: result.reason || null,
      resolvedAt: RESOLVED_STATUSES.has(String(result.status).toLowerCase()) ? nowIso : null,
      checkedAt: nowIso
    });
  }
  return {
    version: 1,
    updatedAt: nowIso,
    status: resolutions.some(r => BLOCKED_STATUSES.has(String(r.status).toLowerCase())) ? 'blocked_retrying' : 'resolved',
    resolutions,
    checks,
    completeGroups: unresolved.completeGroups
  };
}

function stablePublicPayload(payload) {
  return {
    version: payload.version || 1,
    updatedAt: payload.updatedAt || null,
    status: payload.status || 'idle',
    resolutions: (payload.resolutions || []).map(row => ({
      id: row.id,
      status: row.status,
      scope: row.scope,
      group: row.group || null,
      groups: row.groups || [],
      teams: row.teams || [],
      conductScores: row.conductScores || {},
      effectiveOrder: row.effectiveOrder || [],
      sourceCount: row.sourceCount || 0,
      agreeingSources: row.agreeingSources || 0,
      sourceNames: row.sourceNames || [],
      reason: row.reason || null,
      resolvedAt: row.resolvedAt || null,
      checkedAt: row.checkedAt || null
    }))
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const payload = await resolveFairPlay({
    fetchEspn: !args.has('--no-network'),
    skipExternalEvidenceUrls: args.has('--no-evidence-urls')
  });
  const publicPayload = stablePublicPayload(payload);
  if (args.has('--write')) writeJson(OUT_FILE, publicPayload);
  if (process.env.FAIR_PLAY_AUDIT_FILE) writeJson(path.resolve(process.env.FAIR_PLAY_AUDIT_FILE), payload);
  console.log(JSON.stringify(publicPayload, null, 2));
  if (args.has('--fail-on-blocked') && String(publicPayload.status).startsWith('blocked')) process.exit(2);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
} else {
  module.exports = {
    resolveFairPlay,
    resolveConsensus,
    collectEspnEvidence,
    statsFromEspnSummary,
    teamOrderFromScores,
    unresolvedScopes,
    stablePublicPayload
  };
}
