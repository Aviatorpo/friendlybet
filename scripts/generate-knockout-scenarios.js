// FriendlyBet - precomputed knockout scoring scenarios
//
// Builds public-safe leaderboard snapshots for both possible advancing teams in
// selected knockout fixtures. The app may use a scenario only after the real
// match row is verified terminal and its winner_code matches the scenario.

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

const DEFAULT_TARGETS = ['BRA-JPN'];
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

function isKnockoutMatch(match) {
  const stage = String((match && match.stage) || '').toUpperCase();
  return !!match && stage && stage !== 'GROUP_STAGE' && match.home_team_code && match.away_team_code;
}

function findTargetMatches(matches, targets) {
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

function simulateWinner(matches, targetMatch, winnerCode) {
  const targetId = matchIdentity(targetMatch);
  return (matches || []).map(match => {
    if (matchIdentity(match) !== targetId) return { ...match };
    return {
      ...match,
      status: 'FINISHED',
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

  let changedFiles = 0;
  const manifest = {
    updatedAt: scenarioTimestamp,
    type: 'knockout_scenario_manifest',
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
      fs.mkdirSync(winnerDir, { recursive: true });
      let poolCount = 0;

      for (const pool of pools || []) {
        const poolUsers = usersByPool.get(pool.id) || [];
        if (!poolUsers.length) continue;
        const standings = await scorePoolScenario(pool, poolUsers, simulatedMatches, pickIndexes, realTopScorer, scenarioTimestamp);
        const payload = {
          updatedAt: scenarioTimestamp,
          type: 'knockout_scenario_leaderboard',
          pool_id: pool.id,
          winner_code: winnerCode,
          match: manifestMatch.match,
          base_finished_match_ids: baseFinishedMatchIds,
          scoring_fingerprint: {
            pool_rules: shortHash(rulesForPool(pool)),
            users: shortHash(poolUsers.map(u => [u.id, u.joined_at, u.predictions_submitted_at])),
            knockout_picks: shortHash((pickIndexes.knockoutByUser && poolUsers.flatMap(u => pickIndexes.knockoutByUser.get(u.id) || [])) || []),
          },
          count: standings.length,
          standings,
        };
        if (writeScenarioIfChanged(path.join(winnerDir, `${safeSegment(pool.id)}.json`), payload)) changedFiles++;
        poolCount++;
      }

      manifestMatch[`${winnerCode}_pool_count`] = poolCount;
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
    finishedIdsExcluding,
    safeSegment,
    matchIdentity,
    isTargetPair,
    isKnockoutMatch,
    sortStandings,
    rulesForPool,
  };
}
