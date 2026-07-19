// Test: pool-scoped final preview for 349MD cannot become global result truth.
// Run: node scripts/test-pool-final-preview.js

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const previewPath = path.join(ROOT, 'public-data', 'final-preview', '349MD.json');
const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
const scenario = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'public-data',
  'knockout-scenarios',
  '400021543',
  'ESP',
  '8c339bd2-3fc2-49f2-a755-622f406a01dc',
  '4927bd42-a9aa-4bf5-ab5d-e166869a72c6.json'
), 'utf8'));

function includes(name, text, needle) {
  assert.ok(text.includes(needle), `${name} should include ${needle}`);
  console.log(`ok: ${name}`);
}

includes('preview allowlist is exactly pool 349MD', app, "const POOL_FINAL_PREVIEW_CODES = new Set(['349MD'])");
includes('preview fetch uses code-scoped public data file', app, '/public-data/final-preview/${encodeURIComponent(code)}.json');
includes('preview requires active flag', app, 'if (!raw || raw.active !== true) return null');
includes('preview requires exact pool code', app, "String(raw.pool_code || '').trim().toUpperCase() !== code");
includes('preview requires exact pool id', app, "String(raw.pool_id) !== String(pool.id || '')");
includes('preview requires same member ids', app, '_scenarioStandingsMatchCurrentUsers(preview.standings, currentUsers)');
includes('dashboard applies pool final preview after normal final scenario', app, 'allUsers = await _applyPoolFinalPreviewUsers(state.currentPool.id, allUsers)');
includes('refresh applies pool final preview after normal final scenario', app, 'users = await _applyPoolFinalPreviewUsers(state.currentPool.id, users)');
includes('preview surface is marked non-base', app, "variantKind: 'pool_final_preview'");
includes('preview overlays final match only in memory', app, 'function _applyPoolFinalPreviewResults');
includes('preview removes matching pending verification rows', app, 'state.results.pendingVerificationMatches = (Array.isArray(state.results.pendingVerificationMatches)');
includes('preview stores final knockout winner in memory', app, 'state.results.knockoutWinners[match.id] = _matchResolvedWinner(match)');

const previewBlock = app.slice(
  app.indexOf('function _poolFinalPreviewCode'),
  app.indexOf('let _dashboardFinalCelebrationState')
);
assert.ok(previewBlock.length > 0, 'preview helper block should be extractable');
assert.ok(!/\.from\('app_settings'\)[\s\S]*\.(insert|upsert|update|delete)\(/.test(previewBlock), 'preview must not write global top-scorer truth');
assert.ok(!/\.from\('matches'\)[\s\S]*\.(insert|upsert|update|delete)\(/.test(previewBlock), 'preview must not write global match truth');
console.log('ok: preview block has no global DB writes');

assert.strictEqual(preview.active, true, '349MD preview must be active for this production preview');
assert.strictEqual(preview.type, 'pool_final_preview');
assert.strictEqual(preview.pool_code, '349MD');
assert.strictEqual(preview.pool_id, '4927bd42-a9aa-4bf5-ab5d-e166869a72c6');
assert.strictEqual(preview.winner_code, 'ESP');
assert.strictEqual(preview.match.stage, 'FINAL');
assert.strictEqual(preview.match.external_id, '400021543');
assert.strictEqual(preview.match.status, 'FINISHED');
assert.strictEqual(preview.match.home_team_code, 'ESP');
assert.strictEqual(preview.match.away_team_code, 'ARG');
assert.strictEqual(preview.match.home_score, 2);
assert.strictEqual(preview.match.away_score, 0);
assert.strictEqual(preview.match.winner_code, 'ESP');
assert.strictEqual(preview.top_scorer.player_id, '8c339bd2-3fc2-49f2-a755-622f406a01dc');
assert.strictEqual(preview.top_scorer.team_code, 'FRA');
assert.strictEqual(preview.count, 10);
assert.strictEqual(preview.standings.length, 10);

const previewIds = preview.standings.map(row => String(row.id)).sort();
const scenarioIds = scenario.standings.map(row => String(row.id)).sort();
assert.deepStrictEqual(previewIds, scenarioIds, 'preview standings must contain the same users as the source scenario');

const previewScores = preview.standings.map(row => ({
  id: row.id,
  total_score: row.total_score,
  group_points: row.group_points,
  knockout_points: row.knockout_points,
  bonus_points: row.bonus_points
}));
const scenarioScores = scenario.standings.map(row => ({
  id: row.id,
  total_score: row.total_score,
  group_points: row.group_points,
  knockout_points: row.knockout_points,
  bonus_points: row.bonus_points
}));
assert.deepStrictEqual(previewScores, scenarioScores, 'preview scores must match the precomputed Spain + Mbappe scenario');

const tiedAt141 = preview.standings.filter(row => row.total_score === 141);
assert.strictEqual(tiedAt141.length, 2, 'preview should preserve the 141-point tie for shared-rank QA');
assert.strictEqual(preview.standings[0].nickname, 'טל טוטנאור');
assert.strictEqual(preview.standings[0].total_score, 199);
assert.strictEqual(preview.standings[2].nickname, 'אייל');
assert.strictEqual(preview.standings[2].total_score, 186);

console.log('ok: pool 349MD final preview is scoped, deterministic, and score-identical to the source scenario');
