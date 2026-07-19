// Test: final dashboard celebration is hidden until verified final scenario truth.
// Run: node scripts/test-final-dashboard-celebration.js

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const i18n = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public-data', 'knockout-scenarios', 'manifest.json'), 'utf8'));
const espArgSpainArt = path.join(ROOT, 'story-assets', 'outcome-bases', 'esp-arg-esp-wins-base.png');

function includes(name, text, needle) {
  assert.ok(text.includes(needle), `${name} should include ${needle}`);
  console.log(`ok: ${name}`);
}

includes('final card is hidden by default', html, 'id="dashboard-final-card" style="display:none;"');
includes('final share button exists', html, 'id="dashboard-final-share"');
includes('final share preview exists', html, 'id="dashboard-final-share-preview"');
includes('final card styles exist', css, '.dashboard-final-card');
includes('final card has dashboard order', css, '#user-dashboard-screen #dashboard-final-card');
includes('final preview frame styles exist', css, '.dfc-preview-frame');

includes('scenario surface metadata is captured', app, '_verifiedKnockoutScenarioSurface = {');
includes('final card requires verified scenario surface', app, 'function _currentVerifiedFinalScenarioSurface');
includes('final card requires Golden Boot truth', app, "entry.requires_top_scorer_truth || entry.path_mode === 'winner_top_scorer'");
includes('dashboard renders final celebration', app, 'renderDashboardFinalCelebration(allUsers)');
includes('refresh renders final celebration', app, 'renderDashboardFinalCelebration(users)');
includes('dashboard renders final share preview', app, 'async function _renderDashboardFinalSharePreview');
includes('final preview uses same share-image blob', app, 'const blob = await _finalCelebrationCardToBlob()');
includes('final preview cleans object URLs', app, 'URL.revokeObjectURL(_dashboardFinalPreviewUrl)');
includes('final share is exported', app, 'window.shareFinalCelebrationCard = shareFinalCelebrationCard');
includes('shared rank helper exists', app, 'function _rankLeaderboardUsers');
includes('shared final ranks are gated', app, 'function _useFinalSharedRanks');
includes('final card uses matchup outcome artwork first', app, '/story-assets/outcome-bases/${home}-${away}-${winner}-wins-base.png');
includes('final card falls back to existing champion hero assets', app, '/heroes/hero-${winnerCode}.webp');
includes('final card loads celebration hero before rendering blob', app, 'heroImage = await _loadFinalCelebrationImage(data)');
assert.ok(!app.includes('ctx.moveTo(-118, 432)'), 'final card must not use the old stick-figure captain renderer');
assert.ok(!app.includes('ctx.arc(0, 364, 58'), 'final card must not draw the old primitive face/body');
assert.ok(fs.existsSync(espArgSpainArt), 'pool 349MD final preview must have the Spain-over-Argentina celebration artwork');
console.log('ok: final card does not contain primitive captain drawing');

includes('Hebrew final title translation exists', i18n, "'dashboard.final.title': '{team} אלופת העולם'");
includes('English final title translation exists', i18n, "'dashboard.final.title': '{team} are world champions'");
includes('Golden Boot share text exists', i18n, "'dashboard.final.goldenBootLabel'");
includes('final preview alt translation exists', i18n, "'dashboard.final.previewAlt'");

const finalEntry = (manifest.matches || []).find(entry => String(entry.match && entry.match.stage).toUpperCase() === 'FINAL');
assert.ok(finalEntry, 'manifest should include a final scenario entry');
assert.strictEqual(finalEntry.path_mode, 'winner_top_scorer');
assert.strictEqual(finalEntry.requires_top_scorer_truth, true);
assert.deepStrictEqual((finalEntry.winners || []).slice().sort(), ['ARG', 'ESP']);
const candidateNames = (finalEntry.top_scorer_candidates || []).map(c => String(c.player_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
assert.ok(candidateNames.some(name => name.includes('messi')), 'manifest includes Messi candidate');
assert.ok(candidateNames.some(name => name.includes('mbappe')), 'manifest includes Mbappe candidate');
console.log('ok: final scenario manifest contains winner x Golden Boot grid');
