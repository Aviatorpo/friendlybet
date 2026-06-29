#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { assertQaSupabaseEnv } = require('./qa-env');

const qaMeta = assertQaSupabaseEnv();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DATA_DIR = process.env.PUBLIC_DATA_DIR
  ? path.resolve(ROOT, process.env.PUBLIC_DATA_DIR)
  : path.join(ROOT, '_qa-artifacts', 'public-data');
const ARTIFACT_DIR = path.resolve(PUBLIC_DATA_DIR, '..');

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find(arg => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function intValue(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 50) throw new Error(`${field} must be an integer from 0 to 50.`);
  return n;
}

function teamCode(value, field) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,4}$/.test(code)) throw new Error(`${field} must be a team code.`);
  return code;
}

function readInput() {
  const externalId = String(process.env.QA_MATCH_EXTERNAL_ID || argValue('external-id') || '').trim();
  const homeScore = intValue(process.env.QA_HOME_SCORE ?? argValue('home-score'), 'home score');
  const awayScore = intValue(process.env.QA_AWAY_SCORE ?? argValue('away-score'), 'away score');
  const winner = teamCode(process.env.QA_WINNER || argValue('winner'), 'winner');
  if (!externalId) throw new Error('Missing QA_MATCH_EXTERNAL_ID or --external-id.');
  return { externalId, homeScore, awayScore, winner };
}

async function sb(method, table, query = '', data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: data == null ? undefined : JSON.stringify(data)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${table}${query} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function isTerminal(row) {
  return ['FINISHED', 'AWARDED'].includes(String(row && row.status || '').toUpperCase());
}

function validateAgainstMatch(input, match) {
  if (!match) throw new Error(`No staging match found for external_id ${input.externalId}. Seed the current WC QA data first.`);
  if (!match.home_team_code || !match.away_team_code) {
    throw new Error(`${input.externalId} is an unresolved knockout placeholder, not a scoreable fixture yet.`);
  }
  if (![match.home_team_code, match.away_team_code].includes(input.winner)) {
    throw new Error(`Winner must be ${match.home_team_code} or ${match.away_team_code}.`);
  }
  if (input.homeScore > input.awayScore && input.winner !== match.home_team_code) {
    throw new Error(`Winner must be ${match.home_team_code} for ${input.homeScore}-${input.awayScore}.`);
  }
  if (input.awayScore > input.homeScore && input.winner !== match.away_team_code) {
    throw new Error(`Winner must be ${match.away_team_code} for ${input.homeScore}-${input.awayScore}.`);
  }
  if (input.homeScore === input.awayScore && String(match.stage || '').toUpperCase() === 'GROUP_STAGE') {
    throw new Error('Group-stage draws must not have a winner. This QA future simulator is intended for knockout fixtures.');
  }
}

async function main() {
  const input = readInput();
  const rows = await sb(
    'GET',
    'matches',
    `?external_id=eq.${encodeURIComponent(input.externalId)}&select=*`
  );
  if (!Array.isArray(rows) || rows.length > 1) {
    throw new Error(`Expected one staging match for ${input.externalId}, got ${Array.isArray(rows) ? rows.length : 'non-array'}.`);
  }
  const before = rows[0];
  validateAgainstMatch(input, before);
  const now = new Date().toISOString();
  const updatedRows = await sb('PATCH', 'matches', `?external_id=eq.${encodeURIComponent(input.externalId)}&select=*`, {
    home_score: input.homeScore,
    away_score: input.awayScore,
    status: 'FINISHED',
    winner_code: input.winner,
    live_clock: null,
    live_period: null,
    status_detail: 'FT',
    live_source: 'qa-future-sim',
    source_updated_at: now,
    last_updated: now
  });
  const after = updatedRows && updatedRows[0];
  if (!after || !isTerminal(after)) throw new Error(`Failed to mark ${input.externalId} as finished.`);

  const summary = {
    mode: 'future_result_simulation',
    environment: {
      name: qaMeta.env,
      project_ref: qaMeta.ref,
      supabase_url_host: new URL(qaMeta.url).host,
      is_prod: false
    },
    simulated_at: now,
    external_id: after.external_id,
    stage: after.stage,
    teams: `${after.home_team_code}-${after.away_team_code}`,
    previous_status: before.status,
    result: {
      home_score: after.home_score,
      away_score: after.away_score,
      winner_code: after.winner_code
    }
  };
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-future-simulation-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
