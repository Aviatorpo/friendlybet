#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assertQaSupabaseEnv } = require('./qa-env');
const FIXTURE = require('./qa-staging-fixture');

const qaMeta = assertQaSupabaseEnv();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DATA_DIR = process.env.PUBLIC_DATA_DIR
  ? path.resolve(ROOT, process.env.PUBLIC_DATA_DIR)
  : path.join(ROOT, '_qa-artifacts', 'public-data');

function hashRecoveryCode(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function iso(value) {
  return new Date(value).toISOString();
}

function matchDate() {
  return iso(process.env.QA_MATCH_DATE || (Date.now() - 60 * 60 * 1000));
}

async function sb(method, table, query = '', data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates'
    },
    body: data == null ? undefined : JSON.stringify(data)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${table} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function count(table, query) {
  const rows = await sb('GET', table, `${query}&select=id`);
  return Array.isArray(rows) ? rows.length : 0;
}

async function reset() {
  const rowsBefore = {
    pools: await count('pools', `?code=eq.${encodeURIComponent(FIXTURE.pool.code)}`),
    matches: await count('matches', `?external_id=eq.${encodeURIComponent(FIXTURE.match.external_id)}`)
  };

  await sb('DELETE', 'pools', `?code=eq.${encodeURIComponent(FIXTURE.pool.code)}`);
  await sb('DELETE', 'matches', `?external_id=eq.${encodeURIComponent(FIXTURE.match.external_id)}`);

  await sb('POST', 'teams?on_conflict=code', '', FIXTURE.teams);

  const now = new Date().toISOString();
  const poolRows = await sb('POST', 'pools?on_conflict=id', '', [{
    id: FIXTURE.pool.id,
    code: FIXTURE.pool.code,
    name: FIXTURE.pool.name,
    language: FIXTURE.pool.language,
    tournament: FIXTURE.pool.tournament,
    status: FIXTURE.pool.status,
    betting_mode: FIXTURE.pool.betting_mode,
    scoring_rules: FIXTURE.pool.scoring_rules,
    use_multipliers: FIXTURE.pool.use_multipliers,
    is_locked: true,
    locked_at: now
  }]);
  if (!Array.isArray(poolRows) || poolRows.length !== 1) throw new Error('Expected one seeded pool row.');

  const users = FIXTURE.users.map((user, idx) => ({
    id: user.id,
    pool_id: FIXTURE.pool.id,
    nickname: user.nickname,
    recovery_code_hash: hashRecoveryCode(user.recovery_code),
    is_admin: user.is_admin,
    is_approved: true,
    approval_status: 'approved',
    approved_at: now,
    predictions_submitted_at: now,
    joined_at: iso(Date.parse(now) + idx * 1000),
    total_score: 0,
    group_points: 0,
    knockout_points: 0,
    bonus_points: 0,
    groups_score: 0,
    knockout_score: 0,
    bonus_score: 0,
    predictions_locked: true
  }));
  await sb('POST', 'users?on_conflict=id', '', users);
  await sb('PATCH', 'pools', `?id=eq.${encodeURIComponent(FIXTURE.pool.id)}`, {
    admin_user_id: FIXTURE.users.find(u => u.is_admin).id
  });

  await sb('POST', 'matches?on_conflict=id', '', [{
    id: FIXTURE.match.id,
    external_id: FIXTURE.match.external_id,
    stage: FIXTURE.match.stage,
    group_letter: null,
    home_team_code: FIXTURE.match.home_team_code,
    away_team_code: FIXTURE.match.away_team_code,
    home_team_name: FIXTURE.match.home_team_name,
    away_team_name: FIXTURE.match.away_team_name,
    home_score: null,
    away_score: null,
    status: 'TIMED',
    match_date: matchDate(),
    venue: FIXTURE.match.venue,
    winner_code: null,
    scorers: [],
    live_clock: null,
    live_period: null,
    status_detail: null,
    live_source: 'qa-seed',
    source_updated_at: now,
    last_updated: now
  }]);

  try {
    await sb('POST', 'app_settings?on_conflict=key', '', [{
      key: 'qa_staging_sentinel',
      value: FIXTURE.seedVersion
    }]);
  } catch (err) {
    throw new Error(`Unable to write QA sentinel to app_settings: ${err.message}`);
  }

  const picks = FIXTURE.users.map(user => ({
    pool_id: FIXTURE.pool.id,
    user_id: user.id,
    match_id: null,
    round: 'ROUND_OF_32',
    predicted_winner: user.pick,
    bracket_position: 1,
    multiplier_applied: 1
  }));
  await sb('POST', 'knockout_picks', '', picks);

  fs.mkdirSync(path.join(PUBLIC_DATA_DIR, 'banter'), { recursive: true });
  const previousStandings = [
    { id: FIXTURE.users[1].id, nickname: FIXTURE.users[1].nickname, total_score: 4 },
    { id: FIXTURE.users[0].id, nickname: FIXTURE.users[0].nickname, total_score: 1 },
    { id: FIXTURE.users[2].id, nickname: FIXTURE.users[2].nickname, total_score: 0 }
  ];
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, 'banter-state.json'), JSON.stringify({
    updatedAt: now,
    pools: {
      [FIXTURE.pool.id]: { standings: previousStandings }
    },
    seenFinishedIds: []
  }));

  const rowsAfter = {
    pools: await count('pools', `?code=eq.${encodeURIComponent(FIXTURE.pool.code)}`),
    users: await count('users', `?pool_id=eq.${encodeURIComponent(FIXTURE.pool.id)}`),
    matches: await count('matches', `?external_id=eq.${encodeURIComponent(FIXTURE.match.external_id)}`)
  };

  const summary = {
    seed_version: FIXTURE.seedVersion,
    environment: { name: qaMeta.env, project_ref: qaMeta.ref, supabase_url_host: new URL(qaMeta.url).host },
    public_data_dir: path.relative(ROOT, PUBLIC_DATA_DIR),
    pool_code: FIXTURE.pool.code,
    pool_id: FIXTURE.pool.id,
    match_external_id: FIXTURE.match.external_id,
    rows_before: rowsBefore,
    rows_after: rowsAfter
  };
  fs.mkdirSync(path.dirname(path.join(PUBLIC_DATA_DIR, '..', 'qa-seed-summary.json')), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, '..', 'qa-seed-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

reset().catch(err => {
  console.error(err);
  process.exit(1);
});
