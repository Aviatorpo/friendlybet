#!/usr/bin/env node
/*
 * Bridge the official FIFA schedule snapshot into the Supabase matches table.
 *
 * This is the canonical handoff from "what the app can display from schedule"
 * to "what scoring/live poller/final verifier can actually process".
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SCHEDULE_PATH = path.join(ROOT, 'public-data', 'world-cup-schedule.json');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const LIVE_FIELDS = {
  live_clock: null,
  live_period: null,
  status_detail: null,
  live_source: null,
  source_updated_at: null
};

function parseArgs(argv) {
  const opts = {
    schedulePath: DEFAULT_SCHEDULE_PATH,
    dryRun: false,
    includePlaceholders: false,
    requirePlaceholders: false,
    windowHours: null,
    failMissingKnownWithinHours: 36,
    now: new Date()
  };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--include-placeholders') opts.includePlaceholders = true;
    else if (arg === '--require-placeholders') opts.requirePlaceholders = true;
    else if (arg.startsWith('--schedule=')) opts.schedulePath = path.resolve(arg.slice('--schedule='.length));
    else if (arg.startsWith('--window-hours=')) opts.windowHours = numberArg(arg, 'window-hours');
    else if (arg.startsWith('--fail-missing-known-within-hours=')) opts.failMissingKnownWithinHours = numberArg(arg, 'fail-missing-known-within-hours');
    else if (arg.startsWith('--now=')) opts.now = dateArg(arg.slice('--now='.length), 'now');
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function numberArg(arg, name) {
  const n = Number(arg.slice(arg.indexOf('=') + 1));
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid --${name}: ${arg}`);
  return n;
}

function dateArg(value, name) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid --${name}: ${value}`);
  return d;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`, 'utf8');
}

function statusFromSchedule(match) {
  const status = String(match && match.status || '').toUpperCase();
  if (status === 'FINISHED' || status === 'AWARDED' || status === 'CANCELLED' || status === 'POSTPONED') return status;
  if (status === 'IN_PLAY' || status === 'PAUSED' || status === 'LIVE') return status;
  return 'SCHEDULED';
}

function statusRank(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'FINISHED' || s === 'AWARDED' || s === 'CANCELLED' || s === 'POSTPONED') return 3;
  if (s === 'IN_PLAY' || s === 'PAUSED' || s === 'LIVE') return 2;
  if (s === 'SCHEDULED') return 1;
  return 0;
}

function valueOrExisting(value, existingValue) {
  return value == null && existingValue != null ? existingValue : value;
}

function mergeScheduleRowWithExisting(row, existing) {
  if (!existing) return row;
  const merged = { ...row };
  const preserveExistingProgress = statusRank(existing.status) > statusRank(row.status);

  merged.home_team_code = valueOrExisting(row.home_team_code, existing.home_team_code);
  merged.away_team_code = valueOrExisting(row.away_team_code, existing.away_team_code);
  merged.home_score = valueOrExisting(row.home_score, existing.home_score);
  merged.away_score = valueOrExisting(row.away_score, existing.away_score);
  merged.winner_code = valueOrExisting(row.winner_code, existing.winner_code);

  if (preserveExistingProgress) {
    merged.status = String(existing.status || row.status).toUpperCase();
    for (const field of ['live_clock', 'live_period', 'status_detail', 'live_source', 'source_updated_at']) {
      merged[field] = valueOrExisting(row[field], existing[field]);
    }
  }

  return merged;
}

function winnerFromSchedule(match) {
  if (!match || match.home_score == null || match.away_score == null) return null;
  const hs = Number(match.home_score);
  const as = Number(match.away_score);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return null;
  if (hs > as) return match.home_team_code || null;
  if (as > hs) return match.away_team_code || null;
  return null;
}

function normalizeScheduleRow(match, opts = {}) {
  const externalId = match.fifa_match_id || match.external_id || String(match.id || '').replace(/^fifa-/, '');
  const hasTeams = !!(match.home_team_code && match.away_team_code);
  if (!externalId || !match.match_date || !match.stage) return null;
  if (!hasTeams && !opts.includePlaceholders) return null;
  const status = statusFromSchedule(match);
  const row = {
    external_id: String(externalId),
    stage: String(match.stage).toUpperCase(),
    group_letter: match.group_letter || null,
    home_team_code: match.home_team_code || null,
    away_team_code: match.away_team_code || null,
    home_score: match.home_score == null ? null : Number(match.home_score),
    away_score: match.away_score == null ? null : Number(match.away_score),
    status,
    match_date: new Date(match.match_date).toISOString(),
    venue: match.venue || null,
    winner_code: winnerFromSchedule(match),
    last_updated: new Date().toISOString(),
    ...LIVE_FIELDS
  };
  if (status === 'FINISHED' || status === 'AWARDED') {
    row.live_source = 'fifa-schedule';
    row.source_updated_at = row.last_updated;
  }
  return row;
}

function inWindow(match, opts) {
  if (opts.windowHours == null) return true;
  const t = Date.parse(match.match_date || '');
  if (!Number.isFinite(t)) return false;
  return t >= opts.now.getTime() - 2 * 60 * 60 * 1000
    && t <= opts.now.getTime() + opts.windowHours * 60 * 60 * 1000;
}

function imminentKnownMissing(scheduleRows, dbRows, opts) {
  const dbById = new Map((dbRows || []).map(row => [String(row.external_id || ''), row]));
  const horizonMs = opts.failMissingKnownWithinHours * 60 * 60 * 1000;
  return scheduleRows.filter(match => {
    if (!match.home_team_code || !match.away_team_code) return false;
    const externalId = String(match.fifa_match_id || match.external_id || '').trim();
    if (!externalId) return false;
    const existing = dbById.get(externalId);
    if (existing && existing.home_team_code === match.home_team_code && existing.away_team_code === match.away_team_code) return false;
    const t = Date.parse(match.match_date || '');
    return Number.isFinite(t) && t >= opts.now.getTime() - 2 * 60 * 60 * 1000 && t <= opts.now.getTime() + horizonMs;
  });
}

async function callSupabase(method, table, data = null, query = '') {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SECRET_KEY');
  const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates'
    },
    body: data ? JSON.stringify(data) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${table} ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function loadDbRows() {
  const select = [
    'external_id',
    'stage',
    'home_team_code',
    'away_team_code',
    'home_score',
    'away_score',
    'status',
    'match_date',
    'winner_code',
    'venue',
    'live_clock',
    'live_period',
    'status_detail',
    'live_source',
    'source_updated_at'
  ].join(',');
  const rows = await callSupabase('GET', 'matches', null, `?select=${select}&order=match_date.asc,id.asc`);
  return Array.isArray(rows) ? rows : [];
}

async function upsertRows(rows, opts = {}) {
  if (opts.dryRun || rows.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    await callSupabase('POST', 'matches', batch, '?on_conflict=external_id');
    count += batch.length;
  }
  return count;
}

async function upsertKnownAndPlaceholders(knownRows, placeholderRows, opts = {}) {
  const known = await upsertRows(knownRows, opts);
  let placeholders = 0;
  let placeholderError = null;
  if (placeholderRows.length > 0) {
    try {
      placeholders = await upsertRows(placeholderRows, opts);
    } catch (err) {
      placeholderError = err;
      if (opts.requirePlaceholders) throw err;
      console.warn(`Placeholder fixture upsert failed; known fixtures are already bridged. Placeholder schema/action still required: ${err.message}`);
    }
  }
  return { known, placeholders, placeholderError };
}

async function run(opts = parseArgs(process.argv.slice(2))) {
  const schedule = readJson(opts.schedulePath);
  const scheduleRows = (schedule.matches || []).filter(match => inWindow(match, opts));
  const normalizedRows = scheduleRows
    .map(match => normalizeScheduleRow(match, opts))
    .filter(Boolean);
  const beforeRows = opts.dryRun ? [] : await loadDbRows();
  const beforeByExternalId = new Map(beforeRows.map(row => [String(row.external_id || ''), row]));
  const rows = normalizedRows.map(row => mergeScheduleRowWithExisting(row, beforeByExternalId.get(row.external_id)));
  const knownRows = rows.filter(row => row.home_team_code && row.away_team_code);
  const placeholderRows = rows.filter(row => !row.home_team_code || !row.away_team_code);

  const missingBefore = opts.dryRun ? [] : imminentKnownMissing(scheduleRows, beforeRows, opts);
  const upsertResult = await upsertKnownAndPlaceholders(knownRows, placeholderRows, opts);
  const upserted = upsertResult.known + upsertResult.placeholders;
  const afterRows = opts.dryRun ? rows : await loadDbRows();
  const missingAfter = opts.dryRun ? [] : imminentKnownMissing(scheduleRows, afterRows, opts);

  console.log(`FIFA schedule bridge: schedule=${scheduleRows.length}, upsert candidates=${rows.length}, known=${knownRows.length}, placeholders=${placeholderRows.length}, upserted=${upserted}${opts.dryRun ? ' (dry-run)' : ''}`);
  if (missingBefore.length) {
    console.log(`Known imminent fixtures missing before upsert: ${missingBefore.map(m => `${m.match_number || m.fifa_match_id}:${m.home_team_code}-${m.away_team_code}`).join(', ')}`);
  }
  if (placeholderRows.length && opts.includePlaceholders) {
    console.log(`Placeholder fixtures carried: ${placeholderRows.map(m => `${m.external_id}:${m.stage}`).join(', ')}`);
  }
  if (missingAfter.length) {
    missingAfter.forEach(m => console.error(`Missing scoreable fixture after bridge: ${m.match_date} ${m.stage} ${m.home_team_code}-${m.away_team_code} (${m.fifa_match_id || m.external_id})`));
  }

  setOutput('upserted', upserted);
  setOutput('known_upserted', upsertResult.known);
  setOutput('placeholder_upserted', upsertResult.placeholders);
  setOutput('placeholder_error', upsertResult.placeholderError ? 'true' : 'false');
  setOutput('known_count', knownRows.length);
  setOutput('placeholder_count', placeholderRows.length);
  setOutput('missing_after', missingAfter.length);
  setOutput('changed', upserted > 0 ? 'true' : 'false');

  if (missingAfter.length > 0) {
    throw new Error(`${missingAfter.length} imminent known fixture(s) still missing from Supabase matches`);
  }
  return { scheduleRows, rows, knownRows, placeholderRows, upserted, missingAfter };
}

if (require.main === module) {
  run().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
} else {
  module.exports = {
    normalizeScheduleRow,
    statusFromSchedule,
    mergeScheduleRowWithExisting,
    winnerFromSchedule,
    imminentKnownMissing,
    run,
    parseArgs
  };
}
