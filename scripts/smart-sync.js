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
const ALLOW_RETIRED_FOOTBALL_DATA_SYNC = process.env.ALLOW_RETIRED_FOOTBALL_DATA_SYNC === '1';

if (!SUPABASE_KEY && require.main === module) {
  console.error('Missing SUPABASE_SECRET_KEY environment variable');
  process.exit(1);
}

// ===== Helpers =====

const { fbGuardDelete } = require('./lib-guard');
async function callSupabase(method, table, data = null, query = '') {
  fbGuardDelete(method, table);  // never let a sync job DELETE user-data tables
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

// Resilient football-data call: 20s timeout per try, retries on network errors,
// 429 (rate limit) and 5xx with backoff (honoring Retry-After). Fails fast on
// other 4xx (e.g. 403 bad token) - retrying those is pointless.
async function callFootballAPI(endpoint) {
  const url = `${FOOTBALL_API_BASE}${endpoint}`;
  const MAX = 4;
  for (let attempt = 1; ; attempt++) {
    let response = null, networkErr = null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      response = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_TOKEN }, signal: ctrl.signal });
    } catch (e) {
      networkErr = e;
    } finally {
      clearTimeout(timer);
    }
    if (response && response.ok) {
      const avail = parseInt(response.headers.get('X-Requests-Available-Minute') || '', 10);
      if (!isNaN(avail)) {
        console.log(`📈 football-data: ${avail} req/min remaining`);
        if (avail <= 2) console.warn('⚠️  football-data rate limit nearly exhausted');
      }
      return await response.json();
    }

    const status = response ? response.status : 0;
    const retryable = !!networkErr || status === 429 || status >= 500;
    if (!retryable) {
      const text = await response.text();
      throw new Error(`API request failed: ${status} - ${text}`);
    }
    if (attempt >= MAX) {
      throw new Error(`API request failed after ${MAX} attempts: ${networkErr ? networkErr.message : 'HTTP ' + status}`);
    }
    const retryAfter = response ? parseInt(response.headers.get('Retry-After') || '', 10) : 0;
    const waitMs = (retryAfter > 0 ? retryAfter : attempt * 5) * 1000;
    console.warn(`⚠️  football-data ${networkErr ? networkErr.name : 'HTTP ' + status} - retry ${attempt}/${MAX} in ${waitMs}ms`);
    await new Promise(r => setTimeout(r, waitMs));
  }
}

// ===== Smart Decision Logic =====

// Statuses that are final - a match in one of these will never change again,
// so it never needs another sync.
const TERMINAL_STATUSES = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);

async function shouldSync() {
  shouldSync.lastReason = 'unknown';
  console.log('🧠 Smart sync: checking if sync is needed...');

  const now = new Date();
  // A match needs syncing for its WHOLE duration, not just around kickoff.
  // match_date is the fixed scheduled kickoff, so a live match's match_date sits
  // in the past. We therefore look back far enough to cover a full match incl.
  // extra time + penalties + stoppages + delays (~4h), and 15 min into the
  // future to pre-warm matches about to start. (The previous +/-15min window
  // only caught the first ~15 min after kickoff, so live scores froze mid-match.)
  const windowStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 15 * 60 * 1000);

  console.log(`📅 Now: ${now.toISOString()} | window ${windowStart.toISOString()} .. ${windowEnd.toISOString()}`);

  const query = `?select=external_id,status,match_date,home_team_code,away_team_code` +
                `&match_date=gte.${windowStart.toISOString()}&match_date=lte.${windowEnd.toISOString()}`;

  try {
    const matches = await callSupabase('GET', 'matches', null, query);

    if (!matches || matches.length === 0) {
      console.log('⏭️  No matches in the live window - skipping sync');
      shouldSync.lastReason = 'no_matches';
      return false;
    }

    // Anything not yet in a terminal status is worth a sync: it may be about to
    // start, in play, or just finished but not yet recorded as FINISHED here
    // (we need one more sync to capture the final score / winner_code).
    const active = matches.filter(m => !TERMINAL_STATUSES.has(m.status));

    if (active.length === 0) {
      console.log(`⏭️  ${matches.length} match(es) in window, all finished - skipping sync`);
      shouldSync.lastReason = 'all_finished';
      return false;
    }

    console.log(`🔴 ${active.length} active match(es) in window - SYNC NEEDED`);
    active.forEach(m => {
      const mins = Math.round((new Date(m.match_date) - now) / 60000);
      console.log(`   - ${m.home_team_code} vs ${m.away_team_code} (${m.status}, kickoff ${mins >= 0 ? 'in ' + mins : Math.abs(mins) + ' min ago'})`);
    });
    shouldSync.lastReason = 'active';
    return true;

  } catch (err) {
    console.error('⚠️  Error checking schedule:', err.message);
    // On error, sync anyway to be safe (never miss a live match because the
    // schedule probe blipped).
    console.log('🔄 Syncing anyway to be safe');
    shouldSync.lastReason = 'probe_error';
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
  'Scotland': 'SCO', 'Curaçao': 'CUR', 'Ecuador': 'ECU', 'Colombia': 'COL',
  // Common provider name variants (football-data / FIFA / broadcasters) so a
  // real team in a live/finished match is never silently dropped (see below).
  'Côte d\'Ivoire': 'CIV', 'Cote d\'Ivoire': 'CIV',
  'DR Congo': 'COD', 'Congo': 'COD',
  'United States of America': 'USA', 'USA': 'USA', 'United States of America (USA)': 'USA',
  'Czech Republic': 'CZE', 'Bosnia and Herzegovina': 'BIH',
  'Cape Verde': 'CPV', 'Cabo Verde': 'CPV',
};

// Normalize a provider name for fuzzy matching: strip diacritics, lowercase,
// collapse whitespace. Lets "Curacao" match "Curaçao", "Cote d'Ivoire" match
// "Côte d'Ivoire", etc., without enumerating every accent variant.
function normalizeName(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[‘’ʼ`´]/g, "'") // curly/back apostrophes → straight (Côte d'Ivoire variants)
          .toLowerCase().replace(/\s+/g, ' ').trim();
}
const TEAM_NAME_NORM = Object.create(null);
for (const [name, code] of Object.entries(TEAM_NAME_TO_CODE)) {
  TEAM_NAME_NORM[normalizeName(name)] = code;
}

function getTeamCode(teamName) {
  if (!teamName) return null;
  return TEAM_NAME_TO_CODE[teamName] || TEAM_NAME_NORM[normalizeName(teamName)] || null;
}

// A real, named team (not a knockout TBD placeholder). football-data leaves
// homeTeam/awayTeam name null/"TBD" until the bracket is drawn.
function isRealTeamName(n) {
  return !!n && !/^(tbd|to be determined|winner |runner|loser )/i.test(String(n).trim());
}
// Statuses that mean the match is live or done — an unmapped team here is a
// SCORING-CRITICAL bug (we'd miss real results), so we fail the run.
// AWARDED = forfeit/walkover result; SUSPENDED = match halted — both are
// scoring-relevant, so an unmapped real team in any of these must fail loudly.
const LIVE_OR_FINAL_STATUS = new Set(['IN_PLAY', 'PAUSED', 'FINISHED', 'LIVE', 'started', 'finished', 'AWARDED', 'SUSPENDED']);

// Probe for matches.winner_code (migration applied manually); only write it
// once it exists, else the upsert would 400.
async function matchesHasWinnerCol() {
  try {
    await callSupabase('GET', 'matches', null, '?select=winner_code&limit=1');
    return true;
  } catch (e) {
    return false;
  }
}

// Resolve football-data score.winner (accounts for ET / penalties) to our code.
function resolveWinnerCode(m, homeCode, awayCode) {
  const w = m.score && m.score.winner;
  if (w === 'HOME_TEAM') return homeCode;
  if (w === 'AWAY_TEAM') return awayCode;
  return null;
}

// ===== Sync Logic =====

function assertRetiredFootballDataSyncAllowed() {
  if (!ALLOW_RETIRED_FOOTBALL_DATA_SYNC) {
    throw new Error('Retired football-data match sync is disabled. Use the FIFA schedule bridge plus final-result verifier; set ALLOW_RETIRED_FOOTBALL_DATA_SYNC=1 only for isolated legacy tests.');
  }
  if (!FOOTBALL_TOKEN) throw new Error('Missing FOOTBALL_DATA_TOKEN');
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY');
}

async function performSync() {
  assertRetiredFootballDataSyncAllowed();
  console.log('🚀 Performing sync...');
  
  const data = await callFootballAPI(`/competitions/${WORLD_CUP_ID}/matches`);
  
  if (!data.matches || data.matches.length === 0) {
    console.log('⚠️  No matches found in API');
    return 0;
  }
  
  console.log(`✅ Got ${data.matches.length} matches from API`);
  
  const hasWinnerCol = await matchesHasWinnerCol();

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
  
  const validMatches = transformedMatches.filter(m => m.home_team_code && m.away_team_code);

  // Distinguish genuine TBD knockout placeholders (no real team name yet — safe
  // to skip) from a REAL team whose name we failed to map (a scoring bug). A
  // real unmapped team in a LIVE/FINISHED match fails the run loudly so the
  // workflow goes red (GitHub emails the owner) instead of silently dropping a
  // result. v2.9.14: previously all skips were logged as "likely TBD".
  const unmappedReal = [];
  data.matches.forEach((m, i) => {
    const t = transformedMatches[i];
    if (!t.home_team_code && isRealTeamName(m.homeTeam?.name)) {
      unmappedReal.push({ id: t.external_id, status: t.status, name: m.homeTeam.name });
    }
    if (!t.away_team_code && isRealTeamName(m.awayTeam?.name)) {
      unmappedReal.push({ id: t.external_id, status: t.status, name: m.awayTeam.name });
    }
  });
  const tbdSkipped = (transformedMatches.length - validMatches.length) - unmappedReal.length;
  if (tbdSkipped > 0) console.log(`⏭️  Skipped ${tbdSkipped} TBD/placeholder matches (no team drawn yet)`);

  if (unmappedReal.length > 0) {
    const names = [...new Set(unmappedReal.map(u => u.name))];
    console.warn(`⚠️  ${unmappedReal.length} REAL team name(s) not in TEAM_NAME_TO_CODE: ${names.join(', ')}`);
    const critical = unmappedReal.filter(u => LIVE_OR_FINAL_STATUS.has(u.status));
    if (critical.length > 0) {
      const cNames = [...new Set(critical.map(c => c.name))].join(', ');
      const cIds = [...new Set(critical.map(c => c.id))].join(', ');
      throw new Error(`Unmapped team in LIVE/FINISHED match — add to TEAM_NAME_TO_CODE: "${cNames}" (match id ${cIds})`);
    }
    console.warn('   (all scheduled, not yet live — add the alias before kickoff to be safe)');
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
    assertRetiredFootballDataSyncAllowed();
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

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('💥 Unhandled error:', err);
      process.exit(1);
    });
} else {
  module.exports = { shouldSync, performSync, getTeamCode, resolveWinnerCode, TERMINAL_STATUSES,
    isRealTeamName, normalizeName, LIVE_OR_FINAL_STATUS,
    __setFetch: (fn) => { globalThis.fetch = fn; } };
}
