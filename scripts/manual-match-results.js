#!/usr/bin/env node
/*
 * Break-glass match-result repair for system incidents.
 *
 * This is not the normal match-truth path. Ordinary results must be resolved by
 * final-result-verifier.js from FIFA/approved automated source-family consensus.
 *
 * Env:
 *   SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *   MANUAL_MATCH_RESULTS_JSON
 *
 * JSON shape:
 * [
 *   { "home": "ENG", "away": "CRO", "home_score": 4, "away_score": 2, "winner": "ENG" }
 *   { "home": "RSA", "away": "CAN", "home_score": 0, "away_score": 1, "winner": "CAN",
 *     "stage": "ROUND_OF_32", "external_id": "400021518", "match_date": "2026-06-28T19:00:00Z" }
 * ]
 */

const { assertQaIfRequested, isQaTarget } = require('./qa-env');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const RAW = process.env.MANUAL_MATCH_RESULTS_JSON;

assertQaIfRequested();

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

function stage(value) {
  const code = String(value || 'GROUP_STAGE').trim().toUpperCase();
  const allowed = new Set([
    'GROUP_STAGE',
    'ROUND_OF_32',
    'LAST_32',
    'R32',
    'ROUND_OF_16',
    'LAST_16',
    'R16',
    'QUARTER_FINALS',
    'QF',
    'SEMI_FINALS',
    'SF',
    'FINAL',
    'THIRD_PLACE'
  ]);
  if (!allowed.has(code)) throw new Error(`Invalid stage: ${value}`);
  return code;
}

function optionalIsoDate(value, field) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${field}: ${value}`);
  return date.toISOString();
}

function normalize(item) {
  const home = teamCode(item.home, 'home');
  const away = teamCode(item.away, 'away');
  const homeScore = score(item.home_score, 'home_score');
  const awayScore = score(item.away_score, 'away_score');
  const normalizedStage = stage(item.stage);
  const winner = item.winner == null || item.winner === ''
    ? null
    : teamCode(item.winner, 'winner');
  if (winner && winner !== home && winner !== away) throw new Error(`${home}-${away}: winner must be ${home} or ${away}`);
  if (homeScore > awayScore && winner !== home) throw new Error(`${home}-${away}: winner must be ${home}`);
  if (awayScore > homeScore && winner !== away) throw new Error(`${home}-${away}: winner must be ${away}`);
  if (homeScore === awayScore && winner !== null && normalizedStage === 'GROUP_STAGE') {
    throw new Error(`${home}-${away}: tied group-stage match winner must be null`);
  }
  return {
    home,
    away,
    homeScore,
    awayScore,
    winner,
    stage: normalizedStage,
    externalId: item.external_id == null || item.external_id === '' ? null : String(item.external_id).trim(),
    matchDate: optionalIsoDate(item.match_date, 'match_date'),
    venue: item.venue == null || item.venue === '' ? null : String(item.venue).trim()
  };
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
    const query = item.externalId ? [
      `?external_id=eq.${encodeURIComponent(item.externalId)}`,
      '&select=id,external_id,stage,home_team_code,away_team_code,home_score,away_score,status,winner_code'
    ].join('') : [
      `?home_team_code=eq.${encodeURIComponent(item.home)}`,
      `&away_team_code=eq.${encodeURIComponent(item.away)}`,
      `&stage=eq.${encodeURIComponent(item.stage)}`,
      '&select=id,external_id,stage,home_team_code,away_team_code,home_score,away_score,status,winner_code'
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
      live_source: isQaTarget() ? 'qa-break-glass' : 'break-glass',
      source_updated_at: now
    });
    if (!Array.isArray(rows)) {
      throw new Error(`${item.home}-${item.away}: expected updated rows array, got non-array`);
    }
    if (rows.length > 1) {
      throw new Error(`${item.home}-${item.away}: expected at most one updated row, got ${rows.length}`);
    }
    let row = rows[0];
    if (!row) {
      if (!item.externalId || !item.matchDate) {
        throw new Error(`${item.home}-${item.away}: no existing row; external_id and match_date are required for insert`);
      }
      const inserted = await sb('POST', 'matches', '', [{
        external_id: item.externalId,
        stage: item.stage,
        group_letter: null,
        home_team_code: item.home,
        away_team_code: item.away,
        home_score: item.homeScore,
        away_score: item.awayScore,
        status: 'FINISHED',
        match_date: item.matchDate,
        venue: item.venue,
        winner_code: item.winner,
        scorers: [],
        live_clock: null,
        live_period: null,
        status_detail: 'FT',
        live_source: isQaTarget() ? 'qa-break-glass' : 'break-glass',
        source_updated_at: now,
        last_updated: now
      }]);
      if (!Array.isArray(inserted) || inserted.length !== 1) {
        throw new Error(`${item.home}-${item.away}: expected one inserted row, got ${Array.isArray(inserted) ? inserted.length : 'non-array'}`);
      }
      row = inserted[0];
    }
    console.log(`${row.stage} ${row.home_team_code}-${row.away_team_code}: ${row.home_score}-${row.away_score}, status=${row.status}, winner=${row.winner_code || 'DRAW'}`);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
