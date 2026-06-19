// ============================================================
// FriendlyBet - server-side bracket resolver (ESM)
// ============================================================
// Port of the bracket logic in share-assets/share-core.js / app.js, used by the
// OG card to compute a champion's "road to the title" (the team beaten each
// round R32..FINAL) from a user's saved picks. No DOM / no globals.
// ============================================================

import { resolveThirdPlaceAssignment } from './third-place-allocation.mjs';

const WC2026_GROUPS = {
  A:['MEX','RSA','KOR','CZE'], B:['CAN','BIH','QAT','SUI'], C:['BRA','MAR','HAI','SCO'],
  D:['USA','PAR','AUS','TUR'], E:['GER','CUR','CIV','ECU'], F:['NED','JPN','SWE','TUN'],
  G:['BEL','EGY','IRN','NZL'], H:['ESP','CPV','SAU','URU'], I:['FRA','SEN','IRQ','NOR'],
  J:['ARG','ALG','AUT','JOR'], K:['POR','COD','UZB','COL'], L:['ENG','CRO','GHA','PAN']
};
const WC2026_GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const FINISHED_MATCH_STATUSES = new Set(['FINISHED', 'AWARDED']);

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

export function computeGroupStandings(matches, groupTeams) {
  const stats = {};
  groupTeams.forEach(code => {
    stats[code] = { code, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  });
  (matches || []).forEach(m => {
    const h = stats[m.home_team_code];
    const a = stats[m.away_team_code];
    const hs = Number(m.home_score);
    const as = Number(m.away_score);
    if (!h || !a || !Number.isFinite(hs) || !Number.isFinite(as)) return;
    h.played++; a.played++;
    h.gf += hs; h.ga += as; h.gd = h.gf - h.ga;
    a.gf += as; a.ga += hs; a.gd = a.gf - a.ga;
    if (hs > as) { h.wins++; a.losses++; h.points += 3; }
    else if (hs < as) { a.wins++; h.losses++; a.points += 3; }
    else { h.draws++; a.draws++; h.points++; a.points++; }
  });

  const h2h = (codes) => {
    const set = new Set(codes);
    const table = {};
    codes.forEach(code => { table[code] = { pts: 0, gd: 0, gf: 0 }; });
    (matches || []).forEach(m => {
      if (!set.has(m.home_team_code) || !set.has(m.away_team_code)) return;
      const hs = Number(m.home_score);
      const as = Number(m.away_score);
      if (!Number.isFinite(hs) || !Number.isFinite(as)) return;
      const h = table[m.home_team_code];
      const a = table[m.away_team_code];
      h.gf += hs; h.gd += hs - as;
      a.gf += as; a.gd += as - hs;
      if (hs > as) h.pts += 3;
      else if (hs < as) a.pts += 3;
      else { h.pts++; a.pts++; }
    });
    return table;
  };

  const ordered = Object.values(stats).sort((a, b) =>
    (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf) || a.code.localeCompare(b.code));
  const sameOverall = (a, b) => a.points === b.points && a.gd === b.gd && a.gf === b.gf;
  const result = [];
  for (let i = 0; i < ordered.length;) {
    let j = i + 1;
    while (j < ordered.length && sameOverall(ordered[i], ordered[j])) j++;
    if (j - i === 1) { result.push(ordered[i]); i = j; continue; }
    const tied = ordered.slice(i, j);
    const ht = h2h(tied.map(s => s.code));
    tied.sort((a, b) =>
      (ht[b.code].pts - ht[a.code].pts) ||
      (ht[b.code].gd - ht[a.code].gd) ||
      (ht[b.code].gf - ht[a.code].gf) ||
      a.code.localeCompare(b.code));
    result.push(...tied);
    i = j;
  }
  return result;
}

export function lateKnockoutSeedFromMatches(matches) {
  const groupPositions = {};
  const thirds = [];
  for (const letter of WC2026_GROUP_LETTERS) {
    const groupMatches = (matches || []).filter(m => {
      const stage = String((m && m.stage) || '').toUpperCase();
      const status = String((m && m.status) || '').toUpperCase();
      return FINISHED_MATCH_STATUSES.has(status) &&
        (stage === 'GROUP_STAGE' || (m.group_letter || m.group) === letter) &&
        (m.group_letter || m.group) === letter;
    });
    const ordered = computeGroupStandings(groupMatches, WC2026_GROUPS[letter] || []);
    if (groupMatches.length < 6 || ordered.length < 4 || ordered.some(s => s.played < 3)) return null;
    groupPositions[letter] = ordered.slice(0, 4).map(s => s.code);
    thirds.push({ ...ordered[2], group: letter });
  }
  thirds.sort((a, b) =>
    (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf) || a.code.localeCompare(b.code));
  return { groupPositions, thirdPlaceAdvancers: thirds.slice(0, 8).map(s => s.group) };
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
