#!/usr/bin/env node
// FriendlyBet - verified FIFA World Cup final Golden Boot resolver.
//
// Default mode is dry-run. With --apply, writes app_settings.top_scorer only
// after the final match is terminal and Golden Boot truth is decisive.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.PROD_ANON_KEY;
const APPLY = process.argv.includes('--apply');
const FINAL_EXTERNAL_ID = String(process.env.GOLDEN_BOOT_FINAL_EXTERNAL_ID || '400021543');
const REPORT_PATH = process.env.GOLDEN_BOOT_REPORT_PATH || '';
const FETCH_TIMEOUT_MS = parseInt(process.env.GOLDEN_BOOT_FETCH_TIMEOUT_MS || '', 10) || 15000;
const SECONDARY_MIN_SOURCES = parseInt(process.env.GOLDEN_BOOT_SECONDARY_MIN_SOURCES || '', 10) || 2;
const USER_AGENT = process.env.GOLDEN_BOOT_USER_AGENT || 'FriendlyBet Golden Boot resolver (+https://friendlybet.live)';

const DEFAULT_SOURCE_URLS = [
  {
    key: 'fifa_stats',
    label: 'FIFA player statistics',
    family: 'official:fifa',
    official: true,
    url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/statistics/player-statistics'
  },
  {
    key: 'fifa_key_stats',
    label: 'FIFA key statistics',
    family: 'official:fifa',
    official: true,
    url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/fifa-world-cup-key-statistics'
  },
  {
    key: 'ap_search',
    label: 'AP News search',
    family: 'wire:ap',
    official: false,
    url: 'https://apnews.com/search?q=World%20Cup%202026%20Golden%20Boot%20Messi%20Mbappe'
  },
  {
    key: 'talksport',
    label: 'TalkSport Golden Boot tracker',
    family: 'media:talksport',
    official: false,
    url: 'https://talksport.com/football/world-cup/4350919/world-cup-golden-boot-messi-mbappe-kane-bellingham/'
  },
  {
    key: 'fox_stats',
    label: 'FOX Sports World Cup stats',
    family: 'media:fox',
    official: false,
    url: 'https://www.foxsports.com/soccer/fifa-world-cup-men/stats?category=goals'
  },
  {
    key: 'livescore_world_cup',
    label: 'LiveScore World Cup page',
    family: 'scoreboard:livescore',
    official: false,
    url: 'https://www.livescore.com/en/football/international/world-cup-2026/'
  },
  {
    key: 'guardian_world_cup',
    label: 'Guardian World Cup page',
    family: 'media:guardian',
    official: false,
    url: 'https://www.theguardian.com/football/worldcup2026'
  }
];

function setGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value == null ? '' : value}\n`, 'utf8');
}

function writeReport(payload) {
  if (!REPORT_PATH) return;
  const file = path.resolve(ROOT, REPORT_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function normalizeText(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .toLowerCase();
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRe(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function plausibleTournamentStats(stats) {
  if (!stats || stats.goals == null || stats.assists == null) return false;
  if (stats.goals < 0 || stats.goals > 20) return false;
  if (stats.assists < 0 || stats.assists > 15) return false;
  if (stats.minutes != null && (stats.minutes < 0 || stats.minutes > 900)) return false;
  return true;
}

function safeCandidateKey(name) {
  const n = normalizeText(name);
  if (n.includes('messi')) return 'messi';
  if (n.includes('mbappe')) return 'mbappe';
  return '';
}

function loadFinalScenarioCandidates() {
  const manifestPath = path.join(ROOT, 'public-data', 'knockout-scenarios', 'manifest.json');
  let rows = [];
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const finalEntry = (manifest.matches || []).find(entry =>
      String(entry && entry.match && entry.match.external_id) === FINAL_EXTERNAL_ID
      || String(entry && entry.match && entry.match.stage || '').toUpperCase() === 'FINAL');
    rows = (finalEntry && finalEntry.top_scorer_candidates) || [];
  } catch (_) {
    rows = [];
  }
  const fromManifest = rows
    .map(row => ({ ...row, candidate_key: safeCandidateKey(row.player_name) }))
    .filter(row => row.candidate_key === 'messi' || row.candidate_key === 'mbappe');
  const byKey = new Map(fromManifest.map(row => [row.candidate_key, row]));
  return [
    {
      key: 'messi',
      player_id: (byKey.get('messi') && byKey.get('messi').player_id) || 'eef85a8f-8dec-4ecc-85e8-8a731f5ed527',
      player_name: (byKey.get('messi') && byKey.get('messi').player_name) || 'Lionel Messi',
      aliases: ['lionel messi', 'messi']
    },
    {
      key: 'mbappe',
      player_id: (byKey.get('mbappe') && byKey.get('mbappe').player_id) || '8c339bd2-3fc2-49f2-a755-622f406a01dc',
      player_name: (byKey.get('mbappe') && byKey.get('mbappe').player_name) || 'Kylian Mbappe',
      aliases: ['kylian mbappe', 'mbappe']
    }
  ];
}

async function sb(method, table, options = {}) {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY/PROD_ANON_KEY');
  const url = `${SUPABASE_URL}/rest/v1/${table}${options.query || ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
      ...(options.headers || {})
    },
    body: options.data ? JSON.stringify(options.data) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function finalMatchFromEnv() {
  if (!process.env.GOLDEN_BOOT_FINAL_MATCH_JSON) return null;
  try { return JSON.parse(process.env.GOLDEN_BOOT_FINAL_MATCH_JSON); }
  catch (_) { return null; }
}

async function loadFinalMatch() {
  const fixture = finalMatchFromEnv();
  if (fixture) return fixture;
  const rows = await sb('GET', 'matches', {
    query: `?select=*&external_id=eq.${encodeURIComponent(FINAL_EXTERNAL_ID)}`
  });
  if (rows && rows[0]) return rows[0];
  const finals = await sb('GET', 'matches', {
    query: '?select=*&stage=eq.FINAL&order=match_date.desc&limit=1'
  });
  return finals && finals[0] ? finals[0] : null;
}

function matchStatus(match) {
  return String((match && match.status) || '').toUpperCase();
}

function hasNumericScore(match) {
  return match && match.home_score != null && match.away_score != null
    && Number.isFinite(Number(match.home_score)) && Number.isFinite(Number(match.away_score));
}

function resolvedWinner(match) {
  if (!hasNumericScore(match)) return null;
  const home = Number(match.home_score);
  const away = Number(match.away_score);
  if (home > away) return match.home_team_code || null;
  if (away > home) return match.away_team_code || null;
  const winner = String((match && match.winner_code) || '').toUpperCase();
  return winner && (winner === match.home_team_code || winner === match.away_team_code) ? winner : null;
}

function finalMatchResolved(match) {
  return !!match
    && ['FINISHED', 'AWARDED'].includes(matchStatus(match))
    && hasNumericScore(match)
    && !!resolvedWinner(match);
}

async function fetchText(url, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json,text/plain,*/*' },
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${label || url} HTTP ${res.status}: ${text.slice(0, 160)}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function sourceUrlsFromEnv() {
  const hints = String(process.env.GOLDEN_BOOT_SOURCE_HINTS || '')
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map((url, idx) => ({
      key: `hint_${idx + 1}`,
      label: `Source hint ${idx + 1}`,
      family: familyForUrl(url),
      official: /(^|\.)fifa\.com$/i.test(hostForUrl(url)),
      url
    }));
  return DEFAULT_SOURCE_URLS.concat(hints);
}

function hostForUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch (_) { return ''; }
}

function familyForUrl(url) {
  const host = hostForUrl(url);
  if (host.endsWith('fifa.com')) return 'official:fifa';
  if (host.endsWith('apnews.com')) return 'wire:ap';
  if (host.endsWith('talksport.com')) return 'media:talksport';
  if (host.endsWith('theguardian.com')) return 'media:guardian';
  if (host.endsWith('foxsports.com')) return 'media:fox';
  if (host.endsWith('livescore.com')) return 'scoreboard:livescore';
  return `web:${host || 'unknown'}`;
}

function apArticleUrls(html) {
  const urls = new Set();
  const hrefRe = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRe.exec(String(html || '')))) {
    let url = m[1];
    if (url.startsWith('/article/')) url = `https://apnews.com${url}`;
    if (!/^https:\/\/apnews\.com\/article\//i.test(url)) continue;
    const low = url.toLowerCase();
    if (!(low.includes('world') || low.includes('cup') || low.includes('soccer') || low.includes('football'))) continue;
    urls.add(url.split('?')[0]);
    if (urls.size >= 5) break;
  }
  return [...urls];
}

function sourceLooksPreFinal(text) {
  const n = normalizeText(stripTags(text));
  return /\bfinal\b.{0,80}\b(?:is set to|will be|set to follow|to follow|approaches|one more opportunity|chasing|needs|requires)\b/.test(n)
    || /\b(?:before|ahead of)\b.{0,80}\bfinal\b/.test(n)
    || /\bfinal\b.{0,80}\b(?:pending|yet to be played)\b/.test(n);
}

function sourceMentionsCompletedFinal(text, match) {
  const n = normalizeText(stripTags(text));
  const teamNames = {
    ARG: 'argentina',
    ESP: 'spain',
    FRA: 'france',
    ENG: 'england'
  };
  const winnerCode = resolvedWinner(match);
  const loserCode = winnerCode && winnerCode === match.home_team_code ? match.away_team_code : match.home_team_code;
  const winner = normalizeText(teamNames[winnerCode] || winnerCode || '');
  const loser = normalizeText(teamNames[loserCode] || loserCode || '');
  if (!winner || !loser) return false;
  const hasFinal = /\b(world cup final|final)\b/.test(n);
  const winnerBeatLoser = new RegExp(`\\b${escapeRe(winner)}\\b.{0,140}\\b(?:beat|beats|defeated|defeats|won|wins|champion|champions|lifted|retained|claimed)\\b.{0,140}\\b${escapeRe(loser)}\\b`).test(n);
  const loserLostToWinner = new RegExp(`\\b${escapeRe(loser)}\\b.{0,140}\\b(?:lost|beaten|defeated)\\b.{0,140}\\b${escapeRe(winner)}\\b`).test(n);
  const penaltyWinner = new RegExp(`\\b${escapeRe(winner)}\\b.{0,180}\\b(?:penalties|penalty shootout|shootout)\\b`).test(n);
  return hasFinal && (winnerBeatLoser || loserLostToWinner || penaltyWinner);
}

function extractStatsFromWindow(windowText) {
  const w = normalizeText(windowText);
  const goalAssist = w.match(/(\d{1,2})\s+goals?\b.{0,90}?(\d{1,2})\s+assists?\b/);
  if (goalAssist) return { goals: numeric(goalAssist[1]), assists: numeric(goalAssist[2]), minutes: null };
  const goalOnly = w.match(/(\d{1,2})\s+goals?\b/);
  const assistOnly = w.match(/(\d{1,2})\s+assists?\b/);
  if (goalOnly && assistOnly) return { goals: numeric(goalOnly[1]), assists: numeric(assistOnly[1]), minutes: null };
  const table = w.match(/(?:fw|mf|df|gk)?\s*\|?\s*(\d{1,2})\s*(?:\||\s{2,})\s*(\d{1,2})(?:\s*(?:\||\s{2,})\s*(\d{2,4}))?/);
  if (table) return { goals: numeric(table[1]), assists: numeric(table[2]), minutes: numeric(table[3]) };
  return null;
}

function extractStatsForCandidate(text, candidate) {
  const plain = stripTags(text);
  const n = normalizeText(plain);
  const results = [];
  for (const alias of candidate.aliases || []) {
    const a = normalizeText(alias);
    let idx = n.indexOf(a);
    while (idx >= 0) {
      const afterAlias = n.slice(idx + a.length, Math.min(n.length, idx + a.length + 360));
      const afterStats = extractStatsFromWindow(afterAlias);
      if (plausibleTournamentStats(afterStats)) results.push(afterStats);
      const start = Math.max(0, idx - 260);
      const end = Math.min(n.length, idx + a.length + 820);
      const windowText = n.slice(start, end);
      if (!afterStats) {
        const stats = extractStatsFromWindow(windowText);
        if (plausibleTournamentStats(stats)) results.push(stats);
      }
      idx = n.indexOf(a, idx + a.length);
    }
  }
  if (!results.length) return null;
  return results.sort((a, b) =>
    (b.goals - a.goals)
    || (b.assists - a.assists)
    || ((a.minutes == null ? 99999 : a.minutes) - (b.minutes == null ? 99999 : b.minutes)))[0];
}

function directGoldenBootVerdict(text, candidates) {
  const n = normalizeText(stripTags(text));
  if (!/\bgolden boot\b/.test(n)) return null;
  const winWords = '(?:wins?|won|claims?|claimed|clinches?|clinched|secures?|secured|takes?|took|winner|awarded)';
  for (const candidate of candidates) {
    for (const alias of candidate.aliases || []) {
      const a = escapeRe(normalizeText(alias));
      const before = new RegExp(`\\bgolden boot\\b.{0,140}\\b${a}\\b.{0,120}\\b${winWords}\\b`);
      const after = new RegExp(`\\b${a}\\b.{0,140}\\b${winWords}\\b.{0,120}\\bgolden boot\\b`);
      const winnerLine = new RegExp(`\\bgolden boot winner\\b.{0,120}\\b${a}\\b|\\b${a}\\b.{0,120}\\bgolden boot winner\\b`);
      if (before.test(n) || after.test(n) || winnerLine.test(n)) return candidate.key;
    }
  }
  return null;
}

function sourceAllowsDirectVerdict(source) {
  if (!source) return false;
  if (source.official) return true;
  if (String(source.key || '') === 'ap_search') return false;
  return ['wire:ap', 'media:talksport', 'media:guardian', 'media:fox']
    .includes(String(source.family || '').toLowerCase());
}

function statsWinner(statsByKey) {
  const messi = statsByKey.messi;
  const mbappe = statsByKey.mbappe;
  if (!messi || !mbappe) return { key: null, reason: 'missing candidate stats' };
  if (messi.goals !== mbappe.goals) return { key: messi.goals > mbappe.goals ? 'messi' : 'mbappe', reason: 'goals' };
  if (messi.assists !== mbappe.assists) return { key: messi.assists > mbappe.assists ? 'messi' : 'mbappe', reason: 'assists' };
  if (messi.minutes != null && mbappe.minutes != null && messi.minutes !== mbappe.minutes) {
    return { key: messi.minutes < mbappe.minutes ? 'messi' : 'mbappe', reason: 'fewer minutes' };
  }
  return { key: null, reason: 'tied stats without decisive minutes' };
}

async function observeSource(source, text, candidates, finalMatch) {
  const preFinal = sourceLooksPreFinal(text);
  const completedFinal = sourceMentionsCompletedFinal(text, finalMatch);
  const stats = {};
  for (const candidate of candidates) {
    const parsed = extractStatsForCandidate(text, candidate);
    if (parsed) stats[candidate.key] = parsed;
  }
  const direct = sourceAllowsDirectVerdict(source) ? directGoldenBootVerdict(text, candidates) : null;
  const fromStats = statsWinner(stats);
  let verdictKey = direct || fromStats.key;
  let reason = direct ? 'direct Golden Boot winner wording' : fromStats.reason;
  const liveOfficialStats = source.official && source.key === 'fifa_stats';
  const freshEnough = !preFinal && (liveOfficialStats || completedFinal || (source.official && !!direct));
  if (!freshEnough) {
    verdictKey = null;
    reason = preFinal ? 'source still describes the final as upcoming' : 'source does not prove post-final Golden Boot truth';
  }
  return {
    source: source.key,
    label: source.label,
    family: source.family,
    official: !!source.official,
    url: source.url,
    freshEnough,
    verdictKey,
    reason,
    stats
  };
}

async function loadSourceTexts() {
  const loaded = [];
  for (const source of sourceUrlsFromEnv()) {
    try {
      const text = await fetchText(source.url, source.label);
      loaded.push({ source, text });
      if (source.key === 'ap_search') {
        for (const url of apArticleUrls(text)) {
          try {
            const articleText = await fetchText(url, 'AP News article');
            loaded.push({
              source: { ...source, key: `ap_article_${loaded.length}`, label: 'AP News article', url },
              text: articleText
            });
          } catch (err) {
            loaded.push({
              source: { ...source, key: `ap_article_error_${loaded.length}`, label: 'AP News article', url },
              error: err.message
            });
          }
        }
      }
    } catch (err) {
      loaded.push({ source, error: err.message });
    }
  }
  return loaded;
}

function selectResolution(observations, candidates) {
  const decisive = (observations || []).filter(o => o && o.verdictKey);
  const official = decisive.filter(o => o.family === 'official:fifa');
  if (official.length) {
    const officialKeys = new Set(official.map(o => o.verdictKey));
    if (officialKeys.size === 1) {
      const key = official[0].verdictKey;
      const candidate = candidates.find(c => c.key === key);
      return { decisive: true, candidate, basis: 'official_fifa', observations: official };
    }
    return { decisive: false, reason: 'official FIFA sources conflict', observations: official };
  }

  const families = new Map();
  for (const obs of decisive) {
    if (!families.has(obs.family)) families.set(obs.family, obs);
  }
  const byKey = {};
  for (const obs of families.values()) {
    if (!byKey[obs.verdictKey]) byKey[obs.verdictKey] = [];
    byKey[obs.verdictKey].push(obs);
  }
  const winners = Object.entries(byKey).sort((a, b) => b[1].length - a[1].length);
  if (!winners.length) return { decisive: false, reason: 'no decisive post-final Golden Boot source' };
  if (winners.length > 1 && winners[0][1].length === winners[1][1].length) {
    return { decisive: false, reason: 'secondary sources conflict' };
  }
  const [key, sourceRows] = winners[0];
  if (sourceRows.length < SECONDARY_MIN_SOURCES) {
    return { decisive: false, reason: `need ${SECONDARY_MIN_SOURCES} independent secondary sources, have ${sourceRows.length}` };
  }
  const candidate = candidates.find(c => c.key === key);
  return { decisive: true, candidate, basis: 'secondary_consensus', observations: sourceRows };
}

async function loadCurrentTopScorer() {
  const rows = await sb('GET', 'app_settings', { query: '?key=eq.top_scorer&select=value' });
  return rows && rows[0] && rows[0].value ? String(rows[0].value) : '';
}

async function hasAnyAwardedTopScorerScore() {
  try {
    const rows = await sb('GET', 'users', { query: '?select=id&top_scorer_score=gt.0&limit=1' });
    return !!(rows && rows.length);
  } catch (_) {
    return false;
  }
}

async function writeTopScorer(candidate) {
  await sb('POST', 'app_settings', {
    query: '?on_conflict=key',
    data: { key: 'top_scorer', value: String(candidate.player_id), updated_at: new Date().toISOString() }
  });
}

async function main() {
  const candidates = loadFinalScenarioCandidates();
  const finalMatch = await loadFinalMatch();
  if (!finalMatchResolved(finalMatch)) {
    const report = { decisive: false, changed: false, reason: 'final match is not verified terminal', finalMatch, candidates };
    setGithubOutput('decisive', 'false');
    setGithubOutput('changed', 'false');
    setGithubOutput('score_needed', 'false');
    setGithubOutput('reason', report.reason);
    writeReport(report);
    console.log(`golden-boot: ${report.reason}`);
    return report;
  }

  const loaded = await loadSourceTexts();
  const observations = [];
  for (const item of loaded) {
    if (item.error) {
      observations.push({ source: item.source.key, label: item.source.label, family: item.source.family, official: !!item.source.official, url: item.source.url, error: item.error });
      continue;
    }
    observations.push(await observeSource(item.source, item.text, candidates, finalMatch));
  }

  const resolution = selectResolution(observations, candidates);
  if (!resolution.decisive || !resolution.candidate) {
    const report = { decisive: false, changed: false, reason: resolution.reason || 'Golden Boot not decisive', finalMatch, candidates, observations };
    setGithubOutput('decisive', 'false');
    setGithubOutput('changed', 'false');
    setGithubOutput('score_needed', 'false');
    setGithubOutput('reason', report.reason);
    writeReport(report);
    console.log(`golden-boot: ${report.reason}`);
    return report;
  }

  const current = await loadCurrentTopScorer();
  const changed = current !== String(resolution.candidate.player_id);
  if (APPLY && changed) await writeTopScorer(resolution.candidate);
  const scoreNeeded = APPLY && (changed || !(await hasAnyAwardedTopScorerScore()));
  const report = {
    decisive: true,
    changed: APPLY ? changed : false,
    wouldChange: !APPLY && changed,
    scoreNeeded,
    applied: APPLY,
    basis: resolution.basis,
    player_id: resolution.candidate.player_id,
    player_name: resolution.candidate.player_name,
    current_value: current || null,
    finalMatch,
    observations: resolution.observations,
    allObservations: observations
  };
  setGithubOutput('decisive', 'true');
  setGithubOutput('changed', APPLY && changed ? 'true' : 'false');
  setGithubOutput('score_needed', scoreNeeded ? 'true' : 'false');
  setGithubOutput('player_id', resolution.candidate.player_id);
  setGithubOutput('player_name', resolution.candidate.player_name);
  setGithubOutput('basis', resolution.basis);
  setGithubOutput('reason', resolution.basis);
  writeReport(report);
  console.log(`golden-boot: ${APPLY ? (changed ? 'wrote' : 'already set') : 'dry-run'} ${resolution.candidate.player_name} (${resolution.candidate.player_id}) via ${resolution.basis}`);
  return report;
}

if (require.main === module) {
  main().catch(err => {
    setGithubOutput('decisive', 'false');
    setGithubOutput('changed', 'false');
    setGithubOutput('score_needed', 'false');
    setGithubOutput('reason', err.message);
    writeReport({ decisive: false, changed: false, error: err.message, stack: err.stack });
    console.error(err);
    process.exit(1);
  });
} else {
  module.exports = {
    normalizeText,
    stripTags,
    sourceLooksPreFinal,
    sourceMentionsCompletedFinal,
    extractStatsForCandidate,
    directGoldenBootVerdict,
    statsWinner,
    observeSource,
    selectResolution,
    finalMatchResolved,
    loadFinalScenarioCandidates
  };
}
