// ============================================================
// FriendlyBet - Smart Match Sync Script
// ============================================================
// This script intelligently decides whether to sync:
// 1. Checks if there's a live match RIGHT NOW
// 2. Checks if a match is starting within 15 minutes
// 3. Only syncs if there's actually something to update
// 
// This saves a TON of GitHub Actions minutes when nothing is happening.
// ============================================================

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const WORLD_CUP_ID = 'WC';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const FOOTBALL_TOKEN = process.env.FOOTBALL_DATA_TOKEN;

if (!SUPABASE_KEY || !FOOTBALL_TOKEN) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// ===== Helpers =====

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

async function callFootballAPI(endpoint) {
  const url = `${FOOTBALL_API_BASE}${endpoint}`;
  
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

// ===== Smart Decision Logic =====

async function shouldSync() {
  console.log('🧠 Smart sync: checking if sync is needed...');
  
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  
  console.log(`📅 Current time: ${now.toISOString()}`);
  
  // Query Supabase for matches in the window
  const query = `?select=*&match_date=gte.${fifteenMinutesAgo.toISOString()}&match_date=lte.${twoHoursFromNow.toISOString()}`;
  
  try {
    const matches = await callSupabase('GET', 'matches', null, query);
    
    if (!matches || matches.length === 0) {
      console.log('⏭️  No matches in the next 2 hours - skipping sync');
      return false;
    }
    
    console.log(`📊 Found ${matches.length} matches in the time window:`);
    
    // Categorize matches
    const liveMatches = [];
    const startingSoon = [];
    const startingLater = [];
    
    matches.forEach(m => {
      const matchTime = new Date(m.match_date);
      const matchTimePlusThreeHours = new Date(matchTime.getTime() + 3 * 60 * 60 * 1000);
      
      if (m.status === 'LIVE' || m.status === 'IN_PLAY' || m.status === 'PAUSED') {
        liveMatches.push(m);
      } else if (matchTime <= fifteenMinutesFromNow && matchTime >= fifteenMinutesAgo) {
        // Starting very soon
        startingSoon.push(m);
      } else if (matchTime > fifteenMinutesFromNow && matchTimePlusThreeHours > now) {
        // Will start within window
        startingLater.push(m);
      }
    });
    
    if (liveMatches.length > 0) {
      console.log(`🔴 LIVE matches: ${liveMatches.length} - SYNC NEEDED`);
      liveMatches.forEach(m => {
        console.log(`   - ${m.home_team_code} vs ${m.away_team_code} (${m.status})`);
      });
      return true;
    }
    
    if (startingSoon.length > 0) {
      console.log(`⏰ Matches starting within 15 min: ${startingSoon.length} - SYNC NEEDED`);
      startingSoon.forEach(m => {
        const minutesUntil = Math.round((new Date(m.match_date) - now) / 60000);
        console.log(`   - ${m.home_team_code} vs ${m.away_team_code} in ${minutesUntil} min`);
      });
      return true;
    }
    
    if (startingLater.length > 0) {
      console.log(`📅 Matches starting later today: ${startingLater.length}`);
      const nextMatch = startingLater.sort((a, b) => 
        new Date(a.match_date) - new Date(b.match_date)
      )[0];
      const minutesUntil = Math.round((new Date(nextMatch.match_date) - now) / 60000);
      console.log(`   Next match: ${nextMatch.home_team_code} vs ${nextMatch.away_team_code} in ${minutesUntil} min`);
      console.log('⏭️  No immediate action needed - skipping sync');
      return false;
    }
    
    console.log('⏭️  No relevant matches - skipping sync');
    return false;
    
  } catch (err) {
    console.error('⚠️  Error checking schedule:', err.message);
    // On error, sync anyway to be safe
    console.log('🔄 Syncing anyway to be safe');
    return true;
  }
}

// ===== Team name to code mapping =====

const TEAM_NAME_TO_CODE = {
  'Argentina': 'ARG', 'France': 'FRA', 'Brazil': 'BRA', 'England': 'ENG',
  'Spain': 'ESP', 'Portugal': 'POR', 'Netherlands': 'NED', 'Germany': 'GER',
  'Belgium': 'BEL', 'Croatia': 'CRO', 'Uruguay': 'URU',
  'United States': 'USA', 'Mexico': 'MEX', 'Switzerland': 'SUI',
  'Austria': 'AUT', 'Sweden': 'SWE', 'Senegal': 'SEN', 'Morocco': 'MAR',
  'Japan': 'JPN', 'South Korea': 'KOR', 'Republic of Korea': 'KOR', 'Korea Republic': 'KOR',
  'Australia': 'AUS', 'Canada': 'CAN', 'Ukraine': 'UKR',
  'Turkey': 'TUR', 'Norway': 'NOR', 'Iran': 'IRN', 'Tunisia': 'TUN', 
  'Egypt': 'EGY', 'Cameroon': 'CMR', 'Ghana': 'GHA', 'Panama': 'PAN',
  'Jamaica': 'JAM', 'Paraguay': 'PAR',
  'New Zealand': 'NZL', 'Uzbekistan': 'UZB', 'Iraq': 'IRQ',
  'Saudi Arabia': 'SAU', 'Jordan': 'JOR',
  // Added qualifiers
  'South Africa': 'RSA', 'Algeria': 'ALG', 'Czechia': 'CZE',
  'Haiti': 'HAI', 'Bosnia-Herzegovina': 'BIH', 'Cape Verde Islands': 'CPV',
  'Congo DR': 'COD', 'Ivory Coast': 'CIV', 'Qatar': 'QAT',
  'Scotland': 'SCO', 'Curaçao': 'CUR',
};

function getTeamCode(teamName) {
  if (!teamName) return null;
  return TEAM_NAME_TO_CODE[teamName] || null;
}

// ===== Sync Logic =====

async function performSync() {
  console.log('🚀 Performing sync...');
  
  const data = await callFootballAPI(`/competitions/${WORLD_CUP_ID}/matches`);
  
  if (!data.matches || data.matches.length === 0) {
    console.log('⚠️  No matches found in API');
    return 0;
  }
  
  console.log(`✅ Got ${data.matches.length} matches from API`);
  
  const transformedMatches = data.matches.map(m => {
    const homeCode = getTeamCode(m.homeTeam?.name);
    const awayCode = getTeamCode(m.awayTeam?.name);
    
    return {
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
  });
  
  const validMatches = transformedMatches.filter(m => m.home_team_code && m.away_team_code);
  const skippedCount = transformedMatches.length - validMatches.length;
  
  if (skippedCount > 0) {
    console.log(`⏭️  Skipped ${skippedCount} matches with unmapped teams (likely TBD)`);
  }
  
  console.log(`💾 Upserting ${validMatches.length} matches to Supabase...`);
  
  const BATCH_SIZE = 50;
  let totalUpserted = 0;
  
  for (let i = 0; i < validMatches.length; i += BATCH_SIZE) {
    const batch = validMatches.slice(i, i + BATCH_SIZE);
    await callSupabase('POST', 'matches', batch, '?on_conflict=external_id');
    totalUpserted += batch.length;
  }
  
  console.log(`✅ Successfully synced ${totalUpserted} matches`);
  
  // Print status summary
  const statusCounts = {};
  validMatches.forEach(m => {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
  });
  
  console.log('📊 Status breakdown:');
  Object.keys(statusCounts).forEach(status => {
    console.log(`   ${status}: ${statusCounts[status]}`);
  });
  
  return totalUpserted;
}

// ===== Main =====

async function main() {
  console.log('🚀 FriendlyBet Smart Sync starting...');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log('');
  
  try {
    const needsSync = await shouldSync();
    
    if (!needsSync) {
      console.log('');
      console.log('✨ Smart skip - saved GitHub Actions minutes!');
      console.log('💡 Next regular sync will happen via 6-hour cron');
      return;
    }
    
    console.log('');
    console.log('🎯 Sync is needed - proceeding...');
    console.log('');
    
    const count = await performSync();
    
    console.log('');
    console.log(`✨ Done! Synced ${count} matches`);
    
  } catch (err) {
    console.error('💥 Fatal error:', err.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Unhandled error:', err);
    process.exit(1);
  });
