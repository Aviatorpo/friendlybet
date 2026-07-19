const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'i18n.js'), 'utf8');
const tournamentContext = fs.readFileSync(path.join(root, 'lib', 'tournament-context.js'), 'utf8');
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
const dashboardPendingKindSource = extractFunction(app, '_dashboardPendingMatchUxKind');
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

sandbox.state.results.finishedMatches = [];
for (const group of 'ABCDEFGHIJKL'.split('')) {
  sandbox.state.results.finishedMatches.push(
    { stage: 'GROUP_STAGE', group_letter: group, home_team_code: `${group}1`, away_team_code: `${group}2` },
    { stage: 'GROUP_STAGE', group_letter: group, home_team_code: `${group}1`, away_team_code: `${group}3` },
    { stage: 'GROUP_STAGE', group_letter: group, home_team_code: `${group}1`, away_team_code: `${group}4` },
    { stage: 'GROUP_STAGE', group_letter: group, home_team_code: `${group}2`, away_team_code: `${group}3` },
    { stage: 'GROUP_STAGE', group_letter: group, home_team_code: `${group}2`, away_team_code: `${group}4` },
    { stage: 'GROUP_STAGE', group_letter: group, home_team_code: `${group}3`, away_team_code: `${group}4` },
  );
}
sandbox.state.results.finishedMatches.push(
  { stage: 'GROUP_STAGE', group_letter: 'H', home_team_code: 'H2_ALIAS', away_team_code: 'H4' },
  { stage: 'GROUP_STAGE', group_letter: 'E', home_team_code: 'E1', away_team_code: 'E4_ALIAS' },
);
const progressWithProviderAliases = sandbox.dashboardGroupProgress();
assert(progressWithProviderAliases.completeGroups === 12, 'Dashboard group progress must treat six-or-more unique group fixtures as complete');
assert(progressWithProviderAliases.finished === 72, 'Dashboard finished match count must cap provider duplicate or alias rows at official group capacity');
assert(phase(true, false, progressWithProviderAliases) === 'groupsComplete', 'Provider duplicate or alias rows must not keep the dashboard in group-stage projection mode');

assert(
  /g\.size\s*>=\s*matchesPerGroup/.test(groupProgressSource),
  'Dashboard group completion must allow provider duplicate or alias rows after six unique completed fixtures'
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
  _isLateKnockoutPool: (pool) => !!pool && pool.betting_mode === 'late_knockout',
  _lateEntryCutoffLabel: () => '20:00',
  _knockoutCutoffLabel: () => '20:00',
  t: (key, vars = {}) => `${key}${Object.keys(vars).length ? ':' + JSON.stringify(vars) : ''}`,
  _matchUxState: (m) => ({ kind: (m && m.uxKind) || 'live_updating' }),
  _currentTournamentContext: () => ({
    exact: true,
    round: 'R16',
    roundLabelKey: 'tournamentContext.round.r16',
    completedMatches: 2,
    totalMatches: 8,
    dashboard: {
      kickerKey: 'dashboard.tournament.roundKicker',
      badgeKey: 'dashboard.tournament.roundBadge',
      titleKey: 'dashboard.tournament.roundTitle',
      textKey: 'dashboard.tournament.roundText',
      onePhaseTextKey: 'dashboard.tournament.roundOnePhaseText',
    },
    leaderboardStatusKey: 'leaderboard.statusTournamentRound',
  }),
  _tournamentContextTextKey: (ctx, onePhase) => onePhase ? ctx.dashboard.onePhaseTextKey : ctx.dashboard.textKey,
  _tournamentContextParams: (ctx, extra = {}) => ({ round: 'Round of 16', completed: 2, total: 8, ...extra }),
};
vm.createContext(dashboardStatusSandbox);
vm.runInContext(`${phaseSource}; ${pendingVerificationSource}; ${dashboardPendingKindSource}; ${extractFunction(app, '_renderDashboardLiveStatus')}; this.renderDashboardLiveStatus = _renderDashboardLiveStatus;`, dashboardStatusSandbox);

function renderDashboardStatus(progress, tournamentStarted = true, hasScores = false, pendingOrPoolMode = false, poolMode = undefined) {
  dashboardStatusSandbox.progress = progress;
  const pendingRows = Array.isArray(pendingOrPoolMode)
    ? pendingOrPoolMode
    : (pendingOrPoolMode === true ? [{ id: 'm-pending' }] : []);
  const mode = typeof pendingOrPoolMode === 'string' ? pendingOrPoolMode : poolMode;
  dashboardStatusSandbox.state.results.pendingVerificationMatches = pendingRows;
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
assert(statusEl.innerHTML.includes('dashboard.liveStatus.title'), 'Pending live-state verification must not override dashboard with a stuck updating state');
assert(statusEl.innerHTML.includes('dashboard.liveStatus.zeroPoints'), 'Pending live-state dashboard state must keep the normal live badge');
assert(!statusEl.innerHTML.includes('dashboard.liveUpdating.title'), 'Dashboard must not show the stuck live-updating title for stale live rows');
assert(!statusEl.innerHTML.includes('dashboard.officialStatus.thirdPlacePending'), 'Pending dashboard state must not mix in normal scoring notes');

statusEl = renderDashboardStatus(
  { finished: 18, total: 72, completeGroups: 3, totalGroups: 12 },
  true,
  true,
  [{ id: 'm-final-pending', uxKind: 'final_confirming' }]
);
assert(statusEl.innerHTML.includes('dashboard.resultConfirming.title'), 'Pending final-result confirmation must use result-confirming dashboard copy');
assert(statusEl.innerHTML.includes('dashboard.resultConfirming.badge'), 'Pending final-result confirmation must show a confirming badge');
assert(statusEl.innerHTML.includes('dashboard.resultConfirming.note'), 'Pending final-result confirmation must explain that last official standings remain visible');

statusEl = renderDashboardStatus({ finished: 72, total: 72, completeGroups: 12, totalGroups: 12 });
assert(statusEl.innerHTML.includes('dashboard.tournament.roundTitle'), 'All completed groups must use tournament-context dashboard copy');
assert(statusEl.innerHTML.includes('dashboard.tournament.roundBadge'), 'Tournament context status must show final group-points badge');
assert(statusEl.innerHTML.includes('dashboard.tournament.roundText'), 'Two-phase/default groups-complete status must name the verified knockout round');
assert(!statusEl.innerHTML.includes('dls-progress'), 'Group-stage-complete status must not keep the group-stage progress bar');
assert(!statusEl.innerHTML.includes('dashboard.liveStatus.progress'), 'Group-stage-complete status must not keep group match progress metrics');
assert(!statusEl.innerHTML.includes('dashboard.liveStatus.groups'), 'Group-stage-complete status must not keep completed-group metrics');

statusEl = renderDashboardStatus({ finished: 72, total: 72, completeGroups: 12, totalGroups: 12 }, true, false, 'single_phase');
assert(statusEl.innerHTML.includes('dashboard.tournament.roundOnePhaseText'), 'One-phase groups-complete status must not say knockout picks are open');
assert(!statusEl.innerHTML.includes('dashboard.tournament.roundText:'), 'One-phase groups-complete status must use mode-specific locked-bracket copy');
assert(!statusEl.innerHTML.includes('dashboard.officialStatus.thirdPlacePending'), 'Group-stage-complete status must stop showing third-place pending copy');

statusEl = renderDashboardStatus({ finished: 72, total: 72, completeGroups: 12, totalGroups: 12 }, true, false, 'late_knockout');
assert(statusEl.innerHTML.includes('dashboard.liveStatus.lateKnockoutTitle'), 'Late knockout dashboard must use knockout-specific copy');
assert(!statusEl.innerHTML.includes('dls-progress'), 'Late knockout dashboard must not show a stale group-stage progress bar');
assert(!statusEl.innerHTML.includes('dashboard.liveStatus.progress'), 'Late knockout dashboard must not show stale group-stage match counts');

statusEl = renderDashboardStatus({ finished: 0, total: 72, completeGroups: 0, totalGroups: 12 }, false, false);
assert(statusEl.style.display === 'none' && statusEl.innerHTML === '', 'Pre-tournament dashboard status must stay hidden');

const leaderboard = sliceBetween(app, 'async function showLeaderboard', 'function showTheoreticalLeaderboard');
assert(/const hasScores\s*=\s*totalScores\s*>\s*0/.test(leaderboard), 'Leaderboard must derive hasScores from official total_score values');
assert(/const officialStarted\s*=\s*_phaseHasOfficialScoring\(phase\)/.test(leaderboard), 'Leaderboard must derive officialStarted from phase, not points');
assert(/_groupStagePhase\(tournamentStarted,\s*hasScores,\s*progress\)/.test(leaderboard), 'Leaderboard must use the shared group-stage phase model');
assert(/leaderboard\.statusLiveNoOfficial/.test(leaderboard), 'Leaderboard must have a live-but-no-official status');
assert(/leaderboard\.statusOfficialStarted/.test(leaderboard), 'Leaderboard must have an official scoring status');
assert(/leaderboardStatusKey/.test(leaderboard) && /leaderboard\.statusTournamentRound/.test(tournamentContext), 'Leaderboard must use resolver-owned exact tournament-round status');
assert(/leaderboard\.statusTournamentGeneric/.test(leaderboard), 'Leaderboard must have a conservative tournament fallback status');
assert(/leaderboard\.statusDataPending/.test(leaderboard), 'Leaderboard must have a pending official-data status');
assert(/lb-third-place-note/.test(leaderboard) && /leaderboard\.thirdPlacePending/.test(leaderboard), 'Leaderboard must show pending third-place explanation during official partial-group scoring');
assert(
  /if \(hasScores\)[\s\S]*renderPodium\(users,\s*\{\s*sharedRanks\s*\}\)[\s\S]*else if \(podiumEl\)[\s\S]*podiumEl\.innerHTML\s*=\s*''[\s\S]*podiumEl\.style\.display\s*=\s*'none'/.test(leaderboard),
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
vm.runInContext(`${extractFunction(app, '_sortLeaderboardUsers')}; ${extractFunction(app, '_leaderboardScore')}; ${extractFunction(app, '_rankLeaderboardUsers')}; ${extractFunction(app, '_leaderboardRankLabel')}; ${extractFunction(app, 'renderPodium')}; ${extractFunction(app, 'createPodiumSpot')}; ${extractFunction(app, 'createEmptyPodium')}; this.renderPodium = renderPodium;`, podiumSandbox);
podiumSandbox.renderPodium([
  { nickname: 'Leader With A Very Very Long Name', total_score: 9 },
  { nickname: 'Second', total_score: 5 },
]);
assert(podiumRows.length === 3, 'Podium must render second/first/third slots even with fewer than three scored users');
assert(podiumRows[0].className.includes('second') && podiumRows[1].className.includes('first') && podiumRows[2].className.includes('third'), 'Podium must keep visual order second, first, third');
assert(podiumRows[1].innerHTML.includes('Leader With A Very Very Long Name'), 'Podium first slot must show the actual leader name');
assert(podiumRows[2].innerHTML.includes('leaderboard.podiumEmpty'), 'Podium third slot must show an empty placeholder when only two scored users exist');
podiumRows.length = 0;
podiumSandbox.renderPodium([
  { nickname: 'Co Leader A', total_score: 9 },
  { nickname: 'Co Leader B', total_score: 9 },
  { nickname: 'Third', total_score: 5 },
], { sharedRanks: true });
const tiedSecondMedal = (podiumRows[0].innerHTML.match(/<div class="podium-medal">([^<]+)<\/div>/) || [])[1];
const tiedFirstMedal = (podiumRows[1].innerHTML.match(/<div class="podium-medal">([^<]+)<\/div>/) || [])[1];
assert(podiumRows[0].innerHTML.includes('Co Leader B') && tiedSecondMedal && tiedSecondMedal === tiedFirstMedal, 'Shared first-place podium must show tied leaders as rank one');

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
vm.runInContext(`${extractFunction(app, '_sortLeaderboardUsers')}; ${extractFunction(app, '_leaderboardScore')}; ${extractFunction(app, '_rankLeaderboardUsers')}; ${extractFunction(app, '_leaderboardRankLabel')}; ${renderFullSource}; this.renderFullLeaderboard = renderFullLeaderboard;`, renderSandbox);
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
renderRows.length = 0;
renderSandbox.renderFullLeaderboard([
  { id: 'u1', nickname: 'Tie A', total_score: 7 },
  { id: 'u2', nickname: 'Tie B', total_score: 7 },
  { id: 'u3', nickname: 'Third', total_score: 4 },
], { hasScores: true, sharedRanks: true });
assert(renderRows[0].innerHTML.includes('<div class="lb-rank">#1</div>') && renderRows[1].innerHTML.includes('<div class="lb-rank">#1</div>') && renderRows[2].innerHTML.includes('<div class="lb-rank">#3</div>'), 'Final leaderboard rows must use shared ranks for tied scores');
assert(/renderLeaderboardBanter\(users,\s*\{\s*phase,\s*dataPending,\s*tournamentContext:\s*tournamentCtx,\s*sharedRanks\s*\}\)/.test(app), 'Leaderboard banter must receive the current tournament context, pending-data state, and shared-rank mode');
assert(/options\s*&&\s*options\.dataPending/.test(app), 'Leaderboard banter must stay hidden while official data is pending');
assert(/function _groupsCompleteLeaderboardBanter\(users,\s*tournamentCtx\)/.test(app), 'Leaderboard must have a tournament-context Pundit fallback');
assert(/options\s*&&\s*options\.phase\s*===\s*'groupsComplete'/.test(app), 'Leaderboard Pundit fallback must activate only for groups-complete phase');
assert(/function _punditItemAllowedForPoolMode\(item,\s*poolMode\)/.test(app), 'Pundit feed must have a pool-mode filter');
assert(/globalItems\s*=\s*globalItems\.filter\(item\s*=>\s*_punditItemAllowedForPoolMode\(item,\s*poolMode\)\)/.test(app), 'Global Pundit items must be filtered by pool betting mode before rotation');
assert(/mode_scopes/.test(app) && /poolMode === 'single_phase'/.test(app), 'Single-phase pools must not render mode-specific knockout-open Pundit cards');

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
  'dashboard.liveUpdating.text',
  'dashboard.liveUpdating.note',
  'dashboard.resultConfirming.text',
  'dashboard.resultConfirming.note',
  'dashboard.tournament.roundText',
  'dashboard.tournament.roundOnePhaseText',
  'dashboard.tournament.upcomingText',
  'dashboard.tournament.confirmingText',
  'dashboard.tournament.genericText',
  'dashboard.drama.tournamentRound.text',
  'dashboard.drama.tournamentGeneric.text',
  'tournamentContext.round.r16',
  'tournamentContext.round.qf',
  'tournamentContext.round.sf',
  'tournamentContext.round.thirdPlace',
  'tournamentContext.round.final',
  'leaderboard.statusLiveNoOfficial',
  'leaderboard.statusOfficialStarted',
  'leaderboard.statusTournamentRound',
  'leaderboard.statusTournamentUpcoming',
  'leaderboard.statusTournamentConfirming',
  'leaderboard.statusTournamentGeneric',
  'leaderboard.statusDataPending',
  'leaderboard.banter.tournamentHeadline',
  'leaderboard.banter.tournamentGeneric',
  'pundit.tournament.round',
  'pundit.tournament.generic',
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
assert(!/first knockout match starts|תחילת משחק הנוקאאוט הראשון/.test(i18n), 'Knockout-started copy must not say picks are open until the first knockout match');
assert(!/Knockouts underway|knockouts underway|הנוקאאוט כבר התחיל|הנוקאאוט כבר רץ/.test(i18n), 'Tournament copy must not preserve stale generic "knockouts already started" wording');

assert(workflow.includes("scripts/test-tournament-context.js"), 'CI workflow must watch tournament context tests');
assert(/run:\s*node scripts\/test-tournament-context\.js/.test(workflow), 'CI workflow must run tournament context tests');
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
