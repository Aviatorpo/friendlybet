#!/usr/bin/env node
/*
 * Apply reviewed match results to Supabase.
 *
 * Env:
 *   SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *   MANUAL_MATCH_RESULTS_JSON
 *
 * JSON shape:
 * [
 *   { "home": "ENG", "away": "CRO", "home_score": 4, "away_score": 2, "winner": "ENG" }
 * ]
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const RAW = process.env.MANUAL_MATCH_RESULTS_JSON;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SECRET_KEY');
  process.exit(1);
}
if (!RAW) {
  console.error('Missing MANUAL_MATCH_RESULTS_JSON');
  process.exit(1);
}

let results;
try {
  results = JSON.parse(RAW);
} catch (err) {
  try {
    const normalizedRaw = RAW
      .replace(/([{,])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/:\s*([A-Z0-9]{2,4})(?=\s*[,}])/g, ':"$1"');
    results = JSON.parse(normalizedRaw);
  } catch (looseErr) {
    console.error('MANUAL_MATCH_RESULTS_JSON is not valid JSON:', err.message);
    process.exit(1);
  }
}

if (!Array.isArray(results) || !results.length) {
  console.error('MANUAL_MATCH_RESULTS_JSON must be a non-empty array');
  process.exit(1);
}

function teamCode(value, field) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,4}$/.test(code)) throw new Error(`Invalid ${field}: ${value}`);
  return code;
}

function score(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 50) throw new Error(`Invalid ${field}: ${value}`);
  return n;
}

function normalize(item) {
  const home = teamCode(item.home, 'home');
  const away = teamCode(item.away, 'away');
  const homeScore = score(item.home_score, 'home_score');
  const awayScore = score(item.away_score, 'away_score');
  const winner = item.winner == null || item.winner === ''
    ? null
    : teamCode(item.winner, 'winner');
  if (homeScore > awayScore && winner !== home) throw new Error(`${home}-${away}: winner must be ${home}`);
  if (awayScore > homeScore && winner !== away) throw new Error(`${home}-${away}: winner must be ${away}`);
  if (homeScore === awayScore && winner !== null) throw new Error(`${home}-${away}: tied match winner must be null`);
  return { home, away, homeScore, awayScore, winner };
}

async function sb(method, table, query, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: data ? JSON.stringify(data) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${table} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  const normalized = results.map(normalize);
  const now = new Date().toISOString();
  for (const item of normalized) {
    const query = [
      `?home_team_code=eq.${encodeURIComponent(item.home)}`,
      `&away_team_code=eq.${encodeURIComponent(item.away)}`,
      '&stage=eq.GROUP_STAGE',
      '&select=id,home_team_code,away_team_code,home_score,away_score,status,winner_code'
    ].join('');
    const rows = await sb('PATCH', 'matches', query, {
      home_score: item.homeScore,
      away_score: item.awayScore,
      status: 'FINISHED',
      winner_code: item.winner,
      last_updated: now,
      live_clock: null,
      live_period: null,
      status_detail: 'FT',
      live_source: 'manual',
      source_updated_at: now
    });
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error(`${item.home}-${item.away}: expected one updated row, got ${Array.isArray(rows) ? rows.length : 'non-array'}`);
    }
    const row = rows[0];
    console.log(`${row.home_team_code}-${row.away_team_code}: ${row.home_score}-${row.away_score}, status=${row.status}, winner=${row.winner_code || 'DRAW'}`);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
