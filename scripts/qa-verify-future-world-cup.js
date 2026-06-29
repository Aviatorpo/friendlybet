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
      Range: '0-9999'
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase GET ${table}${query} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function scoreMap(rows) {
  return Object.fromEntries((rows || []).map(row => [row.id, Number(row.total_score || 0)]));
}

function isTerminal(row) {
  return ['FINISHED', 'AWARDED'].includes(String(row && row.status || '').toUpperCase());
}

async function main() {
  const startedAt = new Date().toISOString();
  const seedSummary = readJson(path.join(ARTIFACT_DIR, 'qa-current-world-cup-seed-summary.json'), null)
    || readJson(path.join(ARTIFACT_DIR, 'qa-random-finished-seed-summary.json'), null);
  const simulation = readJson(path.join(ARTIFACT_DIR, 'qa-future-simulation-summary.json'), null);
  if (!simulation) throw new Error('Missing qa-future-simulation-summary.json.');

  const poolRows = await sb('pools', `?code=eq.${encodeURIComponent(FIXTURE.pool.code)}&select=*`);
  const pool = poolRows && poolRows[0];
  const users = await sb('users', `?pool_id=eq.${encodeURIComponent(FIXTURE.pool.id)}&select=id,nickname,total_score,group_points,knockout_points,bonus_points,recovery_code_hash&order=total_score.desc,joined_at.asc`);
  const dbMatches = await sb('matches', '?select=external_id,status,stage,home_team_code,away_team_code,home_score,away_score,winner_code,live_source');
  const simulatedDb = (dbMatches || []).find(m => String(m.external_id) === String(simulation.external_id));
  const leaderboardPath = path.join(PUBLIC_DATA_DIR, 'leaderboard', `${FIXTURE.pool.id}.json`);
  const leaderboard = readJson(leaderboardPath, {});
  const matchesSnapshot = readJson(path.join(PUBLIC_DATA_DIR, 'matches.json'), {});
  const pundit = readJson(path.join(PUBLIC_DATA_DIR, 'pundit.json'), {});
  const banter = readJson(path.join(PUBLIC_DATA_DIR, 'banter', `${FIXTURE.pool.id}.json`), {});
  const simulatedSnapshot = (matchesSnapshot.matches || []).find(m => String(m.external_id) === String(simulation.external_id));

  const nonTerminal = (matchesSnapshot.matches || []).filter(m => !isTerminal(m));
  const futureConcrete = nonTerminal.filter(m => m.home_team_code && m.away_team_code);
  const futurePlaceholders = nonTerminal.filter(m => !m.home_team_code || !m.away_team_code);
  const dbScores = scoreMap(users);
  const leaderboardScores = scoreMap(leaderboard.standings || []);
  const scoreMismatches = Object.entries(dbScores)
    .filter(([id, score]) => leaderboardScores[id] !== score)
    .map(([id, score]) => ({ id, db: score, leaderboard: leaderboardScores[id] }));

  const artifactBundle = { leaderboard, matchesSnapshot, pundit, banter };
  const blockers = [];
  const warnings = [];
  if (!pool) blockers.push(`QA pool ${FIXTURE.pool.code} not found`);
  if ((users || []).length !== FIXTURE.users.length) blockers.push(`expected ${FIXTURE.users.length} users, got ${(users || []).length}`);
  if (!simulatedDb) blockers.push(`simulated match ${simulation.external_id} missing from staging matches`);
  if (simulatedDb && simulatedDb.status !== 'FINISHED') blockers.push(`simulated DB match status is ${simulatedDb.status}`);
  if (simulatedDb && simulatedDb.live_source !== 'qa-future-sim') blockers.push(`simulated DB match live_source is ${simulatedDb.live_source}`);
  if (simulatedDb && String(simulatedDb.winner_code) !== String(simulation.result.winner_code)) blockers.push('simulated DB winner does not match requested winner');
  if (!simulatedSnapshot) blockers.push(`simulated match ${simulation.external_id} missing from exported matches.json`);
  if (simulatedSnapshot && simulatedSnapshot.status !== 'FINISHED') blockers.push(`simulated snapshot match status is ${simulatedSnapshot.status}`);
  const expectedSeedMatches = seedSummary && seedSummary.seeded && Number(seedSummary.seeded.matches || 0);
  if (!Array.isArray(matchesSnapshot.matches) || (expectedSeedMatches && matchesSnapshot.matches.length < expectedSeedMatches)) {
    blockers.push('matches snapshot missing seeded current WC rows');
  }
  if (!futureConcrete.length) warnings.push('no remaining concrete future rows after simulation');
  if (!futurePlaceholders.length) warnings.push('no unresolved future placeholders present; verify this is expected for the tournament phase');
  if (!leaderboard || (leaderboard.standings || []).length !== FIXTURE.users.length) blockers.push('leaderboard snapshot missing or wrong user count');
  if (scoreMismatches.length) blockers.push(`leaderboard score mismatch: ${JSON.stringify(scoreMismatches)}`);
  if (JSON.stringify(artifactBundle).includes('recovery_code_hash')) blockers.push('artifact bundle leaks recovery_code_hash');
  if (!pundit || !Array.isArray(pundit.items) || !pundit.items.length) warnings.push('pundit artifact is empty');
  if (!banter || !banter.headline) warnings.push('banter artifact is empty');

  const summary = {
    run: {
      started_at: startedAt,
      finished_at: new Date().toISOString()
    },
    mode: 'future_world_cup_simulation',
    environment: {
      name: qaMeta.env,
      supabase_url_host: new URL(qaMeta.url).host,
      project_ref: qaMeta.ref,
      is_prod: false
    },
    seed: {
      mode: seedSummary ? seedSummary.mode : 'existing_staging_state',
      source: seedSummary ? seedSummary.source : null,
      seeded: seedSummary ? seedSummary.seeded : null
    },
    simulated_match: {
      external_id: simulation.external_id,
      stage: simulation.stage,
      teams: simulation.teams,
      result: simulation.result,
      db_status: simulatedDb && simulatedDb.status,
      snapshot_status: simulatedSnapshot && simulatedSnapshot.status
    },
    db: {
      imported_matches: (dbMatches || []).length,
      terminal_matches: (dbMatches || []).filter(isTerminal).length,
      users: (users || []).length,
      top_scores: (users || []).slice(0, 10).map(u => ({
        nickname: u.nickname,
        total_score: Number(u.total_score || 0),
        group_points: Number(u.group_points || 0),
        knockout_points: Number(u.knockout_points || 0),
        bonus_points: Number(u.bonus_points || 0)
      }))
    },
    export: {
      matches_count: matchesSnapshot.count || (matchesSnapshot.matches || []).length || 0,
      future_concrete_remaining: futureConcrete.length,
      future_placeholders_remaining: futurePlaceholders.length,
      leaderboard_count: leaderboard.count || (leaderboard.standings || []).length || 0,
      leaderboard_file: path.relative(ROOT, leaderboardPath)
    },
    content: {
      pundit_items: (pundit.items || []).length,
      banter_items: (banter.items || []).length,
      banter_headline: banter.headline && banter.headline.id
    },
    privacy: {
      recovery_code_hash_absent_from_artifacts: !JSON.stringify(artifactBundle).includes('recovery_code_hash')
    },
    blockers,
    warnings
  };

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-run-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (blockers.length) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
