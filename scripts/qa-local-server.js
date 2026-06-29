#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const FIXTURE = require('./qa-staging-fixture');

const ROOT = path.resolve(__dirname, '..');
const QA_REF = process.env.QA_SUPABASE_PROJECT_REF || 'etnkxwsjfckbnbsordih';
const QA_URL = process.env.QA_SUPABASE_URL || `https://${QA_REF}.supabase.co`;
const PORT = Number(process.env.QA_PORT || 4179);
const PUBLIC_DATA_DIR = path.join(ROOT, '_qa-artifacts', 'public-data');
const ARTIFACT_DIR = path.join(ROOT, '_qa-artifacts');
const PROD_REF = 'kovhuahdoluxyqqwqohw';
const QA_WORKFLOW = process.env.QA_GITHUB_WORKFLOW || 'qa-staging-pipeline.yml';
const QA_WORKFLOW_REF = process.env.QA_GITHUB_REF || 'main';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function resolveQaKeys() {
  const publishable = process.env.QA_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  const service = process.env.QA_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (publishable && service) return { publishable, service };

  const result = spawnSync('supabase', ['projects', 'api-keys', '--project-ref', QA_REF, '--output', 'json'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.status !== 0) {
    throw new Error(`Unable to read staging Supabase keys: ${result.stderr || result.stdout}`);
  }
  const keys = JSON.parse(result.stdout);
  return {
    publishable: publishable || (keys.find(k => k.type === 'publishable') || keys.find(k => k.name === 'anon') || {}).api_key,
    service: service || (keys.find(k => k.name === 'service_role') || {}).api_key
  };
}

const QA_KEYS = resolveQaKeys();
if (!QA_KEYS.publishable || !QA_KEYS.service) throw new Error('Missing QA Supabase publishable or service key.');
if (QA_URL.includes(PROD_REF) || QA_REF === PROD_REF) throw new Error('Refusing to start QA server against production Supabase.');

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data, null, 2), 'application/json; charset=utf-8');
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isTerminalMatch(row) {
  return ['FINISHED', 'AWARDED'].includes(String(row && row.status || '').toUpperCase());
}

function safeStaticPath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const clean = decoded.replace(/^\/+/, '') || 'index.html';
  const full = path.resolve(root, clean);
  if (!full.startsWith(root)) return null;
  return full;
}

function qaConfig() {
  const original = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  return original
    .replace(/SUPABASE_URL:\s*'[^']*'/, `SUPABASE_URL: '${QA_URL}'`)
    .replace(/SUPABASE_PUBLISHABLE_KEY:\s*'[^']*'/, `SUPABASE_PUBLISHABLE_KEY: '${QA_KEYS.publishable}'`)
    .replace(/APP_VERSION:\s*'([^']*)'/, `APP_VERSION: '$1-qa-staging'`);
}

function qaBannerHtml() {
  const users = FIXTURE.users.map(user => {
    const bare = user.recovery_code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return `<a class="qa-chip" href="/?login=${bare}">${user.nickname}</a>`;
  }).join('');
  return `
<style>
  .qa-staging-bar{position:fixed;z-index:99999;left:0;right:0;top:0;background:#101820;color:#fff;border-bottom:3px solid #f8c537;font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)}
  .qa-staging-inner{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:8px 12px;flex-wrap:wrap}
  .qa-title{font-weight:800;color:#f8c537}.qa-copy{opacity:.9}.qa-chip,.qa-button{border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:6px 8px;color:#fff;background:rgba(255,255,255,.08);text-decoration:none;cursor:pointer}.qa-button:disabled{opacity:.55;cursor:wait}
  .qa-controls{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.qa-controls input,.qa-controls select{height:30px;border-radius:6px;border:1px solid #596575;background:#fff;color:#111;padding:0 6px}.qa-score{width:52px}.qa-match-select{width:260px;max-width:46vw}.qa-status{min-width:170px;opacity:.9}
  body{padding-top:66px}
  @media(max-width:720px){body{padding-top:164px}.qa-staging-inner{align-items:flex-start}.qa-copy{font-size:12px}.qa-match-select{width:100%;max-width:100%}}
</style>
<div class="qa-staging-bar" dir="ltr">
  <div class="qa-staging-inner">
    <div><span class="qa-title">QA STAGING</span> <span class="qa-copy">Synthetic users/results only. No money, no prizes, no odds, no payouts, no real gambling.</span></div>
    <div class="qa-controls">
      ${users}
      <select id="qa-future-match" class="qa-match-select"><option>Load future matches...</option></select>
      <input id="qa-home-score" class="qa-score" type="number" min="0" max="20" value="2">
      <input id="qa-away-score" class="qa-score" type="number" min="0" max="20" value="1">
      <select id="qa-winner"><option value="">Winner</option></select>
      <button class="qa-button" id="qa-run-future-result" type="button">Run GitHub simulation</button>
      <button class="qa-button" id="qa-randomize-finished" type="button">Seed via GitHub</button>
      <span class="qa-status" id="qa-status"></span>
    </div>
  </div>
</div>
<script>
(() => {
  const status = () => document.getElementById('qa-status');
  const setStatus = text => { const el = status(); if (el) el.textContent = text || ''; };
  const matchSelect = document.getElementById('qa-future-match');
  const winnerSelect = document.getElementById('qa-winner');
  const btn = document.getElementById('qa-run-future-result');
  const randomBtn = document.getElementById('qa-randomize-finished');
  let futureMatches = [];
  const selectedMatch = () => futureMatches.find(m => String(m.external_id) === String(matchSelect && matchSelect.value));
  const formatMatch = m => {
    const date = m.match_date ? new Date(m.match_date).toLocaleString('en-GB', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
    return date + ' ' + m.stage + ' ' + m.home_team_code + '-' + m.away_team_code;
  };
  const refreshWinnerOptions = () => {
    const m = selectedMatch();
    if (!winnerSelect) return;
    winnerSelect.innerHTML = '';
    if (!m) {
      winnerSelect.append(new Option('Winner', ''));
      return;
    }
    winnerSelect.append(new Option(m.home_team_code + ' wins', m.home_team_code));
    winnerSelect.append(new Option(m.away_team_code + ' wins', m.away_team_code));
  };
  const loadFutureMatches = async () => {
    if (!matchSelect) return;
    try {
      const res = await fetch('/__qa/future-matches');
      const data = await res.json();
      futureMatches = data.matches || [];
      matchSelect.innerHTML = '';
      if (!futureMatches.length) {
        matchSelect.append(new Option('No scoreable future matches', ''));
      } else {
        futureMatches.forEach(m => matchSelect.append(new Option(formatMatch(m), m.external_id)));
      }
      refreshWinnerOptions();
    } catch (err) {
      matchSelect.innerHTML = '';
      matchSelect.append(new Option('Seed current WC first', ''));
    }
  };
  if (matchSelect) matchSelect.addEventListener('change', refreshWinnerOptions);
  if (btn) btn.addEventListener('click', async () => {
    btn.disabled = true;
    setStatus('Dispatching GitHub Action...');
    try {
      const m = selectedMatch();
      if (!m) throw new Error('Choose a future match');
      const body = {
        external_id: m.external_id,
        home_score: Number(document.getElementById('qa-home-score').value),
        away_score: Number(document.getElementById('qa-away-score').value),
        winner: winnerSelect.value
      };
      const res = await fetch('/__qa/simulate-future-result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'QA run failed');
      setStatus('Action done in ' + Math.round(data.duration_ms / 1000) + 's');
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      setStatus(err.message || 'Failed');
    } finally {
      btn.disabled = false;
    }
  });
  if (randomBtn) randomBtn.addEventListener('click', async () => {
    randomBtn.disabled = true;
    setStatus('Dispatching GitHub seed...');
    try {
      const res = await fetch('/__qa/randomize-finished', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'QA randomizer failed');
      setStatus('Action done in ' + Math.round(data.duration_ms / 1000) + 's');
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      setStatus(err.message || 'Failed');
    } finally {
      randomBtn.disabled = false;
    }
  });
  loadFutureMatches();
})();
</script>`;
}

function injectIndex(html) {
  return html.replace('</body>', `${qaBannerHtml()}\n</body>`);
}

function runNodeStep(args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      windowsHide: true,
      env: {
        ...process.env,
        TARGET_ENV: 'qa',
        FRIENDLYBET_TARGET_ENV: 'qa',
        QA_SUPABASE_PROJECT_REF: QA_REF,
        SUPABASE_URL: QA_URL,
        SUPABASE_SECRET_KEY: QA_KEYS.service,
        PUBLIC_DATA_DIR: '_qa-artifacts/public-data',
        FORCE_MATCH_SNAPSHOT: '1',
        SCORING_SUPABASE_FETCH_TIMEOUT_MS: '30000',
        ...extraEnv
      }
    });
    let out = '';
    child.stdout.on('data', data => { out += data.toString(); });
    child.stderr.on('data', data => { out += data.toString(); });
    child.on('close', code => {
      if (code === 0) resolve(out);
      else reject(new Error(`${args.join(' ')} failed (${code})\n${out}`));
    });
  });
}

function runCommand(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      windowsHide: true,
      env: { ...process.env, ...(opts.env || {}) }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    const timeoutMs = opts.timeoutMs || 30000;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} ${args.join(' ')} timed out after ${timeoutMs}ms\n${stdout}${stderr}`));
    }, timeoutMs);
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stdout}${stderr}`));
    });
  });
}

async function runGh(args, opts = {}) {
  return runCommand('gh', args, opts);
}

async function ghJson(args, opts = {}) {
  const result = await runGh(args, opts);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function repoSlug() {
  const data = await ghJson(['repo', 'view', '--json', 'nameWithOwner'], { timeoutMs: 30000 });
  if (!data || !data.nameWithOwner) throw new Error('Could not resolve GitHub repository.');
  return data.nameWithOwner;
}

async function findWorkflowRun(repo, token) {
  const data = await ghJson([
    'api',
    `repos/${repo}/actions/runs`,
    '--method',
    'GET',
    '-f',
    'event=workflow_dispatch',
    '-f',
    'per_page=30'
  ], { timeoutMs: 30000 });
  const runs = data && Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
  return runs.find(run => String(run.display_title || '').includes(token));
}

async function waitForWorkflowRun(repo, token) {
  const started = Date.now();
  let run = null;
  while (!run && Date.now() - started < 90000) {
    run = await findWorkflowRun(repo, token);
    if (!run) await sleep(3000);
  }
  if (!run) throw new Error(`GitHub Actions run was dispatched but not found for token ${token}.`);

  while (!['completed'].includes(String(run.status || '').toLowerCase())) {
    if (Date.now() - started > 25 * 60 * 1000) {
      throw new Error(`GitHub Actions run ${run.id} did not finish within 25 minutes: ${run.html_url || ''}`);
    }
    await sleep(5000);
    run = await ghJson(['api', `repos/${repo}/actions/runs/${run.id}`], { timeoutMs: 30000 });
  }
  if (run.conclusion !== 'success') {
    throw new Error(`GitHub Actions run ${run.id} ended with ${run.conclusion || 'unknown'}: ${run.html_url || ''}`);
  }
  return run;
}

function installDownloadedArtifact(downloadDir) {
  const sourceRoot = fs.existsSync(path.join(downloadDir, 'public-data'))
    ? downloadDir
    : (fs.existsSync(path.join(downloadDir, '_qa-artifacts')) ? path.join(downloadDir, '_qa-artifacts') : downloadDir);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  for (const name of [
    'public-data',
    'qa-run-summary.json',
    'qa-current-world-cup-seed-summary.json',
    'qa-random-finished-seed-summary.json',
    'qa-future-simulation-summary.json'
  ]) {
    fs.rmSync(path.join(ARTIFACT_DIR, name), { recursive: true, force: true });
  }
  fs.cpSync(sourceRoot, ARTIFACT_DIR, { recursive: true, force: true });
}

async function runGithubQaWorkflow(mode, inputs = {}) {
  const started = Date.now();
  const token = `qa-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const repo = await repoSlug();
  const fields = {
    mode,
    qa_run_id: token,
    external_id: inputs.external_id || '',
    home_score: inputs.home_score == null ? '' : String(inputs.home_score),
    away_score: inputs.away_score == null ? '' : String(inputs.away_score),
    winner: inputs.winner || ''
  };
  const args = ['workflow', 'run', QA_WORKFLOW, '--ref', QA_WORKFLOW_REF];
  for (const [key, value] of Object.entries(fields)) args.push('-f', `${key}=${value}`);
  await runGh(args, { timeoutMs: 30000 });
  const run = await waitForWorkflowRun(repo, token);
  const downloadDir = path.join(ARTIFACT_DIR, `_download-${token}`);
  fs.rmSync(downloadDir, { recursive: true, force: true });
  fs.mkdirSync(downloadDir, { recursive: true });
  await runGh(['run', 'download', String(run.id), '--name', `qa-staging-proof-${token}`, '--dir', downloadDir], { timeoutMs: 120000 });
  installDownloadedArtifact(downloadDir);
  fs.rmSync(downloadDir, { recursive: true, force: true });
  const summaryPath = path.join(ARTIFACT_DIR, 'qa-run-summary.json');
  return {
    ok: true,
    orchestration: 'github_actions',
    workflow: QA_WORKFLOW,
    ref: QA_WORKFLOW_REF,
    run_id: run.id,
    run_url: run.html_url,
    duration_ms: Date.now() - started,
    summary: fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : null
  };
}

function validateResult(input) {
  const home = Number(input.home_score);
  const away = Number(input.away_score);
  const winner = String(input.winner || '').toUpperCase();
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 20 || away > 20) {
    throw new Error('Scores must be integers from 0 to 20.');
  }
  if (!['MEX', 'RSA'].includes(winner)) throw new Error('Winner must be MEX or RSA.');
  if (home === away) throw new Error('This QA match is knockout-only; choose a non-draw score for now.');
  if ((home > away && winner !== 'MEX') || (away > home && winner !== 'RSA')) {
    throw new Error('Winner must match the score.');
  }
  return { home, away, winner };
}

async function runQaPipeline(input) {
  const result = validateResult(input);
  const started = Date.now();
  const resultsJson = JSON.stringify([{
    external_id: FIXTURE.match.external_id,
    home: FIXTURE.match.home_team_code,
    away: FIXTURE.match.away_team_code,
    home_score: result.home,
    away_score: result.away,
    winner: result.winner,
    stage: FIXTURE.match.stage
  }]);
  const steps = [];
  for (const [label, args, env] of [
    ['reset', ['scripts/qa-reset-staging-data.js'], {}],
    ['manual-result', ['scripts/manual-match-results.js'], { MANUAL_MATCH_RESULTS_JSON: resultsJson }],
    ['score', ['scripts/calculate-scores-v2.js', '--critical'], {}],
    ['export', ['scripts/export-snapshots.js', 'all'], {}],
    ['verify-snapshots', ['scripts/verify-scoring-snapshots.js'], {}],
    ['banter', ['scripts/generate-banter.js'], {}],
    ['pundit', ['scripts/generate-pundit.js'], {}],
    ['verify-qa', ['scripts/qa-verify-staging-rehearsal.js'], {}]
  ]) {
    const output = await runNodeStep(args, env);
    steps.push({ label, output: output.trim().slice(-2500) });
  }
  return { ok: true, duration_ms: Date.now() - started, result, steps };
}

async function runRandomFinishedPipeline() {
  if (process.env.QA_USE_LOCAL_PIPELINE !== '1') {
    return runGithubQaWorkflow('seed_current');
  }
  const started = Date.now();
  const steps = [];
  for (const [label, args] of [
    ['randomize-finished', ['scripts/qa-randomize-finished-world-cup.js']],
    ['score', ['scripts/calculate-scores-v2.js', '--critical']],
    ['export', ['scripts/export-snapshots.js', 'all']],
    ['verify-snapshots', ['scripts/verify-scoring-snapshots.js']],
    ['banter', ['scripts/generate-banter.js']],
    ['pundit', ['scripts/generate-pundit.js']],
    ['verify-random-finished', ['scripts/qa-verify-random-finished-world-cup.js']]
  ]) {
    const output = await runNodeStep(args);
    steps.push({ label, output: output.trim().slice(-2500) });
  }
  const summaryPath = path.join(ROOT, '_qa-artifacts', 'qa-run-summary.json');
  return {
    ok: true,
    duration_ms: Date.now() - started,
    summary: fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : null,
    steps
  };
}

function futureMatchesFromSnapshot() {
  const snapshot = readJson(path.join(PUBLIC_DATA_DIR, 'matches.json'), {});
  const rows = Array.isArray(snapshot.matches) ? snapshot.matches : [];
  const matches = rows
    .filter(m => m && !isTerminalMatch(m) && m.home_team_code && m.away_team_code)
    .sort((a, b) => String(a.match_date || '').localeCompare(String(b.match_date || '')))
    .map(m => ({
      external_id: String(m.external_id || ''),
      stage: m.stage || null,
      match_date: m.match_date || null,
      home_team_code: m.home_team_code || null,
      away_team_code: m.away_team_code || null,
      home_team_name: m.home_team_name || m.home_team_code || null,
      away_team_name: m.away_team_name || m.away_team_code || null,
      status: m.status || null
    }))
    .filter(m => m.external_id);
  const placeholders = rows.filter(m => m && !isTerminalMatch(m) && (!m.home_team_code || !m.away_team_code)).length;
  return {
    updatedAt: snapshot.updatedAt || null,
    count: matches.length,
    placeholder_count: placeholders,
    matches
  };
}

function validateFutureResult(input) {
  const externalId = String(input.external_id || '').trim();
  const home = Number(input.home_score);
  const away = Number(input.away_score);
  const winner = String(input.winner || '').toUpperCase();
  const allowed = futureMatchesFromSnapshot().matches.find(m => m.external_id === externalId);
  if (!allowed) throw new Error('Choose a concrete future match from the QA list.');
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 20 || away > 20) {
    throw new Error('Scores must be integers from 0 to 20.');
  }
  if (![allowed.home_team_code, allowed.away_team_code].includes(winner)) {
    throw new Error(`Winner must be ${allowed.home_team_code} or ${allowed.away_team_code}.`);
  }
  if (home > away && winner !== allowed.home_team_code) throw new Error('Winner must match the score.');
  if (away > home && winner !== allowed.away_team_code) throw new Error('Winner must match the score.');
  return { externalId, home, away, winner, match: allowed };
}

async function runFuturePipeline(input) {
  const result = validateFutureResult(input);
  if (process.env.QA_USE_LOCAL_PIPELINE !== '1') {
    const data = await runGithubQaWorkflow('simulate_future', {
      external_id: result.externalId,
      home_score: result.home,
      away_score: result.away,
      winner: result.winner
    });
    return {
      ...data,
      result: {
        external_id: result.externalId,
        teams: `${result.match.home_team_code}-${result.match.away_team_code}`,
        score: `${result.home}-${result.away}`,
        winner: result.winner
      }
    };
  }
  const started = Date.now();
  const steps = [];
  const simEnv = {
    QA_MATCH_EXTERNAL_ID: result.externalId,
    QA_HOME_SCORE: String(result.home),
    QA_AWAY_SCORE: String(result.away),
    QA_WINNER: result.winner
  };
  for (const [label, args, env] of [
    ['simulate-future-result', ['scripts/qa-simulate-future-result.js'], simEnv],
    ['score', ['scripts/calculate-scores-v2.js', '--critical'], {}],
    ['export', ['scripts/export-snapshots.js', 'all'], {}],
    ['verify-snapshots', ['scripts/verify-scoring-snapshots.js'], {}],
    ['banter', ['scripts/generate-banter.js'], {}],
    ['pundit', ['scripts/generate-pundit.js'], {}],
    ['verify-future-world-cup', ['scripts/qa-verify-future-world-cup.js'], {}]
  ]) {
    const output = await runNodeStep(args, env);
    steps.push({ label, output: output.trim().slice(-2500) });
  }
  const summaryPath = path.join(ROOT, '_qa-artifacts', 'qa-run-summary.json');
  return {
    ok: true,
    duration_ms: Date.now() - started,
    result: {
      external_id: result.externalId,
      teams: `${result.match.home_team_code}-${result.match.away_team_code}`,
      score: `${result.home}-${result.away}`,
      winner: result.winner
    },
    summary: fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : null,
    steps
  };
}

async function handleQaApply(req, res) {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', async () => {
    try {
      const payload = raw ? JSON.parse(raw) : {};
      const data = await runQaPipeline(payload);
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message });
    }
  });
}

async function handleQaRandomFinished(req, res) {
  req.on('data', () => {});
  req.on('end', async () => {
    try {
      const data = await runRandomFinishedPipeline();
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message });
    }
  });
}

async function handleQaFutureResult(req, res) {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', async () => {
    try {
      const payload = raw ? JSON.parse(raw) : {};
      const data = await runFuturePipeline(payload);
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message });
    }
  });
}

function handleStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/__qa/status') {
    const summaryPath = path.join(ROOT, '_qa-artifacts', 'qa-run-summary.json');
    const summary = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : null;
    return sendJson(res, 200, {
      ok: true,
      qa_url: QA_URL,
      project_ref: QA_REF,
      pool_code: FIXTURE.pool.code,
      users: FIXTURE.users.map(u => ({ nickname: u.nickname, recovery_code: u.recovery_code, login: `/?login=${u.recovery_code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}` })),
      summary
    });
  }
  if (url.pathname === '/__qa/future-matches') {
    return sendJson(res, 200, futureMatchesFromSnapshot());
  }
  if (url.pathname === '/__qa/apply-result' && req.method === 'POST') return handleQaApply(req, res);
  if (url.pathname === '/__qa/randomize-finished' && req.method === 'POST') return handleQaRandomFinished(req, res);
  if (url.pathname === '/__qa/simulate-future-result' && req.method === 'POST') return handleQaFutureResult(req, res);
  if (url.pathname === '/config.js') return send(res, 200, qaConfig(), MIME['.js']);
  if (url.pathname === '/service-worker.js') return send(res, 200, 'self.addEventListener("install",e=>self.skipWaiting());self.addEventListener("fetch",()=>{});', MIME['.js']);

  const root = url.pathname.startsWith('/public-data/') ? PUBLIC_DATA_DIR : ROOT;
  const rel = url.pathname.startsWith('/public-data/') ? url.pathname.replace(/^\/public-data\//, '/') : url.pathname;
  const file = safeStaticPath(root, rel);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (url.pathname === '/' || !path.extname(url.pathname)) {
      const html = injectIndex(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
      return send(res, 200, html, MIME['.html']);
    }
    return send(res, 404, 'Not found');
  }
  const ext = path.extname(file).toLowerCase();
  let body = fs.readFileSync(file);
  if (path.basename(file) === 'index.html') body = injectIndex(body.toString('utf8'));
  send(res, 200, body, MIME[ext] || 'application/octet-stream');
}

const server = http.createServer((req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    handleStatic(req, res);
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`FriendlyBet QA server running: http://localhost:${PORT}/?login=EYALQA260001TEST`);
  console.log(`QA pool: ${FIXTURE.pool.code}`);
  console.log(`Staging Supabase: ${QA_URL}`);
});
