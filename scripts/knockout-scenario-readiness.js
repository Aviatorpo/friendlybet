#!/usr/bin/env node
// FriendlyBet - operational readiness gate for hidden knockout scoring scenarios.

const fs = require('fs');
const path = require('path');
const S = require('./calculate-scores-v2.js');
const G = require('./generate-knockout-scenarios.js');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.PUBLIC_DATA_DIR
  ? path.resolve(ROOT, process.env.PUBLIC_DATA_DIR)
  : path.join(ROOT, 'public-data');
const SCENARIO_DIR = path.join(OUT_DIR, 'knockout-scenarios');
const MANIFEST_PATH = path.join(SCENARIO_DIR, 'manifest.json');
const DEFAULT_FAIL_WITHIN_HOURS = 24;

function parseArgs(argv) {
  const opts = {
    failWithinHours: numberEnv('KNOCKOUT_SCENARIO_FAIL_WITHIN_HOURS', DEFAULT_FAIL_WITHIN_HOURS),
    now: process.env.KNOCKOUT_SCENARIO_NOW ? dateArg(process.env.KNOCKOUT_SCENARIO_NOW, 'KNOCKOUT_SCENARIO_NOW') : new Date(),
    manifestPath: MANIFEST_PATH,
    scenarioDir: SCENARIO_DIR,
    allowMissingWhenFar: true,
  };
  for (const arg of argv || []) {
    if (arg.startsWith('--fail-within-hours=')) opts.failWithinHours = numberArg(arg, 'fail-within-hours');
    else if (arg.startsWith('--now=')) opts.now = dateArg(arg.slice('--now='.length), 'now');
    else if (arg.startsWith('--manifest=')) opts.manifestPath = path.resolve(arg.slice('--manifest='.length));
    else if (arg.startsWith('--scenario-dir=')) opts.scenarioDir = path.resolve(arg.slice('--scenario-dir='.length));
    else if (arg === '--strict') opts.allowMissingWhenFar = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid ${name}: ${raw}`);
  return n;
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

function readJsonIfExists(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value == null ? '' : value)}\n`, 'utf8');
}

function minutesUntil(match, now = new Date()) {
  const t = Date.parse(match && match.match_date);
  if (!Number.isFinite(t)) return null;
  return Math.round((t - now.getTime()) / 60000);
}

function fixtureLabel(match) {
  if (!match) return 'none';
  return `${match.home_team_code || 'TBD'}-${match.away_team_code || 'TBD'} ${match.stage || ''} ${match.match_date || ''}`.trim();
}

function sameFixture(a, b) {
  if (!a || !b) return false;
  if (a.external_id != null && b.external_id != null && String(a.external_id) === String(b.external_id)) return true;
  if (a.id != null && b.id != null && String(a.id) === String(b.id)) return true;
  return String(a.stage || '').toUpperCase() === String(b.stage || '').toUpperCase()
    && String(a.home_team_code || '') === String(b.home_team_code || '')
    && String(a.away_team_code || '') === String(b.away_team_code || '');
}

function scenarioFileCount(dir) {
  try {
    return fs.readdirSync(dir).filter(file => file.endsWith('.json')).length;
  } catch (_) {
    return 0;
  }
}

function manifestEntryForMatch(manifest, match) {
  return ((manifest && manifest.matches) || []).find(entry => sameFixture(entry.match, match)) || null;
}

function scenarioFilesReady(entry, opts) {
  const issues = [];
  if (!entry || !Array.isArray(entry.winners) || entry.winners.length !== 2) {
    return { ok: false, issues: ['manifest entry missing two possible winners'] };
  }
  for (const winnerCode of entry.winners) {
    const expected = Number(entry[`${winnerCode}_pool_count`] || 0);
    if (!expected) {
      issues.push(`${winnerCode}: no pool count in manifest`);
      continue;
    }
    const dir = path.join(opts.scenarioDir, G.safeSegment(entry.scenario_key), G.safeSegment(winnerCode));
    const actual = scenarioFileCount(dir);
    if (actual < expected) issues.push(`${winnerCode}: ${actual}/${expected} scenario files present`);
  }
  return { ok: issues.length === 0, issues };
}

function nextUnresolvedKnockout(matches) {
  return (matches || [])
    .filter(match => G.isKnockoutStage(match) && !G.isResolvedForScenarioTimeline(match))
    .sort((a, b) => {
      const at = Date.parse(a.match_date || '') || Number.MAX_SAFE_INTEGER;
      const bt = Date.parse(b.match_date || '') || Number.MAX_SAFE_INTEGER;
      return at - bt || String(a.external_id || a.id || '').localeCompare(String(b.external_id || b.id || ''));
    })[0] || null;
}

function blockerFor(match) {
  if (!match) return null;
  if (S.isPendingProviderFinal && S.isPendingProviderFinal(match)) return 'earliest knockout result is still pending verification';
  if (!match.home_team_code || !match.away_team_code) return 'earliest unresolved knockout fixture is missing one or both teams';
  if (match.winner_code && !S.isTerminalMatch(match)) return 'earliest knockout fixture has a winner but is not verified terminal';
  if (S.isTerminalMatch(match) && !match.winner_code) return 'earliest knockout fixture is terminal without winner_code';
  if (!G.isScenarioCandidate(match)) return 'earliest unresolved knockout fixture is not scenario-ready';
  return null;
}

function evaluateReadiness(matches, manifest, opts = {}) {
  const options = {
    failWithinHours: DEFAULT_FAIL_WITHIN_HOURS,
    now: new Date(),
    scenarioDir: SCENARIO_DIR,
    allowMissingWhenFar: true,
    ...opts,
  };
  const next = nextUnresolvedKnockout(matches);
  if (!next) {
    return {
      ok: true,
      status: 'no_unresolved_knockout',
      hardFail: false,
      message: 'No unresolved advancing knockout fixture needs hidden scenarios.',
    };
  }

  const mins = minutesUntil(next, options.now);
  const withinFailWindow = mins == null ? false : mins <= options.failWithinHours * 60;
  const blocker = blockerFor(next);
  if (blocker) {
    const hardFail = withinFailWindow || !options.allowMissingWhenFar;
    return {
      ok: !hardFail,
      status: 'blocked',
      hardFail,
      match: next,
      minutesUntilKickoff: mins,
      blocker,
      message: `${blocker}: ${fixtureLabel(next)}`,
    };
  }

  const entry = manifestEntryForMatch(manifest, next);
  if (!entry) {
    const hardFail = withinFailWindow || !options.allowMissingWhenFar;
    return {
      ok: !hardFail,
      status: 'missing_manifest_entry',
      hardFail,
      match: next,
      minutesUntilKickoff: mins,
      message: `No scenario manifest entry for next fixture: ${fixtureLabel(next)}`,
    };
  }

  const fileCheck = scenarioFilesReady(entry, options);
  if (!fileCheck.ok) {
    const hardFail = withinFailWindow || !options.allowMissingWhenFar;
    return {
      ok: !hardFail,
      status: 'missing_scenario_files',
      hardFail,
      match: next,
      minutesUntilKickoff: mins,
      issues: fileCheck.issues,
      message: `Scenario files incomplete for ${fixtureLabel(next)}: ${fileCheck.issues.join('; ')}`,
    };
  }

  return {
    ok: true,
    status: 'ready',
    hardFail: false,
    match: next,
    minutesUntilKickoff: mins,
    message: `Hidden knockout scenarios ready for ${fixtureLabel(next)}.`,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const matches = await S.sbAll('matches', '?select=*&order=match_date.asc,id.asc');
  const manifest = readJsonIfExists(opts.manifestPath);
  const result = evaluateReadiness(matches, manifest, opts);
  const prefix = result.ok ? 'OK' : (result.hardFail ? 'ERROR' : 'WARNING');
  console.log(`${prefix}: ${result.message}`);
  if (result.minutesUntilKickoff != null) console.log(`minutes_until_kickoff=${result.minutesUntilKickoff}`);
  if (result.issues && result.issues.length) result.issues.forEach(issue => console.log(`issue: ${issue}`));

  setOutput('ok', result.ok ? 'true' : 'false');
  setOutput('status', result.status);
  setOutput('hard_fail', result.hardFail ? 'true' : 'false');
  setOutput('minutes_until_kickoff', result.minutesUntilKickoff == null ? '' : result.minutesUntilKickoff);
  setOutput('message', result.message);

  if (!result.ok) process.exit(1);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
} else {
  module.exports = {
    parseArgs,
    evaluateReadiness,
    nextUnresolvedKnockout,
    blockerFor,
    sameFixture,
    scenarioFilesReady,
    manifestEntryForMatch,
    minutesUntil,
  };
}
