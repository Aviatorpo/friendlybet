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

function includes(name, text, needle) {
  assert.ok(text.includes(needle), `${name} should include ${needle}`);
  console.log(`ok: ${name}`);
}

includes('final card is hidden by default', html, 'id="dashboard-final-card" style="display:none;"');
includes('final share button exists', html, 'id="dashboard-final-share"');
includes('final card styles exist', css, '.dashboard-final-card');
includes('final card has dashboard order', css, '#user-dashboard-screen #dashboard-final-card');

includes('scenario surface metadata is captured', app, '_verifiedKnockoutScenarioSurface = {');
includes('final card requires verified scenario surface', app, 'function _currentVerifiedFinalScenarioSurface');
includes('final card requires Golden Boot truth', app, "entry.requires_top_scorer_truth || entry.path_mode === 'winner_top_scorer'");
includes('dashboard renders final celebration', app, 'renderDashboardFinalCelebration(allUsers)');
includes('refresh renders final celebration', app, 'renderDashboardFinalCelebration(users)');
includes('final share is exported', app, 'window.shareFinalCelebrationCard = shareFinalCelebrationCard');
includes('shared rank helper exists', app, 'function _rankLeaderboardUsers');
includes('shared final ranks are gated', app, 'function _useFinalSharedRanks');

includes('Hebrew final title translation exists', i18n, "'dashboard.final.title': '{team} אלופת העולם'");
includes('English final title translation exists', i18n, "'dashboard.final.title': '{team} are world champions'");
includes('Golden Boot share text exists', i18n, "'dashboard.final.goldenBootLabel'");

const finalEntry = (manifest.matches || []).find(entry => String(entry.match && entry.match.stage).toUpperCase() === 'FINAL');
assert.ok(finalEntry, 'manifest should include a final scenario entry');
assert.strictEqual(finalEntry.path_mode, 'winner_top_scorer');
assert.strictEqual(finalEntry.requires_top_scorer_truth, true);
assert.deepStrictEqual((finalEntry.winners || []).slice().sort(), ['ARG', 'ESP']);
const candidateNames = (finalEntry.top_scorer_candidates || []).map(c => String(c.player_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
assert.ok(candidateNames.some(name => name.includes('messi')), 'manifest includes Messi candidate');
assert.ok(candidateNames.some(name => name.includes('mbappe')), 'manifest includes Mbappe candidate');
console.log('ok: final scenario manifest contains winner x Golden Boot grid');
