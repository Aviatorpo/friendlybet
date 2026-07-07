const fs = require('fs');

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const i18n = fs.readFileSync('i18n.js', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(!app.includes('DASHBOARD_IMPACT_PILOT_POOL_ID'), 'dashboard rollout is not tied to one pool id');
assert(!app.includes('DASHBOARD_IMPACT_PILOT_POOL_CODE'), 'dashboard rollout is not tied to one pool code');
assert(!app.includes('DASHBOARD_IMPACT_PILOT_USER_ID'), 'dashboard rollout is not tied to one reviewer user');
assert(app.includes('function _isDashboardImpactEnabled'), 'dashboard eligibility function exists');
assert(app.includes('renderDashboardImpactPilot(allUsers'), 'dashboard render calls pilot renderer');
assert(app.includes('renderDashboardImpactPilot(users'), 'score refresh updates pilot renderer');
assert(!app.includes('_dashboardImpactLivePreviewMatches'), 'production build must not include fake live preview helpers');
assert(!app.includes('live-real-app'), 'production build must not include local live preview routing');

const gateStart = app.indexOf('function _isDashboardImpactEnabled');
const gateEnd = app.indexOf('function _setDashboardImpactPilotMode', gateStart);
const gateBody = app.slice(gateStart, gateEnd);
assert(gateStart >= 0 && gateEnd > gateStart, 'dashboard eligibility body is extractable');
assert(!/(location|searchParams|localStorage)/.test(gateBody), 'dashboard rollout does not depend on URL or browser storage flags');
assert(gateBody.includes('if (!pool) return false'), 'dashboard stays hidden when no pool is loaded');
assert(gateBody.includes('state.currentUser && state.currentUser.id'), 'dashboard requires a real logged-in pool user');
assert(!gateBody.includes('is_admin'), 'dashboard rollout is not admin-only');
assert(!gateBody.includes('349MD'), 'dashboard rollout is not pool-code gated');
assert(!gateBody.includes('a8fe26ff-12df-45ed-890b-70b6072fe2c0'), 'dashboard rollout is not reviewer-user gated');

const pilotStart = app.indexOf('const DASHBOARD_IMPACT_PICK_CACHE_MS');
const pilotEnd = app.indexOf('function _hideDashboardProjectionTeaser', pilotStart);
const pilotBody = app.slice(pilotStart, pilotEnd);
assert(pilotStart >= 0 && pilotEnd > pilotStart, 'pilot body is extractable');
assert(pilotBody.includes('_dashboardImpactLoadMyBracketPicks'), 'pilot reads current user bracket picks');
assert(pilotBody.includes(".eq('pool_id', poolId)"), 'pilot pick read is pool scoped');
assert(pilotBody.includes(".not('bracket_position', 'is', null)"), 'pilot reads single-phase bracket positions only');
assert(pilotBody.includes('.range(0, 9999)'), 'pilot reads all bracket picks, not only the first Supabase page');
assert(pilotBody.includes('_dashboardImpactLoadMemoryBracketRows'), 'pilot can fall back to loaded single-phase picks');
assert(pilotBody.includes('const legacy = await readPicks(false);'), 'pilot has legacy unscoped pick fallback for older single-phase rows');
assert(pilotBody.includes('return resolvedRows;'), 'pilot returns empty arrays distinctly from failed pick loads');
assert(!pilotBody.includes('if (!resolvedRows.length) return null'), 'empty successful pick reads must not look like load failure');
assert(pilotBody.includes("if (!fallbackRows.length) console.warn('dashboard impact pilot: knockout pick read failed'"), 'pick-read warnings are suppressed when fallback rows are usable');
assert(pilotBody.includes('_dashboardImpactPickPointsForTeamAtStage'), 'pilot calculates stage-specific point impact');
assert(pilotBody.includes('_dashboardImpactVerifiedAdvancer'), 'pilot uses verified knockout advancer for result points');
assert(pilotBody.includes('winner_code'), 'result points depend on verified winner_code');
assert(pilotBody.includes('_dashboardImpactMatchStackHtml(activeMatch, lastResult, nextMatch, bracketPicks)'), 'live dashboard renders live/last/next stack');
assert(pilotBody.includes('_dashboardImpactNextMatch(matches, Date.now(), activeMatch)'), 'next match is not hidden during live state');
assert(pilotBody.includes("_dashboardImpactTeamScoreText(match, 'home', ux)"), 'home score is bound to the home team row');
assert(pilotBody.includes("_dashboardImpactTeamScoreText(match, 'away', ux)"), 'away score is bound to the away team row');
assert(pilotBody.includes('_dashboardImpactScorePillHtml(match, ux)'), 'scoreboard renders score through a dedicated pill helper');
assert(pilotBody.includes('dip-score-pill-scored'), 'scored matches render one centered score pill');
assert(pilotBody.includes('dip-score-number-home'), 'home score is isolated in its own numeric span');
assert(pilotBody.includes('dip-score-number-away'), 'away score is isolated in its own numeric span');
assert(pilotBody.includes('dip-score-separator'), 'score separator is isolated from team-name bidi text');
assert(!pilotBody.includes('dip-team-score-badge'), 'scored matches no longer stack team rows with separate score badges');
assert(!pilotBody.includes('dip-score-team-scored'), 'scored team rows stay in the same horizontal scoreboard');
assert(pilotBody.includes('<div class="dip-score-pill">VS</div>'), 'score pill is used only for scoreless fixture states');
assert(!pilotBody.includes('`${match.home_score}-${match.away_score}`'), 'pilot must not render one shared bidi-sensitive score string');
assert(pilotBody.includes('dip-match-block-compact'), 'last/next cards become compact when a live match is present');
assert(pilotBody.includes('_dashboardImpactMatchMeta(match, ux)'), 'live card metadata receives UX state');
assert(pilotBody.includes('_matchLiveClockLabel(match)'), 'live match metadata uses live clock when available');
assert(pilotBody.includes('_dashboardImpactOpenBracket'), 'bracket button uses resilient opener');
assert(pilotBody.includes('await spLoadExistingPicks();'), 'single-phase bracket opens after picks are loaded');
assert(pilotBody.includes('openSpBracketView();'), 'single-phase bracket still opens the real bracket modal');
assert(pilotBody.includes('scenarioPointsSentence'), 'future/live scenarios use explicit pool-point copy');
assert(pilotBody.includes('scenarioPointsUnavailable'), 'scenario rows have a load fallback sentence');
assert(pilotBody.includes('dip-match-card dip-match-block'), 'each match impact item renders as its own card');
assert(pilotBody.includes('_dashboardImpactEmptyCardHtml'), 'empty match states keep the same card structure');
assert(!pilotBody.includes('_fetchKnockoutScenarioManifest'), 'pilot does not depend on generated scenario JSON');
assert(!pilotBody.includes("t('dashboard.impact.ifAdvances')"), 'generic if-advances copy is not rendered in pilot');
assert(!pilotBody.includes("dashboard.impact.pointsChecking"), 'pilot does not render checking-points copy');
assert(!pilotBody.includes('dip-scenarios'), 'pilot no longer has one shared scenario container id');
assert(!pilotBody.includes('dip-score-pill">${escapeHtml'), 'scored matches do not render a shared middle score pill');
assert(!pilotBody.includes("getElementById('dip-match-title')"), 'pilot does not render a duplicate parent match title');
assert(!pilotBody.includes("getElementById('dip-match-sub')"), 'pilot does not render duplicate parent match metadata');

const pointRowStart = app.indexOf('function _dashboardImpactPointSentenceHtml');
const pointRowEnd = app.indexOf('function _dashboardImpactScenarioRows', pointRowStart);
const pointRowBody = app.slice(pointRowStart, pointRowEnd);
assert(pointRowStart >= 0 && pointRowEnd > pointRowStart, 'point sentence body is extractable');
assert(!pointRowBody.includes('getCountryFlag'), 'point rows do not duplicate flags');
assert(!pointRowBody.includes('dip-flag'), 'point rows keep flags only in the scoreboard');
assert(pointRowBody.includes('_dashboardImpactPointSentenceHtml'), 'point rows render as readable sentences');
assert(pointRowBody.includes('dip-points-value'), 'point rows emphasize the pool point value inline');

assert(index.includes('id="dashboard-impact-pilot"'), 'dashboard pilot mount exists');
assert(index.includes('id="dip-open-leaderboard"'), 'leaderboard action exists');
assert(index.includes('id="dip-open-bracket"'), 'bracket action exists');
assert(!index.includes('id="dip-match-title"'), 'dashboard pilot has no duplicate parent match title');
assert(!index.includes('id="dip-match-sub"'), 'dashboard pilot has no duplicate parent match subline');

assert(styles.includes('.dashboard-impact-pilot-active #dashboard-drama-hero'), 'pilot hides old hero only inside active gate');
assert(styles.includes('#user-dashboard-screen.dashboard-impact-pilot-active #pundit-card'), 'pilot reorders Pundit under match module');
assert(styles.includes('.dip-scoreboard'), 'pilot has a single scoreboard row');
assert(styles.includes('.dip-scoreboard-scored'), 'scored matches use a dedicated horizontal score layout');
assert(styles.includes('.dip-score-pill-scored'), 'center score has a scored visual state');
assert(styles.includes('.dip-score-number'), 'team scores are isolated inside the center score pill');
assert(!styles.includes('.dip-team-score-badge'), 'old vertical per-team score badges were removed');
assert(!styles.includes('.dip-score-team-scored'), 'old stacked scored-team layout was removed');
assert(styles.includes('direction: ltr;'), 'numeric score pill is isolated from RTL bidi reordering');
assert(styles.includes('unicode-bidi: isolate'), 'numeric score pill has an explicit bidi fallback');
assert(styles.includes('.dip-point-row'), 'pilot has simple point rows');
assert(styles.includes('.dip-point-sentence'), 'pilot point rows are sentence-based');
assert(styles.includes('.dip-points-value'), 'pilot emphasizes points inline');
assert(styles.includes('.dip-action:disabled'), 'pilot bracket action has a disabled state');
assert(styles.includes('.dip-match-block-compact'), 'pilot can de-emphasize secondary cards during live matches');
assert(styles.includes('.dip-match-stack'), 'pilot stacks separate match cards');
assert(styles.includes('gap: 10px'), 'pilot separates match cards visually');
assert(!styles.includes('.dip-scenario-row'), 'pilot does not style nested scenario cards');
assert(!styles.includes('grid-template-columns: minmax(0, 1fr) 52px'), 'point rows are not split into confusing label/value columns');
assert(!styles.includes('.dip-point-label'), 'old label-only point row class was removed');
assert(!styles.includes('.dip-points {'), 'old detached points column was removed');

[
  'dashboard.impact.rank',
  'dashboard.impact.openLeaderboard',
  'dashboard.impact.viewBracket',
  'dashboard.impact.liveTitle',
  'dashboard.impact.ifTeamAdvances',
  'dashboard.impact.teamAdvanced',
  'dashboard.impact.teamEliminated',
  'dashboard.impact.resultPoints',
  'dashboard.impact.resultPending',
  'dashboard.impact.statusFinal',
  'dashboard.impact.pointsChecking',
  'dashboard.impact.pointsUnavailable',
  'dashboard.impact.pointsValueOne',
  'dashboard.impact.pointsValueOther',
  'dashboard.impact.scenarioPointsSentence',
  'dashboard.impact.resultPointsSentence',
  'dashboard.impact.scenarioPointsUnavailable',
  'dashboard.impact.resultPointsUnavailable',
  'worldCupStories.previous',
  'worldCupStories.next'
].forEach((key) => {
  const count = (i18n.match(new RegExp(`'${key}'`, 'g')) || []).length;
  assert(count === 2, `${key} exists in Hebrew and English`);
});

[
  'pool one-phase',
  'מטשאפ',
  'הולכת לפנדלים',
  'ניקוד מחכה'
].forEach((bad) => {
  assert(!app.includes(bad) && !index.includes(bad) && !i18n.includes(bad), `removed fragile copy: ${bad}`);
});

console.log('dashboard impact rollout gate ok');
