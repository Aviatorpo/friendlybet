#!/usr/bin/env node
// Audits canonical DB scores against the deterministic two-phase knockout model.
// This catches the class of bug where snapshots match Supabase, but Supabase was
// computed from an empty or wrong bracket-slot bridge.

const S = require('./calculate-scores-v2.js');
const { assertQaIfRequested } = require('./qa-env');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY;
const REST_PAGE_SIZE = 1000;

assertQaIfRequested();

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SECRET_KEY or SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

function scoreNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function sbAll(table, query = '', pageSize = REST_PAGE_SIZE) {
  const all = [];
  for (let from = 0, guard = 0; ; guard++, from += pageSize) {
    if (guard >= 10000) {
      throw new Error(`Supabase GET ${table}: pagination guard exceeded after ${all.length} rows`);
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + pageSize - 1}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Supabase GET ${table} ${res.status}: ${await res.text()}`);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error(`Supabase GET ${table}: expected array page`);
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

function indexRowsBy(rows, key) {
  const out = new Map();
  for (const row of rows || []) {
    const value = row && row[key];
    if (!value) continue;
    if (!out.has(value)) out.set(value, []);
    out.get(value).push(row);
  }
  return out;
}

async function main() {
  const [pools, users, picks, matches] = await Promise.all([
    sbAll('pools', '?select=id,code,name,betting_mode,scoring_rules,use_multipliers'),
    sbAll('users', '?select=id,pool_id,nickname,total_score,knockout_points,knockout_score'),
    sbAll('knockout_picks', '?select=user_id,pool_id,match_id,predicted_winner,multiplier_applied,bracket_position'),
    sbAll('matches', '?select=id,external_id,stage,group_letter,home_team_code,away_team_code,home_score,away_score,status,winner_code,match_date,live_source,status_detail&order=match_date.asc,id.asc'),
  ]);

  const groupState = S.buildGroupState(matches || []);
  const finishedMatches = (matches || []).filter(S.isTerminalMatch);
  const slotMatches = S.buildTwoPhaseSlotMatches(finishedMatches, groupState);
  const mappedSlots = Array.from(slotMatches.entries())
    .map(([slot, match]) => ({
      slot,
      external_id: match.external_id,
      teams: `${match.home_team_code}-${match.away_team_code}`,
      winner: S.knockoutWinner(match),
    }));

  const usersByPool = indexRowsBy(users, 'pool_id');
  const picksByUser = indexRowsBy(picks, 'user_id');
  const errors = [];
  let twoPhasePools = 0;
  let checkedUsers = 0;
  let usersWithExpectedKnockout = 0;

  for (const pool of pools || []) {
    if ((pool.betting_mode || 'two_phase') !== 'two_phase') continue;
    twoPhasePools++;
    const rules = pool.scoring_rules || S.DEFAULT_RULES_TWO;
    const resolveMult = S.poolMultResolver(pool, rules);

    for (const user of usersByPool.get(pool.id) || []) {
      checkedUsers++;
      let expectedKnockout = 0;
      for (const pick of picksByUser.get(user.id) || []) {
        if (!pick || pick.bracket_position != null || !pick.match_id) continue;
        const match = slotMatches.get(pick.match_id);
        if (!match || !S.isTerminalMatch(match)) continue;
        const winner = S.knockoutWinner(match);
        if (!winner || pick.predicted_winner !== winner) continue;
        const key = S.stageRuleKey(match.stage);
        if (!key) continue;
        expectedKnockout += (rules[key] || 0) * resolveMult(winner, pick.multiplier_applied);
      }

      expectedKnockout = Math.round(expectedKnockout);
      if (expectedKnockout > 0) usersWithExpectedKnockout++;
      const storedKnockout = scoreNumber(user.knockout_points ?? user.knockout_score);
      if (expectedKnockout !== storedKnockout) {
        errors.push({
          pool_id: pool.id,
          code: pool.code,
          name: pool.name,
          user_id: user.id,
          nickname: user.nickname,
          expected_knockout: expectedKnockout,
          stored_knockout: storedKnockout,
        });
      }
    }
  }

  console.log(JSON.stringify({
    twoPhasePools,
    checkedUsers,
    usersWithExpectedKnockout,
    mappedFinishedKnockoutSlots: mappedSlots,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  }, null, 2));

  if (errors.length) {
    throw new Error(`two-phase knockout scoring audit failed with ${errors.length} mismatch(es)`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}
