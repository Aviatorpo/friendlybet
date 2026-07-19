#!/usr/bin/env node
/*
 * Chairman break-glass final truth override.
 *
 * This is not the normal result path. Ordinary final truth must come from
 * final-result-verifier.js and resolve-final-golden-boot.js. Use this only when
 * the automatic final-night chain is failing and Eyal gives a final operator
 * decision for the World Cup final winner, score, and Golden Boot winner.
 *
 * Default mode is dry-run. Pass --apply to write Supabase.
 */

const fs = require('fs');
const path = require('path');
const { assertQaIfRequested, isQaTarget } = require('./qa-env');
const { loadFinalScenarioCandidates } = require('./resolve-final-golden-boot.js');

const ROOT = path.resolve(__dirname, '..');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const FINAL_EXTERNAL_ID = String(process.env.CHAIRMAN_FINAL_EXTERNAL_ID || '400021543');
const ACK_PHRASE = 'I_UNDERSTAND_THIS_IS_FINAL_TRUTH_OVERRIDE';
const FINAL_HOME = 'ESP';
const FINAL_AWAY = 'ARG';
const LIVE_SOURCE = isQaTarget() ? 'qa-chairman-final-truth' : 'chairman-final-truth';

assertQaIfRequested();

function setGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value == null ? '' : value}\n`, 'utf8');
}

function writeReport(file, payload) {
  if (!file) return;
  const resolved = path.resolve(ROOT, file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function truthy(value) {
  return ['1', 'true', 'yes', 'y', 'apply'].includes(String(value || '').trim().toLowerCase());
}

function normalizeCode(value, field, allowed = null) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,4}$/.test(code)) throw new Error(`Invalid ${field}: ${value}`);
  if (allowed && !allowed.includes(code)) throw new Error(`${field} must be one of ${allowed.join('/')}`);
  return code;
}

function parseScore(value, field, max = 50) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`Invalid ${field}: ${value}`);
  return n;
}

function optionalScore(value, field, max = 30) {
  if (value == null || String(value).trim() === '') return null;
  return parseScore(value, field, max);
}

function safeCandidateKey(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (normalized === 'messi' || normalized.includes('lionel messi')) return 'messi';
  if (normalized === 'mbappe' || normalized.includes('kylian mbappe')) return 'mbappe';
  return '';
}

function finalCandidates() {
  const rows = loadFinalScenarioCandidates();
  const byKey = new Map();
  for (const row of rows || []) {
    const key = row.key === 'messi' || row.key === 'mbappe' ? row.key : safeCandidateKey(row.player_name);
    if (key) byKey.set(key, { ...row, candidate_key: key });
  }
  return [
    {
      candidate_key: 'messi',
      player_id: (byKey.get('messi') && byKey.get('messi').player_id) || 'eef85a8f-8dec-4ecc-85e8-8a731f5ed527',
      player_name: (byKey.get('messi') && byKey.get('messi').player_name) || 'Lionel Messi',
      team_code: (byKey.get('messi') && byKey.get('messi').team_code) || 'ARG',
    },
    {
      candidate_key: 'mbappe',
      player_id: (byKey.get('mbappe') && byKey.get('mbappe').player_id) || '8c339bd2-3fc2-49f2-a755-622f406a01dc',
      player_name: (byKey.get('mbappe') && byKey.get('mbappe').player_name) || 'Kylian Mbappe',
      team_code: (byKey.get('mbappe') && byKey.get('mbappe').team_code) || 'FRA',
    },
  ];
}

function normalizeGoldenBoot(value, candidates = finalCandidates()) {
  const raw = String(value || '').trim();
  const key = safeCandidateKey(raw);
  const candidate = (candidates || []).find(row =>
    row.candidate_key === key
    || String(row.player_id || '').toLowerCase() === raw.toLowerCase()
    || String(row.player_name || '').toLowerCase() === raw.toLowerCase());
  if (!candidate) throw new Error('Golden Boot must be Messi or Mbappe');
  return candidate;
}

function normalizeResultMethod(value, homeScore, awayScore) {
  const raw = String(value || 'auto').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const tied = homeScore === awayScore;
  let method = raw;
  if (!method || method === 'auto') method = tied ? 'penalties' : 'regular';
  if (['ft', 'full_time', 'regular_time', 'regular'].includes(method)) method = 'regular';
  if (['aet', 'extra', 'extra_time', 'after_extra_time'].includes(method)) method = 'extra_time';
  if (['pen', 'pens', 'penalty', 'penalties', 'shootout', 'penalty_shootout'].includes(method)) method = 'penalties';
  if (!['regular', 'extra_time', 'penalties'].includes(method)) {
    throw new Error(`Invalid result_method: ${value}`);
  }
  if (tied && method !== 'penalties') {
    throw new Error('A tied knockout final score requires result_method=penalties');
  }
  if (!tied && method === 'penalties') {
    throw new Error('result_method=penalties requires a tied final score before penalties');
  }
  return method;
}

function statusDetailForMethod(method) {
  if (method === 'penalties') return 'PEN';
  if (method === 'extra_time') return 'AET';
  return 'FT';
}

function normalizeOverrideInput(env = process.env, args = process.argv.slice(2), candidates = finalCandidates()) {
  const apply = args.includes('--apply') || truthy(env.CHAIRMAN_FINAL_APPLY);
  const ack = String(env.CHAIRMAN_FINAL_ACK || '').trim();
  if (ack !== ACK_PHRASE) {
    throw new Error(`Missing acknowledgement phrase: ${ACK_PHRASE}`);
  }

  const homeScore = parseScore(env.CHAIRMAN_FINAL_HOME_SCORE, 'CHAIRMAN_FINAL_HOME_SCORE');
  const awayScore = parseScore(env.CHAIRMAN_FINAL_AWAY_SCORE, 'CHAIRMAN_FINAL_AWAY_SCORE');
  const winnerCode = normalizeCode(env.CHAIRMAN_FINAL_WINNER_CODE, 'CHAIRMAN_FINAL_WINNER_CODE', [FINAL_HOME, FINAL_AWAY]);
  if (homeScore > awayScore && winnerCode !== FINAL_HOME) {
    throw new Error(`${FINAL_HOME}-${FINAL_AWAY}: winner must be ${FINAL_HOME} for a decisive home score`);
  }
  if (awayScore > homeScore && winnerCode !== FINAL_AWAY) {
    throw new Error(`${FINAL_HOME}-${FINAL_AWAY}: winner must be ${FINAL_AWAY} for a decisive away score`);
  }

  const method = normalizeResultMethod(env.CHAIRMAN_FINAL_RESULT_METHOD, homeScore, awayScore);
  const homePenalties = optionalScore(env.CHAIRMAN_FINAL_HOME_PENALTIES, 'CHAIRMAN_FINAL_HOME_PENALTIES');
  const awayPenalties = optionalScore(env.CHAIRMAN_FINAL_AWAY_PENALTIES, 'CHAIRMAN_FINAL_AWAY_PENALTIES');
  if ((homePenalties == null) !== (awayPenalties == null)) {
    throw new Error('Penalty score must include both home and away values');
  }
  if (homePenalties != null) {
    if (method !== 'penalties') throw new Error('Penalty scores require result_method=penalties');
    if (homePenalties === awayPenalties) throw new Error('Penalty scores cannot be tied');
    const penaltyWinner = homePenalties > awayPenalties ? FINAL_HOME : FINAL_AWAY;
    if (penaltyWinner !== winnerCode) throw new Error('Penalty-score winner contradicts CHAIRMAN_FINAL_WINNER_CODE');
  }

  const goldenBoot = normalizeGoldenBoot(env.CHAIRMAN_FINAL_GOLDEN_BOOT || env.CHAIRMAN_FINAL_TOP_SCORER, candidates);
  const operatorNote = String(env.CHAIRMAN_FINAL_OPERATOR_NOTE || '').trim();
  if (apply && operatorNote.length < 8) {
    throw new Error('CHAIRMAN_FINAL_OPERATOR_NOTE is required for apply runs');
  }

  return {
    apply,
    externalId: String(env.CHAIRMAN_FINAL_EXTERNAL_ID || FINAL_EXTERNAL_ID),
    winnerCode,
    homeScore,
    awayScore,
    resultMethod: method,
    statusDetail: statusDetailForMethod(method),
    homePenalties,
    awayPenalties,
    goldenBoot,
    operatorNote,
  };
}

function validateFinalFixture(match, input) {
  if (!match) throw new Error(`Final fixture ${input.externalId} was not found in Supabase matches`);
  if (String(match.external_id || '') !== String(input.externalId)) {
    throw new Error(`Fixture external_id mismatch: expected ${input.externalId}, got ${match.external_id || 'missing'}`);
  }
  if (String(match.stage || '').toUpperCase() !== 'FINAL') {
    throw new Error(`Fixture ${input.externalId} is not stage FINAL`);
  }
  if (String(match.home_team_code || '').toUpperCase() !== FINAL_HOME || String(match.away_team_code || '').toUpperCase() !== FINAL_AWAY) {
    throw new Error(`Fixture ${input.externalId} must be ${FINAL_HOME}-${FINAL_AWAY}, got ${match.home_team_code || '?'}-${match.away_team_code || '?'}`);
  }
  if (![match.home_team_code, match.away_team_code].includes(input.winnerCode)) {
    throw new Error(`Winner ${input.winnerCode} is not one of ${match.home_team_code}/${match.away_team_code}`);
  }
  return true;
}

function buildMatchPatch(input, nowIso = new Date().toISOString()) {
  return {
    home_score: input.homeScore,
    away_score: input.awayScore,
    status: 'FINISHED',
    winner_code: input.winnerCode,
    live_clock: null,
    live_period: null,
    status_detail: input.statusDetail,
    live_source: LIVE_SOURCE,
    source_updated_at: nowIso,
    last_updated: nowIso,
  };
}

function changedMatchFields(match, patch) {
  const keys = ['home_score', 'away_score', 'status', 'winner_code', 'live_clock', 'live_period', 'status_detail', 'live_source'];
  return keys.filter(key => {
    const left = match && match[key] == null ? null : String(match && match[key]);
    const right = patch[key] == null ? null : String(patch[key]);
    return left !== right;
  });
}

async function sb(method, table, query = '', data = null) {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${table} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function loadFinalMatch(externalId) {
  const rows = await sb('GET', 'matches',
    `?select=*&external_id=eq.${encodeURIComponent(externalId)}`);
  if (!Array.isArray(rows)) throw new Error('Supabase matches response was not an array');
  if (rows.length > 1) throw new Error(`Expected one final fixture ${externalId}, got ${rows.length}`);
  return rows[0] || null;
}

async function loadCurrentTopScorer() {
  const rows = await sb('GET', 'app_settings', '?key=eq.top_scorer&select=value');
  return rows && rows[0] && rows[0].value ? String(rows[0].value) : '';
}

async function writeTopScorer(candidate, nowIso) {
  const rows = await sb('POST', 'app_settings', '?on_conflict=key', {
    key: 'top_scorer',
    value: String(candidate.player_id),
    updated_at: nowIso,
  });
  return rows;
}

async function recordLedger(input, match, patch, nowIso, apply) {
  const runId = process.env.GITHUB_RUN_ID || null;
  const candidate = {
    external_id: String(input.externalId),
    match_key: `${FINAL_HOME}-${FINAL_AWAY}-${match.match_date || ''}`,
    match_date: match.match_date || null,
    home_team_code: FINAL_HOME,
    away_team_code: FINAL_AWAY,
    current_status: String(match.status || ''),
    last_checked_at: nowIso,
    resolved_at: apply ? nowIso : null,
    latest_action: apply ? 'chairman_final_truth_applied' : 'chairman_final_truth_dry_run',
    latest_consensus: {
      ok: true,
      break_glass: true,
      source: LIVE_SOURCE,
      source_family: 'operator:chairman',
    },
    latest_summary: {
      workflow_run_id: runId,
      result_method: input.resultMethod,
      golden_boot_key: input.goldenBoot.candidate_key,
      golden_boot_player_id: input.goldenBoot.player_id,
      applied: !!apply,
    },
  };
  const observation = {
    match_external_id: String(input.externalId),
    match_key: candidate.match_key,
    source: LIVE_SOURCE,
    source_family: 'operator:chairman',
    source_id: runId,
    observed_at: nowIso,
    state: 'confirmed_result',
    status: patch.status,
    home_score: patch.home_score,
    away_score: patch.away_score,
    winner_code: patch.winner_code,
    fixture_date: match.match_date || null,
    reason: 'chairman break-glass final truth override',
    update: patch,
  };
  const report = { candidate: { ok: false }, observation: { ok: false } };
  try {
    await sb('POST', 'result_verification_candidates', '?on_conflict=external_id', [candidate]);
    report.candidate = { ok: true };
  } catch (err) {
    report.candidate = { ok: false, error: err.message };
  }
  try {
    await sb('POST', 'result_verification_observations', '', [observation]);
    report.observation = { ok: true };
  } catch (err) {
    report.observation = { ok: false, error: err.message };
  }
  return report;
}

async function run(env = process.env, args = process.argv.slice(2)) {
  const input = normalizeOverrideInput(env, args);
  const nowIso = new Date().toISOString();
  const match = await loadFinalMatch(input.externalId);
  validateFinalFixture(match, input);
  const patch = buildMatchPatch(input, nowIso);
  const matchChangedFields = changedMatchFields(match, patch);
  const currentTopScorer = await loadCurrentTopScorer();
  const topScorerChanged = currentTopScorer !== String(input.goldenBoot.player_id);

  let updatedMatch = null;
  let topScorerWrite = null;
  let ledger = { skipped: true, reason: 'dry-run ledger writes disabled' };
  if (input.apply && matchChangedFields.length) {
    const rows = await sb('PATCH', 'matches',
      `?external_id=eq.${encodeURIComponent(input.externalId)}&select=*`,
      patch);
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error(`Expected one patched final fixture, got ${Array.isArray(rows) ? rows.length : 'non-array'}`);
    }
    updatedMatch = rows[0];
  } else if (input.apply) {
    updatedMatch = match;
  }
  if (input.apply && topScorerChanged) {
    topScorerWrite = await writeTopScorer(input.goldenBoot, nowIso);
  }
  if (input.apply || truthy(env.CHAIRMAN_FINAL_LEDGER_WRITE_DRY_RUN)) {
    ledger = await recordLedger(input, match, patch, nowIso, input.apply);
  }

  const report = {
    applied: input.apply,
    fixture_external_id: input.externalId,
    final: `${FINAL_HOME}-${FINAL_AWAY}`,
    winner_code: input.winnerCode,
    score: {
      home_team_code: FINAL_HOME,
      away_team_code: FINAL_AWAY,
      home_score: input.homeScore,
      away_score: input.awayScore,
      result_method: input.resultMethod,
      status_detail: input.statusDetail,
      home_penalties: input.homePenalties,
      away_penalties: input.awayPenalties,
    },
    golden_boot: {
      key: input.goldenBoot.candidate_key,
      player_id: input.goldenBoot.player_id,
      player_name: input.goldenBoot.player_name,
      team_code: input.goldenBoot.team_code,
      current_value: currentTopScorer || null,
      changed: topScorerChanged,
    },
    match: {
      before: {
        status: match.status || null,
        home_score: match.home_score == null ? null : Number(match.home_score),
        away_score: match.away_score == null ? null : Number(match.away_score),
        winner_code: match.winner_code || null,
        source_updated_at: match.source_updated_at || null,
        last_updated: match.last_updated || null,
      },
      patch,
      changed_fields: matchChangedFields,
      after: updatedMatch ? {
        status: updatedMatch.status || null,
        home_score: updatedMatch.home_score == null ? null : Number(updatedMatch.home_score),
        away_score: updatedMatch.away_score == null ? null : Number(updatedMatch.away_score),
        winner_code: updatedMatch.winner_code || null,
        source_updated_at: updatedMatch.source_updated_at || null,
        last_updated: updatedMatch.last_updated || null,
      } : null,
    },
    ledger,
    operator_note_present: !!input.operatorNote,
    operator_note: input.operatorNote || null,
    generated_at: nowIso,
  };

  setGithubOutput('applied', input.apply ? 'true' : 'false');
  setGithubOutput('changed_match', matchChangedFields.length ? 'true' : 'false');
  setGithubOutput('changed_top_scorer', topScorerChanged ? 'true' : 'false');
  setGithubOutput('score_needed', input.apply ? 'true' : 'false');
  setGithubOutput('winner_code', input.winnerCode);
  setGithubOutput('golden_boot_key', input.goldenBoot.candidate_key);
  setGithubOutput('golden_boot_player_id', input.goldenBoot.player_id);
  setGithubOutput('result_method', input.resultMethod);

  writeReport(env.CHAIRMAN_FINAL_REPORT_PATH || '', report);
  console.log(`${input.apply ? 'APPLIED' : 'DRY-RUN'} chairman final truth: ${FINAL_HOME} ${input.homeScore}-${input.awayScore} ${FINAL_AWAY}, winner=${input.winnerCode}, Golden Boot=${input.goldenBoot.player_name}`);
  return report;
}

if (require.main === module) {
  run().catch(err => {
    setGithubOutput('applied', 'false');
    setGithubOutput('score_needed', 'false');
    writeReport(process.env.CHAIRMAN_FINAL_REPORT_PATH || '', {
      applied: false,
      error: err.message,
      stack: err.stack,
      generated_at: new Date().toISOString(),
    });
    console.error(err);
    process.exit(1);
  });
} else {
  module.exports = {
    ACK_PHRASE,
    FINAL_HOME,
    FINAL_AWAY,
    safeCandidateKey,
    finalCandidates,
    normalizeGoldenBoot,
    normalizeResultMethod,
    normalizeOverrideInput,
    validateFinalFixture,
    buildMatchPatch,
    changedMatchFields,
    statusDetailForMethod,
  };
}
