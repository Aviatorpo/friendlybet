// ============================================================
// FriendlyBet - World Cup Teams Sync
// ============================================================
// Syncs the actual 48 teams from football-data.org
// Includes Hebrew names, group letters, FIFA rankings, and tiers
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

// ============================================================
// Master mapping: API team name → our data
// ============================================================
// This is the source of truth for Hebrew names, tiers, and rankings
// Group letters will be assigned from API data once available

const TEAM_INFO = {
  // Strong favorites - Tier 1 (× 1.0)
  'Argentina': { code: 'ARG', name_he: 'ארגנטינה', tier: 'favorite', fifa_ranking: 1 },
  'France': { code: 'FRA', name_he: 'צרפת', tier: 'favorite', fifa_ranking: 2 },
  'Spain': { code: 'ESP', name_he: 'ספרד', tier: 'favorite', fifa_ranking: 3 },
  'England': { code: 'ENG', name_he: 'אנגליה', tier: 'favorite', fifa_ranking: 4 },
  'Brazil': { code: 'BRA', name_he: 'ברזיל', tier: 'favorite', fifa_ranking: 5 },
  'Portugal': { code: 'POR', name_he: 'פורטוגל', tier: 'favorite', fifa_ranking: 6 },
  'Netherlands': { code: 'NED', name_he: 'הולנד', tier: 'favorite', fifa_ranking: 7 },
  'Germany': { code: 'GER', name_he: 'גרמניה', tier: 'favorite', fifa_ranking: 8 },
  
  // Contenders - Tier 2 (× 1.5)
  'Croatia': { code: 'CRO', name_he: 'קרואטיה', tier: 'contender', fifa_ranking: 10 },
  'Belgium': { code: 'BEL', name_he: 'בלגיה', tier: 'contender', fifa_ranking: 11 },
  'Uruguay': { code: 'URU', name_he: 'אורוגוואי', tier: 'contender', fifa_ranking: 12 },
  'Colombia': { code: 'COL', name_he: 'קולומביה', tier: 'contender', fifa_ranking: 13 },
  'Morocco': { code: 'MAR', name_he: 'מרוקו', tier: 'contender', fifa_ranking: 14 },
  'Switzerland': { code: 'SUI', name_he: 'שווייץ', tier: 'contender', fifa_ranking: 15 },
  'Denmark': { code: 'DEN', name_he: 'דנמרק', tier: 'contender', fifa_ranking: 16 },
  'United States': { code: 'USA', name_he: 'ארה"ב', tier: 'contender', fifa_ranking: 17 },
  'Mexico': { code: 'MEX', name_he: 'מקסיקו', tier: 'contender', fifa_ranking: 18 },
  'Japan': { code: 'JPN', name_he: 'יפן', tier: 'contender', fifa_ranking: 19 },
  'Senegal': { code: 'SEN', name_he: 'סנגל', tier: 'contender', fifa_ranking: 20 },
  'Iran': { code: 'IRN', name_he: 'איראן', tier: 'contender', fifa_ranking: 21 },
  'South Korea': { code: 'KOR', name_he: 'דרום קוריאה', tier: 'contender', fifa_ranking: 22 },
  'Republic of Korea': { code: 'KOR', name_he: 'דרום קוריאה', tier: 'contender', fifa_ranking: 22 },
  'Korea Republic': { code: 'KOR', name_he: 'דרום קוריאה', tier: 'contender', fifa_ranking: 22 },
  'Australia': { code: 'AUS', name_he: 'אוסטרליה', tier: 'contender', fifa_ranking: 23 },
  'Poland': { code: 'POL', name_he: 'פולין', tier: 'contender', fifa_ranking: 24 },
  'Serbia': { code: 'SRB', name_he: 'סרביה', tier: 'contender', fifa_ranking: 25 },
  'Ukraine': { code: 'UKR', name_he: 'אוקראינה', tier: 'contender', fifa_ranking: 26 },
  'Turkey': { code: 'TUR', name_he: 'טורקיה', tier: 'contender', fifa_ranking: 27 },
  'Austria': { code: 'AUT', name_he: 'אוסטריה', tier: 'contender', fifa_ranking: 28 },
  'Norway': { code: 'NOR', name_he: 'נורווגיה', tier: 'contender', fifa_ranking: 29 },
  'Sweden': { code: 'SWE', name_he: 'שבדיה', tier: 'contender', fifa_ranking: 30 },
  'Canada': { code: 'CAN', name_he: 'קנדה', tier: 'contender', fifa_ranking: 31 },
  
  // Underdogs - Tier 3 (× 2.0)
  'Tunisia': { code: 'TUN', name_he: 'תוניסיה', tier: 'underdog', fifa_ranking: 32 },
  'Egypt': { code: 'EGY', name_he: 'מצרים', tier: 'underdog', fifa_ranking: 33 },
  'Nigeria': { code: 'NGA', name_he: 'ניגריה', tier: 'underdog', fifa_ranking: 34 },
  'Ghana': { code: 'GHA', name_he: 'גאנה', tier: 'underdog', fifa_ranking: 35 },
  'Cameroon': { code: 'CMR', name_he: 'קמרון', tier: 'underdog', fifa_ranking: 36 },
  'Costa Rica': { code: 'CRC', name_he: 'קוסטה ריקה', tier: 'underdog', fifa_ranking: 37 },
  'Panama': { code: 'PAN', name_he: 'פנמה', tier: 'underdog', fifa_ranking: 38 },
  'Jamaica': { code: 'JAM', name_he: 'ג\'מייקה', tier: 'underdog', fifa_ranking: 39 },
  'Chile': { code: 'CHI', name_he: 'צ\'ילה', tier: 'underdog', fifa_ranking: 40 },
  'Peru': { code: 'PER', name_he: 'פרו', tier: 'underdog', fifa_ranking: 41 },
  'Ecuador': { code: 'ECU', name_he: 'אקוודור', tier: 'underdog', fifa_ranking: 42 },
  'Paraguay': { code: 'PAR', name_he: 'פרגוואי', tier: 'underdog', fifa_ranking: 43 },
  'New Zealand': { code: 'NZL', name_he: 'ניו זילנד', tier: 'underdog', fifa_ranking: 44 },
  'Saudi Arabia': { code: 'SAU', name_he: 'ערב הסעודית', tier: 'underdog', fifa_ranking: 45 },
  'Iraq': { code: 'IRQ', name_he: 'עיראק', tier: 'underdog', fifa_ranking: 46 },
  'Jordan': { code: 'JOR', name_he: 'ירדן', tier: 'underdog', fifa_ranking: 47 },
  'Uzbekistan': { code: 'UZB', name_he: 'אוזבקיסטן', tier: 'underdog', fifa_ranking: 48 },
  
  // Added qualifiers (March 31, 2026 playoffs)
  'South Africa': { code: 'RSA', name_he: 'דרום אפריקה', tier: 'underdog', fifa_ranking: 49 },
  'Algeria': { code: 'ALG', name_he: 'אלג\'יריה', tier: 'contender', fifa_ranking: 31 },
  'Czechia': { code: 'CZE', name_he: 'צ\'כיה', tier: 'contender', fifa_ranking: 28 },
  'Haiti': { code: 'HAI', name_he: 'האיטי', tier: 'underdog', fifa_ranking: 50 },
  'Bosnia-Herzegovina': { code: 'BIH', name_he: 'בוסניה-הרצגובינה', tier: 'underdog', fifa_ranking: 51 },
  'Cape Verde Islands': { code: 'CPV', name_he: 'כף ורדה', tier: 'underdog', fifa_ranking: 52 },
  'Congo DR': { code: 'COD', name_he: 'קונגו', tier: 'underdog', fifa_ranking: 53 },
  'Ivory Coast': { code: 'CIV', name_he: 'חוף השנהב', tier: 'contender', fifa_ranking: 32 },
  'Qatar': { code: 'QAT', name_he: 'קטאר', tier: 'underdog', fifa_ranking: 54 },
  'Scotland': { code: 'SCO', name_he: 'סקוטלנד', tier: 'contender', fifa_ranking: 33 },
  'Curaçao': { code: 'CUR', name_he: 'קוראסאו', tier: 'underdog', fifa_ranking: 55 },
};

// ============================================================
// Manual group assignments (Source of truth)
// FIFA World Cup 2026 Final Draw - December 5, 2025
// Update this if FIFA changes anything
// ============================================================

const MANUAL_GROUPS = {
  // Group A
  'Mexico': 'A', 'South Africa': 'A', 'South Korea': 'A',
  'Republic of Korea': 'A', 'Korea Republic': 'A', 'Czechia': 'A',
  
  // Group B
  'Canada': 'B', 'Switzerland': 'B', 'Qatar': 'B', 'Bosnia-Herzegovina': 'B',
  
  // Group C
  'Brazil': 'C', 'Morocco': 'C', 'Haiti': 'C', 'Scotland': 'C',
  
  // Group D
  'United States': 'D', 'Paraguay': 'D', 'Australia': 'D', 'Turkey': 'D',
  
  // Group E
  'Spain': 'E', 'Ukraine': 'E', 'Iran': 'E', 'Cape Verde Islands': 'E',
  
  // Group F
  'Argentina': 'F', 'Tunisia': 'F', 'Iraq': 'F', 'Algeria': 'F',
  
  // Group G
  'Germany': 'G', 'Curaçao': 'G', 'Belgium': 'G', 'Saudi Arabia': 'G',
  
  // Group H
  'Portugal': 'H', 'Austria': 'H', 'Egypt': 'H', 'Sweden': 'H',
  
  // Group I
  'France': 'I', 'Senegal': 'I', 'Norway': 'I', 'New Zealand': 'I',
  
  // Group J
  'Netherlands': 'J', 'Cameroon': 'J', 'Uzbekistan': 'J', 'Jordan': 'J',
  
  // Group K
  'Uruguay': 'K', 'Japan': 'K', 'Jamaica': 'K', 'Ivory Coast': 'K',
  
  // Group L
  'England': 'L', 'Croatia': 'L', 'Ghana': 'L', 'Panama': 'L',
};

// ============================================================
// Helpers
// ============================================================

async function callFootballAPI(endpoint) {
  const url = `${FOOTBALL_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'X-Auth-Token': FOOTBALL_TOKEN }
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }
  
  return await response.json();
}

async function callSupabase(method, table, options = {}) {
  const { data, query = '' } = options;
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  
  const reqOptions = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation,resolution=merge-duplicates'
    }
  };
  
  if (data) reqOptions.body = JSON.stringify(data);
  
  const response = await fetch(url, reqOptions);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ============================================================
// Main sync
// ============================================================

async function syncTeams() {
  console.log('🚀 Starting teams sync...');
  console.log(`📅 ${new Date().toISOString()}\n`);
  
  // Step 1: Get all WC teams from API
  console.log('📡 Fetching teams from football-data.org...');
  const teamsData = await callFootballAPI(`/competitions/${WORLD_CUP_ID}/teams`);
  const apiTeams = teamsData.teams || [];
  
  console.log(`   Found ${apiTeams.length} teams in API\n`);
  
  if (apiTeams.length === 0) {
    console.log('⚠️  No teams found - aborting');
    return;
  }
  
  // Step 2: Try to get standings to assign group letters
  console.log('📊 Fetching standings (for group assignment)...');
  let groupsByTeamId = {};
  try {
    const standingsData = await callFootballAPI(`/competitions/${WORLD_CUP_ID}/standings`);
    const standings = standingsData.standings || [];
    
    standings.forEach(group => {
      const groupName = group.group; // e.g. "GROUP_A"
      if (!groupName || !groupName.startsWith('GROUP_')) return;
      
      const letter = groupName.replace('GROUP_', '');
      (group.table || []).forEach(entry => {
        if (entry.team?.id) {
          groupsByTeamId[entry.team.id] = letter;
        }
      });
    });
    
    console.log(`   Mapped ${Object.keys(groupsByTeamId).length} teams to groups\n`);
  } catch (err) {
    console.log(`   ⚠️  Standings not yet available: ${err.message}\n`);
  }
  
  // Step 3: Build the list of teams to insert
  const teamsToInsert = [];
  const unmapped = [];
  
  apiTeams.forEach(apiTeam => {
    const info = TEAM_INFO[apiTeam.name];
    
    if (!info) {
      unmapped.push(apiTeam.name);
      return;
    }
    
    // Group letter: prefer MANUAL_GROUPS (most authoritative), fallback to API
    const manualGroup = MANUAL_GROUPS[apiTeam.name];
    const apiGroup = groupsByTeamId[apiTeam.id];
    const groupLetter = manualGroup || apiGroup || null;
    
    teamsToInsert.push({
      code: info.code,
      name_en: apiTeam.name,
      name_he: info.name_he,
      group_letter: groupLetter,
      tier: info.tier,
      fifa_ranking: info.fifa_ranking,
      flag_emoji: apiTeam.crest || null
    });
  });
  
  const withGroup = teamsToInsert.filter(t => t.group_letter).length;
  console.log(`✅ Mapped: ${teamsToInsert.length} teams (${withGroup} with group)`);
  if (unmapped.length > 0) {
    console.log(`⚠️  Unmapped teams (need to add to TEAM_INFO):`);
    unmapped.forEach(name => console.log(`   - ${name}`));
  }
  console.log('');
  
  if (teamsToInsert.length === 0) {
    console.log('💥 No teams to insert - aborting');
    return;
  }
  
  // Step 4: Clean up existing teams + picks
  console.log('🧹 Cleaning up existing data...');
  
  // Delete all picks (they may reference teams that won't exist)
  try {
    await callSupabase('DELETE', 'group_picks', { query: '?id=neq.00000000-0000-0000-0000-000000000000' });
    console.log('   ✅ Deleted all group_picks');
  } catch (err) {
    console.log(`   ⚠️  group_picks cleanup: ${err.message}`);
  }
  
  try {
    await callSupabase('DELETE', 'knockout_picks', { query: '?id=neq.00000000-0000-0000-0000-000000000000' });
    console.log('   ✅ Deleted all knockout_picks');
  } catch (err) {
    console.log(`   ⚠️  knockout_picks cleanup: ${err.message}`);
  }
  
  // Delete teams - use code instead of id (teams table uses 'code' as primary key)
  try {
    await callSupabase('DELETE', 'teams', { query: '?code=neq.__NEVER__' });
    console.log('   ✅ Deleted all teams\n');
  } catch (err) {
    console.log(`   ⚠️  teams cleanup: ${err.message}\n`);
  }
  
  // Step 5: Insert new teams
  console.log('💾 Inserting teams...');
  
  for (let i = 0; i < teamsToInsert.length; i += 50) {
    const batch = teamsToInsert.slice(i, i + 50);
    await callSupabase('POST', 'teams', { data: batch });
    console.log(`   Batch ${Math.floor(i/50) + 1}/${Math.ceil(teamsToInsert.length/50)}`);
  }
  
  console.log('');
  console.log('═══════════════════════════════════');
  console.log(`✅ Sync complete!`);
  console.log(`   Total teams: ${teamsToInsert.length}`);
  console.log(`   With group: ${teamsToInsert.filter(t => t.group_letter).length}`);
  console.log(`   Without group: ${teamsToInsert.filter(t => !t.group_letter).length}`);
  console.log('═══════════════════════════════════');
}

syncTeams()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
