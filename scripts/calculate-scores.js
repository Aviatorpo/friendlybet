// ============================================================
// FriendlyBet - Score Calculation Script
// ============================================================
// Runs after each match sync to calculate points for users
// based on their predictions vs actual results.
//
// Scoring Rules (Golazo defaults):
//   Groups:     1 pt per correct advancement
//   R32:        1 pt
//   R16:        2 pts
//   QF:         3 pts
//   SF:         4 pts
//   FINAL:      8 pts
//
// Multipliers:
//   Favorite ⭐:    × 1.0
//   Contender ⚔️:   × 1.5
//   Underdog 🐴:    × 2.0
//
// Top Scorer bonus: 25 pts
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_SECRET_KEY');
  process.exit(1);
}

// ===== Scoring constants =====

const POINTS_PER_ROUND = {
  'GROUP_STAGE': 1,
  'LAST_16': 2,
  'QUARTER_FINALS': 3,
  'SEMI_FINALS': 4,
  'FINAL': 8,
  'THIRD_PLACE': 0  // No points for 3rd place match
};

const TIER_MULTIPLIERS = {
  'favorite': 1.0,
  'contender': 1.5,
  'underdog': 2.0
};

// ===== Helpers =====

const { fbGuardDelete } = require('./lib-guard');
async function callSupabase(method, table, options = {}) {
  fbGuardDelete(method, table);  // never let a sync job DELETE user-data tables
  const { data, query = '', headers = {} } = options;
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  
  const reqOptions = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation,resolution=merge-duplicates',
      ...headers
    }
  };
  
  if (data) {
    reqOptions.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, reqOptions);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${method} ${table} failed: ${response.status} - ${text}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ===== Score calculation logic =====

function calculateGroupScore(pick, match, pool) {
  // For group stage: 1 pt if user's pick won
  // But the actual logic is about advancing teams, not match wins
  // For now, simple: did the picked team win this match?
  
  if (!match.home_score && !match.away_score && match.home_score !== 0) {
    return null; // Match not finished
  }
  
  const homeWon = match.home_score > match.away_score;
  const awayWon = match.away_score > match.home_score;
  const draw = match.home_score === match.away_score;
  
  // Check if user picked the winning team
  let correct = false;
  if (homeWon && pick.team_code === match.home_team_code) correct = true;
  if (awayWon && pick.team_code === match.away_team_code) correct = true;
  
  // Note: For group stage, the real scoring is more complex
  // (about team advancement to knockout), but per-match also makes sense
  
  if (!correct) return 0;
  
  const basePoints = POINTS_PER_ROUND['GROUP_STAGE'];
  const multiplier = TIER_MULTIPLIERS[pick.tier] || 1.0;
  return Math.round(basePoints * multiplier);
}

function calculateKnockoutScore(pick, match) {
  // For knockout: pick the winning team
  if (match.home_score === null || match.away_score === null) {
    return null; // Match not finished
  }
  
  // In knockouts, ties go to penalties - the API should return the actual winner
  // For now, simple comparison
  const homeWon = match.home_score > match.away_score;
  const awayWon = match.away_score > match.home_score;
  
  let correct = false;
  if (homeWon && pick.team_code === match.home_team_code) correct = true;
  if (awayWon && pick.team_code === match.away_team_code) correct = true;
  
  if (!correct) return 0;
  
  const basePoints = POINTS_PER_ROUND[match.stage] || 1;
  // Knockout picks may have their own tier from when they were placed
  const multiplier = TIER_MULTIPLIERS[pick.tier] || 1.0;
  return Math.round(basePoints * multiplier);
}

// ===== Main calculation =====

async function calculateScores() {
  console.log('🧮 Starting score calculation...');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log('');
  
  // Step 1: Get all FINISHED matches
  const finishedMatches = await callSupabase('GET', 'matches', {
    query: '?status=eq.FINISHED&select=*'
  });
  
  if (!finishedMatches || finishedMatches.length === 0) {
    console.log('⏭️  No finished matches yet - nothing to score');
    return;
  }
  
  console.log(`📊 Found ${finishedMatches.length} finished matches`);
  
  // Step 2: Get all pools
  const pools = await callSupabase('GET', 'pools', { query: '?select=*' });
  console.log(`🏊 Found ${pools.length} pools`);
  
  let totalCalculations = 0;
  let totalPointsAwarded = 0;
  
  // Step 3: Process each pool
  for (const pool of pools) {
    console.log(`\n📍 Processing pool: ${pool.name} (${pool.code})`);
    
    // Get all users in this pool
    const users = await callSupabase('GET', 'users', {
      query: `?pool_id=eq.${pool.id}&select=*`
    });
    
    if (!users || users.length === 0) {
      console.log('   ⏭️  No users in pool');
      continue;
    }
    
    console.log(`   👥 ${users.length} users`);
    
    // For each user, calculate scores for each match
    for (const user of users) {
      const userScores = await processUser(user, pool, finishedMatches);
      
      if (userScores.matches > 0) {
        console.log(`   🎯 ${user.nickname}: ${userScores.total} pts from ${userScores.matches} matches`);
        totalCalculations += userScores.matches;
        totalPointsAwarded += userScores.total;
      }
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════');
  console.log(`✅ Calculation complete`);
  console.log(`   ${totalCalculations} match-user scores computed`);
  console.log(`   ${totalPointsAwarded} total points awarded`);
  console.log('═══════════════════════════════════');
}

async function processUser(user, pool, finishedMatches) {
  let totalPoints = 0;
  let matchesScored = 0;
  
  // Get user's picks
  const [groupPicks, knockoutPicks] = await Promise.all([
    callSupabase('GET', 'group_picks', {
      query: `?user_id=eq.${user.id}&select=*`
    }),
    callSupabase('GET', 'knockout_picks', {
      query: `?user_id=eq.${user.id}&select=*`
    })
  ]);
  
  // Get existing scores for this user (to avoid duplicates)
  const existingScores = await callSupabase('GET', 'user_scores', {
    query: `?user_id=eq.${user.id}&select=match_id,pick_type`
  });
  
  const scoredMatches = new Set();
  (existingScores || []).forEach(s => {
    scoredMatches.add(`${s.match_id}_${s.pick_type}`);
  });
  
  const newScores = [];
  let groupsTotal = user.groups_score || 0;
  let knockoutTotal = user.knockout_score || 0;
  
  // Process each finished match
  for (const match of finishedMatches) {
    // Skip if home/away scores not set
    if (match.home_score === null || match.away_score === null) continue;
    
    if (match.stage === 'GROUP_STAGE') {
      // Find user's pick for this team in this group
      const homePick = (groupPicks || []).find(p => p.team_code === match.home_team_code);
      const awayPick = (groupPicks || []).find(p => p.team_code === match.away_team_code);
      
      // Check both team picks
      [homePick, awayPick].forEach(pick => {
        if (!pick) return;
        if (scoredMatches.has(`${match.id}_GROUP`)) return;
        
        const points = calculateGroupScore(pick, match, pool);
        if (points === null) return;
        
        if (points > 0) {
          newScores.push({
            user_id: user.id,
            pool_id: pool.id,
            match_id: match.id,
            pick_type: 'GROUP',
            points_earned: points,
            multiplier: TIER_MULTIPLIERS[pick.tier] || 1.0,
            details: {
              team_picked: pick.team_code,
              winner: match.home_score > match.away_score ? match.home_team_code : match.away_team_code,
              tier: pick.tier,
              base_points: POINTS_PER_ROUND['GROUP_STAGE']
            }
          });
          totalPoints += points;
          groupsTotal += points;
          matchesScored++;
        }
      });
      
    } else {
      // Knockout match - find user's pick
      // Knockout picks are by match position, not team
      const knockoutPick = (knockoutPicks || []).find(p => 
        p.team_code === match.home_team_code || p.team_code === match.away_team_code
      );
      
      if (!knockoutPick) continue;
      if (scoredMatches.has(`${match.id}_KNOCKOUT`)) continue;
      
      const points = calculateKnockoutScore(knockoutPick, match);
      if (points === null) continue;
      
      if (points > 0) {
        newScores.push({
          user_id: user.id,
          pool_id: pool.id,
          match_id: match.id,
          pick_type: 'KNOCKOUT',
          points_earned: points,
          multiplier: TIER_MULTIPLIERS[knockoutPick.tier] || 1.0,
          details: {
            team_picked: knockoutPick.team_code,
            winner: match.home_score > match.away_score ? match.home_team_code : match.away_team_code,
            tier: knockoutPick.tier,
            stage: match.stage,
            base_points: POINTS_PER_ROUND[match.stage]
          }
        });
        totalPoints += points;
        knockoutTotal += points;
        matchesScored++;
      }
    }
  }
  
  // Save new scores
  if (newScores.length > 0) {
    await callSupabase('POST', 'user_scores', {
      data: newScores,
      query: '?on_conflict=user_id,match_id,pick_type'
    });
    
    // Update user's totals
    const totalScore = groupsTotal + knockoutTotal + (user.bonus_score || 0);
    
    await callSupabase('PATCH', 'users', {
      data: {
        groups_score: groupsTotal,
        knockout_score: knockoutTotal,
        total_score: totalScore,
        last_score_calc: new Date().toISOString()
      },
      query: `?id=eq.${user.id}`
    });
  }
  
  return {
    matches: matchesScored,
    total: totalPoints
  };
}

// ===== Run =====

calculateScores()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
