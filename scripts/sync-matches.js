// ============================================================
// FriendlyBet - Match Sync Script
// ============================================================
// Pulls World Cup 2026 matches from football-data.org
// and syncs them to Supabase
// 
// Required environment variables:
//   - SUPABASE_URL
//   - SUPABASE_SECRET_KEY
//   - FOOTBALL_DATA_TOKEN
// ============================================================

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const WORLD_CUP_ID = 'WC';  // World Cup competition code

// ===== Get env vars =====
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const FOOTBALL_TOKEN = process.env.FOOTBALL_DATA_TOKEN;

if (!SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_SECRET_KEY environment variable');
  process.exit(1);
}

if (!FOOTBALL_TOKEN) {
  console.error('❌ Missing FOOTBALL_DATA_TOKEN environment variable');
  process.exit(1);
}

// ===== Helpers =====

async function callFootballAPI(endpoint) {
  const url = `${FOOTBALL_API_BASE}${endpoint}`;
  console.log(`📡 Fetching: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': FOOTBALL_TOKEN
    }
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} - ${text}`);
  }
  
  return await response.json();
}

async function callSupabase(method, table, data = null, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  
  const options = {
    method: method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation,resolution=merge-duplicates'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${method} ${table} failed: ${response.status} - ${text}`);
  }
  
  return await response.json();
}

// Map team names from football-data.org to our team codes
const TEAM_NAME_TO_CODE = {
  'Argentina': 'ARG',
  'France': 'FRA',
  'Brazil': 'BRA',
  'England': 'ENG',
  'Spain': 'ESP',
  'Portugal': 'POR',
  'Netherlands': 'NED',
  'Germany': 'GER',
  'Belgium': 'BEL',
  'Croatia': 'CRO',
  'Uruguay': 'URU',
  'United States': 'USA',
  'Mexico': 'MEX',
  'Switzerland': 'SUI',
  'Austria': 'AUT',
  'Sweden': 'SWE',
  'Senegal': 'SEN',
  'Morocco': 'MAR',
  'Japan': 'JPN',
  'South Korea': 'KOR',
  'Republic of Korea': 'KOR',
  'Korea Republic': 'KOR',
  'Australia': 'AUS',
  'Canada': 'CAN',
  'Ukraine': 'UKR',
  'Turkey': 'TUR',
  'Norway': 'NOR',
  'Iran': 'IRN',
  'Tunisia': 'TUN',
  'Egypt': 'EGY',
  'Cameroon': 'CMR',
  'Ghana': 'GHA',
  'Panama': 'PAN',
  'Jamaica': 'JAM',
  'Paraguay': 'PAR',
  'New Zealand': 'NZL',
  'Uzbekistan': 'UZB',
  'Iraq': 'IRQ',
  'Saudi Arabia': 'SAU',
  'Jordan': 'JOR',
  
  // Added qualifiers (March 31, 2026 playoffs)
  'South Africa': 'RSA',
  'Algeria': 'ALG',
  'Czechia': 'CZE',
  'Haiti': 'HAI',
  'Bosnia-Herzegovina': 'BIH',
  'Cape Verde Islands': 'CPV',
  'Congo DR': 'COD',
  'Ivory Coast': 'CIV',
  'Qatar': 'QAT',
  'Scotland': 'SCO',
  'Curaçao': 'CUR',
  'Ecuador': 'ECU',
  'Colombia': 'COL',
};

function getTeamCode(teamName) {
  if (!teamName) return null;
  return TEAM_NAME_TO_CODE[teamName] || null;
}

// Does the matches table have the winner_code column yet? The migration
// (2026-06-03-add-match-winner.sql) is applied manually, so probe for it and
// only write winner_code once it exists - otherwise the upsert would 400.
async function matchesHasWinnerCol() {
  try {
    await callSupabase('GET', 'matches', null, '?select=winner_code&limit=1');
    return true;
  } catch (e) {
    return false;
  }
}

// Resolve football-data score.winner (accounts for extra time / penalties)
// to our team code. NULL for draws / not-yet-decided.
function resolveWinnerCode(m, homeCode, awayCode) {
  const w = m.score && m.score.winner;
  if (w === 'HOME_TEAM') return homeCode;
  if (w === 'AWAY_TEAM') return awayCode;
  return null;
}

// ===== Main sync function =====

async function syncMatches() {
  console.log('🚀 Starting World Cup match sync...');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  
  try {
    // Fetch all WC matches
    const data = await callFootballAPI(`/competitions/${WORLD_CUP_ID}/matches`);
    
    if (!data.matches || data.matches.length === 0) {
      console.log('⚠️  No matches found. The 2026 World Cup may not be available yet.');
      console.log('📝 This is expected before the tournament begins.');
      return;
    }
    
    console.log(`✅ Got ${data.matches.length} matches from API`);

    const hasWinnerCol = await matchesHasWinnerCol();
    if (!hasWinnerCol) {
      console.log('ℹ️  matches.winner_code not present yet (run migration 2026-06-03-add-match-winner.sql) - skipping winner capture');
    }

    // Transform matches for our DB
    const transformedMatches = data.matches.map(m => {
      const homeCode = getTeamCode(m.homeTeam?.name);
      const awayCode = getTeamCode(m.awayTeam?.name);

      const row = {
        external_id: String(m.id),
        stage: m.stage,
        group_letter: m.group ? m.group.replace('GROUP_', '') : null,
        home_team_code: homeCode,
        away_team_code: awayCode,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
        status: m.status || 'SCHEDULED',
        match_date: m.utcDate,
        venue: m.venue || null,
        last_updated: new Date().toISOString()
      };
      if (hasWinnerCol) row.winner_code = resolveWinnerCode(m, homeCode, awayCode);
      return row;
    });
    
    // Filter out matches where we couldn't map teams (e.g., TBD teams)
    const validMatches = transformedMatches.filter(m => m.home_team_code && m.away_team_code);
    const skippedCount = transformedMatches.length - validMatches.length;
    
    if (skippedCount > 0) {
      console.log(`⏭️  Skipped ${skippedCount} matches with unmapped teams (likely TBD)`);
    }
    
    console.log(`💾 Upserting ${validMatches.length} matches to Supabase...`);
    
    // Upsert in batches of 50
    const BATCH_SIZE = 50;
    let totalUpserted = 0;
    
    for (let i = 0; i < validMatches.length; i += BATCH_SIZE) {
      const batch = validMatches.slice(i, i + BATCH_SIZE);
      
      await callSupabase('POST', 'matches', batch, '?on_conflict=external_id');
      
      totalUpserted += batch.length;
      console.log(`   ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${totalUpserted}/${validMatches.length}`);
    }
    
    console.log(`✅ Successfully synced ${totalUpserted} matches`);
    
    // Print summary by status
    const statusCounts = {};
    validMatches.forEach(m => {
      statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
    });
    
    console.log('📊 Status breakdown:');
    Object.keys(statusCounts).forEach(status => {
      console.log(`   ${status}: ${statusCounts[status]}`);
    });
    
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
  }
}

// ===== Run =====
syncMatches()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
