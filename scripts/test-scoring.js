// ============================================================
// End-to-end scoring test for calculate-scores-v2.js
// ============================================================
// Runs the REAL scoring functions against a fully simulated tournament
// (12 scored groups + a complete knockout incl. TWO penalty-decided matches),
// with picks whose points are hand-computed, and asserts every category.
// Run: node scripts/test-scoring.js   (no DB / no secrets needed)
// ============================================================

process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'test-key';
const S = require('./calculate-scores-v2.js');

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '✓' : '✗ FAIL'}  ${label}  got=${JSON.stringify(got)}${ok ? '' : ` want=${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
}

// ---------- 1. PURE-FUNCTION UNIT TESTS ----------
console.log('\n== unit: bracketPosRuleKey ==');
eq('pos1->r32',  S.bracketPosRuleKey(1),  'round_of_32');
eq('pos16->r32', S.bracketPosRuleKey(16), 'round_of_32');
eq('pos17->r16', S.bracketPosRuleKey(17), 'round_of_16');
eq('pos24->r16', S.bracketPosRuleKey(24), 'round_of_16');
eq('pos25->qf',  S.bracketPosRuleKey(25), 'quarter_final');
eq('pos28->qf',  S.bracketPosRuleKey(28), 'quarter_final');
eq('pos29->sf',  S.bracketPosRuleKey(29), 'semi_final');
eq('pos30->sf',  S.bracketPosRuleKey(30), 'semi_final');
eq('pos31->final', S.bracketPosRuleKey(31), 'final');
eq('pos0->null',  S.bracketPosRuleKey(0),  null);
eq('pos32->null', S.bracketPosRuleKey(32), null);
eq('null->null',  S.bracketPosRuleKey(null), null);

console.log('\n== unit: stageRuleKey ==');
eq('LAST_32',       S.stageRuleKey('LAST_32'), 'round_of_32');
eq('ROUND_OF_32',   S.stageRuleKey('ROUND_OF_32'), 'round_of_32');
eq('LAST_16',       S.stageRuleKey('LAST_16'), 'round_of_16');
eq('QUARTER_FINALS',S.stageRuleKey('QUARTER_FINALS'), 'quarter_final');
eq('SEMI_FINALS',   S.stageRuleKey('SEMI_FINALS'), 'semi_final');
eq('FINAL',         S.stageRuleKey('FINAL'), 'final');
eq('GROUP_STAGE->null', S.stageRuleKey('GROUP_STAGE'), null);

console.log('\n== unit: knockoutWinner (penalties!) ==');
eq('normal home win', S.knockoutWinner({home_score:2,away_score:1,home_team_code:'H',away_team_code:'A'}), 'H');
eq('normal away win', S.knockoutWinner({home_score:0,away_score:3,home_team_code:'H',away_team_code:'A'}), 'A');
eq('penalty: winner_code used', S.knockoutWinner({home_score:1,away_score:1,winner_code:'A',home_team_code:'H',away_team_code:'A'}), 'A');
eq('0-0 penalty winner_code', S.knockoutWinner({home_score:0,away_score:0,winner_code:'H',home_team_code:'H',away_team_code:'A'}), 'H');
eq('tied, no winner_code -> null', S.knockoutWinner({home_score:1,away_score:1,home_team_code:'H',away_team_code:'A'}), null);
eq('winner_code contradicting decisive score is unsafe', S.knockoutWinner({home_score:2,away_score:1,winner_code:'A',home_team_code:'H',away_team_code:'A'}), null);

console.log('\n== unit: computeGroupStandings (tie-break pts>gd>gf>code) ==');
(() => {
  // X beats everyone, Y 2nd, Z & W tie on pts but Z has better GD
  const ms = [
    {home_team_code:'X',away_team_code:'Y',home_score:1,away_score:0,status:'FINISHED'},
    {home_team_code:'X',away_team_code:'Z',home_score:1,away_score:0,status:'FINISHED'},
    {home_team_code:'X',away_team_code:'W',home_score:5,away_score:0,status:'FINISHED'},
    {home_team_code:'Y',away_team_code:'Z',home_score:1,away_score:0,status:'FINISHED'},
    {home_team_code:'Y',away_team_code:'W',home_score:1,away_score:0,status:'FINISHED'},
    {home_team_code:'Z',away_team_code:'W',home_score:1,away_score:0,status:'FINISHED'},
  ];
  const order = S.computeGroupStandings(ms, ['X','Y','Z','W']).map(s => s.code);
  eq('order X>Y>Z>W', order, ['X','Y','Z','W']);
})();
(() => {
  // pts tie A=B=3 each beat the other? make A and B both beat C and D, A-B draw
  const ms = [
    {home_team_code:'A',away_team_code:'B',home_score:0,away_score:0,status:'FINISHED'},
    {home_team_code:'A',away_team_code:'C',home_score:3,away_score:0,status:'FINISHED'},
    {home_team_code:'A',away_team_code:'D',home_score:1,away_score:0,status:'FINISHED'},
    {home_team_code:'B',away_team_code:'C',home_score:1,away_score:0,status:'FINISHED'},
    {home_team_code:'B',away_team_code:'D',home_score:1,away_score:0,status:'FINISHED'},
    {home_team_code:'C',away_team_code:'D',home_score:0,away_score:0,status:'FINISHED'},
  ];
  // A: 7pts(2W1D) gd+4 ; B: 7pts gd+2 ; -> A before B by GD
  const order = S.computeGroupStandings(ms, ['A','B','C','D']).map(s => s.code);
  eq('GD tiebreak A>B', order.slice(0,2), ['A','B']);
})();
(() => {
  // HEAD-TO-HEAD: Z and A tie EXACTLY on overall pts(6)/GD(+2)/GF(4); Z beat A 1-0.
  // FIFA head-to-head must rank Z above A; the old alphabetical rule would wrongly
  // put A first. Result must be [Z,A,M,N].
  const ms = [
    {home_team_code:'Z',away_team_code:'A',home_score:1,away_score:0,status:'FINISHED'}, // Z beats A (h2h)
    {home_team_code:'Z',away_team_code:'M',home_score:0,away_score:2,status:'FINISHED'},
    {home_team_code:'Z',away_team_code:'N',home_score:3,away_score:0,status:'FINISHED'},
    {home_team_code:'A',away_team_code:'M',home_score:2,away_score:0,status:'FINISHED'},
    {home_team_code:'A',away_team_code:'N',home_score:2,away_score:1,status:'FINISHED'},
    {home_team_code:'M',away_team_code:'N',home_score:0,away_score:1,status:'FINISHED'},
  ];
  const order = S.computeGroupStandings(ms, ['Z','A','M','N']).map(s => s.code);
  eq('head-to-head Z>A (not alphabetical A>Z)', order, ['Z','A','M','N']);
})();

console.log('\n== unit: poolMultResolver (pool config precedence / disabled / NaN) ==');
(() => {
  const rules = { multipliers: { favorite:1, contender:1.5, underdog:2 }, team_multipliers: { ARG: 3 } };
  const on  = S.poolMultResolver({ use_multipliers:true }, rules);
  const off = S.poolMultResolver({ use_multipliers:false }, rules);
  eq('disabled -> 1', off('ARG', null), 1);
  eq('per-team override beats stale persisted snapshot', on('ARG', 1), 3);
  eq('category multiplier beats stale persisted snapshot', on('CUR', 1), 2);
  eq('per-team override', on('ARG', null), 3);
  eq('category by rank (ARG=favorite=1)', on('FRA', null), 1);          // FRA rank3
  eq('category underdog (CUR=85)', on('CUR', null), 2);                 // underdog
  eq('contender (MEX=17)', on('MEX', null), 1.5);
  eq('unknown code -> underdog default', on('ZZZ', null), 2);
  eq('NaN persisted ignored -> falls through', on('FRA', 'oops'), 1);
})();

console.log('\n== unit: scoreCalcTimestampFresh ==');
(() => {
  const now = Date.parse('2026-06-24T00:00:00.000Z');
  eq('fresh within heartbeat window', S.scoreCalcTimestampFresh('2026-06-23T19:01:00.000Z', now), true);
  eq('stale at heartbeat limit', S.scoreCalcTimestampFresh('2026-06-23T19:00:00.000Z', now), false);
  eq('missing timestamp is stale', S.scoreCalcTimestampFresh(null, now), false);
})();

// ---------- 2. FULL TOURNAMENT INTEGRATION ----------
// Build 12 groups A..L, teams <L>1..<L>4, better seed always wins 1-0.
// Final standings per group = [<L>1,<L>2,<L>3,<L>4]; each 3rd has pts3 gd-1 gf1.
const LETTERS = 'ABCDEFGHIJKL'.split('');
const groupMatches = [];
const syntheticConductScores = {};
LETTERS.forEach((L, idx) => {
  syntheticConductScores[`${L}3`] = 100 - idx;
});
process.env.FAIR_PLAY_RESOLUTIONS_JSON = JSON.stringify({
  version: 1,
  status: 'ready',
  resolutions: [{
    id: 'test-third-place-cutoff',
    status: 'consensus_resolved',
    conductScores: syntheticConductScores
  }]
});
for (const L of LETTERS) {
  const t = [L+'1', L+'2', L+'3', L+'4'];
  const pairs = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  for (const [i,j] of pairs) {
    groupMatches.push({ stage:'GROUP_STAGE', group_letter:L,
      home_team_code:t[i], away_team_code:t[j], home_score:1, away_score:0, status:'FINISHED' });
  }
}
// best-8 thirds: all 3rds identical on points/GD/GF; the resolver snapshot above
// supplies conduct scores so A3..H3 advance and I3..L3 don't.

// Knockout matches (note TWO penalty-decided: a R32 and the FINAL).
const koMatches = [
  { stage:'LAST_32', home_team_code:'KO1', away_team_code:'KO2', home_score:2, away_score:1, status:'FINISHED' },          // KO1 wins normally
  { stage:'LAST_32', home_team_code:'KOP1',away_team_code:'KOP2',home_score:1, away_score:1, winner_code:'KOP2', status:'FINISHED' }, // penalties -> KOP2
  { stage:'LAST_32', home_team_code:'ARG', away_team_code:'xx1', home_score:1, away_score:0, status:'FINISHED' },          // ARG (favorite) wins
  { stage:'LAST_32', home_team_code:'MEX', away_team_code:'xx2', home_score:1, away_score:0, status:'FINISHED' },          // MEX (contender) wins
  { stage:'LAST_16', home_team_code:'KO1', away_team_code:'xx3', home_score:3, away_score:0, status:'FINISHED' },
  { stage:'QUARTER_FINALS', home_team_code:'KO1', away_team_code:'xx4', home_score:1, away_score:0, status:'FINISHED' },
  { stage:'SEMI_FINALS', home_team_code:'KO1', away_team_code:'xx5', home_score:2, away_score:0, status:'FINISHED' },
  { stage:'FINAL', home_team_code:'KO1', away_team_code:'xx6', home_score:0, away_score:0, winner_code:'KO1', status:'FINISHED' }, // FINAL on penalties -> KO1 champion
];
const finishedMatches = groupMatches.concat(koMatches);
const fullGroupMatchesSnapshot = groupMatches.slice();
const twoPhaseKnockoutMatches = [
  { stage:'LAST_32', home_team_code:'A2', away_team_code:'B2', home_score:2, away_score:0, status:'FINISHED' },
  { stage:'LAST_32', home_team_code:'E1', away_team_code:'C3', home_score:1, away_score:0, status:'FINISHED' },
];
const twoPhaseGroupState = {
  status: 'ready',
  groupPositions: Object.fromEntries(LETTERS.map(L => [L, [L+'1', L+'2', L+'3', L+'4']])),
  thirdPlaceGroups: LETTERS.slice(0, 8)
};

console.log('\n== unit: two-phase slot mapper accepts scorer group state shape ==');
(() => {
  const scorerGroupState = {
    status: 'ready',
    standings: Object.fromEntries(LETTERS.map(L => [L, [L+'1', L+'2', L+'3', L+'4']])),
    realBest8Thirds: new Set(LETTERS.slice(0, 8).map(L => L+'3')),
  };
  const slots = S.buildTwoPhaseSlotMatches(groupMatches.concat(twoPhaseKnockoutMatches), scorerGroupState);
  eq('R32_M1 maps from buildGroupState-style standings', slots.get('R32_M1')?.home_team_code, 'A2');
  eq('R32_M2 maps from buildGroupState-style best thirds', slots.get('R32_M2')?.away_team_code, 'C3');
})();

function setGroupMatchesForMock(rows) {
  groupMatches.length = 0;
  groupMatches.push(...rows);
}

function syntheticGroupRows(letter, statusOverride = null) {
  return fullGroupMatchesSnapshot
    .filter(m => m.group_letter === letter)
    .map((m, idx) => ({
      ...m,
      ...(typeof statusOverride === 'function' ? statusOverride(m, idx) : (statusOverride || {})),
    }));
}

function actualGroupRows(letter, limit = 6, statusOverride = null) {
  const teams = S.WC2026_GROUPS[letter];
  const pairs = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  return pairs.slice(0, limit).map(([i, j], idx) => ({
    stage: 'GROUP_STAGE',
    group_letter: letter,
    home_team_code: teams[i],
    away_team_code: teams[j],
    home_score: 1,
    away_score: 0,
    status: 'FINISHED',
    ...(typeof statusOverride === 'function' ? statusOverride(idx) : (statusOverride || {})),
  }));
}

// Per-user pick fixtures (keyed by user id)
const gppByUser = {}, kpByUser = {}, tppByUser = {};
function gpp(uid, L, picks) { // picks = [t1,t2,t3,t4] team for positions 1..4
  gppByUser[uid] = gppByUser[uid] || [];
  picks.forEach((code, idx) => { if (code) gppByUser[uid].push({ group_letter:L, position:idx+1, team_code:code }); });
}
function bracket(uid, pos, team) { kpByUser[uid] = kpByUser[uid] || []; kpByUser[uid].push({ bracket_position:pos, predicted_winner:team }); }
function thirds(uid, letters) { tppByUser[uid] = letters.map(L => ({ group_letter:L })); }

// U1 single-phase, multipliers OFF. Full group A + full group I correct.
gpp('U1','A',['A1','A2','A3','A4']);
gpp('U1','I',['I1','I2','I3','I4']);
thirds('U1',['A','I']);                 // A3 in best8 (+1), I3 not (+0)
bracket('U1',1,'KO1');                  // r32 +2
bracket('U1',2,'KOP2');                 // r32 via PENALTY +2  (regression guard)
bracket('U1',17,'KO1');                 // r16 +4
bracket('U1',25,'KO1');                 // qf  +8
bracket('U1',29,'KO1');                 // sf  +16
bracket('U1',31,'KO1');                 // final via PENALTY +32 (regression guard)
// U1 top scorer correct -> +10
// expected: group=20, knockout=2+2+4+8+16+32=64, bonus=1(third)+10(ts)=11, total=95

// U2 single-phase, multipliers ON (defaults). Synthetic=underdog x2; ARG fav x1; MEX cont x1.5
gpp('U2','B',['B1','B2','B3','B4']);    // (4+3+2+1)*2 = 20
bracket('U2',1,'KO1');                  // 2 * x2 = 4
bracket('U2',3,'ARG');                  // 2 * x1 = 2
bracket('U2',5,'MEX');                  // 2 * x1.5 = 3
// expected: group=20, knockout=4+2+3=9, bonus=0, total=29

// U3 two-phase, multipliers OFF. v2.10.9: two-phase group points now require a
// VALID FINAL set (exactly 32 real-WC2026 teams, 2-3 per group). This synthetic
// 3-pick set is intentionally INCOMPLETE -> 0 group points (the validator's
// accept/reject behaviour is covered exhaustively by the validateTwoPhaseGroupPickSet
// unit tests below). Knockout + bonus scoring is unaffected.
const gp3 = [{ group_letter:'A', team_code:'A1' }, { group_letter:'A', team_code:'A2' }, { group_letter:'A', team_code:'A4' }];
const kp3 = [
  { match_id:'R32_M1', predicted_winner:'A2' }, // correct exact slot
  { match_id:'R32_M2', predicted_winner:'A2' }, // same winning team, wrong slot -> no points
];
kpByUser['U3'] = kp3;                    // wire U3's two-phase knockout picks into the mock
const groupPicksByUser = { U3: gp3 };
// A2 wins R32_M1. The duplicate A2 pick in R32_M2 must NOT score now that
// two-phase scoring is fixture/slot-aware.
// U3 top scorer correct -> +10
// expected: group=0 (incomplete set, not a valid 32), knockout=2, bonus=10, total=12

// U4 single-phase, multipliers ON, ALL teams x1.5 -> rounding (sum-then-round) check.
gpp('U4','C',[null,'C2',null,'C4']);    // pos2=3*1.5=4.5 ; pos4=1*1.5=1.5 ; sum=6.0 -> round 6 (NOT 7)
// expected: group=6, knockout=0, bonus=0, total=6

// U5 late-knockout, with stale group/third-place/top-scorer rows present.
// Late pools must score only the knockout bracket.
gpp('U5','A',['A1','A2','A3','A4']);
thirds('U5',['A']);
bracket('U5',1,'KO1');
bracket('U5',17,'KO1');
bracket('U5',25,'KO1');
bracket('U5',29,'KO1');
bracket('U5',31,'KO1');
// expected: group=0, knockout=2+4+8+16+32=62, bonus=0, total=62

// ---------- mock Supabase transport ----------
const captured = {};
const idOf = (url) => { const m = url.match(/(?:user_id|id)=eq\.([^&]+)/); return m ? m[1] : null; };
const resp = (data) => ({ ok:true, status:200, text: async () => JSON.stringify(data) });
const mockScoringFetch = async (url, opts) => {
  const method = (opts && opts.method) || 'GET';
  if (method === 'PATCH' && url.includes('/users')) { captured[idOf(url)] = JSON.parse(opts.body); return resp([{}]); }
  if (method === 'GET'  && url.includes('/matches') && url.includes('GROUP_STAGE')) return resp(groupMatches);
  if (method === 'GET'  && url.includes('/group_position_picks')) return resp(gppByUser[idOf(url)] || []);
  if (method === 'GET'  && url.includes('/knockout_picks'))       return resp(kpByUser[idOf(url)] || []);
  if (method === 'GET'  && url.includes('/sp_third_place_picks')) return resp(tppByUser[idOf(url)] || []);
  if (method === 'GET'  && url.includes('/group_picks'))          return resp(groupPicksByUser[idOf(url)] || []);
  return resp([]);
};
S.__setFetch(mockScoringFetch);

(async () => {
  console.log('\n== integration: sbAll paginates beyond 100 pages ==');
  const ranges = [];
  S.__setFetch(async (_url, opts) => {
    const range = opts.headers.Range;
    ranges.push(range);
    const from = Number(range.split('-')[0]);
    const len = from < 100000 ? 1000 : 1;
    return resp(Array.from({ length: len }, (_, i) => ({ row: from + i })));
  });
  const pagedRows = await S.sbAll('big_table');
  eq('sbAll fetches page 101 instead of truncating at 100k rows', pagedRows.length, 100001);
  eq('sbAll requested the page after 0-99999', ranges.includes('100000-100999'), true);
  S.__setFetch(mockScoringFetch);

  const rulesSingle = { ...S.DEFAULT_RULES_SINGLE };           // 4/3/2/1, r32..final, third_place_advance=1, top_scorer=10
  const rulesAllX15 = { ...S.DEFAULT_RULES_SINGLE, multipliers: { favorite:1.5, contender:1.5, underdog:1.5 } };
  const rulesTwo    = { ...S.DEFAULT_RULES_TWO };              // group_first=1, r32..final, top_scorer=10

  const tsMapSingle = new Map([['U1', { player_id:'TS1' }]]);  // U1 correct top scorer
  const tsMapTwo    = new Map([['U3', { player_id:'TS1' }]]);  // U3 correct top scorer

  console.log('\n== integration: single-phase, multipliers OFF (U1) ==');
  await S.scoreSinglePhasePool({ id:'P1', code:'P1', use_multipliers:false }, rulesSingle,
    [{ id:'U1', nickname:'U1' }], finishedMatches, tsMapSingle, 'TS1');
  eq('U1 group', captured.U1.group_points, 20);
  eq('U1 knockout', captured.U1.knockout_points, 64);
  eq('U1 bonus', captured.U1.bonus_points, 11);
  eq('U1 total', captured.U1.total_score, 95);

  console.log('\n== integration: single-phase, multipliers ON (U2) ==');
  await S.scoreSinglePhasePool({ id:'P2', code:'P2', use_multipliers:true }, rulesSingle,
    [{ id:'U2', nickname:'U2' }], finishedMatches, new Map(), null);
  eq('U2 group (x2)', captured.U2.group_points, 20);
  eq('U2 knockout (4+2+3)', captured.U2.knockout_points, 9);
  eq('U2 bonus', captured.U2.bonus_points, 0);
  eq('U2 total', captured.U2.total_score, 29);

  console.log('\n== integration: two-phase (U3) ==');
  await S.scoreTwoPhasePool({ id:'P3', code:'P3', use_multipliers:false }, rulesTwo,
    [{ id:'U3', nickname:'U3' }], groupMatches.concat(twoPhaseKnockoutMatches), tsMapTwo, 'TS1', { groupState: twoPhaseGroupState });
  eq('U3 group (incomplete set -> 0)', captured.U3.group_points, 0);
  eq('U3 knockout exact slot only', captured.U3.knockout_points, 2);
  eq('U3 bonus (top scorer)', captured.U3.bonus_points, 10);
  eq('U3 total', captured.U3.total_score, 12);

  console.log('\n== integration: rounding sum-then-round (U4) ==');
  await S.scoreSinglePhasePool({ id:'P4', code:'P4', use_multipliers:true }, rulesAllX15,
    [{ id:'U4', nickname:'U4' }], finishedMatches, new Map(), null);
  eq('U4 group (round(4.5+1.5)=6, not 7)', captured.U4.group_points, 6);
  eq('U4 total', captured.U4.total_score, 6);

  console.log('\n== integration: late-knockout ignores stale non-knockout rows (U5) ==');
  const rulesLate = {
    ...S.DEFAULT_RULES_SINGLE,
    group_first: 99,
    group_second: 99,
    group_third: 99,
    group_fourth: 99,
    third_place_advance: 99,
    top_scorer: 99,
  };
  await S.scoreSinglePhasePool({ id:'P5', code:'P5', use_multipliers:false }, rulesLate,
    [{ id:'U5', nickname:'U5' }], finishedMatches, new Map([['U5', { player_id:'TS1' }]]), 'TS1', { lateKnockout:true });
  eq('U5 group ignored', captured.U5.group_points, 0);
  eq('U5 knockout only', captured.U5.knockout_points, 62);
  eq('U5 bonus ignored', captured.U5.bonus_points, 0);
  eq('U5 total', captured.U5.total_score, 62);

  console.log('\n== integration: partial group completion starts real scoring per group ==');
  gpp('U6','A',['A1','A2','A3','A4']);
  gpp('U6','B',['B1','B2','B3','B4']);
  thirds('U6',['A']);
  setGroupMatchesForMock([
    ...syntheticGroupRows('A'),
    ...syntheticGroupRows('B').slice(0, 5),
  ]);
  await S.scoreSinglePhasePool({ id:'P6', code:'P6', use_multipliers:false }, rulesSingle,
    [{ id:'U6', nickname:'U6' }], groupMatches.slice(), new Map(), null);
  eq('U6 scores completed group A immediately', captured.U6.group_points, 10);
  eq('U6 does not score best-third bonus before all 12 groups complete', captured.U6.bonus_points, 0);
  eq('U6 total excludes incomplete group B picks', captured.U6.total_score, 10);

  console.log('\n== integration: provider-pending final does not unlock group scoring ==');
  gpp('U8','C',['C1','C2','C3','C4']);
  setGroupMatchesForMock(syntheticGroupRows('C', (m, idx) => (
    idx === 5 ? { live_source: 'espn-final', status_detail: 'ESPN final pending verification' } : null
  )));
  await S.scoreSinglePhasePool({ id:'P8', code:'P8', use_multipliers:false }, rulesSingle,
    [{ id:'U8', nickname:'U8' }], groupMatches.slice(), new Map(), null);
  eq('U8 pending final keeps group C unscored', captured.U8.group_points, 0);
  eq('U8 pending final total stays zero', captured.U8.total_score, 0);

  console.log('\n== integration: provider-pending knockout final does not award points ==');
  bracket('U9',1,'KO1');
  kpByUser.U10 = [{ predicted_winner:'KO1' }];
  setGroupMatchesForMock([]);
  const pendingKnockout = [{
    stage: 'LAST_32',
    home_team_code: 'KO1',
    away_team_code: 'KO2',
    home_score: 2,
    away_score: 1,
    status: 'FINISHED',
    live_source: 'espn-final',
    status_detail: 'ESPN final pending verification',
  }];
  await S.scoreSinglePhasePool({ id:'P9', code:'P9', use_multipliers:false }, rulesSingle,
    [{ id:'U9', nickname:'U9' }], pendingKnockout, new Map(), null);
  eq('U9 pending knockout final keeps single-phase knockout unscored', captured.U9.knockout_points, 0);
  eq('U9 pending knockout final total stays zero', captured.U9.total_score, 0);
  await S.scoreTwoPhasePool({ id:'P10', code:'P10', use_multipliers:false }, rulesTwo,
    [{ id:'U10', nickname:'U10' }], pendingKnockout, new Map(), null);
  eq('U10 pending knockout final keeps two-phase knockout unscored', captured.U10.knockout_points, 0);
  eq('U10 pending knockout final total stays zero', captured.U10.total_score, 0);

  console.log('\n== integration: unchanged scores refresh stale heartbeat only ==');
  const unchangedZero = {
    id: 'U11',
    nickname: 'U11',
    group_points: 0,
    knockout_points: 0,
    bonus_points: 0,
    groups_score: 0,
    knockout_score: 0,
    bonus_score: 0,
    total_score: 0,
    last_score_calc: '2026-06-20T00:00:00.000Z',
  };
  const staleTouched = await S.updateUserScoreIfChanged(unchangedZero, 0, 0, 0, 0);
  eq('stale unchanged score writes heartbeat', staleTouched, true);
  eq('stale unchanged score patches timestamp only', Object.keys(captured.U11).sort(), ['last_score_calc']);
  eq('heartbeat timestamp is parseable', Number.isFinite(Date.parse(captured.U11.last_score_calc)), true);
  const freshSkipped = await S.updateUserScoreIfChanged({
    ...unchangedZero,
    id: 'U12',
    last_score_calc: new Date().toISOString(),
  }, 0, 0, 0, 0);
  eq('fresh unchanged score skips write', freshSkipped, false);
  eq('fresh unchanged score has no patch', captured.U12, undefined);
  const criticalSkipped = await S.updateUserScoreIfChanged({
    ...unchangedZero,
    id: 'U13',
  }, 0, 0, 0, 0, { heartbeat: false });
  eq('critical unchanged score skips stale heartbeat write', criticalSkipped, false);
  eq('critical unchanged score has no patch', captured.U13, undefined);

  console.log('\n== integration: two-phase partial group completion scores only confirmed advancers ==');
  const validTwoPhase32 = [];
  'ABCDEFGHIJKL'.split('').forEach((L, i) => {
    S.WC2026_GROUPS[L].slice(0, i < 8 ? 3 : 2).forEach(team_code => validTwoPhase32.push({ group_letter: L, team_code }));
  });
  groupPicksByUser.U7 = validTwoPhase32;
  setGroupMatchesForMock([
    ...actualGroupRows('A'),
    ...actualGroupRows('B', 5),
  ]);
  await S.scoreTwoPhasePool({ id:'P7', code:'P7', use_multipliers:false }, rulesTwo,
    [{ id:'U7', nickname:'U7' }], groupMatches.slice(), new Map(), null);
  eq('U7 scores only Group A top-two advancers', captured.U7.group_points, 2);
  eq('U7 total excludes Group A third and incomplete Group B', captured.U7.total_score, 2);

  console.log('\n== integration: duplicate provider group rows do not wipe scoring ==');
  groupPicksByUser.U17 = validTwoPhase32;
  setGroupMatchesForMock([
    ...actualGroupRows('A'),
    ...actualGroupRows('A').map((m, idx) => ({ ...m, id: 'dup-A-' + idx, external_id: 'fifa-A-' + idx, live_source: 'fifa-schedule' })),
    ...actualGroupRows('B', 5),
  ]);
  await S.scoreTwoPhasePool({ id:'P17', code:'P17', use_multipliers:false }, rulesTwo,
    [{ id:'U17', nickname:'U17' }], groupMatches.slice(), new Map(), null);
  eq('U17 duplicate equivalent rows still score Group A top-two advancers', captured.U17.group_points, 2);
  eq('U17 duplicate equivalent rows do not unlock incomplete Group B', captured.U17.total_score, 2);

  console.log('\n== unit: FIFA alias duplicate rows normalize before group completion ==');
  const groupEAliasDupes = actualGroupRows('E').flatMap((m, idx) => ([
    m,
    {
      ...m,
      id: 'dup-E-' + idx,
      external_id: 'fifa-E-' + idx,
      live_source: 'fifa-schedule',
      home_team_code: m.home_team_code === 'CUR' ? 'CUW' : m.home_team_code,
      away_team_code: m.away_team_code === 'CUR' ? 'CUW' : m.away_team_code,
      winner_code: m.winner_code === 'CUR' ? 'CUW' : m.winner_code,
    }
  ]));
  const aliasState = S.buildGroupState(groupEAliasDupes);
  eq('Group E completes with CUR/CUW duplicate aliases', aliasState.standings.E && aliasState.standings.E.length, 4);

  setGroupMatchesForMock(fullGroupMatchesSnapshot);

  console.log('\n== integration: single-phase advancement mode ignores exact position ==');
  gpp('U13','C',['C2','C1','C3','C4']);
  thirds('U13',['C']);
  await S.scoreSinglePhasePool({ id:'P13', code:'P13', use_multipliers:false }, {
    ...rulesSingle,
    group_scoring_mode: 'advancement',
    group_first: 1,
    group_second: 99,
    group_third: 99,
    group_fourth: 99,
  }, [{ id:'U13', nickname:'U13' }], groupMatches.slice(), new Map(), null);
  eq('U13 scores C1/C2/C3 as advancers despite wrong positions', captured.U13.group_points, 3);
  eq('U13 does not score C4 non-advancer', captured.U13.total_score, 3);

  console.log('\n== integration: single-phase advancement mode ignores non-advancing rank slots ==');
  gpp('U15','C',['C4','C3','C2','C1']);
  await S.scoreSinglePhasePool({ id:'P15', code:'P15', use_multipliers:false }, {
    ...rulesSingle,
    group_scoring_mode: 'advancement',
    group_first: 1,
    group_second: 99,
    group_third: 99,
    group_fourth: 99,
    third_place_advance: 1,
  }, [{ id:'U15', nickname:'U15' }], groupMatches.slice(), new Map(), null);
  eq('U15 scores only selected advancement slots, not all ranked teams', captured.U15.group_points, 1);
  eq('U15 does not get the old flat third-place bonus in advancement mode', captured.U15.total_score, 1);

  console.log('\n== integration: single-phase advancement mode replaces flat third-place bonus ==');
  gpp('U16','C',['C4','C1','C3','C2']);
  thirds('U16',['C']);
  await S.scoreSinglePhasePool({ id:'P16', code:'P16', use_multipliers:false }, {
    ...rulesSingle,
    group_scoring_mode: 'advancement',
    group_first: 1,
    third_place_advance: 1,
  }, [{ id:'U16', nickname:'U16' }], groupMatches.slice(), new Map(), null);
  eq('U16 scores top-two plus selected third-place candidate only', captured.U16.group_points, 2);
  eq('U16 total has no extra flat third-place bonus', captured.U16.total_score, 2);

  console.log('\n== integration: single-phase advancement mode waits for best-thirds ==');
  gpp('U14','A',['RSA','MEX','KOR','CZE']);
  setGroupMatchesForMock(actualGroupRows('A'));
  await S.scoreSinglePhasePool({ id:'P14', code:'P14', use_multipliers:false }, {
    ...rulesSingle,
    group_scoring_mode: 'advancement',
    group_first: 1,
  }, [{ id:'U14', nickname:'U14' }], groupMatches.slice(), new Map(), null);
  eq('U14 scores completed Group A top-two only before all thirds are known', captured.U14.group_points, 2);
  eq('U14 third-place pick waits for all groups', captured.U14.total_score, 2);
  setGroupMatchesForMock(fullGroupMatchesSnapshot);

  console.log('\n== unit: groupIsComplete requires TERMINAL status, not live scores ==');
  const finished6 = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, status: 'FINISHED', home_score: 1, away_score: 0 }));
  // a final match still IN_PLAY but already carrying a live score (football-data fills it):
  const fiveDoneOneLive = finished6.map((m, i) => (i === 5 ? { status: 'IN_PLAY', home_score: 1, away_score: 0 } : m));
  eq('6 FINISHED -> group complete', S.groupIsComplete(finished6), true);
  eq('5 FINISHED + 1 IN_PLAY (with live score) -> NOT complete', S.groupIsComplete(fiveDoneOneLive), false);
  eq('AWARDED counts as terminal', S.groupIsComplete(finished6.map((m, i) => (i === 0 ? { status: 'AWARDED', home_score: 3, away_score: 0 } : m))), true);
  eq('mixed-case terminal statuses count defensively', S.groupIsComplete(finished6.map((m, i) => (
    i === 0 ? { ...m, status: 'finished' } : (i === 1 ? { ...m, status: 'Awarded' } : m)
  ))), true);
  eq('only 5 matches present -> NOT complete', S.groupIsComplete(finished6.slice(0, 5)), false);
  eq('ESPN-only pending final does NOT complete group', S.groupIsComplete(finished6.map((m, i) => (
    i === 5 ? { ...m, live_source: 'espn-final', status_detail: 'ESPN final pending verification' } : m
  ))), false);
  eq('duplicate terminal rows do NOT complete group', S.groupIsComplete([
    { id: 1, status: 'FINISHED' }, { id: 2, status: 'FINISHED' }, { id: 3, status: 'FINISHED' },
    { id: 4, status: 'FINISHED' }, { id: 5, status: 'FINISHED' }, { id: 5, status: 'FINISHED' }
  ]), false);
  eq('duplicate logical fixture with different id does NOT complete group', S.groupIsComplete([
    { id: 1, group_letter: 'A', home_team_code: 'A1', away_team_code: 'A2', status: 'FINISHED' },
    { id: 2, group_letter: 'A', home_team_code: 'A1', away_team_code: 'A3', status: 'FINISHED' },
    { id: 3, group_letter: 'A', home_team_code: 'A1', away_team_code: 'A4', status: 'FINISHED' },
    { id: 4, group_letter: 'A', home_team_code: 'A2', away_team_code: 'A3', status: 'FINISHED' },
    { id: 5, group_letter: 'A', home_team_code: 'A2', away_team_code: 'A4', status: 'FINISHED' },
    { id: 99, group_letter: 'A', home_team_code: 'A4', away_team_code: 'A2', status: 'FINISHED' },
  ]), false);
  eq('7 unique terminal rows do NOT complete group', S.groupIsComplete([
    { id: 1, status: 'FINISHED' }, { id: 2, status: 'FINISHED' }, { id: 3, status: 'FINISHED' },
    { id: 4, status: 'FINISHED' }, { id: 5, status: 'FINISHED' }, { id: 6, status: 'FINISHED' },
    { id: 7, status: 'FINISHED' }
  ]), false);

  console.log('\n== unit: validateTwoPhaseGroupPickSet (two-phase scoring fairness) ==');
  const LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  // a VALID exactly-32 set: 3 from the first 8 groups, 2 from the last 4 (8*3+4*2=32)
  const valid32 = [];
  LETTERS.forEach((L, i) => S.WC2026_GROUPS[L].slice(0, i < 8 ? 3 : 2).forEach(tc => valid32.push({ group_letter: L, team_code: tc })));
  eq('valid 32 accepted', S.validateTwoPhaseGroupPickSet(valid32).ok, true);
  eq('valid 32 picks length', S.validateTwoPhaseGroupPickSet(valid32).picks.length, 32);

  // an over-complete 36 set (3 in every group) is INVALID -> not scoreable as 36
  const over36 = [];
  LETTERS.forEach(L => S.WC2026_GROUPS[L].slice(0, 3).forEach(tc => over36.push({ group_letter: L, team_code: tc })));
  const r36 = S.validateTwoPhaseGroupPickSet(over36);
  eq('36 rejected (ok=false)', r36.ok, false);
  eq('36 yields NO scoreable picks', r36.picks.length, 0);

  // under-complete 24 (2 per group) and 31 are NOT a final scoreable set
  const set24 = [];
  LETTERS.forEach(L => S.WC2026_GROUPS[L].slice(0, 2).forEach(tc => set24.push({ group_letter: L, team_code: tc })));
  eq('24 rejected (not final)', S.validateTwoPhaseGroupPickSet(set24).ok, false);
  const set31 = valid32.slice(0, 31);
  eq('31 rejected (not final)', S.validateTwoPhaseGroupPickSet(set31).ok, false);

  // duplicates / wrong-group rows cannot inflate: a valid 32 + a dup + a wrong-group
  // row still validates to exactly the clean 32 (the noise is ignored)
  const dirty = [...valid32, { group_letter: 'A', team_code: S.WC2026_GROUPS.A[0] }, { group_letter: 'A', team_code: 'BRA' }];
  const rDirty = S.validateTwoPhaseGroupPickSet(dirty);
  eq('dirty-but-32 still valid', rDirty.ok, true);
  eq('dirty cleaned to 32', rDirty.picks.length, 32);
  // a wrong-group team alone (BRA tagged A) does not count toward group A
  eq('wrong-group ignored -> A incomplete', S.validateTwoPhaseGroupPickSet([
    { group_letter: 'A', team_code: 'BRA' }
  ]).ok, false);

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})();
