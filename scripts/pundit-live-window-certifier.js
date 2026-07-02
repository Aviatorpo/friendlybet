#!/usr/bin/env node

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
const STORIES_FILE = path.join(DATA_DIR, 'world-cup-stories.json');
const NEWS_FILE = path.join(DATA_DIR, 'pundit-news.json');
const PRODUCTION_BASE_URL = 'https://friendlybet.live/';

const HOUR_MS = 60 * 60 * 1000;
const STALE_SCHEDULED_MS = 35 * 60 * 1000;
const LIVE_STALE_MS = 260 * 60 * 1000;
const LIVE_STATUSES = new Set(['IN_PLAY', 'LIVE', 'PAUSED']);
const SCHEDULED_STATUSES = new Set(['TIMED', 'SCHEDULED']);
const TERMINAL_STATUSES = new Set(['FINISHED', 'AWARDED']);
const EN_CONSEQUENCE_TERMS = /\b(table|tables|group|prediction|predictions|predictors|pool|pools|pick|picks|picked|form|forms|slip|slips|called|safe|sweating|points|qualify|qualification|receipt|receipts)\b/i;
const HE_CONSEQUENCE_TERMS = /(?:טבלה|טבלאות|בית|בתים|תחזית|תחזיות|הימור|הימורים|טופס|טפסים|נקודות|מקום|מקומות|עלייה|קבלה|קבלות|סימן)/u;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function normaliseBaseUrl(baseUrl) {
  const value = String(baseUrl || '').trim();
  if (!value) throw new Error('--base-url requires a URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('--base-url must be an http(s) URL');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

function assetUrl(baseUrl, relativePath, stamp = Date.now()) {
  const url = new URL(relativePath, normaliseBaseUrl(baseUrl));
  url.searchParams.set('v', `pundit-certifier-${stamp}`);
  return url.href;
}

async function fetchJson(baseUrl, relativePath) {
  const url = assetUrl(baseUrl, relativePath);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`cannot fetch ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function itemText(item) {
  return [item && item.he, item && item.en].filter(Boolean).join(' ');
}

function matchLabel(match) {
  return `${match.home_team_code}-${match.away_team_code}`;
}

function matchSelector(match) {
  return [matchLabel(match), `${match.away_team_code}-${match.home_team_code}`];
}

function itemRef(item) {
  const id = String((item && item.id) || '');
  const match = id.match(/^(live|fixture|result|verify)-(.+)$/);
  return match ? { type: match[1], matchId: match[2] } : null;
}

function mentionsTeamCode(item, code) {
  const wanted = String(code || '').toUpperCase();
  if (!wanted) return false;
  const team = String(item && item.team || '').toUpperCase();
  const hasTeam = Boolean(team);
  if (team === wanted) return true;
  const teams = Array.isArray(item && item.teams) ? item.teams : [];
  const hasTeams = teams.length > 0;
  if (teams.some(value => String(value || '').toUpperCase() === wanted)) return true;
  if (hasTeam || hasTeams) return false;
  const text = JSON.stringify(item || {}).toUpperCase();
  return new RegExp(`(^|[^A-Z])${wanted}([^A-Z]|$)`).test(text);
}

function phaseFor(match, nowMs) {
  const status = String((match && match.status) || '').toUpperCase();
  const kickoff = parseTime(match && match.match_date);
  const elapsed = nowMs - kickoff;
  if (!Number.isFinite(kickoff)) return 'unknown';
  if (TERMINAL_STATUSES.has(status)) return 'final';
  if (LIVE_STATUSES.has(status)) return elapsed > LIVE_STALE_MS ? 'stale_live' : 'live';
  if (SCHEDULED_STATUSES.has(status)) {
    if (elapsed < 0) return 'pre';
    if (elapsed <= STALE_SCHEDULED_MS) return 'kickoff_grace';
    return 'stale_scheduled';
  }
  return 'unknown';
}

function findTargets(matches, args, nowMs) {
  const explicit = args.match;
  if (explicit) {
    const wanted = explicit.toUpperCase();
    return matches.filter(match => matchSelector(match).includes(wanted));
  }
  return matches
    .filter(match => {
      const kickoff = parseTime(match && match.match_date);
      return Number.isFinite(kickoff) && kickoff >= nowMs - 2 * HOUR_MS && kickoff <= nowMs + 8 * HOUR_MS;
    })
    .sort((a, b) => parseTime(a.match_date) - parseTime(b.match_date))
    .slice(0, 4);
}

function parseArgs(argv) {
  const args = { minScore: 90 };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--match') args.match = argv[++i];
    else if (arg === '--now') args.now = argv[++i];
    else if (arg === '--min-score') args.minScore = Number(argv[++i]);
    else if (arg === '--json') args.json = true;
    else if (arg === '--record') args.record = argv[++i];
    else if (arg === '--allow-pre') args.allowPre = true;
    else if (arg === '--graduation-proof') args.graduationProof = true;
    else if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--production') args.baseUrl = PRODUCTION_BASE_URL;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function resolveRecordPath(recordPath) {
  const resolved = path.resolve(ROOT, recordPath || '');
  if (!resolved.startsWith(ROOT + path.sep)) {
    throw new Error('--record path must stay inside the repository');
  }
  return resolved;
}

function scoreTarget(match, ctx) {
  const { nowMs, feedItems, newsItems } = ctx;
  const storyCoverage = ctx.storyCoverage || ctx.storiesByMatch || new Set();
  const phase = phaseFor(match, nowMs);
  const kickoff = parseTime(match.match_date);
  const refs = feedItems
    .map(item => ({ item, ref: itemRef(item) }))
    .filter(row => row.ref && row.ref.matchId === String(match.id));
  const itemTypes = refs.map(row => row.ref.type);
  const errors = [];
  const warnings = [];
  let score = 100;

  const fixture = refs.find(row => row.ref.type === 'fixture');
  const live = refs.find(row => row.ref.type === 'live');
  const result = refs.find(row => row.ref.type === 'result');
  const verify = refs.find(row => row.ref.type === 'verify');

  if (phase !== 'pre' && fixture) {
    errors.push('fixture item remains after kickoff');
    score -= 30;
  }
  if (phase === 'pre') {
    if (!fixture) {
      warnings.push('pre-kickoff target has no fixture item in the visible global feed');
      score -= 8;
    } else {
      const expiresAt = parseTime(fixture.item.expires_at);
      if (!Number.isFinite(expiresAt) || expiresAt > kickoff) {
        errors.push('fixture item does not expire at kickoff');
        score -= 18;
      }
    }
  }
  if (phase === 'kickoff_grace') {
    if (live || result) {
      errors.push('kickoff grace contains live/result item before verified state');
      score -= 25;
    }
  }
  if (phase === 'stale_scheduled') {
    if (!verify) {
      errors.push('stale scheduled match lacks verification/recovery item');
      score -= 30;
    }
  }
  if (phase === 'live') {
    if (!live) {
      errors.push('live match lacks live Pundit item');
      score -= 25;
    }
  }
  if (phase === 'final') {
    if (!result) {
      errors.push('finished match lacks result Pundit item');
      score -= 25;
    }
    if (!storyCoversMatch(storyCoverage, match)) {
      errors.push('finished match lacks World Cup story');
      score -= 20;
    }
  }

  const mainItem = result || fixture || live || verify;
  if (mainItem && (mainItem.ref.type === 'result' || mainItem.ref.type === 'fixture')) {
    const text = itemText(mainItem.item);
    if (!EN_CONSEQUENCE_TERMS.test(String(mainItem.item.en || ''))) {
      errors.push(`${mainItem.ref.type} English copy lacks table/prediction consequence`);
      score -= 12;
    }
    if (!HE_CONSEQUENCE_TERMS.test(String(mainItem.item.he || ''))) {
      errors.push(`${mainItem.ref.type} Hebrew copy lacks table/prediction consequence`);
      score -= 12;
    }
    if (/Statement made|No winner, all drama|makes noise with/i.test(text)) {
      errors.push('copy uses banned generic story phrasing');
      score -= 20;
    }
  }

  const targetNews = newsItems.filter(item => {
    return mentionsTeamCode(item, match.home_team_code) || mentionsTeamCode(item, match.away_team_code);
  });
  if (phase === 'pre' && kickoff - nowMs <= 8 * HOUR_MS && targetNews.length === 0) {
    warnings.push('no source-backed news/editorial item linked to this pre-kickoff target');
    score -= 5;
  }
  if (phase === 'pre') {
    for (const item of targetNews) {
      const expiresAt = parseTime(item && item.expires_at);
      if (!Number.isFinite(expiresAt) || expiresAt > kickoff) {
        errors.push(`pre-kickoff news item ${item.id || '(unknown)'} does not expire at kickoff`);
        score -= 15;
      }
    }
  }

  return {
    match: matchLabel(match),
    match_id: match.id,
    kickoff: match.match_date,
    status: match.status,
    phase,
    itemTypes,
    score: Math.max(0, score),
    errors,
    warnings,
  };
}

function localPayloads() {
  return {
    source: 'local',
    matchesPayload: readJson(MATCHES_FILE, { matches: [] }),
    feed: readJson(PUNDIT_FILE, null),
    stories: readJson(STORIES_FILE, { items: [] }),
    news: readJson(NEWS_FILE, { items: [] }),
  };
}

async function remotePayloads(baseUrl) {
  const normalised = normaliseBaseUrl(baseUrl);
  const [matchesPayload, feed, stories, news] = await Promise.all([
    fetchJson(normalised, 'public-data/matches.json'),
    fetchJson(normalised, 'public-data/pundit.json'),
    fetchJson(normalised, 'public-data/world-cup-stories.json'),
    fetchJson(normalised, 'public-data/pundit-news.json'),
  ]);
  return {
    source: normalised,
    matchesPayload,
    feed,
    stories,
    news,
  };
}

function certifyWithPayloads(args, payloads) {
  const nowMs = args.now ? Date.parse(args.now) : Date.now();
  if (!Number.isFinite(nowMs)) throw new Error(`Invalid --now value: ${args.now}`);
  const matchesPayload = payloads.matchesPayload || { matches: [] };
  const feed = payloads.feed || null;
  const stories = payloads.stories || { items: [] };
  const news = payloads.news || { items: [] };
  const matches = Array.isArray(matchesPayload.matches) ? matchesPayload.matches : [];
  const feedItems = feed && Array.isArray(feed.items) ? feed.items : [];
  const storyCoverage = storyCoverageSet(Array.isArray(stories.items) ? stories.items : [], matches);
  const newsItems = Array.isArray(news.items) ? news.items : [];
  const errors = [];
  const warnings = [];
  const nowIso = new Date(nowMs).toISOString();

  if (!feed || !Array.isArray(feed.items)) errors.push('pundit.json missing or invalid');
  const freshUntil = parseTime(feed && feed.freshUntil);
  const updatedAt = parseTime(feed && feed.updatedAt);
  if (!Number.isFinite(updatedAt)) errors.push('pundit.json missing updatedAt');
  if (!Number.isFinite(freshUntil) || freshUntil <= nowMs) errors.push('pundit.json is stale for certification time');
  for (const item of feedItems) {
    const expiresAt = parseTime(item && item.expires_at);
    if (item && item.expires_at && Number.isFinite(expiresAt) && expiresAt <= nowMs) {
      errors.push(`${item.id}: expired item is still present in pundit.json`);
    }
  }

  const targets = findTargets(matches, args, nowMs);
  if (!targets.length) errors.push(args.match ? `no match found for ${args.match}` : 'no live-window target found');
  const targetReports = targets.map(match => scoreTarget(match, {
    nowMs,
    feedItems,
    storyCoverage,
    newsItems,
  }));
  for (const report of targetReports) {
    report.errors.forEach(error => errors.push(`${report.match}: ${error}`));
    report.warnings.forEach(warning => warnings.push(`${report.match}: ${warning}`));
  }
  const proofWindow = targetReports.some(report => report.phase !== 'pre');
  const proofPhases = targetReports.map(report => report.phase);
  if (args.graduationProof && !proofWindow) {
    errors.push('graduation proof requires at least one post-kickoff/live/final target; all targets are pre-kickoff');
  }

  const targetScore = targetReports.length
    ? Math.min(...targetReports.map(report => report.score))
    : 0;
  let score = Math.min(100, targetScore);
  score -= errors.length * 10;
  score -= warnings.length * 2;
  score = Math.max(0, score);
  const passed = errors.length === 0 && score >= args.minScore;
  return {
    source: payloads.source || 'local',
    checked_at: nowIso,
    min_score: args.minScore,
    score,
    passed,
    proof_window: proofWindow,
    proof_phases: proofPhases,
    graduation_proof_required: Boolean(args.graduationProof),
    feed: {
      updatedAt: feed && feed.updatedAt,
      freshUntil: feed && feed.freshUntil,
      items: feedItems.length,
    },
    targets: targetReports,
    errors,
    warnings,
  };
}

function certify(args) {
  return certifyWithPayloads(args, localPayloads());
}

async function certifyAsync(args) {
  if (args.baseUrl) {
    return certifyWithPayloads(args, await remotePayloads(args.baseUrl));
  }
  return certify(args);
}

function printReport(report, json) {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Pundit live-window certification: score=${report.score} passed=${report.passed}`);
  console.log(`source=${report.source || 'local'}`);
  console.log(`checked_at=${report.checked_at}`);
  console.log(`proof_window=${report.proof_window} phases=${(report.proof_phases || []).join(',') || '-'}`);
  console.log(`feed=${report.feed.items} item(s), updatedAt=${report.feed.updatedAt}, freshUntil=${report.feed.freshUntil}`);
  report.targets.forEach(target => {
    console.log(`- ${target.match} phase=${target.phase} status=${target.status} score=${target.score} items=${target.itemTypes.join(',') || '-'}`);
    target.errors.forEach(error => console.log(`  error: ${error}`));
    target.warnings.forEach(warning => console.log(`  warning: ${warning}`));
  });
  report.errors.forEach(error => console.log(`ERROR: ${error}`));
  report.warnings.forEach(warning => console.log(`warning: ${warning}`));
}

function recordReport(report, recordPath) {
  const file = resolveRecordPath(recordPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify({
    kind: 'pundit_live_window_certification',
    ...report,
  })}\n`);
}

if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv);
    const report = await certifyAsync(args);
    printReport(report, args.json);
    if (args.record) recordReport(report, args.record);
    if (!report.passed) process.exit(1);
  })().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
} else {
  module.exports = {
    certify,
    certifyAsync,
    certifyWithPayloads,
    phaseFor,
    scoreTarget,
    mentionsTeamCode,
    recordReport,
    assetUrl,
    normaliseBaseUrl,
  };
}
