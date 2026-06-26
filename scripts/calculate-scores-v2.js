// ============================================================
// FriendlyBet v2 - Score Calculation Script
// ============================================================
// New scoring model that supports:
//   - 'single_phase' pools (groups + hypothetical bracket + winner + top scorer)
//   - 'two_phase' pools (legacy groups + knockout)
//   - 'late_knockout' pools (real knockout bracket only)
// All scoring rules come from pools.scoring_rules (JSONB).
// Runs every 30 minutes via GitHub Actions.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_FETCH_TIMEOUT_MS = Number(process.env.SCORING_SUPABASE_FETCH_TIMEOUT_MS || 30000);
const SCORING_VERBOSE = process.env.SCORING_VERBOSE !== '0';

function scoringDetail(...args) {
  if (SCORING_VERBOSE) console.log(...args);
}

function scoringWarn(...args) {
  if (SCORING_VERBOSE) console.warn(...args);
}

if (!SUPABASE_KEY && require.main === module) {
  console.error('Missing SUPABASE_SECRET_KEY');
  process.exit(1);
}

// ---- Defaults (mirror app's DEFAULT_SCORING_RULES) ----
// v2.5.55: doubling-progression defaults (1 / 2 / 4 / 8 / 16 / 32) so each
// stage maxes at ~32 pts across the pool.
const DEFAULT_RULES_SINGLE = {
  // v2.6.17: doubling progression (mirror app.js DEFAULT_SCORING_RULES).
  //   Groups: 1st=4, 2nd=3, 3rd=2, 4th=1.
  //   Knockout: R32=2, R16=4, QF=8, SF=16, Final=32 (~32 pts max per stage).
  group_first: 4, group_second: 3, group_third: 2, group_fourth: 1,
  third_place_advance: 1,
  round_of_32: 2, round_of_16: 4, quarter_final: 8, semi_final: 16, final: 32,
  top_scorer: 10
};
const DEFAULT_RULES_TWO = {
  group_first: 1, group_second: 1, group_third: 0, group_fourth: 0,
  round_of_32: 2, round_of_16: 4, quarter_final: 8, semi_final: 16, final: 32,
  top_scorer: 10
};
const DEFAULT_RULES_LATE_KNOCKOUT = {
  group_first: 0, group_second: 0, group_third: 0, group_fourth: 0,
  third_place_advance: 0,
  round_of_32: 2, round_of_16: 4, quarter_final: 8, semi_final: 16, final: 32,
  top_scorer: 0
};

// v2.5.36: shared multiplier resolver. Looks up (in order): the
// multiplier_applied snapshot persisted on the pick row → the pool's
// per-team override → the pool's category multiplier (favorite /
// contender / underdog, classified by FIFA rank) → global defaults.
// Keep in sync with FIFA_RANKINGS in app.js (the official Dec-5 2025 draw teams).
const FIFA_RANK = {
  ARG:1, ESP:2, FRA:3, ENG:4, BRA:5, POR:6, NED:7, BEL:8, CRO:9, GER:12, COL:13, MAR:14, URU:15,
  USA:16, MEX:17, JPN:18, SUI:19, SEN:20, IRN:21, KOR:22, AUT:23, ECU:24, SWE:25, AUS:26,
  TUR:27, NOR:28, TUN:29, EGY:30, ALG:31, CAN:32, CZE:33, SCO:34, CIV:35, PAR:37,
  PAN:38, IRQ:40, RSA:42, UZB:43, JOR:44, GHA:47, NZL:55, SAU:57, COD:58, BIH:59, HAI:60,
  CPV:65, QAT:66, CUR:85
};
// Canonical WC2026 group membership — used to reject impossible two-phase group
// picks (team tagged under a group it isn't in) and to validate set shape so a
// tampered/over-complete set can't inflate the score.
const WC2026_GROUPS = {
  A: ['MEX','RSA','KOR','CZE'], B: ['CAN','BIH','QAT','SUI'], C: ['BRA','MAR','HAI','SCO'],
  D: ['USA','PAR','AUS','TUR'], E: ['GER','CUR','CIV','ECU'], F: ['NED','JPN','SWE','TUN'],
  G: ['BEL','EGY','IRN','NZL'], H: ['ESP','CPV','SAU','URU'], I: ['FRA','SEN','IRQ','NOR'],
  J: ['ARG','ALG','AUT','JOR'], K: ['POR','COD','UZB','COL'], L: ['ENG','CRO','GHA','PAN']
};
const TEAM_TO_GROUP = {};
for (const [L, teams] of Object.entries(WC2026_GROUPS)) teams.forEach(tc => { TEAM_TO_GROUP[tc] = L; });

// Validate a two-phase group-pick SET for scoring. A legal advancing set is
// EXACTLY 32 distinct teams, each in its real group, with 2-3 picks per group
// A-L. Anything else (under-complete like 24/31, OR over-complete like 36 which
// would unfairly cover more teams) is NOT a scoreable final set. We first drop
// wrong-group rows and duplicate teams, then require the cleaned set to be a
// valid 32. Returns { ok, picks, reason }: when ok, `picks` is the cleaned,
// score-ready list; when not ok, scoring must award 0 group points. Exported for
// tests. (Replaces the earlier sanitize-only helper, which let 36 score as 36.)
function validateTwoPhaseGroupPickSet(rows) {
  const LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  const seen = new Set();
  const byGroup = {};
  for (const p of (rows || [])) {
    if (!p || !p.team_code) continue;
    if (TEAM_TO_GROUP[p.team_code] !== p.group_letter) continue; // wrong group / unknown team
    if (seen.has(p.team_code)) continue;                          // duplicate team
    seen.add(p.team_code);
    (byGroup[p.group_letter] = byGroup[p.group_letter] || []).push(p);
  }
  let total = 0;
  for (const L of LETTERS) {
    const n = (byGroup[L] || []).length;
    if (n < 2 || n > 3) return { ok: false, picks: [], reason: `group ${L} has ${n} valid pick(s) (need 2-3)` };
    total += n;
  }
  if (total !== 32) return { ok: false, picks: [], reason: `${total} valid picks (need exactly 32)` };
  return { ok: true, picks: LETTERS.flatMap(L => byGroup[L]), reason: null };
}

const DEFAULT_CAT_MULT = { favorite: 1.0, contender: 1.5, underdog: 2.0 };
function poolMultResolver(pool, rules) {
  const enabled = pool.use_multipliers !== false;
  const cat = rules.multipliers || DEFAULT_CAT_MULT;
  const overrides = rules.team_multipliers || {};
  return (teamCode, persisted) => {
    if (!enabled) return 1.0;
    if (persisted != null && !isNaN(parseFloat(persisted))) return parseFloat(persisted);
    if (overrides[teamCode] != null) return parseFloat(overrides[teamCode]) || 1.0;
    const rank = FIFA_RANK[teamCode] || 999;
    const tier = rank <= 10 ? 'favorite' : rank <= 30 ? 'contender' : 'underdog';
    return parseFloat(cat[tier]) || DEFAULT_CAT_MULT[tier];
  };
}

function groupScoringMode(rules) {
  const mode = String((rules && rules.group_scoring_mode) || '').toLowerCase();
  return mode === 'advancement' ? 'advancement' : 'position';
}

function thirdPlacePickGroupSet(rows) {
  return new Set((rows || []).map(row => row && row.group_letter).filter(Boolean));
}

function isSinglePhaseAdvancementCandidate(pick, thirdPlaceGroups) {
  const pos = Number(pick && pick.position);
  if (pos === 1 || pos === 2) return true;
  return pos === 3 && thirdPlaceGroups && thirdPlaceGroups.has(pick.group_letter);
}

// ---- Supabase fetch helper ----
const { fbGuardDelete } = require('./lib-guard');
async function sb(method, table, options = {}) {
  fbGuardDelete(method, table);  // scoring must never DELETE user-data tables
  const { data, query = '', headers = {} } = options;
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation,resolution=merge-duplicates',
        ...headers
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(`Supabase ${method} ${table} timed out after ${SUPABASE_FETCH_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const REST_PAGE_SIZE = 1000;
async function sbAll(table, query = '', pageSize = REST_PAGE_SIZE) {
  const all = [];
  for (let from = 0, guard = 0; ; guard++, from += pageSize) {
    if (guard >= 10000) {
      throw new Error(`Supabase GET ${table}: pagination guard exceeded after ${all.length} rows`);
    }
    const page = await sb('GET', table, {
      query,
      headers: { Range: `${from}-${from + pageSize - 1}` }
    });
    if (!Array.isArray(page)) {
      throw new Error(`Supabase GET ${table}: expected array page`);
    }
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

// ---- Compute actual group standings from finished group_stage matches ----
function computeGroupStandings(matches, groupTeams) {
  // Build per-team stats
  const stats = {};
  groupTeams.forEach(code => {
    stats[code] = { code, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  });
  matches.forEach(m => {
    if (m.home_score == null || m.away_score == null) return;
    if (!stats[m.home_team_code] || !stats[m.away_team_code]) return;
    const h = stats[m.home_team_code];
    const a = stats[m.away_team_code];
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score; h.gd = h.gf - h.ga;
    a.gf += m.away_score; a.ga += m.home_score; a.gd = a.gf - a.ga;
    if (m.home_score > m.away_score) { h.wins++; a.losses++; h.points += 3; }
    else if (m.home_score < m.away_score) { a.wins++; h.losses++; a.points += 3; }
    else { h.draws++; a.draws++; h.points++; a.points++; }
  });
  // Head-to-head mini-table among a SET of tied teams: points, then GD, then GF
  // counting ONLY the matches played between those teams. This is the next set of
  // FIFA 2026 tiebreakers after overall points/GD/GF.
  const h2h = (codes) => {
    const set = new Set(codes);
    const t = {}; codes.forEach(c => (t[c] = { pts: 0, gd: 0, gf: 0 }));
    matches.forEach(m => {
      if (m.home_score == null || m.away_score == null) return;
      if (!set.has(m.home_team_code) || !set.has(m.away_team_code)) return;
      const h = t[m.home_team_code], a = t[m.away_team_code];
      h.gf += m.home_score; h.gd += m.home_score - m.away_score;
      a.gf += m.away_score; a.gd += m.away_score - m.home_score;
      if (m.home_score > m.away_score) h.pts += 3;
      else if (m.home_score < m.away_score) a.pts += 3;
      else { h.pts++; a.pts++; }
    });
    return t;
  };

  // 1) order by overall points -> GD -> GF
  const ordered = Object.values(stats).sort((x, y) =>
    (y.points - x.points) || (y.gd - x.gd) || (y.gf - x.gf) || x.code.localeCompare(y.code));

  // 2) re-order each run of teams equal on (points, GD, GF) by head-to-head
  //    (h2h points -> h2h GD -> h2h GF). Code order is only the LAST resort,
  //    standing in for fair-play/drawing-of-lots which we have no data for.
  const sameOverall = (p, q) => p.points === q.points && p.gd === q.gd && p.gf === q.gf;
  const result = [];
  for (let i = 0; i < ordered.length;) {
    let j = i + 1;
    while (j < ordered.length && sameOverall(ordered[i], ordered[j])) j++;
    if (j - i === 1) { result.push(ordered[i]); i = j; continue; }
    const tied = ordered.slice(i, j);
    const ht = h2h(tied.map(s => s.code));
    tied.sort((x, y) =>
      (ht[y.code].pts - ht[x.code].pts) ||
      (ht[y.code].gd - ht[x.code].gd) ||
      (ht[y.code].gf - ht[x.code].gf) ||
      x.code.localeCompare(y.code));
    result.push(...tied); i = j;
  }
  return result;
}

// A 4-team group is a 6-match round robin. It is SETTLED only when all its matches
// reach a TERMINAL status (FINISHED/AWARDED) — NOT merely when they have scores:
// football-data fills home_score/away_score while a match is IN_PLAY, so the old
// "has scores" check could settle standings (and award group-position points) from a
// still-running final match, then flip when it actually finished. (fix 2026-06-10)
const TERMINAL_MATCH_STATUS = new Set(['FINISHED', 'AWARDED']);
function isPendingProviderFinal(m) {
  const source = String((m && m.live_source) || '').toLowerCase();
  const detail = String((m && m.status_detail) || '').toLowerCase();
  return source === 'espn-final' || detail.includes('pending verification');
}
function isTerminalMatch(m) {
  return !!m && TERMINAL_MATCH_STATUS.has(String(m.status || '').toUpperCase()) && !isPendingProviderFinal(m);
}
function groupMatchIdentity(m) {
  if (!m) return '';
  const group = String(m.group_letter || m.group || '');
  const date = String(m.match_date || '');
  const home = String(m.home_team_code || '');
  const away = String(m.away_team_code || '');
  if (home && away) return `group:${group}|teams:${[home, away].sort().join('|')}`;
  if (m.external_id != null) return `external:${m.external_id}`;
  if (m.id != null) return `id:${m.id}`;
  return `${group}|${date}|${home}|${away}`;
}
function groupIsComplete(matches) {
  const terminalMatches = (matches || []).filter(isTerminalMatch);
  const terminalFixtures = new Set();
  (matches || []).forEach((m, index) => {
    if (isTerminalMatch(m)) {
      const identity = groupMatchIdentity(m);
      terminalFixtures.add(identity || `anonymous-terminal-row:${index}`);
    }
  });
  return terminalMatches.length === 6 && terminalFixtures.size === 6;
}

function indexRowsBy(rows, key) {
  const out = new Map();
  for (const row of rows || []) {
    const value = row && row[key];
    if (value == null) continue;
    if (!out.has(value)) out.set(value, []);
    out.get(value).push(row);
  }
  return out;
}

function buildGroupState(matches) {
  const allGroupMatchesAny = (matches || []).filter(m => m && m.stage === 'GROUP_STAGE');
  const groupCodes = {};
  const standings = {};
  const thirdStats = {};
  const advanced = new Set();

  allGroupMatchesAny.forEach(m => {
    const letter = m.group_letter || m.group;
    if (!letter) return;
    if (!groupCodes[letter]) groupCodes[letter] = new Set();
    if (m.home_team_code) groupCodes[letter].add(m.home_team_code);
    if (m.away_team_code) groupCodes[letter].add(m.away_team_code);
  });

  Object.keys(groupCodes).forEach(letter => {
    const teams = [...groupCodes[letter]];
    if (teams.length !== 4) {
      scoringWarn(`  group ${letter} has ${teams.length} teams (expected 4) - SKIPPED, will not score: ${teams.join(',')}`);
      return;
    }
    const groupMatches = allGroupMatchesAny.filter(m => (m.group_letter || m.group) === letter);
    if (!groupIsComplete(groupMatches)) return;
    const orderedStats = computeGroupStandings(groupMatches.filter(isTerminalMatch), teams);
    standings[letter] = orderedStats.map(s => s.code);
    thirdStats[letter] = orderedStats[2];
    advanced.add(orderedStats[0].code);
    advanced.add(orderedStats[1].code);
  });

  let realBest8Thirds = null;
  if (Object.keys(thirdStats).length === 12) {
    const thirds = Object.values(thirdStats).slice().sort((x, y) =>
      (y.points - x.points) || (y.gd - x.gd) || (y.gf - x.gf) || x.code.localeCompare(y.code));
    realBest8Thirds = new Set(thirds.slice(0, 8).map(s => s.code));
    thirds.slice(0, 8).forEach(s => advanced.add(s.code));
  }

  return { allGroupMatchesAny, groupCodes, standings, thirdStats, realBest8Thirds, advanced };
}

function scoreNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const SCORE_HEARTBEAT_MAX_AGE_MS = 5 * 60 * 60 * 1000;
const SCORE_HEARTBEAT_MAX_PATCHES_PER_RUN = 250;
let scoreHeartbeatPatchesThisRun = 0;

function scoreCalcTimestampFresh(value, nowMs = Date.now()) {
  if (!value) return false;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts < SCORE_HEARTBEAT_MAX_AGE_MS;
}

function canPatchScoreHeartbeat() {
  return scoreHeartbeatPatchesThisRun < SCORE_HEARTBEAT_MAX_PATCHES_PER_RUN;
}

function userScoresAlreadyCurrent(user, groupPoints, knockoutPoints, bonusPoints, total) {
  if (user.total_score == null) return false;
  if ((user.group_points ?? user.groups_score) == null) return false;
  if ((user.knockout_points ?? user.knockout_score) == null) return false;
  if ((user.bonus_points ?? user.bonus_score) == null) return false;
  return scoreNumber(user.group_points ?? user.groups_score) === groupPoints
    && scoreNumber(user.knockout_points ?? user.knockout_score) === knockoutPoints
    && scoreNumber(user.bonus_points ?? user.bonus_score) === bonusPoints
    && scoreNumber(user.total_score) === total;
}

async function updateUserScoreIfChanged(user, groupPoints, knockoutPoints, bonusPoints, total) {
  const now = new Date();
  const nowIso = now.toISOString();
  if (userScoresAlreadyCurrent(user, groupPoints, knockoutPoints, bonusPoints, total)) {
    if (scoreCalcTimestampFresh(user.last_score_calc, now.getTime())) return false;
    if (!canPatchScoreHeartbeat()) return false;
    await sb('PATCH', 'users', {
      data: { last_score_calc: nowIso },
      query: `?id=eq.${user.id}`
    });
    scoreHeartbeatPatchesThisRun++;
    return true;
  }
  try {
    await sb('PATCH', 'users', {
      data: {
        group_points: groupPoints,
        knockout_points: knockoutPoints,
        bonus_points: bonusPoints,
        groups_score: groupPoints,
        knockout_score: knockoutPoints,
        bonus_score: bonusPoints,
        total_score: total,
        last_score_calc: nowIso
      },
      query: `?id=eq.${user.id}`
    });
  } catch (e) {
    try {
      await sb('PATCH', 'users', {
        data: { groups_score: groupPoints, knockout_score: knockoutPoints,
                bonus_score: bonusPoints, total_score: total,
                last_score_calc: nowIso },
        query: `?id=eq.${user.id}`
      });
    } catch (e2) {
      console.warn(`  update failed for ${user.nickname}:`, e2.message);
    }
  }
  return true;
}

// Knockout winner. Prefer the explicit winner_code (from football-data
// score.winner) because a penalty shootout / extra-time win leaves
// home_score == away_score, which the raw score comparison would read as "no
// winner" and award zero points. Fall back to the score comparison for rows
// synced before winner_code existed.
function knockoutWinner(m) {
  if (m.winner_code) return m.winner_code;
  if (m.home_score == null || m.away_score == null) return null;
  if (m.home_score > m.away_score) return m.home_team_code;
  if (m.away_score > m.home_score) return m.away_team_code;
  return null; // tied with no winner_code (e.g. penalties not yet captured)
}

// Map a stage string to a scoring rule key
function stageRuleKey(stage) {
  switch ((stage || '').toUpperCase()) {
    case 'ROUND_OF_32': case 'R32': case 'LAST_32': return 'round_of_32';
    case 'LAST_16': case 'ROUND_OF_16': case 'R16': return 'round_of_16';
    case 'QUARTER_FINALS': case 'QF': return 'quarter_final';
    case 'SEMI_FINALS': case 'SF': return 'semi_final';
    case 'FINAL': return 'final';
    default: return null;
  }
}

// v2.5.68: bracket position -> rule key for hypothetical bracket scoring.
// Position numbering (official WC 2026):
//   1-16  = R32   (16 matches)
//   17-24 = R16   (8 matches)
//   25-28 = QF    (4 matches)
//   29-30 = SF    (2 matches)
//   31    = Final
// v2.5.70: each round is scored as "team reached the NEXT round" (R32 pick
// rewards reaching R16, R16 pick rewards reaching QF, etc).
function bracketPosRuleKey(pos) {
  if (pos >= 1  && pos <= 16) return 'round_of_32';
  if (pos >= 17 && pos <= 24) return 'round_of_16';
  if (pos >= 25 && pos <= 28) return 'quarter_final';
  if (pos >= 29 && pos <= 30) return 'semi_final';
  if (pos === 31) return 'final';
  return null;
}

// ---- Main ----
async function main() {
  console.log('FriendlyBet v2 scoring start');
  const startedAt = Date.now();

  // 1. Load pools
  const pools = await sbAll('pools', '?select=*');
  if (!pools || !pools.length) { console.log('No pools'); return; }

  // 2. Load matches (for groups + knockout outcomes)
  const matches = await sbAll('matches', '?select=*');
  // Only TRULY-final matches count. A live (IN_PLAY/PAUSED) match has a current
  // score, so keying off "has a score" scored matches mid-play and made knockout
  // points appear/flip as the scoreline changed. Require a terminal status.
  const finishedMatches = (matches || []).filter(isTerminalMatch);
  console.log(`${pools.length} pools, ${finishedMatches.length} finished matches`);
  const groupState = buildGroupState(matches || []);

  const [
    allGroupPositionPicks,
    allKnockoutPicks,
    allThirdPlacePicks,
    allGroupPicks,
    allTopScorerPicks,
  ] = await Promise.all([
    sbAll('group_position_picks', '?select=*'),
    sbAll('knockout_picks', '?select=*'),
    sbAll('sp_third_place_picks', '?select=*'),
    sbAll('group_picks', '?select=*'),
    sbAll('top_scorer_picks', '?select=*'),
  ]);
  const pickIndexes = {
    groupPositionByUser: indexRowsBy(allGroupPositionPicks, 'user_id'),
    knockoutByUser: indexRowsBy(allKnockoutPicks, 'user_id'),
    thirdPlaceByUser: indexRowsBy(allThirdPlacePicks, 'user_id'),
    groupByUser: indexRowsBy(allGroupPicks, 'user_id'),
    topScorerByPool: indexRowsBy(allTopScorerPicks, 'pool_id'),
  };

  // 3. Top scorer truth. app_settings is a KEY/VALUE table (columns key,value) -
  // read the 'top_scorer' row's value (the real top scorer's player_id). Reading
  // it as a .top_scorer column left realTopScorer null, so the top-scorer bonus
  // was never awarded.
  let realTopScorer = null;
  try {
    const settings = await sbAll('app_settings', '?key=eq.top_scorer&select=value');
    if (settings && settings[0] && settings[0].value) realTopScorer = settings[0].value;
  } catch (e) { /* ignore */ }

  // 4. Per-pool processing. Each pool is isolated in a try/catch so one bad
  // pool (e.g. a transient fetch error) can't abort scoring for everyone else.
  let poolFailures = 0;
  for (const pool of pools) {
    try {
      const mode = pool.betting_mode || 'two_phase';
      const rules = pool.scoring_rules ||
        (mode === 'late_knockout' ? DEFAULT_RULES_LATE_KNOCKOUT : (mode === 'single_phase' ? DEFAULT_RULES_SINGLE : DEFAULT_RULES_TWO));

      scoringDetail(`\nPool ${pool.code} - ${pool.name} (${mode})`);

      const users = await sbAll('users', `?pool_id=eq.${pool.id}&select=*`);
      if (!users || !users.length) { scoringDetail('  no users'); continue; }

      // Get all top_scorer_picks for users in this pool
      const tsPicks = pickIndexes.topScorerByPool.get(pool.id) || [];
      const tsMap = new Map((tsPicks || []).map(t => [t.user_id, t]));

      if (mode === 'single_phase' || mode === 'late_knockout') {
        await scoreSinglePhasePool(pool, rules, users, finishedMatches, tsMap, realTopScorer, {
          lateKnockout: mode === 'late_knockout',
          groupState,
          pickIndexes,
        });
      } else {
        await scoreTwoPhasePool(pool, rules, users, finishedMatches, tsMap, realTopScorer, {
          groupState,
          pickIndexes,
        });
      }
    } catch (e) {
      poolFailures++;
      console.error(`  ✖ pool ${pool.code} failed, skipping:`, e.message);
    }
  }
  if (poolFailures) {
    throw new Error(`${poolFailures} pool(s) failed during scoring`);
  }

  console.log(`\nDone in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

// ---- SINGLE PHASE scoring ----
async function scoreSinglePhasePool(pool, rules, users, finishedMatches, tsMap, realTopScorer, opts = {}) {
  const lateKnockout = !!opts.lateKnockout;
  // Group standings (real-world)
  const groupState = opts.groupState || buildGroupState((finishedMatches || []).filter(m => m.stage === 'GROUP_STAGE'));
  const standings = groupState.standings || {}; // letter -> [team codes in order 1st..4th] or null if group not complete
  const realBest8Thirds = groupState.realBest8Thirds || null;
  const pickIndexes = opts.pickIndexes || {};
  const groupMode = groupScoringMode(rules);

  // Knockout results (real-world) - by stage
  // For hypothetical bracket: we check whether the team the user picked as
  // a R16/QF/SF/Final winner actually won SOME match at that level.
  const realKnockoutWinners = {}; // 'R16': Set of winner codes, etc.
  ['ROUND_OF_32','LAST_32','R32','LAST_16','ROUND_OF_16','R16','QUARTER_FINALS','QF','SEMI_FINALS','SF','FINAL'].forEach(s => { realKnockoutWinners[s] = new Set(); });
  finishedMatches.forEach(m => {
    if (!isTerminalMatch(m)) return;
    if (!m.stage || m.stage === 'GROUP_STAGE' || m.stage === 'THIRD_PLACE') return;
    const winner = knockoutWinner(m);
    if (!winner) return;
    if (realKnockoutWinners[m.stage]) realKnockoutWinners[m.stage].add(winner);
  });

  // Score each user
  for (const user of users) {
    let groupPoints = 0;
    let knockoutPoints = 0;
    let bonusPoints = 0;

    // v2.5.36: pool-aware multiplier resolver
    const resolveMult = poolMultResolver(pool, rules);

    // Group position picks. Late knockout pools never score group positions.
    const gpp = lateKnockout ? [] : (pickIndexes.groupPositionByUser
      ? (pickIndexes.groupPositionByUser.get(user.id) || [])
      : await sbAll('group_position_picks', `?user_id=eq.${user.id}&select=*`));
    const needsThirdPlaceRows = !lateKnockout && (
      groupMode === 'advancement' || (realBest8Thirds && (rules.third_place_advance || 0) > 0)
    );
    const tpp = needsThirdPlaceRows
      ? (pickIndexes.thirdPlaceByUser
        ? (pickIndexes.thirdPlaceByUser.get(user.id) || [])
        : await sbAll('sp_third_place_picks', `?user_id=eq.${user.id}&select=group_letter`))
      : [];
    const thirdPlaceGroups = thirdPlacePickGroupSet(tpp);
    if (!lateKnockout && groupMode === 'advancement') {
      const seenAdvancePicks = new Set();
      (gpp || []).forEach(p => {
        if (!p || !p.team_code || seenAdvancePicks.has(p.team_code)) return;
        if (!isSinglePhaseAdvancementCandidate(p, thirdPlaceGroups)) return;
        if (!groupState.advanced || !groupState.advanced.has(p.team_code)) return;
        seenAdvancePicks.add(p.team_code);
        groupPoints += (rules.group_first || 0) * resolveMult(p.team_code, p.multiplier_applied);
      });
    } else if (!lateKnockout) {
      (gpp || []).forEach(p => {
        const real = standings[p.group_letter];
        if (!real) return; // group not done
        if (real[p.position - 1] === p.team_code) {
          let pts = 0;
          if (p.position === 1) pts = rules.group_first || 0;
          else if (p.position === 2) pts = rules.group_second || 0;
          else if (p.position === 3) pts = rules.group_third || 0;
          else if (p.position === 4) pts = rules.group_fourth || 0;
          groupPoints += pts * resolveMult(p.team_code, p.multiplier_applied);
        }
      });
    }

    // Hypothetical bracket picks
    const kpRaw = pickIndexes.knockoutByUser
      ? (pickIndexes.knockoutByUser.get(user.id) || [])
      : await sbAll('knockout_picks', `?user_id=eq.${user.id}&bracket_position=not.is.null&select=*`);
    const kp = (kpRaw || []).filter(p => p.bracket_position != null);
    (kp || []).forEach(p => {
      const ruleKey = bracketPosRuleKey(p.bracket_position);
      if (!ruleKey) return;
      // The picked team is stored in predicted_winner (knockout_picks has no
      // team_code column); keep team_code as a defensive fallback.
      const pickTeam = p.predicted_winner || p.team_code;
      if (!pickTeam) return;
      // SCORING MODEL = ADVANCEMENT (Option A, owner-approved 2026-06-10). INTENTIONAL,
      // not a bug: a picked team scores for a round if it actually won a match at that
      // stage in the real world — regardless of which bracket SLOT/branch the user
      // placed it in. We deliberately do NOT require the exact path/position (that
      // would be Option B). Keep it this way unless Eyal explicitly switches to B.
      // Did user's picked team win their actual real-world match at this stage?
      const stageMap = {
        round_of_32:  ['ROUND_OF_32','LAST_32','R32'],
        round_of_16:  ['LAST_16','ROUND_OF_16','R16'],
        quarter_final:['QUARTER_FINALS','QF'],
        semi_final:   ['SEMI_FINALS','SF'],
        final:        ['FINAL']
      };
      const stages = stageMap[ruleKey] || [];
      const won = stages.some(s => realKnockoutWinners[s] && realKnockoutWinners[s].has(pickTeam));
      if (won) {
        const pts = rules[ruleKey] || 0;
        knockoutPoints += pts * resolveMult(pickTeam, p.multiplier_applied);
      }
    });

    // v2.5.72: no separate tournament_winner bonus - a correct Final pick
    // (bracket position 31) already rewards `final` points via the bracket
    // loop above, and that pick IS the champion prediction.

    // v2.5.82: third-place-advance bonus. For each group the user tagged as
    // "its 3rd-place team advances", check whether the team THEY put 3rd in
    // that group is actually one of the real best-8 third places. Team-based,
    // flat bonus (not multiplied). Only once all 12 groups are complete.
    if (!lateKnockout && groupMode !== 'advancement' && realBest8Thirds && (rules.third_place_advance || 0) > 0) {
      (tpp || []).forEach(row => {
        const pick = (gpp || []).find(p => p.group_letter === row.group_letter && p.position === 3);
        if (pick && realBest8Thirds.has(pick.team_code)) {
          bonusPoints += (rules.third_place_advance || 0);
        }
      });
    }

    // Top scorer
    const tsp = tsMap.get(user.id);
    if (!lateKnockout && tsp && realTopScorer && String(tsp.player_id) === String(realTopScorer)) {
      bonusPoints += rules.top_scorer || 0;
    }

    // v2.5.36: round multiplied totals to integers for clean leaderboard display
    groupPoints = Math.round(groupPoints);
    knockoutPoints = Math.round(knockoutPoints);
    bonusPoints = Math.round(bonusPoints);
    const total = groupPoints + knockoutPoints + bonusPoints;

    await updateUserScoreIfChanged(user, groupPoints, knockoutPoints, bonusPoints, total);

    if (total > 0) scoringDetail(`  ${user.nickname}: ${total} (g${groupPoints}+k${knockoutPoints}+b${bonusPoints})`);
  }
}

// Which teams ADVANCED to the knockout: top-2 of each completed group, plus the
// 8 best third-placed teams once all 12 groups are complete. Used by two-phase
// group scoring so the awarded points match the "advanced" checkmark in the UI.
async function computeAdvancedTeams(finishedMatches, groupState = null) {
  if (groupState && groupState.advanced) return groupState.advanced;
  return buildGroupState((finishedMatches || []).filter(m => m.stage === 'GROUP_STAGE')).advanced;
}

// ---- TWO PHASE scoring (legacy-style) ----
// v2.5.35: applies risk multipliers from scoring_rules (per-team override →
// category by FIFA-rank-derived tier → global default). Persisted
// multiplier_applied on each pick row takes priority (snapshot at pick time)
// so historical picks aren't retroactively re-scored when the admin tweaks
// values mid-tournament.
async function scoreTwoPhasePool(pool, rules, users, finishedMatches, tsMap, realTopScorer, opts = {}) {
  const resolveMult = poolMultResolver(pool, rules);
  // Two-phase groups = "pick which teams ADVANCE". Award group_first for each
  // picked team that actually reached the knockout, so the points match the
  // "advanced" checkmark the app shows (was: per group-match-won, which a
  // drawing-but-advancing team would score 0 for).
  const advanced = await computeAdvancedTeams(finishedMatches, opts.groupState || null);
  const pickIndexes = opts.pickIndexes || {};

  for (const user of users) {
    let groupPoints = 0;
    let knockoutPoints = 0;
    let bonusPoints = 0;

    // Group picks. Only a VALID FINAL set (exactly 32, 2-3 per group, correct
    // membership, no dupes) scores — an under-complete (24/31) or over-complete
    // (36, which unfairly covers more teams) set earns 0 group points until it's
    // corrected. The RPC enforces this on new writes; historical rows still exist.
    const gpRaw = pickIndexes.groupByUser
      ? (pickIndexes.groupByUser.get(user.id) || [])
      : await sbAll('group_picks', `?user_id=eq.${user.id}&select=*`);
    const gpValid = validateTwoPhaseGroupPickSet(gpRaw);
    if (!gpValid.ok) {
      if ((gpRaw || []).length > 0) {
        scoringWarn(`[scoreTwoPhasePool] user ${user.id}: invalid two-phase group set (${gpValid.reason}) — 0 group points`);
      }
    } else {
      gpValid.picks.forEach(p => {
        if (!advanced.has(p.team_code)) return;
        const mult = resolveMult(p.team_code, p.multiplier_applied);
        groupPoints += (rules.group_first || 0) * mult;
      });
    }

    // Knockout picks - per-match
    const kp = pickIndexes.knockoutByUser
      ? (pickIndexes.knockoutByUser.get(user.id) || [])
      : await sbAll('knockout_picks', `?user_id=eq.${user.id}&select=*`);
    finishedMatches.forEach(m => {
      if (!isTerminalMatch(m)) return;
      if (!m.stage || m.stage === 'GROUP_STAGE' || m.stage === 'THIRD_PLACE') return;
      const winner = knockoutWinner(m);
      if (!winner) return;
      const pick = (kp || []).find(p => p.predicted_winner === winner || p.team_code === winner);
      if (!pick) return;
      const key = stageRuleKey(m.stage);
      if (!key) return;
      const mult = resolveMult(winner, pick.multiplier_applied);
      knockoutPoints += (rules[key] || 0) * mult;
    });

    // v2.5.72: no separate tournament_winner bonus - the FINAL pick already
    // rewards `final` points above, and that pick IS the champion prediction.

    // Top scorer
    const tsp = tsMap.get(user.id);
    if (tsp && realTopScorer && String(tsp.player_id) === String(realTopScorer)) {
      bonusPoints += rules.top_scorer || 0;
    }

    groupPoints = Math.round(groupPoints);
    knockoutPoints = Math.round(knockoutPoints);
    bonusPoints = Math.round(bonusPoints);

    const total = groupPoints + knockoutPoints + bonusPoints;
    await updateUserScoreIfChanged(user, groupPoints, knockoutPoints, bonusPoints, total);
    if (total > 0) scoringDetail(`  ${user.nickname}: ${total} (g${groupPoints}+k${knockoutPoints}+b${bonusPoints})`);
  }
}

// Run only when executed directly; when required (tests) expose the internals.
if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
} else {
  module.exports = {
    main, scoreSinglePhasePool, scoreTwoPhasePool,
    computeGroupStandings, groupIsComplete, groupMatchIdentity, isPendingProviderFinal, knockoutWinner,
    buildGroupState, indexRowsBy, userScoresAlreadyCurrent, updateUserScoreIfChanged,
    scoreCalcTimestampFresh,
    bracketPosRuleKey, stageRuleKey, poolMultResolver,
    groupScoringMode,
    validateTwoPhaseGroupPickSet, WC2026_GROUPS, TEAM_TO_GROUP,
    DEFAULT_RULES_SINGLE, DEFAULT_RULES_TWO, DEFAULT_CAT_MULT, FIFA_RANK,
    sbAll,
    // allow tests to inject a fake Supabase transport
    __setFetch: (fn) => { globalThis.fetch = fn; },
  };
}
