const fs = require('fs');
const path = require('path');
const vm = require('vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'test-scoring.yml'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractFunction(source, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert(match, `Missing function ${name}`);
  const start = match.index;
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert(start >= 0, `Missing anchor ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert(end > start, `Missing anchor ${endNeedle}`);
  return source.slice(start, end);
}

const fnNames = [
  '_matchStatus',
  '_matchIdentityKey',
  '_matchFifaIdKey',
  '_matchNumberKey',
  '_matchIdentityKeys',
  '_matchIsScheduledStatus',
  '_matchIsLiveStatus',
  '_matchElapsedMs',
  '_matchIsStaleLive',
  '_matchIsStaleScheduled',
  '_matchIsPendingProviderFinal',
  '_matchIsFinishedStatus',
  '_matchIsTerminalStatus',
  '_matchNeedsStatusVerification',
  '_matchIsLiveish',
  '_matchShouldOverlayOfficial',
  'mergeOfficialScheduleWithLiveMatches',
  '_snapshotHasStaleScheduled',
];

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`
const _LIVE_MATCH_STATUSES = ['IN_PLAY', 'PAUSED', 'LIVE'];
const _TERMINAL_MATCH_STATUSES = ['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED'];
const _FINISHED_MATCH_STATUSES = ['FINISHED', 'AWARDED'];
const _MAX_MATCH_MS = 3.5 * 60 * 60 * 1000;
const _SCHEDULED_MATCH_STATUSES = ['TIMED', 'SCHEDULED'];
const _STALE_SCHEDULED_MATCH_MS = 35 * 60 * 1000;
${fnNames.map(name => extractFunction(app, name)).join('\n')}
this.api = { ${fnNames.join(', ')} };
`, sandbox);

const api = sandbox.api;
const now = Date.parse('2026-06-23T12:00:00Z');
const match = (overrides) => ({
  status: 'TIMED',
  match_date: '2026-06-23T11:20:00Z',
  ...overrides,
});

assert(api._matchIsStaleScheduled(match(), now), 'TIMED 40 minutes after kickoff must be stale scheduled');
assert(api._matchNeedsStatusVerification(match(), now), 'Stale scheduled match must require verification');
assert(!api._matchIsLiveish(match(), now), 'Stale scheduled match must not render as live-ish');

assert(!api._matchIsStaleScheduled(match({ match_date: '2026-06-23T11:40:00Z' }), now), 'TIMED 20 minutes after kickoff stays in kickoff grace');
assert(api._matchIsLiveish(match({ match_date: '2026-06-23T11:40:00Z' }), now), 'TIMED inside kickoff grace may still render as live-ish');

assert(api._matchNeedsStatusVerification(match({
  status: 'FINISHED',
  live_source: 'espn-final',
  status_detail: 'ESPN final pending verification',
}), now), 'Provider-pending finals must render as verification, not final/scheduled');

assert(api._matchNeedsStatusVerification(match({
  status: 'IN_PLAY',
  match_date: '2026-06-23T07:00:00Z',
}), now), 'Very old live status must render as verification');

assert(!api._matchNeedsStatusVerification(match({
  status: 'FINISHED',
  match_date: '2026-06-23T09:00:00Z',
  home_score: 2,
  away_score: 1,
  status_detail: null,
  live_source: null,
}), now), 'Verified finished match must not render as verification');

assert(api._snapshotHasStaleScheduled([match()], now), 'Snapshot stale detection must include stale scheduled rows');

const cardSource = sliceBetween(app, 'function createMatchCard', 'function getTeamName');
assert(/needsStatusVerification\s*=\s*_matchNeedsStatusVerification\(match\)/.test(cardSource), 'Match cards must use the shared verification state');
assert(/card\.classList\.add\('verifying'\)/.test(cardSource), 'Verification state must use the verifying card style');
assert(/matchesEx\.statusBeingVerified/.test(cardSource), 'Verification note must avoid overclaiming a final score');
assert(/if \(needsStatusVerification\)[\s\S]*statusText\s*=\s*t\('matchesEx\.verifyingResult'\)/.test(cardSource), 'Verification state must display verifying result status text');

const mergedByNumber = api.mergeOfficialScheduleWithLiveMatches([
  {
    match_number: 73,
    match_date: '2026-06-28T19:00:00Z',
    status: 'SCHEDULED',
    home_team_code: 'RSA',
    away_team_code: 'CAN'
  }
], [
  {
    match_number: 73,
    match_date: '2026-06-28T19:00:00Z',
    status: 'FINISHED',
    home_score: 2,
    away_score: 1,
    home_team_code: 'RSA',
    away_team_code: 'CAN',
    winner_code: 'RSA'
  }
]);
assert(mergedByNumber[0].status === 'FINISHED', 'Verified DB result must overlay FIFA schedule by match_number');
assert(mergedByNumber[0].home_score === 2 && mergedByNumber[0].away_score === 1, 'Overlay must carry final score into match display');

const loadMatchesSource = sliceBetween(app, 'async function loadMatches', 'function _matchIdentityKey');
assert(!/loadPundit|renderPundit|loadWorldCupStories|worldCupStories|pundit|banter/i.test(loadMatchesSource), 'Match loading must not depend on optional content systems');

const snapshotSource = sliceBetween(app, 'function _snapshotShouldReadDb', 'function _matchCountsForGroupProjection');
assert(/_snapshotHasStaleScheduled\(matches\)/.test(snapshotSource), 'Stale scheduled CDN snapshots must force a DB read');

assert(workflow.includes("scripts/test-match-display-state.js"), 'CI workflow must watch and run match display-state tests');
assert(/run:\s*node scripts\/test-match-display-state\.js/.test(workflow), 'CI workflow must run match display-state tests');

console.log('Match display-state tests passed');
