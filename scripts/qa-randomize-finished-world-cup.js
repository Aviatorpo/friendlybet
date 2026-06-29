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
const ARTIFACT_DIR = path.resolve(PUBLIC_DATA_DIR, '..');
const MATCHES_URL = process.env.QA_MATCHES_URL || 'https://friendlybet.live/public-data/matches.json';
const GROUPS = {
  A: ['MEX', 'RSA', 'KOR', 'CZE'],
  B: ['CAN', 'BIH', 'QAT', 'SUI'],
  C: ['BRA', 'MAR', 'HAI', 'SCO'],
  D: ['USA', 'PAR', 'AUS', 'TUR'],
  E: ['GER', 'CUR', 'CIV', 'ECU'],
  F: ['NED', 'JPN', 'SWE', 'TUN'],
  G: ['BEL', 'EGY', 'IRN', 'NZL'],
  H: ['ESP', 'CPV', 'SAU', 'URU'],
  I: ['FRA', 'SEN', 'IRQ', 'NOR'],
  J: ['ARG', 'ALG', 'AUT', 'JOR'],
  K: ['POR', 'COD', 'UZB', 'COL'],
  L: ['ENG', 'CRO', 'GHA', 'PAN']
};

function hashRecoveryCode(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function seedInt(value) {
  const hash = crypto.createHash('sha256').update(String(value)).digest();
  return hash.readUInt32LE(0);
}

function rng(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, rows) {
  return rows[Math.floor(random() * rows.length)];
}

function shuffle(random, rows) {
  const out = rows.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function isTerminal(row) {
  return ['FINISHED', 'AWARDED'].includes(String(row && row.status || '').toUpperCase());
}

function logicalKey(row) {
  return [
    row.stage || '',
    row.group_letter || '',
    row.home_team_code || '',
    row.away_team_code || '',
    row.match_date || ''
  ].join('|');
}

function chooseBetterMatch(a, b) {
  if (!a) return b;
  const scoreA = Number(a.home_score != null && a.away_score != null) + Number(!!a.winner_code) + Number(!!a.home_team_code && !!a.away_team_code) + Number(String(a.external_id || '').startsWith('400'));
  const scoreB = Number(b.home_score != null && b.away_score != null) + Number(!!b.winner_code) + Number(!!b.home_team_code && !!b.away_team_code) + Number(String(b.external_id || '').startsWith('400'));
  return scoreB > scoreA ? b : a;
}

async function fetchCurrentMatches() {
  const res = await fetch(`${MATCHES_URL}?cb=${Date.now()}`, { cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) throw new Error(`Failed to fetch live matches snapshot ${res.status}: ${text.slice(0, 300)}`);
  const payload = JSON.parse(text);
  const allRows = (payload.matches || []).filter(row => row && row.stage && row.match_date && (row.external_id || row.id));
  const byLogical = new Map();
  for (const row of allRows) {
    const key = logicalKey(row);
    byLogical.set(key, chooseBetterMatch(byLogical.get(key), row));
  }
  const matches = Array.from(byLogical.values()).sort((a, b) =>
    String(a.match_date || '').localeCompare(String(b.match_date || '')) ||
    String(a.external_id || '').localeCompare(String(b.external_id || '')));
  return {
    source_updated_at: payload.updatedAt || payload.updated_at || null,
    raw_count: (payload.matches || []).length,
    usable_raw_count: allRows.length,
    terminal_raw_count: allRows.filter(isTerminal).length,
    non_terminal_raw_count: allRows.filter(row => !isTerminal(row)).length,
    duplicate_count: allRows.length - byLogical.size,
    matches
  };
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
  if (!res.ok) throw new Error(`Supabase ${method} ${table}${query} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function insertChunks(table, rows, size = 300) {
  for (let i = 0; i < rows.length; i += size) {
    await sb('POST', table, '', rows.slice(i, i + size));
  }
}

function teamRowsFromMatches(matches) {
  const teams = new Map();
  for (const [group, codes] of Object.entries(GROUPS)) {
    for (const code of codes) teams.set(code, { code, name: code, name_en: code, name_he: code, group_letter: group, tier: null, fifa_ranking: null, flag_emoji: null });
  }
  for (const m of matches) {
    if (m.home_team_code) {
      teams.set(m.home_team_code, {
        ...(teams.get(m.home_team_code) || {}),
        code: m.home_team_code,
        name: m.home_team_name || m.home_team_code,
        name_en: m.home_team_name || m.home_team_code,
        name_he: m.home_team_name || m.home_team_code,
        group_letter: m.group_letter || (teams.get(m.home_team_code) || {}).group_letter || null,
        tier: null,
        fifa_ranking: null,
        flag_emoji: null
      });
    }
    if (m.away_team_code) {
      teams.set(m.away_team_code, {
        ...(teams.get(m.away_team_code) || {}),
        code: m.away_team_code,
        name: m.away_team_name || m.away_team_code,
        name_en: m.away_team_name || m.away_team_code,
        name_he: m.away_team_name || m.away_team_code,
        group_letter: m.group_letter || (teams.get(m.away_team_code) || {}).group_letter || null,
        tier: null,
        fifa_ranking: null,
        flag_emoji: null
      });
    }
  }
  return Array.from(teams.values());
}

function normalizeMatch(row) {
  const status = String(row.status || '').toUpperCase() || (row.home_score == null || row.away_score == null ? 'SCHEDULED' : 'FINISHED');
  const externalId = String(row.external_id || row.id);
  return {
    id: `qa-live-${externalId}`,
    external_id: externalId,
    stage: row.stage || null,
    group_letter: row.group_letter || null,
    home_team_code: row.home_team_code || null,
    away_team_code: row.away_team_code || null,
    home_team_name: row.home_team_name || row.home_team_code || null,
    away_team_name: row.away_team_name || row.away_team_code || null,
    home_score: row.home_score == null ? null : Number(row.home_score),
    away_score: row.away_score == null ? null : Number(row.away_score),
    status,
    match_date: row.match_date || new Date().toISOString(),
    venue: row.venue || null,
    winner_code: row.winner_code || null,
    scorers: Array.isArray(row.scorers) ? row.scorers : [],
    live_clock: null,
    live_period: null,
    status_detail: row.status_detail || null,
    live_source: 'qa-live-snapshot',
    source_updated_at: new Date().toISOString(),
    last_updated: new Date().toISOString()
  };
}

function knockoutPositionsByStage() {
  return [
    ...Array.from({ length: 16 }, (_, i) => ({ pos: i + 1, stage: 'ROUND_OF_32' })),
    ...Array.from({ length: 8 }, (_, i) => ({ pos: i + 17, stage: 'ROUND_OF_16' })),
    ...Array.from({ length: 4 }, (_, i) => ({ pos: i + 25, stage: 'QUARTER_FINALS' })),
    ...Array.from({ length: 2 }, (_, i) => ({ pos: i + 29, stage: 'SEMI_FINALS' })),
    { pos: 31, stage: 'FINAL' }
  ];
}

function candidateTeamsForStage(matches, stage) {
  const stageAliases = {
    ROUND_OF_32: new Set(['ROUND_OF_32', 'LAST_32', 'R32']),
    ROUND_OF_16: new Set(['ROUND_OF_16', 'LAST_16', 'R16']),
    QUARTER_FINALS: new Set(['QUARTER_FINALS', 'QF']),
    SEMI_FINALS: new Set(['SEMI_FINALS', 'SF']),
    FINAL: new Set(['FINAL'])
  }[stage] || new Set([stage]);
  const teams = [];
  for (const m of matches) {
    if (!stageAliases.has(m.stage)) continue;
    if (m.home_team_code) teams.push(m.home_team_code);
    if (m.away_team_code) teams.push(m.away_team_code);
  }
  return teams.length ? Array.from(new Set(teams)) : Object.values(GROUPS).flat();
}

function randomPredictionRows(matches, seedLabel) {
  const now = new Date().toISOString();
  const groupRows = [];
  const thirdRows = [];
  const knockoutRows = [];
  const championRows = [];
  const topScorerRows = [];
  const stagePositions = knockoutPositionsByStage();
  const byStage = Object.fromEntries(['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']
    .map(stage => [stage, candidateTeamsForStage(matches, stage)]));

  for (const user of FIXTURE.users) {
    const random = rng(seedInt(`${seedLabel}:${user.id}`));
    for (const [group, teams] of Object.entries(GROUPS)) {
      shuffle(random, teams).forEach((teamCode, idx) => {
        groupRows.push({
          id: crypto.randomUUID(),
          pool_id: FIXTURE.pool.id,
          user_id: user.id,
          group_letter: group,
          position: idx + 1,
          team_code: teamCode,
          created_at: now
        });
      });
    }
    for (const group of shuffle(random, Object.keys(GROUPS)).slice(0, 8)) {
      thirdRows.push({
        id: crypto.randomUUID(),
        pool_id: FIXTURE.pool.id,
        user_id: user.id,
        group_letter: group,
        created_at: now
      });
    }
    let champion = null;
    for (const { pos, stage } of stagePositions) {
      const team = pick(random, byStage[stage]);
      if (pos === 31) champion = team;
      knockoutRows.push({
        id: crypto.randomUUID(),
        pool_id: FIXTURE.pool.id,
        user_id: user.id,
        match_id: null,
        round: stage,
        predicted_winner: team,
        bracket_position: pos,
        multiplier_applied: 1,
        created_at: now
      });
    }
    championRows.push({
      id: crypto.randomUUID(),
      pool_id: FIXTURE.pool.id,
      user_id: user.id,
      team_code: champion || pick(random, Object.values(GROUPS).flat()),
      created_at: now
    });
    const topTeam = pick(random, Object.values(GROUPS).flat());
    topScorerRows.push({
      id: crypto.randomUUID(),
      pool_id: FIXTURE.pool.id,
      user_id: user.id,
      player_id: `qa-${topTeam.toLowerCase()}-${user.id.slice(-4)}`,
      player_name: `${topTeam} QA Scorer`,
      team_code: topTeam,
      created_at: now
    });
  }
  return { groupRows, thirdRows, knockoutRows, championRows, topScorerRows };
}

async function main() {
  const startedAt = new Date().toISOString();
  const seedLabel = process.env.QA_RANDOM_SEED || `qa-${Date.now()}`;
  const snapshot = await fetchCurrentMatches();
  const matches = snapshot.matches.map(normalizeMatch);
  const now = new Date().toISOString();
  const terminalMatches = matches.filter(isTerminal);
  const futureConcreteMatches = matches.filter(m => !isTerminal(m) && m.home_team_code && m.away_team_code);
  const futurePlaceholderMatches = matches.filter(m => !isTerminal(m) && (!m.home_team_code || !m.away_team_code));

  if (!matches.length) throw new Error('No matches found in live snapshot.');
  if (!terminalMatches.length) throw new Error('No finished matches found in live snapshot.');
  if (!futureConcreteMatches.length) throw new Error('No concrete future matches found in live snapshot.');

  await sb('DELETE', 'knockout_picks', `?pool_id=eq.${encodeURIComponent(FIXTURE.pool.id)}`);
  await sb('DELETE', 'group_position_picks', `?pool_id=eq.${encodeURIComponent(FIXTURE.pool.id)}`);
  await sb('DELETE', 'group_picks', `?pool_id=eq.${encodeURIComponent(FIXTURE.pool.id)}`);
  await sb('DELETE', 'sp_third_place_picks', `?pool_id=eq.${encodeURIComponent(FIXTURE.pool.id)}`);
  await sb('DELETE', 'tournament_winner_picks', `?pool_id=eq.${encodeURIComponent(FIXTURE.pool.id)}`);
  await sb('DELETE', 'top_scorer_picks', `?pool_id=eq.${encodeURIComponent(FIXTURE.pool.id)}`);
  await sb('DELETE', 'users', `?pool_id=eq.${encodeURIComponent(FIXTURE.pool.id)}`);
  await sb('DELETE', 'pools', `?id=eq.${encodeURIComponent(FIXTURE.pool.id)}`);
  await sb('DELETE', 'matches', '?live_source=eq.qa-live-snapshot');
  await sb('DELETE', 'matches', '?live_source=eq.qa-future-sim');
  await sb('DELETE', 'matches', '?live_source=eq.qa-manual');
  await sb('DELETE', 'matches', `?external_id=eq.${encodeURIComponent(FIXTURE.match.external_id)}`);

  await sb('POST', 'teams?on_conflict=code', '', teamRowsFromMatches(matches));
  await insertChunks('matches', matches);

  await sb('POST', 'pools?on_conflict=id', '', [{
    id: FIXTURE.pool.id,
    code: FIXTURE.pool.code,
    name: `${FIXTURE.pool.name} - current WC simulator`,
    language: FIXTURE.pool.language,
    tournament: FIXTURE.pool.tournament,
    status: FIXTURE.pool.status,
    betting_mode: FIXTURE.pool.betting_mode,
    scoring_rules: FIXTURE.pool.scoring_rules,
    use_multipliers: FIXTURE.pool.use_multipliers,
    is_locked: true,
    locked_at: now
  }]);

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
    joined_at: new Date(Date.parse(now) + idx * 1000).toISOString(),
    total_score: 0,
    group_score: 0,
    knockout_score: 0,
    top_scorer_score: 0,
    group_points: 0,
    knockout_points: 0,
    bonus_points: 0,
    groups_score: 0,
    bonus_score: 0,
    predictions_locked: true
  }));
  await sb('POST', 'users?on_conflict=id', '', users);
  await sb('PATCH', 'pools', `?id=eq.${encodeURIComponent(FIXTURE.pool.id)}`, {
    admin_user_id: FIXTURE.users.find(u => u.is_admin).id
  });

  const predictionRows = randomPredictionRows(matches, seedLabel);
  await insertChunks('group_position_picks', predictionRows.groupRows);
  await insertChunks('sp_third_place_picks', predictionRows.thirdRows);
  await insertChunks('knockout_picks', predictionRows.knockoutRows);
  await insertChunks('tournament_winner_picks', predictionRows.championRows);
  await insertChunks('top_scorer_picks', predictionRows.topScorerRows);

  await sb('POST', 'app_settings?on_conflict=key', '', [{
    key: 'qa_staging_sentinel',
    value: FIXTURE.seedVersion
  }, {
    key: 'qa_random_finished_seed',
    value: { seed: seedLabel, match_rows: matches.length, finished_unique: terminalMatches.length, future_concrete: futureConcreteMatches.length, applied_at: now }
  }]);

  fs.mkdirSync(path.join(PUBLIC_DATA_DIR, 'banter'), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, 'banter-state.json'), JSON.stringify({
    updatedAt: now,
    pools: {},
    seenFinishedIds: []
  }, null, 2));

  const summary = {
    mode: 'current_world_cup_future_simulator',
    seed: seedLabel,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    environment: { name: qaMeta.env, project_ref: qaMeta.ref, supabase_url_host: new URL(qaMeta.url).host },
    source: {
      url: MATCHES_URL,
      updated_at: snapshot.source_updated_at,
      raw_matches: snapshot.raw_count,
      usable_raw_matches: snapshot.usable_raw_count,
      terminal_raw_matches: snapshot.terminal_raw_count,
      non_terminal_raw_matches: snapshot.non_terminal_raw_count,
      duplicates_removed: snapshot.duplicate_count
    },
    pool_code: FIXTURE.pool.code,
    pool_id: FIXTURE.pool.id,
    risk_multipliers: {
      enabled: FIXTURE.pool.use_multipliers !== false,
      multipliers: FIXTURE.pool.scoring_rules && FIXTURE.pool.scoring_rules.multipliers,
      team_multipliers: FIXTURE.pool.scoring_rules && FIXTURE.pool.scoring_rules.team_multipliers
    },
    users: FIXTURE.users.map(u => ({ id: u.id, nickname: u.nickname, recovery_code: u.recovery_code })),
    seeded: {
      matches: matches.length,
      finished_matches: terminalMatches.length,
      future_concrete_matches: futureConcreteMatches.length,
      future_placeholder_matches: futurePlaceholderMatches.length,
      teams: teamRowsFromMatches(matches).length,
      group_position_picks: predictionRows.groupRows.length,
      third_place_picks: predictionRows.thirdRows.length,
      knockout_picks: predictionRows.knockoutRows.length,
      tournament_winner_picks: predictionRows.championRows.length,
      top_scorer_picks: predictionRows.topScorerRows.length
    },
    latest_finished: terminalMatches.slice(-8).map(m => ({
      external_id: m.external_id,
      stage: m.stage,
      teams: `${m.home_team_code}-${m.away_team_code}`,
      score: `${m.home_score}-${m.away_score}`,
      winner: m.winner_code
    })),
    upcoming_simulatable: futureConcreteMatches.slice(0, 16).map(m => ({
      external_id: m.external_id,
      stage: m.stage,
      match_date: m.match_date,
      teams: `${m.home_team_code}-${m.away_team_code}`
    })),
    unresolved_placeholders: futurePlaceholderMatches.slice(0, 16).map(m => ({
      external_id: m.external_id,
      stage: m.stage,
      match_date: m.match_date,
      home_team_code: m.home_team_code,
      away_team_code: m.away_team_code
    }))
  };
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-random-finished-seed-summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa-current-world-cup-seed-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
