const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'i18n.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'test-scoring.yml'), 'utf8');
const visualProof = fs.readFileSync(path.join(root, 'scripts', 'live-ux-visual-proof.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert(match, `Missing function ${name}`);
  const start = match.index;
  const signatureEnd = source.indexOf(') {', start);
  const open = source.indexOf('{', signatureEnd > start ? signatureEnd : start);
  assert(open >= 0, `Missing function body for ${name}`);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed function body for ${name}`);
}

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert(start >= 0, `Missing anchor ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert(end > start, `Missing anchor ${endNeedle}`);
  return source.slice(start, end);
}

const phaseSource = extractFunction(app, '_groupStagePhase');
const phaseOfficialSource = extractFunction(app, '_phaseHasOfficialScoring');
const groupProgressSource = extractFunction(app, '_dashboardGroupProgress');
const groupIdentitySource = extractFunction(app, '_dashboardMatchIdentity');
const pendingVerificationSource = extractFunction(app, '_hasPendingResultVerification');
const sandbox = {
  state: { results: { finishedMatches: [], pendingVerificationMatches: [] } },
  _dashboardGroupProgress: () => ({ completeGroups: 0, totalGroups: 12 })
};
vm.createContext(sandbox);
vm.runInContext(`${phaseSource}; ${phaseOfficialSource}; ${pendingVerificationSource}; this.groupStagePhase = _groupStagePhase; this.phaseHasOfficialScoring = _phaseHasOfficialScoring; this.hasPendingResultVerification = _hasPendingResultVerification;`, sandbox);

const phase = sandbox.groupStagePhase;
assert(phase(false, false, { completeGroups: 0, totalGroups: 12 }) === 'pre', 'Pre-tournament phase must stay pre');
assert(phase(true, false, { completeGroups: 0, totalGroups: 12 }) === 'liveNoOfficial', 'Live tournament without scores must say official points are waiting');
assert(phase(true, false, { completeGroups: 1, totalGroups: 12 }) === 'officialFirst', 'First completed group must start official phase even when visible points are zero');
assert(phase(true, false, { completeGroups: 3, totalGroups: 12 }) === 'officialSeveral', 'Several completed groups must be official even when visible points are zero');
assert(phase(true, true, { completeGroups: 1, totalGroups: 12 }) === 'officialFirst', 'First scored group must get the officialFirst phase');
assert(phase(true, true, { completeGroups: 3, totalGroups: 12 }) === 'officialSeveral', 'Multiple scored groups must get the officialSeveral phase');
assert(phase(true, true, { completeGroups: 12, totalGroups: 12 }) === 'groupsComplete', 'All groups complete must override normal official scoring phase');
assert(phase(true, false, { completeGroups: 12, totalGroups: 12 }) === 'groupsComplete', 'All groups complete must be explicit even if visible pool scores are zero');
assert(sandbox.phaseHasOfficialScoring('officialFirst'), 'officialFirst must count as official scoring');
assert(sandbox.phaseHasOfficialScoring('groupsComplete'), 'groupsComplete must count as official scoring');
assert(!sandbox.phaseHasOfficialScoring('liveNoOfficial'), 'liveNoOfficial must not count as official scoring');

vm.runInContext(`${groupIdentitySource}; ${groupProgressSource}; this.dashboardGroupProgress = _dashboardGroupProgress;`, sandbox);
sandbox.state.results.finishedMatches = [
  { stage: 'GROUP_STAGE', group_letter: 'A', home_team_code: 'A1', away_team_code: 'A2' },
  { stage: 'GROUP_STAGE', group_letter: 'A', home_team_code: 'A1', away_team_code: 'A3' },
  { stage: 'GROUP_STAGE', group_letter: 'A', home_team_code: 'A1', away_team_code: 'A4' },
  { stage: 'GROUP_STAGE', group_letter: 'A', home_team_code: 'A2', away_team_code: 'A3' },
  { stage: 'GROUP_STAGE', group_letter: 'A', home_team_code: 'A2', away_team_code: 'A4' },
  { stage: 'GROUP_STAGE', group_letter: 'A', home_team_code: 'A3', away_team_code: 'A4' },
  { stage: 'GROUP_STAGE', group_letter: 'B', home_team_code: 'B1', away_team_code: 'B2' },
  { stage: 'GROUP_STAGE', group_letter: 'B', home_team_code: 'B1', away_team_code: 'B3' },
  { stage: 'GROUP_STAGE', group_letter: 'B', home_team_code: 'B1', away_team_code: 'B4' },
  { stage: 'GROUP_STAGE', group_letter: 'B', home_team_code: 'B2', away_team_code: 'B3' },
  { stage: 'GROUP_STAGE', group_letter: 'B', home_team_code: 'B2', away_team_code: 'B4' },
  { stage: 'GROUP_STAGE', group_letter: 'B', home_team_code: 'B2', away_team_code: 'B4', id: 'duplicate-different-id' },
];
const progressWithDuplicate = sandbox.dashboardGroupProgress();
assert(progressWithDuplicate.completeGroups === 1, 'Dashboard group progress must not count duplicate logical fixtures as a completed group');
assert(progressWithDuplicate.finished === 11, 'Dashboard finished match count must be unique-fixture safe');

assert(
  /g\.size\s*===\s*6/.test(groupProgressSource),
  'Dashboard group completion must require exactly six unique completed fixtures'
);

const dashboardProjection = extractFunction(app, 'updateDashboardProjectionTeaser');
assert(
  /officialScoreTotal/.test(dashboardProjection) && /_phaseHasOfficialScoring\(phase\)/.test(dashboardProjection),
  'Dashboard theoretical teaser must hide once official scoring starts'
);
const dashboard = extractFunction(app, 'goToDashboard');
assert(
  /\(hasScores\s*&&\s*rank\s*>\s*0\)\s*\?\s*rank\s*:\s*'-'/.test(dashboard),
  'Dashboard rank must not show a fake rank when official scoring is live but every user has zero points'
);

const twoPhaseKnockoutEntry = extractFunction(app, 'startKnockoutBetting');
assert(
  /const readiness\s*=\s*await\s+_officialKnockoutReadiness\(\)[\s\S]*buildOfficialTwoPhaseKnockout\(readiness\.seed\)/.test(twoPhaseKnockoutEntry),
  'Two-phase knockout entry must load official readiness before building the real bracket'
);
assert(
  /KNOCKOUT_LOCK_FALLBACK_ISO\s*=\s*'2026-06-28T17:00:00\.000Z'/.test(app),
  'Knockout fallback lock must be the first knockout kickoff, June 28 20:00 Israel time'
);

const dashboardStatusSandbox = {
  state: { currentPool: {}, _dashboardKnockoutReviewOpen: false, results: { pendingVerificationMatches: [] } },
  statusEl: { style: {}, innerHTML: '', classList: { toggle() {} } },
  document: {
    getElementById: (id) => (id === 'dashboard-live-status' ? dashboardStatusSandbox.statusEl : null)
  },
  _dashboardGroupProgress: () => dashboardStatusSandbox.progress,
  _poolLateEntryOpen: () => false,
  _isLateKnockoutPool: () => false,
  _lateEntryCutoffLabel: () => '20:00',
  _knockoutCutoffLabel: () => '20:00',
  t: (key, vars = {}) => `${key}${Object.keys(vars).length ? ':' + JSON.stringify(vars) : ''}`,
};
vm.createContext(dashboardStatusSandbox);
vm.runInContext(`${phaseSource}; ${pendingVerificationSource}; ${extractFunction(app, '_renderDashboardLiveStatus')}; this.renderDashboardLiveStatus = _renderDashboardLiveStatus;`, dashboardStatusSandbox);

function renderDashboardStatus(progress, tournamentStarted = true, hasScores = false, pendingOrPoolMode = false, poolMode = undefined) {
  dashboardStatusSandbox.progress = progress;
  const pending = pendingOrPoolMode === true;
  const mode = typeof pendingOrPoolMode === 'string' ? pendingOrPoolMode : poolMode;
  dashboardStatusSandbox.state.results.pendingVerificationMatches = pending ? [{ id: 'm-pending' }] : [];
  dashboardStatusSandbox.state.currentPool = mode ? { betting_mode: mode } : {};
  dashboardStatusSandbox.statusEl = { style: {}, innerHTML: '', classList: { toggle() {} } };
  dashboardStatusSandbox.renderDashboardLiveStatus(tournamentStarted, hasScores);
  return dashboardStatusSandbox.statusEl;
}

let statusEl = renderDashboardStatus({ finished: 5, total: 72, completeGroups: 0, totalGroups: 12 });
assert(statusEl.style.display === '', 'Live dashboard status must show after kickoff even before official points');
assert(statusEl.innerHTML.includes('dashboard.liveStatus.title'), 'Live/no-official dashboard status must use waiting-for-group copy');
assert(statusEl.innerHTML.includes('dashboard.liveStatus.progress:{"done":5,"total":72}'), 'Live dashboard status must show finished group-match progress');

statusEl = renderDashboardStatus({ finished: 6, total: 72, completeGroups: 1, totalGroups: 12 });
assert(statusEl.innerHTML.includes('dashboard.officialStatus.firstGroupTitle'), 'First completed group must switch dashboard status to official scoring copy');
assert(statusEl.innerHTML.includes('dashboard.officialStatus.pointsLive'), 'Official dashboard status must stop showing zero-point badge copy');
assert(statusEl.innerHTML.includes('dashboard.officialStatus.thirdPlacePending'), 'Official dashboard status must explain pending third-place advancement points');

statusEl = renderDashboardStatus({ finished: 18, total: 72, completeGroups: 3, totalGroups: 12 });
assert(statusEl.innerHTML.includes('dashboard.officialStatus.severalGroupsTitle'), 'Several completed groups must use moving-table dashboard copy');
assert(statusEl.innerHTML.includes('dashboard.officialStatus.severalGroupsText:{"time":"20:00","done":3,"total":12}'), 'Several-groups dashboard copy must include completed group count');
assert(statusEl.innerHTML.includes('dashboard.officialStatus.thirdPlacePending'), 'Several-groups dashboard status must keep pending third-place explanation');

statusEl = renderDashboardStatus({ finished: 18, total: 72, completeGroups: 3, totalGroups: 12 }, true, true, true);
assert(statusEl.innerHTML.includes('dashboard.dataPending.title'), 'Pending result verification must override official dashboard copy');
assert(statusEl.innerHTML.includes('dashboard.dataPending.badge'), 'Pending dashboard state must show a finalizing badge');
assert(statusEl.innerHTML.includes('dashboard.dataPending.note'), 'Pending dashboard state must explain that scores will return automatically');
assert(!statusEl.innerHTML.includes('dashboard.officialStatus.thirdPlacePending'), 'Pending dashboard state must not mix in normal scoring notes');

statusEl = renderDashboardStatus({ finished: 72, total: 72, completeGroups: 12, totalGroups: 12 });
assert(statusEl.innerHTML.includes('dashboard.groupStageComplete.title'), 'All completed groups must use group-stage-complete dashboard copy');
assert(statusEl.innerHTML.includes('dashboard.groupStageComplete.badge'), 'Group-stage-complete status must show final group-points badge');
assert(statusEl.innerHTML.includes('dashboard.groupStageComplete.text'), 'Two-phase/default groups-complete status may mention the open knockout window');

statusEl = renderDashboardStatus({ finished: 72, total: 72, completeGroups: 12, totalGroups: 12 }, true, false, 'single_phase');
assert(statusEl.innerHTML.includes('dashboard.groupStageComplete.onePhaseText'), 'One-phase groups-complete status must not say knockout picks are open');
assert(!statusEl.innerHTML.includes('dashboard.groupStageComplete.text:'), 'One-phase groups-complete status must use mode-specific locked-bracket copy');
assert(!statusEl.innerHTML.includes('dashboard.officialStatus.thirdPlacePending'), 'Group-stage-complete status must stop showing third-place pending copy');

statusEl = renderDashboardStatus({ finished: 0, total: 72, completeGroups: 0, totalGroups: 12 }, false, false);
assert(statusEl.style.display === 'none' && statusEl.innerHTML === '', 'Pre-tournament dashboard status must stay hidden');

const leaderboard = sliceBetween(app, 'async function showLeaderboard', 'function showTheoreticalLeaderboard');
assert(/const hasScores\s*=\s*totalScores\s*>\s*0/.test(leaderboard), 'Leaderboard must derive hasScores from official total_score values');
assert(/const officialStarted\s*=\s*_phaseHasOfficialScoring\(phase\)/.test(leaderboard), 'Leaderboard must derive officialStarted from phase, not points');
assert(/_groupStagePhase\(tournamentStarted,\s*hasScores,\s*progress\)/.test(leaderboard), 'Leaderboard must use the shared group-stage phase model');
assert(/leaderboard\.statusLiveNoOfficial/.test(leaderboard), 'Leaderboard must have a live-but-no-official status');
assert(/leaderboard\.statusOfficialStarted/.test(leaderboard), 'Leaderboard must have an official scoring status');
assert(/leaderboard\.statusGroupsComplete/.test(leaderboard), 'Leaderboard must have a groups-complete status');
assert(/leaderboard\.statusDataPending/.test(leaderboard), 'Leaderboard must have a pending official-data status');
assert(/lb-third-place-note/.test(leaderboard) && /leaderboard\.thirdPlacePending/.test(leaderboard), 'Leaderboard must show pending third-place explanation during official partial-group scoring');
assert(
  /if \(hasScores\)[\s\S]*renderPodium\(users\)[\s\S]*else if \(podiumEl\)[\s\S]*podiumEl\.innerHTML\s*=\s*''[\s\S]*podiumEl\.style\.display\s*=\s*'none'/.test(leaderboard),
  'Leaderboard must keep the last official podium visible while official data is pending'
);
assert(
  /leaderboard\.emptyLiveNoOfficialTitle/.test(leaderboard)
    && /leaderboard\.emptyLiveNoOfficialText/.test(leaderboard)
    && /leaderboard\.emptyOfficialZeroTitle/.test(leaderboard)
    && /leaderboard\.emptyOfficialZeroText/.test(leaderboard)
    && /leaderboard\.emptyDataPendingTitle/.test(leaderboard)
    && /leaderboard\.emptyDataPendingText/.test(leaderboard),
  'Leaderboard empty state must explain live/no-official and official-zero scoring instead of looking pre-tournament'
);
assert(
  /renderTheoreticalLeaderboard\(users,\s*\{\s*\.\.\.options,\s*hasScores,\s*phase,\s*dataPending\s*\}\)/.test(leaderboard),
  'Leaderboard must pass official-score, phase, and pending-data state into the theoretical table renderer'
);

const theoretical = sliceBetween(app, 'async function renderTheoreticalLeaderboard', 'function renderPodium');
assert(/_hideTheoreticalLeaderboard\(\)/.test(theoretical), 'Theoretical table must hide before any render decision');
assert(
  /options\.dataPending\s*\|\|\s*options\.hasScores\s*\|\|\s*_phaseHasOfficialScoring\(options\.phase\)/.test(theoretical),
  'Theoretical table must not render while data is pending, after official scoring starts, or groups complete'
);

const podiumRows = [];
const podiumSandbox = {
  document: {
    getElementById: (id) => (id === 'lb-podium' ? {
      innerHTML: '',
      appendChild: row => podiumRows.push(row),
    } : null),
    createElement: () => ({
      className: '',
      style: {},
      innerHTML: '',
    }),
  },
  escapeHtml: value => String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch])),
  t: (key) => key,
};
vm.createContext(podiumSandbox);
vm.runInContext(`${extractFunction(app, 'renderPodium')}; ${extractFunction(app, 'createPodiumSpot')}; ${extractFunction(app, 'createEmptyPodium')}; this.renderPodium = renderPodium;`, podiumSandbox);
podiumSandbox.renderPodium([
  { nickname: 'Leader With A Very Very Long Name', total_score: 9 },
  { nickname: 'Second', total_score: 5 },
]);
assert(podiumRows.length === 3, 'Podium must render second/first/third slots even with fewer than three scored users');
assert(podiumRows[0].className.includes('second') && podiumRows[1].className.includes('first') && podiumRows[2].className.includes('third'), 'Podium must keep visual order second, first, third');
assert(podiumRows[1].innerHTML.includes('Leader With A Very Very Long Name'), 'Podium first slot must show the actual leader name');
assert(podiumRows[2].innerHTML.includes('leaderboard.podiumEmpty'), 'Podium third slot must show an empty placeholder when only two scored users exist');

const renderFullSource = extractFunction(app, 'renderFullLeaderboard');
const renderRows = [];
const renderSandbox = {
  state: { currentPool: { betting_mode: 'single_phase' }, currentUser: { id: 'u1' } },
  document: {
    getElementById: (id) => (id === 'lb-full-list' ? {
      innerHTML: '',
      appendChild: row => renderRows.push(row),
    } : null),
    createElement: () => ({
      className: '',
      classList: { add(cls) { this.owner.className += `${this.owner.className ? ' ' : ''}${cls}`; }, owner: null },
      innerHTML: '',
    }),
  },
  escapeHtml: value => String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch])),
  t: (key) => key,
};
vm.createContext(renderSandbox);
const originalCreateElement = renderSandbox.document.createElement;
renderSandbox.document.createElement = () => {
  const row = originalCreateElement();
  row.classList.owner = row;
  return row;
};
vm.runInContext(`${renderFullSource}; this.renderFullLeaderboard = renderFullLeaderboard;`, renderSandbox);
renderSandbox.renderFullLeaderboard([
  { id: 'u1', nickname: 'שם ארוך מאוד מאוד מאוד Long Long Long', is_admin: true, total_score: 0 },
  { id: 'u2', nickname: 'Second', total_score: 0 },
], { hasScores: false });
assert(renderRows.length === 2, 'Participant list should render rows even before official points exist');
assert(renderRows[0].innerHTML.includes('<div class="lb-rank">-</div>'), 'Participant rows before points must not show fake rank numbers');
assert(renderRows[0].innerHTML.includes('class="lb-name-text"'), 'Leaderboard names must render inside the ellipsis-safe span');
assert(renderRows[0].innerHTML.includes('admin-badge') && renderRows[0].innerHTML.includes('lb-badge'), 'Leaderboard rows must preserve admin/you badges with long names');
renderRows.length = 0;
renderSandbox.renderFullLeaderboard([
  { id: 'u1', nickname: 'Winner', total_score: 5 },
], { hasScores: true });
assert(renderRows[0].innerHTML.includes('<div class="lb-rank">#1</div>'), 'Official score rows must show real rank numbers once points exist');
renderRows.length = 0;
renderSandbox.renderFullLeaderboard([
  { id: 'u1', nickname: 'Winner', total_score: 5, group_points: 5 },
], { hasScores: true, dataPending: true });
assert(renderRows[0].className.includes('data-pending'), 'Pending leaderboard rows must get a finalizing style hook');
assert(renderRows[0].innerHTML.includes('<div class="lb-rank">#1</div>'), 'Pending leaderboard rows with previous official scores must keep rank numbers visible');
assert(renderRows[0].innerHTML.includes('<div class="lb-points">5</div>'), 'Pending leaderboard rows must keep the last official point totals visible');
assert(renderRows[0].innerHTML.includes('leaderboard.lastOfficialLabel'), 'Pending leaderboard rows must label visible points as the last official standings');
renderRows.length = 0;
renderSandbox.renderFullLeaderboard([
  { id: 'u1', nickname: 'Waiting', total_score: 0 },
], { hasScores: false, dataPending: true });
assert(renderRows[0].innerHTML.includes('leaderboard.calculatingShort'), 'Pending leaderboard rows without any official scores must avoid fake point totals');
assert(renderRows[0].innerHTML.includes('leaderboard.calculatingBreakdown'), 'Pending leaderboard rows without official scores must explain that data is finalizing');
assert(/renderLeaderboardBanter\(users,\s*\{\s*phase,\s*dataPending\s*\}\)/.test(app), 'Leaderboard banter must receive the current tournament phase and pending-data state');
assert(/options\s*&&\s*options\.dataPending/.test(app), 'Leaderboard banter must stay hidden while official data is pending');
assert(/function _groupsCompleteLeaderboardBanter\(users\)/.test(app), 'Leaderboard must have a groups-complete Pundit fallback');
assert(/options\s*&&\s*options\.phase\s*===\s*'groupsComplete'/.test(app), 'Leaderboard Pundit fallback must activate only for groups-complete phase');
assert(/function _punditItemAllowedForPoolMode\(item,\s*poolMode\)/.test(app), 'Pundit feed must have a pool-mode filter');
assert(/globalItems\s*=\s*globalItems\.filter\(item\s*=>\s*_punditItemAllowedForPoolMode\(item,\s*poolMode\)\)/.test(app), 'Global Pundit items must be filtered by pool betting mode before rotation');
assert(/mode_scopes/.test(app) && /poolMode === 'one_phase'/.test(app), 'One-phase pools must not render mode-specific knockout-open Pundit cards');

const podiumNameCss = /\.podium-name\s*\{[\s\S]*?white-space:\s*nowrap;[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?\}/.test(styles);
assert(podiumNameCss, 'Podium names must keep nowrap/hidden/ellipsis protection');
const leaderboardNameCss = /\.lb-name-text\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;[\s\S]*?\}/.test(styles);
assert(leaderboardNameCss, 'Leaderboard names must keep ellipsis protection');
assert(/\.lb-badge\s*\{[\s\S]*?flex-shrink:\s*0;[\s\S]*?\}/.test(styles), 'You badge must not shrink into long names');
assert(/\.admin-badge\s*\{[\s\S]*?flex-shrink:\s*0;[\s\S]*?\}/.test(styles), 'Admin badge must not shrink into long names');

[
  'dashboard.liveStatus.text',
  'dashboard.officialStatus.firstGroupText',
  'dashboard.officialStatus.severalGroupsText',
  'dashboard.officialStatus.thirdPlacePending',
  'dashboard.dataPending.text',
  'dashboard.dataPending.note',
  'dashboard.groupStageComplete.text',
  'leaderboard.statusLiveNoOfficial',
  'leaderboard.statusOfficialStarted',
  'leaderboard.statusGroupsComplete',
  'leaderboard.statusDataPending',
  'leaderboard.emptyLiveNoOfficialText',
  'leaderboard.emptyOfficialZeroText',
  'leaderboard.emptyDataPendingText',
  'leaderboard.lastOfficialLabel',
  'leaderboard.calculatingBreakdown',
  'leaderboard.thirdPlacePending',
  'leaderboard.participantsList',
].forEach((key) => {
  const hits = (i18n.match(new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')) || []).length;
  assert(hits >= 2, `${key} must exist in both Hebrew and English`);
});

assert(workflow.includes("scripts/test-live-ux-state.js"), 'CI workflow must watch and run live UX state tests');
assert(/run:\s*node scripts\/test-live-ux-state\.js/.test(workflow), 'CI workflow must run live UX state tests');
[
  'live-no-official',
  'first-official-zero',
  'several-official',
  'groups-complete',
].forEach((stateId) => {
  assert(visualProof.includes(`id: '${stateId}'`), `visual proof harness must cover ${stateId}`);
});
assert(visualProof.includes('hardOverflows') && visualProof.includes('overlaps'), 'visual proof harness must check overflow and podium overlap');
assert(visualProof.includes('LIVE_UX_VISUAL_STRICT'), 'visual proof harness must support strict mode for release verification');

console.log('Live UX state tests passed');
