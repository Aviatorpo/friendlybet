#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { assertQaSupabaseEnv } = require('./qa-env');
const FIXTURE = require('./qa-staging-fixture');

const qaMeta = assertQaSupabaseEnv();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DATA_DIR = process.env.PUBLIC_DATA_DIR
  ? path.resolve(ROOT, process.env.PUBLIC_DATA_DIR)
  : path.join(ROOT, '_qa-artifacts', 'public-data');
const ARTIFACT_DIR = path.resolve(PUBLIC_DATA_DIR, '..');

async function sb(table, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Range: '0-999'
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase GET ${table} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function userScoreMap(rows) {
  return Object.fromEntries((rows || []).map(u => [u.id, Number(u.total_score || 0)]));
}

async function main() {
  const startedAt = new Date().toISOString();
  const poolRows = await sb('pools', `?code=eq.${encodeURIComponent(FIXTURE.pool.code)}&select=*`);
  const pool = poolRows && poolRows[0];
  if (!pool) throw new Error(`QA pool ${FIXTURE.pool.code} not found.`);

  const users = await sb('users', `?pool_id=eq.${encodeURIComponent(FIXTURE.pool.id)}&select=id,nickname,total_score,group_points,knockout_points,bonus_points,recovery_code_hash&order=joined_at.asc`);
  const matchRows = await sb('matches', `?external_id=eq.${encodeURIComponent(FIXTURE.match.external_id)}&select=*`);
  const match = matchRows && matchRows[0];
  if (!match) throw new Error(`QA match ${FIXTURE.match.external_id} not found.`);
  const sentinelRows = await sb('app_settings', '?key=eq.qa_staging_sentinel&select=key,value');
  const sentinel = sentinelRows && sentinelRows[0];

  const leaderboardPath = path.join(PUBLIC_DATA_DIR, 'leaderboard', `${FIXTURE.pool.id}.json`);
  const matchesSnapshot = readJson(path.join(PUBLIC_DATA_DIR, 'matches.json'), {});
  const leaderboard = readJson(leaderboardPath, {});
  const pundit = readJson(path.join(PUBLIC_DATA_DIR, 'pundit.json'), {});
  const banter = readJson(path.join(PUBLIC_DATA_DIR, 'banter', `${FIXTURE.pool.id}.json`), {});

  const r32Points = Number((pool.scoring_rules && pool.scoring_rules.round_of_32) || FIXTURE.pool.scoring_rules.round_of_32 || 0);
  const expectedScores = Object.fromEntries(FIXTURE.users.map(u => [
    u.id,
    match.winner_code && u.pick === match.winner_code ? r32Points : 0
  ]));
  const actualScores = userScoreMap(users);
  const scoreMismatches = Object.entries(expectedScores)
    .filter(([id, expected]) => actualScores[id] !== expected)
    .map(([id, expected]) => ({ id, expected, actual: actualScores[id] }));

  const leaderboardScores = userScoreMap(leaderboard.standings || []);
  const leaderboardMismatches = Object.entries(expectedScores)
    .filter(([id, expected]) => leaderboardScores[id] !== expected)
    .map(([id, expected]) => ({ id, expected, actual: leaderboardScores[id] }));

  const blocker_errors = [];
  const warnings = [];
  if (match.status !== 'FINISHED') blocker_errors.push(`match status is ${match.status}, expected FINISHED`);
  if (!Number.isInteger(Number(match.home_score)) || !Number.isInteger(Number(match.away_score))) {
    blocker_errors.push(`match score is not numeric: ${match.home_score}-${match.away_score}`);
  }
  if (![FIXTURE.match.home_team_code, FIXTURE.match.away_team_code].includes(match.winner_code)) {
    blocker_errors.push(`winner_code is ${match.winner_code}, expected one of ${FIXTURE.match.home_team_code}/${FIXTURE.match.away_team_code}`);
  }
  if (!sentinel || sentinel.value !== FIXTURE.seedVersion) blocker_errors.push('QA sentinel missing or incorrect');
  if (scoreMismatches.length) blocker_errors.push(`DB score mismatch: ${JSON.stringify(scoreMismatches)}`);
  if (leaderboardMismatches.length) blocker_errors.push(`leaderboard snapshot mismatch: ${JSON.stringify(leaderboardMismatches)}`);
  if (!Array.isArray(matchesSnapshot.matches) || !matchesSnapshot.matches.some(m => m.external_id === FIXTURE.match.external_id && m.status === 'FINISHED')) {
    blocker_errors.push('matches snapshot does not include the finished QA match');
  }
  if (JSON.stringify(leaderboard).includes('recovery_code_hash')) {
    blocker_errors.push('leaderboard snapshot leaks recovery_code_hash');
  }
  if (!pundit || !Array.isArray(pundit.items) || !pundit.items.length) warnings.push('pundit artifact is empty or missing');
  if (!banter || !banter.headline) warnings.push('banter artifact is empty or missing');

  const summary = {
    run: {
      workflow_name: process.env.GITHUB_WORKFLOW || null,
      run_id: process.env.GITHUB_RUN_ID || null,
      branch: process.env.GITHUB_REF_NAME || null,
      sha: process.env.GITHUB_SHA || null,
      actor: process.env.GITHUB_ACTOR || null,
      started_at: startedAt,
      finished_at: new Date().toISOString()
    },
    environment: {
      name: qaMeta.env,
      supabase_url_host: new URL(qaMeta.url).host,
      project_ref: qaMeta.ref,
      is_prod: false,
      sentinel_ok: !!sentinel && sentinel.value === FIXTURE.seedVersion,
      guard_version: 'qa-env-v1'
    },
    seed_reset: readJson(path.join(ARTIFACT_DIR, 'qa-seed-summary.json'), null),
    fake_result: {
      external_id: match.external_id,
      stage: match.stage,
      status: match.status,
      score: `${match.home_score}-${match.away_score}`,
      winner_code: match.winner_code,
      live_source: match.live_source
    },
    scoring: {
      expected_scores: expectedScores,
      actual_scores: actualScores,
      score_mismatches: scoreMismatches
    },
    export: {
      matches_count: matchesSnapshot.count || (matchesSnapshot.matches || []).length || 0,
      matches_updated_at: matchesSnapshot.updatedAt || null,
      leaderboard_file: path.relative(ROOT, leaderboardPath),
      leaderboard_count: leaderboard.count || (leaderboard.standings || []).length || 0
    },
    pundit: {
      updated_at: pundit.updatedAt || null,
      item_ids: (pundit.items || []).map(i => i.id),
      item_types: (pundit.items || []).map(i => i.type),
      warnings
    },
    banter: {
      headline_id: banter.headline && banter.headline.id,
      item_ids: (banter.items || []).map(i => i.id)
    },
    privacy: {
      recovery_code_hash_absent_from_artifacts: !JSON.stringify({ leaderboard, matchesSnapshot, pundit, banter }).includes('recovery_code_hash'),
      synthetic_user_count: Array.isArray(users) ? users.length : 0
    },
    blockers: blocker_errors,
    warnings
  };

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-run-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (blocker_errors.length) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
