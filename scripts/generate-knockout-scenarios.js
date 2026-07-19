// FriendlyBet - precomputed knockout scoring scenarios
//
// Builds public-safe leaderboard snapshots for both possible advancing teams in
// selected knockout fixtures. The app may use a scenario only after the real
// match row is verified terminal and its resolved winner matches the scenario.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const S = require('./calculate-scores-v2.js');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.PUBLIC_DATA_DIR
  ? path.resolve(ROOT, process.env.PUBLIC_DATA_DIR)
  : path.join(ROOT, 'public-data');
const SCENARIO_DIR = path.join(OUT_DIR, 'knockout-scenarios');
const MANIFEST_PATH = path.join(SCENARIO_DIR, 'manifest.json');
const BASE_TOP_SCORER_SEGMENT = '_base';
const FINAL_TOP_SCORER_CONTENDER_NAMES = ['messi', 'mbappe'];

const AUTO_NEXT_TARGET = 'auto-next';
const DEFAULT_TARGETS = [AUTO_NEXT_TARGET];
const TARGETS = csvList(process.env.KNOCKOUT_SCENARIO_TARGETS || process.argv.find(a => a.startsWith('--targets='))?.slice('--targets='.length) || DEFAULT_TARGETS.join(','));

function csvList(value) {
  return String(value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function safeSegment(value) {
  return String(value == null ? '' : value).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'unknown';
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function shortHash(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex').slice(0, 16);
}

function withoutUpdatedAt(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const clean = { ...payload };
  delete clean.updatedAt;
  return clean;
}

function writeScenarioIfChanged(file, payload) {
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  if (prev && stableJson(withoutUpdatedAt(prev)) === stableJson(withoutUpdatedAt(payload))) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload));
  return true;
}

function matchIdentity(match) {
  if (!match) return '';
  if (match.external_id != null) return `external:${match.external_id}`;
  if (match.id != null) return `id:${match.id}`;
  return `teams:${match.home_team_code}-${match.away_team_code}|${match.stage || ''}|${match.match_date || ''}`;
}

function isTargetPair(match, pair) {
  const [a, b] = String(pair || '').toUpperCase().split('-').map(s => s.trim()).filter(Boolean);
  if (!a || !b || !match) return false;
  const teams = [match.home_team_code, match.away_team_code].map(t => String(t || '').toUpperCase());
  return teams.includes(a) && teams.includes(b);
}

function isKnockoutStage(match) {
  const stage = String((match && match.stage) || '').toUpperCase();
  return !!match && stage && stage !== 'GROUP_STAGE' && stage !== 'THIRD_PLACE';
}

function isFinalStage(match) {
  return String((match && match.stage) || '').toUpperCase() === 'FINAL';
}

function isKnockoutMatch(match) {
  return isKnockoutStage(match) && match.home_team_code && match.away_team_code;
}

function matchTimeValue(match) {
  const t = Date.parse(match && match.match_date);
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

function isScenarioCandidate(match) {
  if (!isKnockoutMatch(match)) return false;
  if (match.winner_code) return false;
  if (S.isTerminalMatch(match)) return false;
  return true;
}

function isResolvedForScenarioTimeline(match) {
  return isKnockoutStage(match) && S.isTerminalMatch(match) && !!match.winner_code;
}

function findNextScenarioMatch(matches) {
  const nextUnresolved = (matches || [])
    .filter(match => isKnockoutStage(match) && !isResolvedForScenarioTimeline(match))
    .sort((a, b) =>
      matchTimeValue(a) - matchTimeValue(b) ||
      String(a.external_id || a.id || '').localeCompare(String(b.external_id || b.id || '')))[0] || null;
  return isScenarioCandidate(nextUnresolved) ? nextUnresolved : null;
}

function shouldAutoSelectNext(targets) {
  return !(targets || []).length ||
    (targets || []).some(t => ['auto', AUTO_NEXT_TARGET, 'next'].includes(String(t || '').toLowerCase()));
}

function findTargetMatches(matches, targets) {
  if (shouldAutoSelectNext(targets)) {
    const next = findNextScenarioMatch(matches);
    return next ? [next] : [];
  }

  const out = [];
  const seen = new Set();
  for (const target of targets || []) {
    const found = (matches || []).find(match => isKnockoutMatch(match) && isTargetPair(match, target));
    if (!found) {
      console.warn(`knockout scenario target not found: ${target}`);
      continue;
    }
    const id = matchIdentity(found);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(found);
  }
  return out;
}

function scenarioScoresForWinner(match, winnerCode) {
  const home = match && match.home_team_code;
  const away = match && match.away_team_code;
  const winnerIsHome = winnerCode === home;
  const winnerIsAway = winnerCode === away;
  const hs = match && match.home_score;
  const as = match && match.away_score;
  const hasNumericScore = hs != null && as != null && !Number.isNaN(Number(hs)) && !Number.isNaN(Number(as));

  if (hasNumericScore) {
    if (Number(hs) === Number(as)) return { home_score: Number(hs), away_score: Number(as) };
    if ((Number(hs) > Number(as) && winnerIsHome) || (Number(as) > Number(hs) && winnerIsAway)) {
      return { home_score: Number(hs), away_score: Number(as) };
    }
  }

  if (winnerIsHome) return { home_score: 1, away_score: 0 };
  if (winnerIsAway) return { home_score: 0, away_score: 1 };
  return { home_score: null, away_score: null };
}

function simulateWinner(matches, targetMatch, winnerCode) {
  const targetId = matchIdentity(targetMatch);
  return (matches || []).map(match => {
    if (matchIdentity(match) !== targetId) return { ...match };
    const scores = scenarioScoresForWinner(match, winnerCode);
    return {
      ...match,
      status: 'FINISHED',
      ...scores,
      winner_code: winnerCode,
      live_clock: null,
      live_period: null,
      live_source: null,
      status_detail: null,
    };
  });
}

function finishedIdsExcluding(matches, targetMatch) {
  const targetId = matchIdentity(targetMatch);
  return (matches || [])
    .filter(match => matchIdentity(match) !== targetId && S.isTerminalMatch(match))
    .map(matchIdentity)
    .sort();
}

function rulesForPool(pool) {
  const mode = pool.betting_mode || 'two_phase';
  return pool.scoring_rules ||
    (mode === 'late_knockout'
      ? S.DEFAULT_RULES_LATE_KNOCKOUT
      : (mode === 'single_phase' ? S.DEFAULT_RULES_SINGLE : S.DEFAULT_RULES_TWO));
}

function sortStandings(rows) {
  return (rows || []).slice().sort((a, b) =>
    ((b.total_score || 0) - (a.total_score || 0)) ||
    (Date.parse(a.joined_at || 0) - Date.parse(b.joined_at || 0)) ||
    String(a.id || '').localeCompare(String(b.id || '')));
}

function poolTopScorerBonus(pool) {
  if (!pool || String(pool.betting_mode || '') === 'late_knockout') return 0;
  if (pool.top_scorer_enabled === false) return 0;
  const rules = rulesForPool(pool);
  return Math.round(Number(rules.top_scorer || 0));
}

function normalizeTopScorerName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isFinalTopScorerContender(row) {
  const name = normalizeTopScorerName(row && row.player_name);
  return FINAL_TOP_SCORER_CONTENDER_NAMES.some(candidate => name.includes(candidate));
}

function filterFinalTopScorerContenders(rows) {
  return (rows || []).filter(isFinalTopScorerContender);
}

function topScorerCandidateKey(row) {
  return safeSegment(row && (row.player_id || `${row.team_code || 'team'}-${row.player_name || 'player'}`));
}

function buildTopScorerCandidateSummary(topScorerPicks) {
  const byKey = new Map();
  for (const row of topScorerPicks || []) {
    if (!row) continue;
    const key = topScorerCandidateKey(row);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        player_id: row.player_id == null ? null : String(row.player_id),
        player_name: row.player_name || null,
        team_code: row.team_code || null,
        pick_count: 0,
        pool_count: 0,
        _poolIds: new Set(),
      });
    }
    const candidate = byKey.get(key);
    candidate.pick_count++;
    if (row.pool_id != null) candidate._poolIds.add(String(row.pool_id));
  }
  return [...byKey.values()]
    .map(candidate => ({
      key: candidate.key,
      player_id: candidate.player_id,
      player_name: candidate.player_name,
      team_code: candidate.team_code,
      pick_count: candidate.pick_count,
      pool_count: candidate._poolIds.size,
    }))
    .sort((a, b) =>
      (b.pick_count || 0) - (a.pick_count || 0) ||
      String(a.player_name || '').localeCompare(String(b.player_name || '')) ||
      String(a.key || '').localeCompare(String(b.key || '')));
}

function topScorerPicksByCandidate(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = topScorerCandidateKey(row);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function applyTopScorerVariant(standings, poolUsers, poolTopScorerPicks, candidateKey, bonus) {
  if (!bonus || !candidateKey) return sortStandings(standings || []);
  const pickedUserIds = new Set((poolTopScorerPicks || [])
    .filter(row => topScorerCandidateKey(row) === candidateKey)
    .map(row => String(row.user_id || ''))
    .filter(Boolean));
  if (!pickedUserIds.size) return sortStandings(standings || []);
  const poolUserIds = new Set((poolUsers || []).map(user => String(user.id)));
  return sortStandings((standings || []).map(row => {
    if (!row || !pickedUserIds.has(String(row.id)) || !poolUserIds.has(String(row.id))) return row;
    const bonusPoints = Math.round(Number(row.bonus_points || row.bonus_score || 0) + bonus);
    const total = Math.round(Number(row.total_score || 0) + bonus);
    return {
      ...row,
      bonus_points: bonusPoints,
      bonus_score: bonusPoints,
      total_score: total,
    };
  }));
}

async function loadTopScorer() {
  try {
    const rows = await S.sbAll('app_settings', '?key=eq.top_scorer&select=value');
    return rows && rows[0] && rows[0].value ? rows[0].value : null;
  } catch (_) {
    return null;
  }
}

async function scorePoolScenario(pool, users, simulatedMatches, pickIndexes, realTopScorer, scenarioTimestamp) {
  const mode = pool.betting_mode || 'two_phase';
  const rules = rulesForPool(pool);
  const groupState = S.buildGroupState(simulatedMatches || []);
  const tsPicks = pickIndexes.topScorerByPool.get(pool.id) || [];
  const tsMap = new Map((tsPicks || []).map(t => [t.user_id, t]));
  const collectScores = [];
  if (mode === 'single_phase' || mode === 'late_knockout') {
    await S.scoreSinglePhasePool(pool, rules, users, simulatedMatches.filter(S.isTerminalMatch), tsMap, realTopScorer, {
      lateKnockout: mode === 'late_knockout',
      groupState,
      pickIndexes,
      heartbeat: false,
      collectScores,
      scenarioTimestamp,
    });
  } else {
    await S.scoreTwoPhasePool(pool, rules, users, simulatedMatches.filter(S.isTerminalMatch), tsMap, realTopScorer, {
      groupState,
      pickIndexes,
      heartbeat: false,
      collectScores,
      scenarioTimestamp,
    });
  }
  return sortStandings(collectScores);
}

async function main() {
  const startedAt = Date.now();
  const scenarioTimestamp = new Date().toISOString();
  fs.mkdirSync(SCENARIO_DIR, { recursive: true });

  const [
    pools,
    matches,
    users,
    allGroupPositionPicks,
    allKnockoutPicks,
    allThirdPlacePicks,
    allGroupPicks,
    allTopScorerPicks,
    realTopScorer,
  ] = await Promise.all([
    S.sbAll('pools', '?select=*'),
    S.sbAll('matches', '?select=*'),
    S.sbAll('users', '?select=*'),
    S.sbAll('group_position_picks', '?select=*'),
    S.sbAll('knockout_picks', '?select=*'),
    S.sbAll('sp_third_place_picks', '?select=*'),
    S.sbAll('group_picks', '?select=*'),
    S.sbAll('top_scorer_picks', '?select=*'),
    loadTopScorer(),
  ]);

  const targetMatches = findTargetMatches(matches, TARGETS);
  const usersByPool = S.indexRowsBy(users, 'pool_id');
  const pickIndexes = {
    groupPositionByUser: S.indexRowsBy(allGroupPositionPicks, 'user_id'),
    knockoutByUser: S.indexRowsBy(allKnockoutPicks, 'user_id'),
    thirdPlaceByUser: S.indexRowsBy(allThirdPlacePicks, 'user_id'),
    groupByUser: S.indexRowsBy(allGroupPicks, 'user_id'),
    topScorerByPool: S.indexRowsBy(allTopScorerPicks, 'pool_id'),
  };
  const finalTopScorerPicks = filterFinalTopScorerContenders(allTopScorerPicks);
  const finalTopScorerCandidates = topScorerPicksByCandidate(finalTopScorerPicks);

  let changedFiles = 0;
  const manifest = {
    updatedAt: scenarioTimestamp,
    type: 'knockout_scenario_manifest',
    selection_mode: shouldAutoSelectNext(TARGETS) ? AUTO_NEXT_TARGET : 'explicit',
    target_strategy: shouldAutoSelectNext(TARGETS) ? 'auto_next_unresolved_knockout' : 'explicit',
    targets: TARGETS,
    matches: [],
  };

  for (const match of targetMatches) {
    const scenarioKey = safeSegment(match.external_id || match.id || `${match.home_team_code}-${match.away_team_code}-${match.stage}`);
    const baseFinishedMatchIds = finishedIdsExcluding(matches, match);
    const winners = [match.home_team_code, match.away_team_code].filter(Boolean);
    const manifestMatch = {
      scenario_key: scenarioKey,
      match: {
        id: match.id,
        external_id: match.external_id,
        stage: match.stage,
        match_date: match.match_date,
        home_team_code: match.home_team_code,
        away_team_code: match.away_team_code,
      },
      base_finished_match_ids: baseFinishedMatchIds,
      winners,
    };

    for (const winnerCode of winners) {
      const simulatedMatches = simulateWinner(matches, match, winnerCode);
      const winnerDir = path.join(SCENARIO_DIR, scenarioKey, safeSegment(winnerCode));
      const finalScenario = isFinalStage(match);
      const baseDir = finalScenario
        ? path.join(winnerDir, BASE_TOP_SCORER_SEGMENT)
        : winnerDir;
      fs.mkdirSync(baseDir, { recursive: true });
      let poolCount = 0;
      let topScorerVariantFiles = 0;

      for (const pool of pools || []) {
        const poolUsers = usersByPool.get(pool.id) || [];
        if (!poolUsers.length) continue;
        const poolTsPicks = pickIndexes.topScorerByPool.get(pool.id) || [];
        const topScorerBonus = finalScenario ? poolTopScorerBonus(pool) : 0;
        const standings = await scorePoolScenario(
          pool,
          poolUsers,
          simulatedMatches,
          pickIndexes,
          finalScenario ? null : realTopScorer,
          scenarioTimestamp);
        const payload = {
          updatedAt: scenarioTimestamp,
          type: 'knockout_scenario_leaderboard',
          pool_id: pool.id,
          winner_code: winnerCode,
          top_scorer_player_id: null,
          top_scorer_key: null,
          match: manifestMatch.match,
          base_finished_match_ids: baseFinishedMatchIds,
          scoring_fingerprint: {
            pool_rules: shortHash(rulesForPool(pool)),
            users: shortHash(poolUsers.map(u => [u.id, u.joined_at, u.predictions_submitted_at])),
            knockout_picks: shortHash((pickIndexes.knockoutByUser && poolUsers.flatMap(u => pickIndexes.knockoutByUser.get(u.id) || [])) || []),
            top_scorer_picks: shortHash(poolTsPicks.map(p => [p.user_id, p.player_id, p.player_name, p.team_code])),
          },
          count: standings.length,
          standings,
        };
        if (writeScenarioIfChanged(path.join(baseDir, `${safeSegment(pool.id)}.json`), payload)) changedFiles++;

        if (finalScenario && finalTopScorerCandidates.size) {
          for (const [candidateKey, candidateRows] of finalTopScorerCandidates.entries()) {
            const variantStandings = applyTopScorerVariant(standings, poolUsers, poolTsPicks, candidateKey, topScorerBonus);
            const sample = candidateRows[0] || {};
            const variantPayload = {
              ...payload,
              top_scorer_player_id: sample.player_id == null ? null : String(sample.player_id),
              top_scorer_key: candidateKey,
              top_scorer_player_name: sample.player_name || null,
              top_scorer_team_code: sample.team_code || null,
              standings: variantStandings,
            };
            const variantDir = path.join(winnerDir, candidateKey);
            if (writeScenarioIfChanged(path.join(variantDir, `${safeSegment(pool.id)}.json`), variantPayload)) changedFiles++;
            topScorerVariantFiles++;
          }
        }
        poolCount++;
      }

      manifestMatch[`${winnerCode}_pool_count`] = poolCount;
      if (finalScenario) manifestMatch[`${winnerCode}_top_scorer_variant_count`] = topScorerVariantFiles;
    }

    if (isFinalStage(match)) {
      manifestMatch.path_mode = 'winner_top_scorer';
      manifestMatch.requires_top_scorer_truth = true;
      manifestMatch.base_top_scorer_segment = BASE_TOP_SCORER_SEGMENT;
      manifestMatch.top_scorer_candidate_policy = {
        mode: 'final_known_contenders',
        names: ['Messi', 'Mbappe'],
      };
      manifestMatch.top_scorer_candidates = buildTopScorerCandidateSummary(finalTopScorerPicks);
    }

    manifest.matches.push(manifestMatch);
  }

  if (writeScenarioIfChanged(MANIFEST_PATH, manifest)) changedFiles++;
  console.log(`knockout scenarios: ${targetMatches.length} match(es), ${changedFiles} file(s) changed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('generate-knockout-scenarios fatal:', err);
    process.exit(1);
  });
} else {
  module.exports = {
    findTargetMatches,
    simulateWinner,
    scenarioScoresForWinner,
    finishedIdsExcluding,
    safeSegment,
    matchIdentity,
    isTargetPair,
    isKnockoutMatch,
    isKnockoutStage,
    sortStandings,
    rulesForPool,
    isScenarioCandidate,
    isResolvedForScenarioTimeline,
    findNextScenarioMatch,
    shouldAutoSelectNext,
    AUTO_NEXT_TARGET,
    BASE_TOP_SCORER_SEGMENT,
    FINAL_TOP_SCORER_CONTENDER_NAMES,
    isFinalStage,
    normalizeTopScorerName,
    isFinalTopScorerContender,
    filterFinalTopScorerContenders,
    poolTopScorerBonus,
    topScorerCandidateKey,
    buildTopScorerCandidateSummary,
    topScorerPicksByCandidate,
    applyTopScorerVariant,
  };
}
