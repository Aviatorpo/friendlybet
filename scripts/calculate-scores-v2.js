// ============================================================
// FriendlyBet v2 - Score Calculation Script
// ============================================================
// New scoring model that supports:
//   - 'single_phase' pools (groups + hypothetical bracket + winner + top scorer)
//   - 'two_phase' pools (legacy groups + knockout)
// All scoring rules come from pools.scoring_rules (JSONB).
// Runs every 30 minutes via GitHub Actions.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SECRET_KEY');
  process.exit(1);
}

// ---- Defaults (mirror app's DEFAULT_SCORING_RULES) ----
// v2.5.55: doubling-progression defaults (1 / 2 / 4 / 8 / 16 / 32) so each
// stage maxes at ~32 pts across the pool.
const DEFAULT_RULES_SINGLE = {
  // v2.5.63: every correct group POSITION (1st-4th) earns 1 pt.
  // v2.5.70: each correct knockout pick = "team reached the NEXT round".
  // R32 pick = team in R16 (2 pts), R16 pick = team in QF (4 pts), and so
  // on - doubling progression so every stage maxes out at ~32 pts.
  group_first: 1, group_second: 1, group_third: 1, group_fourth: 1,
  round_of_32: 2, round_of_16: 4, quarter_final: 8, semi_final: 16, final: 32,
  tournament_winner: 32, top_scorer: 20
};
const DEFAULT_RULES_TWO = {
  group_first: 1, group_second: 1, group_third: 0, group_fourth: 0,
  round_of_32: 2, round_of_16: 4, quarter_final: 8, semi_final: 16, final: 32,
  tournament_winner: 32, top_scorer: 20
};

// v2.5.36: shared multiplier resolver. Looks up (in order): the
// multiplier_applied snapshot persisted on the pick row → the pool's
// per-team override → the pool's category multiplier (favorite /
// contender / underdog, classified by FIFA rank) → global defaults.
const FIFA_RANK = {
  ARG:1, ESP:2, FRA:3, ENG:4, BRA:5, POR:6, NED:7, BEL:8, CRO:9, GER:12, MAR:13, URU:15,
  USA:16, MEX:17, JPN:18, SUI:19, SEN:20, IRN:21, KOR:22, AUT:23, UKR:24, SWE:25, AUS:26,
  TUR:27, NOR:28, TUN:29, EGY:30, ALG:31, CAN:32, CZE:33, SCO:34, CIV:35, CMR:36, PAR:37,
  PAN:38, IRQ:40, RSA:42, UZB:43, JOR:44, GHA:47, JAM:50, NZL:55, SAU:57, BIH:59, HAI:60,
  CPV:65, QAT:66, CUR:85
};
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

// ---- Supabase fetch helper ----
async function sb(method, table, options = {}) {
  const { data, query = '', headers = {} } = options;
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
      ...headers
    },
    body: data ? JSON.stringify(data) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
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
  // Sort: points desc, GD desc, GF desc
  return Object.values(stats).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.gd !== x.gd) return y.gd - x.gd;
    if (y.gf !== x.gf) return y.gf - x.gf;
    return x.code.localeCompare(y.code);
  });
}

// Return true if every group match in this group is FINISHED
function groupIsComplete(matches) {
  if (matches.length === 0) return false;
  return matches.every(m => m.status === 'FINISHED' || (m.home_score != null && m.away_score != null));
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
  const pools = await sb('GET', 'pools', { query: '?select=*' });
  if (!pools || !pools.length) { console.log('No pools'); return; }

  // 2. Load matches (for groups + knockout outcomes)
  const matches = await sb('GET', 'matches', { query: '?select=*' });
  const finishedMatches = (matches || []).filter(m => m.status === 'FINISHED' || (m.home_score != null && m.away_score != null));
  console.log(`${pools.length} pools, ${finishedMatches.length} finished matches`);

  // 3. Top scorer truth (if app_settings stores it) - read from app_settings.top_scorer
  let realTopScorer = null;
  try {
    const settings = await sb('GET', 'app_settings', { query: '?select=*&limit=1' });
    if (settings && settings[0] && settings[0].top_scorer) realTopScorer = settings[0].top_scorer;
  } catch (e) { /* ignore */ }

  // 4. Per-pool processing
  for (const pool of pools) {
    const mode = pool.betting_mode || 'two_phase';
    const rules = pool.scoring_rules ||
      (mode === 'single_phase' ? DEFAULT_RULES_SINGLE : DEFAULT_RULES_TWO);

    console.log(`\nPool ${pool.code} - ${pool.name} (${mode})`);

    const users = await sb('GET', 'users', { query: `?pool_id=eq.${pool.id}&select=*` });
    if (!users || !users.length) { console.log('  no users'); continue; }

    // Get all top_scorer_picks for users in this pool
    const tsPicks = await sb('GET', 'top_scorer_picks',
      { query: `?pool_id=eq.${pool.id}&select=*` });
    const tsMap = new Map((tsPicks || []).map(t => [t.user_id, t]));

    if (mode === 'single_phase') {
      await scoreSinglePhasePool(pool, rules, users, finishedMatches, tsMap, realTopScorer);
    } else {
      await scoreTwoPhasePool(pool, rules, users, finishedMatches, tsMap, realTopScorer);
    }
  }

  console.log(`\nDone in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

// ---- SINGLE PHASE scoring ----
async function scoreSinglePhasePool(pool, rules, users, finishedMatches, tsMap, realTopScorer) {
  // Group standings (real-world)
  const standings = {}; // letter -> [team codes in order 1st..4th] or null if group not complete
  const groupCodes = {}; // letter -> [team codes in this group]
  const allGroupMatches = finishedMatches.filter(m => m.stage === 'GROUP_STAGE');
  const allGroupMatchesAny = (await sb('GET', 'matches',
    { query: '?stage=eq.GROUP_STAGE&select=*' })) || [];

  // Build group->teams from any group match
  allGroupMatchesAny.forEach(m => {
    const letter = m.group_letter || m.group;
    if (!letter) return;
    if (!groupCodes[letter]) groupCodes[letter] = new Set();
    if (m.home_team_code) groupCodes[letter].add(m.home_team_code);
    if (m.away_team_code) groupCodes[letter].add(m.away_team_code);
  });
  Object.keys(groupCodes).forEach(letter => {
    const teams = [...groupCodes[letter]];
    if (teams.length !== 4) return;
    const groupMatches = allGroupMatchesAny.filter(m => (m.group_letter || m.group) === letter);
    if (!groupIsComplete(groupMatches)) return;
    const ordered = computeGroupStandings(groupMatches, teams).map(s => s.code);
    standings[letter] = ordered;
  });

  // Knockout results (real-world) - by stage
  // For hypothetical bracket: we check whether the team the user picked as
  // a R16/QF/SF/Final winner actually won SOME match at that level.
  const realKnockoutWinners = {}; // 'R16': Set of winner codes, etc.
  ['ROUND_OF_32','LAST_32','R32','LAST_16','ROUND_OF_16','R16','QUARTER_FINALS','QF','SEMI_FINALS','SF','FINAL'].forEach(s => { realKnockoutWinners[s] = new Set(); });
  finishedMatches.forEach(m => {
    if (!m.stage || m.stage === 'GROUP_STAGE' || m.stage === 'THIRD_PLACE') return;
    const winner = m.home_score > m.away_score ? m.home_team_code
                 : m.away_score > m.home_score ? m.away_team_code
                 : null;
    if (!winner) return;
    if (realKnockoutWinners[m.stage]) realKnockoutWinners[m.stage].add(winner);
  });

  // Final winner = winner of FINAL match
  let realChampion = null;
  const finalMatch = finishedMatches.find(m => m.stage === 'FINAL');
  if (finalMatch && finalMatch.home_score != null) {
    realChampion = finalMatch.home_score > finalMatch.away_score ? finalMatch.home_team_code
                 : finalMatch.away_score > finalMatch.home_score ? finalMatch.away_team_code
                 : null;
  }

  // Score each user
  for (const user of users) {
    let groupPoints = 0;
    let knockoutPoints = 0;
    let bonusPoints = 0;

    // v2.5.36: pool-aware multiplier resolver
    const resolveMult = poolMultResolver(pool, rules);

    // Group position picks
    const gpp = await sb('GET', 'group_position_picks',
      { query: `?user_id=eq.${user.id}&select=*` });
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

    // Hypothetical bracket picks
    const kp = await sb('GET', 'knockout_picks',
      { query: `?user_id=eq.${user.id}&bracket_position=not.is.null&select=*` });
    (kp || []).forEach(p => {
      const ruleKey = bracketPosRuleKey(p.bracket_position);
      if (!ruleKey) return;
      // Did user's picked team win their actual real-world match at this stage?
      const stageMap = {
        round_of_32:  ['ROUND_OF_32','LAST_32','R32'],
        round_of_16:  ['LAST_16','ROUND_OF_16','R16'],
        quarter_final:['QUARTER_FINALS','QF'],
        semi_final:   ['SEMI_FINALS','SF'],
        final:        ['FINAL']
      };
      const stages = stageMap[ruleKey] || [];
      const won = stages.some(s => realKnockoutWinners[s] && realKnockoutWinners[s].has(p.team_code));
      if (won) {
        const pts = rules[ruleKey] || 0;
        knockoutPoints += pts * resolveMult(p.team_code, p.multiplier_applied);
      }
    });

    // Tournament winner (multiplied by the champion's multiplier too)
    const twp = await sb('GET', 'tournament_winner_picks',
      { query: `?user_id=eq.${user.id}&select=*&limit=1` });
    if (twp && twp[0] && realChampion && twp[0].team_code === realChampion) {
      bonusPoints += (rules.tournament_winner || 0) * resolveMult(twp[0].team_code, twp[0].multiplier_applied);
    }

    // Top scorer
    const tsp = tsMap.get(user.id);
    if (tsp && realTopScorer && tsp.player_id === realTopScorer) {
      bonusPoints += rules.top_scorer || 0;
    }

    // v2.5.36: round multiplied totals to integers for clean leaderboard display
    groupPoints = Math.round(groupPoints);
    knockoutPoints = Math.round(knockoutPoints);
    bonusPoints = Math.round(bonusPoints);
    const total = groupPoints + knockoutPoints + bonusPoints;

    // Persist
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
          last_score_calc: new Date().toISOString()
        },
        query: `?id=eq.${user.id}`
      });
    } catch (e) {
      // Fall back to a minimal update if some v2 columns don't exist yet
      try {
        await sb('PATCH', 'users', {
          data: {
            groups_score: groupPoints,
            knockout_score: knockoutPoints,
            bonus_score: bonusPoints,
            total_score: total,
            last_score_calc: new Date().toISOString()
          },
          query: `?id=eq.${user.id}`
        });
      } catch (e2) {
        console.warn(`  update failed for ${user.nickname}:`, e2.message);
      }
    }

    if (total > 0) console.log(`  ${user.nickname}: ${total} (g${groupPoints}+k${knockoutPoints}+b${bonusPoints})`);
  }
}

// ---- TWO PHASE scoring (legacy-style) ----
// v2.5.35: applies risk multipliers from scoring_rules (per-team override →
// category by FIFA-rank-derived tier → global default). Persisted
// multiplier_applied on each pick row takes priority (snapshot at pick time)
// so historical picks aren't retroactively re-scored when the admin tweaks
// values mid-tournament.
async function scoreTwoPhasePool(pool, rules, users, finishedMatches, tsMap, realTopScorer) {
  const resolveMult = poolMultResolver(pool, rules);

  for (const user of users) {
    let groupPoints = 0;
    let knockoutPoints = 0;
    let bonusPoints = 0;

    // Group picks
    const gp = await sb('GET', 'group_picks',
      { query: `?user_id=eq.${user.id}&select=*` });
    finishedMatches.forEach(m => {
      if (m.stage !== 'GROUP_STAGE') return;
      const winner = m.home_score > m.away_score ? m.home_team_code
                   : m.away_score > m.home_score ? m.away_team_code
                   : null;
      if (!winner) return;
      const pick = (gp || []).find(p => p.team_code === winner);
      if (!pick) return;
      const mult = resolveMult(winner, pick.multiplier_applied);
      groupPoints += (rules.group_first || 0) * mult;
    });

    // Knockout picks - per-match
    const kp = await sb('GET', 'knockout_picks',
      { query: `?user_id=eq.${user.id}&select=*` });
    let finalWinnerPredicted = false;
    let finalWinnerMult = 1.0;
    finishedMatches.forEach(m => {
      if (!m.stage || m.stage === 'GROUP_STAGE' || m.stage === 'THIRD_PLACE') return;
      const winner = m.home_score > m.away_score ? m.home_team_code
                   : m.away_score > m.home_score ? m.away_team_code
                   : null;
      if (!winner) return;
      const pick = (kp || []).find(p => p.predicted_winner === winner || p.team_code === winner);
      if (!pick) return;
      const key = stageRuleKey(m.stage);
      if (!key) return;
      const mult = resolveMult(winner, pick.multiplier_applied);
      knockoutPoints += (rules[key] || 0) * mult;
      if (m.stage === 'FINAL') {
        finalWinnerPredicted = true;
        finalWinnerMult = mult;
      }
    });

    // Tournament-winner bonus on top of FINAL (applies the same multiplier)
    if (finalWinnerPredicted && rules.tournament_winner) {
      bonusPoints += rules.tournament_winner * finalWinnerMult;
    }

    // Top scorer
    const tsp = tsMap.get(user.id);
    if (tsp && realTopScorer && tsp.player_id === realTopScorer) {
      bonusPoints += rules.top_scorer || 0;
    }

    groupPoints = Math.round(groupPoints);
    knockoutPoints = Math.round(knockoutPoints);
    bonusPoints = Math.round(bonusPoints);

    const total = groupPoints + knockoutPoints + bonusPoints;
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
          last_score_calc: new Date().toISOString()
        },
        query: `?id=eq.${user.id}`
      });
    } catch (e) {
      try {
        await sb('PATCH', 'users', {
          data: { groups_score: groupPoints, knockout_score: knockoutPoints,
                  bonus_score: bonusPoints, total_score: total,
                  last_score_calc: new Date().toISOString() },
          query: `?id=eq.${user.id}`
        });
      } catch (e2) {
        console.warn(`  update failed for ${user.nickname}:`, e2.message);
      }
    }
    if (total > 0) console.log(`  ${user.nickname}: ${total} (g${groupPoints}+k${knockoutPoints}+b${bonusPoints})`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
