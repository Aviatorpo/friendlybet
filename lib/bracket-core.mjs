// ============================================================
// FriendlyBet - server-side bracket resolver (ESM)
// ============================================================
// Port of the bracket logic in share-assets/share-core.js / app.js, used by the
// OG card to compute a champion's "road to the title" (the team beaten each
// round R32..FINAL) from a user's saved picks. No DOM / no globals.
// ============================================================

import { resolveThirdPlaceAssignment } from './third-place-allocation.mjs';

const SP_R32_DEF = {
  1:[{type:'gp',g:'A',p:2},{type:'gp',g:'B',p:2}],
  2:[{type:'gp',g:'E',p:1},{type:'third',allowed:['A','B','C','D','F']}],
  3:[{type:'gp',g:'F',p:1},{type:'gp',g:'C',p:2}],
  4:[{type:'gp',g:'C',p:1},{type:'gp',g:'F',p:2}],
  5:[{type:'gp',g:'I',p:1},{type:'third',allowed:['C','D','F','G','H']}],
  6:[{type:'gp',g:'E',p:2},{type:'gp',g:'I',p:2}],
  7:[{type:'gp',g:'A',p:1},{type:'third',allowed:['C','E','F','H','I']}],
  8:[{type:'gp',g:'L',p:1},{type:'third',allowed:['E','H','I','J','K']}],
  9:[{type:'gp',g:'D',p:1},{type:'third',allowed:['B','E','F','I','J']}],
  10:[{type:'gp',g:'G',p:1},{type:'third',allowed:['A','E','H','I','J']}],
  11:[{type:'gp',g:'K',p:2},{type:'gp',g:'L',p:2}],
  12:[{type:'gp',g:'H',p:1},{type:'gp',g:'J',p:2}],
  13:[{type:'gp',g:'B',p:1},{type:'third',allowed:['E','F','G','I','J']}],
  14:[{type:'gp',g:'J',p:1},{type:'gp',g:'H',p:2}],
  15:[{type:'gp',g:'K',p:1},{type:'third',allowed:['D','E','I','J','L']}],
  16:[{type:'gp',g:'D',p:2},{type:'gp',g:'G',p:2}]
};
const SP_R16_DEF = { 17:[2,5],18:[1,3],19:[4,6],20:[7,8],21:[11,12],22:[9,10],23:[14,16],24:[13,15] };
const SP_QF_DEF  = { 25:[17,18],26:[21,22],27:[19,20],28:[23,24] };
const SP_SF_DEF  = { 29:[25,26],30:[27,28] };
const SP_FINAL_DEF = { 31:[29,30] };

const SP_THIRD_PLACE_SLOTS = [2,5,7,8,9,10,13,15].map(pos => ({
  pos, allowed: SP_R32_DEF[pos].find(f => f.type === 'third').allowed
}));

function _matchThirdPlace(chosenGroups) {
  return resolveThirdPlaceAssignment(chosenGroups);
}
function _greedyThirdPlace() {
  const used = new Set(), assignment = {};
  SP_THIRD_PLACE_SLOTS.forEach(({ pos, allowed }) => {
    const g = allowed.find(x => !used.has(x));
    if (g) { assignment[pos] = g; used.add(g); }
  });
  return assignment;
}
function _resolveThirdSlots(picks) {
  const chosen = (picks.thirdPlaceAdvancers || []).filter(Boolean);
  if (chosen.length === 8) { const m = _matchThirdPlace(chosen); if (m) return m; }
  if (chosen.length === 8) return {};
  return _greedyThirdPlace();
}
function _resolveFeed(feed, thirdSlots, slotPos, groupPositions) {
  if (feed.type === 'gp') { const arr = groupPositions[feed.g]; return arr ? arr[feed.p - 1] : null; }
  if (feed.type === 'third') { const g = thirdSlots[slotPos]; if (!g) return null; const arr = groupPositions[g]; return arr ? arr[2] : null; }
  return null;
}

export function resolveBracket(picks) {
  const gp = picks.groupPositions || {};
  const bp = picks.bracketPicks || {};
  const thirdSlots = _resolveThirdSlots(picks);
  const winner = (pos) => bp[pos] || null;
  const r32 = [];
  for (let pos = 1; pos <= 16; pos++) {
    const [a, b] = SP_R32_DEF[pos];
    r32.push({ pos, round: 'R32', home: _resolveFeed(a, thirdSlots, pos, gp), away: _resolveFeed(b, thirdSlots, pos, gp), winner: winner(pos) });
  }
  const fromPos = (def, round) => Object.entries(def).map(([pos, [a, b]]) => ({ pos: +pos, round, home: winner(a), away: winner(b), winner: winner(+pos) }));
  const r16 = fromPos(SP_R16_DEF, 'R16');
  const qf = fromPos(SP_QF_DEF, 'QF');
  const sf = fromPos(SP_SF_DEF, 'SF');
  const [fa, fb] = SP_FINAL_DEF[31];
  const final = { pos: 31, round: 'FINAL', home: winner(fa), away: winner(fb), winner: winner(31) };
  return { r32, r16, qf, sf, final };
}

// The champion's 5-step road: [{stage, beat}] for R32, R16, QF, SF, FINAL.
// `champ` defaults to picks.tournamentWinner || bracketPicks[31].
export function championRoad(picks) {
  const champ = picks.tournamentWinner || (picks.bracketPicks || {})[31];
  if (!champ) return [];
  const b = resolveBracket(picks);
  const beatIn = matches => {
    const m = (matches || []).find(x => x.winner === champ && (x.home === champ || x.away === champ));
    return m ? (m.home === champ ? m.away : m.home) : null;
  };
  const road = [
    { stage: 'R32', beat: beatIn(b.r32) },
    { stage: 'R16', beat: beatIn(b.r16) },
    { stage: 'QF',  beat: beatIn(b.qf) },
    { stage: 'SF',  beat: beatIn(b.sf) },
  ];
  const f = b.final || {};
  road.push({ stage: 'FINAL', beat: f.home === champ ? f.away : (f.away === champ ? f.home : null) });
  return road;
}
