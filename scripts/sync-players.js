// ============================================================
// FriendlyBet - Smart Player Squad Sync
// ============================================================
// Strategy:
// 1. Check football-data.org for World Cup squads
// 2. If squads available with REAL player names
//    → Auto-unlock the top scorer feature
//    → Populate players table with full official squads
// 3. If during tournament → update goals_so_far for scorers
//
// Runs daily. Activates feature only when official squads are released.
// ============================================================

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const WORLD_CUP_ID = 'WC';

const MIN_PLAYERS_PER_TEAM = 15;
const MIN_TEAMS_WITH_SQUADS = 30;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const FOOTBALL_TOKEN = process.env.FOOTBALL_DATA_TOKEN;

if (!SUPABASE_KEY || !FOOTBALL_TOKEN) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

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
  'Scotland': 'SCO', 'Curaçao': 'CUR', 'Ecuador': 'ECU', 'Colombia': 'COL',
};

function getTeamCode(teamName) {
  if (!teamName) return null;
  return TEAM_NAME_TO_CODE[teamName] || null;
}

// Teams considered favorites (their attackers are auto-stars)
const FAVORITE_TEAMS = new Set([
  'ARG', 'BRA', 'FRA', 'ENG', 'ESP', 'POR', 'GER', 'NED'
]);

// Positions considered "attacking" (likely goal scorers)
const ATTACKING_POSITIONS = new Set([
  'Offence', 'Centre-Forward', 'Left Winger', 'Right Winger',
  'Attacking Midfield', 'Midfield', 'Centre-Midfield',
  'FORWARD', 'MIDFIELDER', 'ATTACK', 'MID'
]);

function isAutoStar(teamCode, position) {
  // Star if: from favorite team AND attacking position
  if (!FAVORITE_TEAMS.has(teamCode)) return false;
  if (!position) return false;
  return ATTACKING_POSITIONS.has(position);
}

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

const { fbGuardDelete } = require('./lib-guard');
async function callSupabase(method, table, options = {}) {
  fbGuardDelete(method, table);  // never let a sync job DELETE user-data tables
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

async function setSetting(key, value) {
  await callSupabase('POST', 'app_settings', {
    data: { key, value: String(value), updated_at: new Date().toISOString() },
    query: '?on_conflict=key'
  });
}

async function getSetting(key) {
  const data = await callSupabase('GET', 'app_settings', {
    query: `?key=eq.${key}&select=value`
  });
  return data?.[0]?.value;
}

async function smartSync() {
  console.log('🔍 Smart Player Sync starting...');
  console.log(`📅 ${new Date().toISOString()}\n`);
  
  await setSetting('squads_last_check', new Date().toISOString());
  
  console.log('📡 Fetching teams...');
  const teamsData = await callFootballAPI(`/competitions/${WORLD_CUP_ID}/teams`);
  const teams = teamsData.teams || [];
  console.log(`   Found ${teams.length} teams\n`);
  
  if (teams.length === 0) {
    console.log('⚠️  No teams in API yet');
    return;
  }
  
  console.log('👥 Checking team squads...\n');
  
  let teamsWithSquads = 0;
  let totalPlayersFound = 0;
  const allSquadPlayers = [];
  
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const teamCode = getTeamCode(team.name);
    
    if (!teamCode) {
      console.log(`   ⏭️  Skip: ${team.name} (no code mapping)`);
      continue;
    }
    
    try {
      const teamData = await callFootballAPI(`/teams/${team.id}`);
      const squad = teamData.squad || [];
      
      if (squad.length >= MIN_PLAYERS_PER_TEAM) {
        teamsWithSquads++;
        totalPlayersFound += squad.length;
        
        squad.forEach(player => {
          const position = player.position || 'MID';
          allSquadPlayers.push({
            external_id: String(player.id),
            team_external_id: String(team.id),
            name_en: player.name,
            name_he: player.name,
            team_code: teamCode,
            position: position,
            is_star: isAutoStar(teamCode, position),
            goals_so_far: 0,
            data_source: 'api',
            last_synced: new Date().toISOString()
          });
        });
        
        console.log(`   ✅ ${team.name} (${teamCode}): ${squad.length} players`);
      } else {
        console.log(`   ⏳ ${team.name} (${teamCode}): ${squad.length} players (not finalized)`);
      }
      
      // Respect rate limit
      await new Promise(r => setTimeout(r, 7000));
      
    } catch (err) {
      if (err.message.includes('429')) {
        console.log(`   🛑 Rate limit reached after ${i + 1} teams`);
        break;
      }
      console.log(`   ⚠️  ${team.name}: ${err.message}`);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Teams with squads: ${teamsWithSquads} / ${teams.length}`);
  console.log(`   Total players: ${totalPlayersFound}\n`);
  
  const squadsReleased = teamsWithSquads >= MIN_TEAMS_WITH_SQUADS;
  const currentReleasedFlag = await getSetting('squads_released') === 'true';
  
  if (squadsReleased && !currentReleasedFlag) {
    console.log('🎉 SQUADS RELEASED! Unlocking top scorer feature...\n');
    
    if (allSquadPlayers.length > 0) {
      await callSupabase('DELETE', 'players', { query: '?id=neq.00000000-0000-0000-0000-000000000000' });
      
      for (let i = 0; i < allSquadPlayers.length; i += 50) {
        const batch = allSquadPlayers.slice(i, i + 50);
        await callSupabase('POST', 'players', { data: batch });
        console.log(`   Batch ${Math.floor(i/50) + 1}/${Math.ceil(allSquadPlayers.length/50)}`);
      }
    }
    
    await setSetting('squads_released', 'true');
    await setSetting('squads_player_count', allSquadPlayers.length);
    
    console.log(`\n✨ Feature unlocked with ${allSquadPlayers.length} players!`);
  } else if (squadsReleased && currentReleasedFlag) {
    console.log('🔄 Updating existing players...');
    
    for (let i = 0; i < allSquadPlayers.length; i += 50) {
      const batch = allSquadPlayers.slice(i, i + 50);
      await callSupabase('POST', 'players', { 
        data: batch,
        query: '?on_conflict=external_id'
      });
    }
    
    await setSetting('squads_player_count', allSquadPlayers.length);
    console.log(`✅ Updated ${allSquadPlayers.length} players`);
  } else {
    console.log('⏳ Not enough squads released yet.');
    console.log(`   Need ${MIN_TEAMS_WITH_SQUADS} teams, have ${teamsWithSquads}`);
    console.log(`   Top scorer feature remains locked.`);
  }
  
  // Try to update scorers (works only during tournament)
  try {
    const scorersData = await callFootballAPI(`/competitions/${WORLD_CUP_ID}/scorers?limit=100`);
    const scorers = scorersData.scorers || [];
    
    if (scorers.length > 0) {
      console.log(`\n⚽ Updating ${scorers.length} scorers...`);
      
      for (const scorer of scorers) {
        const goals = scorer.goals || 0;
        const playerId = String(scorer.player?.id || '');
        
        if (!playerId) continue;
        
        await callSupabase('PATCH', 'players', {
          data: { 
            goals_so_far: goals,
            is_star: goals >= 2 ? true : undefined,
            last_synced: new Date().toISOString()
          },
          query: `?external_id=eq.${playerId}`
        });
      }
      
      console.log('   ✅ Scorers updated');
    }
  } catch (err) {
    console.log(`\n⏭️  Scorers not available yet`);
  }
  
  console.log('\n═══════════════════════════════════');
  console.log('✨ Smart sync complete');
  console.log('═══════════════════════════════════');
}

smartSync()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
