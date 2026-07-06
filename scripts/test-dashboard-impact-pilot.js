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

assert(app.includes("DASHBOARD_IMPACT_PILOT_POOL_ID = '4927bd42-a9aa-4bf5-ab5d-e166869a72c6'"), 'pilot pool id is fixed');
assert(app.includes("DASHBOARD_IMPACT_PILOT_POOL_CODE = '349MD'"), 'pilot pool code is fixed');
assert(app.includes("DASHBOARD_IMPACT_PILOT_USER_ID = 'a8fe26ff-12df-45ed-890b-70b6072fe2c0'"), 'pilot user id is fixed to Eyal');
assert(app.includes('function _isDashboardImpactPilotPool'), 'pilot gate function exists');
assert(app.includes('renderDashboardImpactPilot(allUsers'), 'dashboard render calls pilot renderer');
assert(app.includes('renderDashboardImpactPilot(users'), 'score refresh updates pilot renderer');

const gateStart = app.indexOf('function _isDashboardImpactPilotPool');
const gateEnd = app.indexOf('function _setDashboardImpactPilotMode', gateStart);
const gateBody = app.slice(gateStart, gateEnd);
assert(gateStart >= 0 && gateEnd > gateStart, 'pilot gate body is extractable');
assert(!/(location|searchParams|localStorage)/.test(gateBody), 'pilot gate does not depend on URL or browser storage flags');
assert(gateBody.includes('poolAllowed && reviewerAllowed'), 'pilot requires both allowed pool and reviewer session');
assert(gateBody.includes('userAllowed'), 'pilot requires the exact reviewer user id');
assert(gateBody.includes('state.currentUser && state.currentUser.is_admin && userAllowed'), 'approval pilot is not shown to ordinary pool members or other admins');

const pilotStart = app.indexOf('const DASHBOARD_IMPACT_PILOT_POOL_ID');
const pilotEnd = app.indexOf('function _hideDashboardProjectionTeaser', pilotStart);
const pilotBody = app.slice(pilotStart, pilotEnd);
assert(pilotStart >= 0 && pilotEnd > pilotStart, 'pilot body is extractable');
assert(pilotBody.includes('_dashboardImpactLoadMyBracketPicks'), 'pilot reads current user bracket picks');
assert(pilotBody.includes(".eq('pool_id', poolId)"), 'pilot pick read is pool scoped');
assert(pilotBody.includes(".not('bracket_position', 'is', null)"), 'pilot reads single-phase bracket positions only');
assert(pilotBody.includes('_dashboardImpactPickPointsForTeamAtStage'), 'pilot calculates stage-specific point impact');
assert(pilotBody.includes('_dashboardImpactVerifiedAdvancer'), 'pilot uses verified knockout advancer for result points');
assert(pilotBody.includes('winner_code'), 'result points depend on verified winner_code');
assert(pilotBody.includes('_dashboardImpactMatchStackHtml(activeMatch, lastResult, nextMatch, bracketPicks)'), 'live dashboard renders live/last/next stack');
assert(pilotBody.includes('_dashboardImpactNextMatch(matches, Date.now(), activeMatch)'), 'next match is not hidden during live state');
assert(pilotBody.includes('dip-match-card dip-match-block'), 'each match impact item renders as its own card');
assert(pilotBody.includes('_dashboardImpactEmptyCardHtml'), 'empty match states keep the same card structure');
assert(!pilotBody.includes('_fetchKnockoutScenarioManifest'), 'pilot does not depend on generated scenario JSON');
assert(!pilotBody.includes("t('dashboard.impact.ifAdvances')"), 'generic if-advances copy is not rendered in pilot');
assert(!pilotBody.includes("dashboard.impact.pointsChecking"), 'pilot does not render checking-points copy');
assert(!pilotBody.includes('dip-scenarios'), 'pilot no longer has one shared scenario container id');
assert(!pilotBody.includes('dip-team-score'), 'score is not duplicated inside team rows');
assert(!pilotBody.includes("getElementById('dip-match-title')"), 'pilot does not render a duplicate parent match title');
assert(!pilotBody.includes("getElementById('dip-match-sub')"), 'pilot does not render duplicate parent match metadata');

const pointRowStart = app.indexOf('function _dashboardImpactPointRowHtml');
const pointRowEnd = app.indexOf('function _dashboardImpactScenarioRows', pointRowStart);
const pointRowBody = app.slice(pointRowStart, pointRowEnd);
assert(pointRowStart >= 0 && pointRowEnd > pointRowStart, 'point row body is extractable');
assert(!pointRowBody.includes('getCountryFlag'), 'point rows do not duplicate flags');
assert(!pointRowBody.includes('dip-flag'), 'point rows keep flags only in the scoreboard');

assert(index.includes('id="dashboard-impact-pilot"'), 'dashboard pilot mount exists');
assert(index.includes('id="dip-open-leaderboard"'), 'leaderboard action exists');
assert(index.includes('id="dip-open-bracket"'), 'bracket action exists');
assert(!index.includes('id="dip-match-title"'), 'dashboard pilot has no duplicate parent match title');
assert(!index.includes('id="dip-match-sub"'), 'dashboard pilot has no duplicate parent match subline');

assert(styles.includes('.dashboard-impact-pilot-active #dashboard-drama-hero'), 'pilot hides old hero only inside active gate');
assert(styles.includes('#user-dashboard-screen.dashboard-impact-pilot-active #pundit-card'), 'pilot reorders Pundit under match module');
assert(styles.includes('.dip-scoreboard'), 'pilot has a single scoreboard row');
assert(styles.includes('.dip-point-row'), 'pilot has simple point rows');
assert(styles.includes('.dip-match-stack'), 'pilot stacks separate match cards');
assert(styles.includes('gap: 10px'), 'pilot separates match cards visually');
assert(!styles.includes('.dip-scenario-row'), 'pilot does not style nested scenario cards');

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
  'dashboard.impact.pointsUnavailable'
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

console.log('dashboard impact pilot gate ok');
