// ============================================================
// football-data.org API health diagnostic
// ============================================================
// Probes the live API and verifies the match-sync mechanism end to end:
//   1. rate-limit headroom (so we know how close we run to the free-tier cap)
//   2. EVERY team name the API returns maps to a 3-letter code in our sync map
//      (an unmapped name is silently dropped -> the Ecuador/Colombia bug class)
//   3. status + stage value distribution (so the smart-sync TERMINAL/live sets
//      and the frontend live-status set actually match what the API emits)
//   4. a sample score object (winner / duration / penalties) for the penalty fix
// Exits non-zero if any API team name is unmapped (so it can gate/alert).
// Run in CI: needs FOOTBALL_DATA_TOKEN. Local: node scripts/diag-football-api.js
// ============================================================

const fs = require('fs');
const path = require('path');

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const WC = 'WC';
const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!TOKEN) { console.error('Missing FOOTBALL_DATA_TOKEN'); process.exit(1); }

// Parse the canonical name->code map straight out of sync-matches.js so this
// checks the REAL map the sync uses.
function loadNameMap() {
  const src = fs.readFileSync(path.join(__dirname, 'sync-matches.js'), 'utf8');
  const block = src.slice(src.indexOf('TEAM_NAME_TO_CODE'), src.indexOf('};', src.indexOf('TEAM_NAME_TO_CODE')) + 2);
  const map = {};
  block.replace(/'([^']+)':\s*'([A-Z]{3})'/g, (_, name, code) => { map[name] = code; return _; });
  return map;
}

async function api(endpoint) {
  const res = await fetch(`${FOOTBALL_API_BASE}${endpoint}`, { headers: { 'X-Auth-Token': TOKEN } });
  const headers = {};
  res.headers.forEach((v, k) => { if (/request|x-auth|retry|counter/i.test(k)) headers[k] = v; });
  if (!res.ok) {
    console.error(`HTTP ${res.status} on ${endpoint}:`, await res.text());
    console.error('rate/headers:', headers);
    process.exit(1);
  }
  return { data: await res.json(), headers };
}

(async () => {
  const nameMap = loadNameMap();
  console.log(`name->code map has ${Object.keys(nameMap).length} entries\n`);

  const { data, headers } = await api(`/competitions/${WC}/matches`);
  console.log('=== rate-limit / response headers ===');
  console.log(JSON.stringify(headers, null, 2));

  const matches = data.matches || [];
  console.log(`\n=== matches: ${matches.length} ===`);

  // status + stage distribution
  const statusDist = {}, stageDist = {};
  matches.forEach(m => { statusDist[m.status] = (statusDist[m.status] || 0) + 1; stageDist[m.stage] = (stageDist[m.stage] || 0) + 1; });
  console.log('status distribution:', JSON.stringify(statusDist));
  console.log('stage  distribution:', JSON.stringify(stageDist));

  // team-name coverage (the critical silent-drop check)
  const names = new Set();
  matches.forEach(m => { if (m.homeTeam && m.homeTeam.name) names.add(m.homeTeam.name); if (m.awayTeam && m.awayTeam.name) names.add(m.awayTeam.name); });
  // also pull the teams endpoint for the authoritative squad names
  try {
    const t = await api(`/competitions/${WC}/teams`);
    (t.data.teams || []).forEach(tm => { if (tm.name) names.add(tm.name); });
  } catch (e) { console.warn('teams endpoint failed:', e.message); }

  // football-data uses "TBD"/placeholder names for undecided knockout slots; ignore those
  const placeholder = (n) => /tbd|winner|runner|loser|group|place|\//i.test(n);
  const real = [...names].filter(n => !placeholder(n));
  const unmapped = real.filter(n => !nameMap[n]);

  console.log(`\n=== team-name coverage: ${real.length} real names seen ===`);
  if (unmapped.length) {
    console.error('🔴 UNMAPPED NAMES (these matches are SILENTLY DROPPED):');
    unmapped.forEach(n => console.error(`   "${n}"`));
  } else {
    console.log('✅ every API team name maps to a code');
  }

  // sample score object (for the penalty/winner fix)
  const withScore = matches.find(m => m.score && (m.score.winner || m.score.duration));
  console.log('\n=== sample score object ===');
  console.log(JSON.stringify(withScore ? withScore.score : '(no scored matches yet - pre-tournament)', null, 2));

  console.log(`\n==== diagnostic done. unmapped=${unmapped.length} ====`);
  process.exit(unmapped.length ? 1 : 0);
})().catch(e => { console.error('fatal:', e); process.exit(1); });
