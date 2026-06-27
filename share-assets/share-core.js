// ============================================================
// FriendlyBet - Shareable predictions: shared core
// ============================================================
// Self-contained constants + helpers used by share.html (the public
// "my predictions" page) and share-og.html (the 1200x630 social card).
// Mirrors the single-phase data model in app.js (groupPositions /
// bracketPicks / tournamentWinner) so the share page can resolve a full
// bracket from raw picks WITHOUT loading the 7k-line app.js.
//
// Picks object shape (same as app.js spState):
//   {
//     nickname: 'Eyal',
//     lang: 'he' | 'en',
//     groupPositions: { A:['MEX','KOR','RSA','CZE'], ... },  // 1st..4th
//     thirdPlaceAdvancers: ['A','C','E',...],                // 8 group letters
//     bracketPicks: { 1:'MEX', ..., 31:'ARG' },              // pos -> winner
//     tournamentWinner: 'ARG',
//     topScorer: { player_name:'Lionel Messi', team_code:'ARG' }
//   }
// ============================================================

// 48 WC2026 teams: code -> { en, he }
const TEAM_NAMES = {
  MEX:{en:'Mexico',he:'מקסיקו'}, RSA:{en:'South Africa',he:'דרום אפריקה'}, KOR:{en:'South Korea',he:'דרום קוריאה'}, CZE:{en:'Czechia',he:"צ'כיה"},
  CAN:{en:'Canada',he:'קנדה'}, BIH:{en:'Bosnia-Herzegovina',he:'בוסניה-הרצגובינה'}, QAT:{en:'Qatar',he:'קטאר'}, SUI:{en:'Switzerland',he:'שווייץ'},
  BRA:{en:'Brazil',he:'ברזיל'}, MAR:{en:'Morocco',he:'מרוקו'}, HAI:{en:'Haiti',he:'האיטי'}, SCO:{en:'Scotland',he:'סקוטלנד'},
  USA:{en:'United States',he:'ארה"ב'}, PAR:{en:'Paraguay',he:'פרגוואי'}, AUS:{en:'Australia',he:'אוסטרליה'}, TUR:{en:'Turkey',he:'טורקיה'},
  GER:{en:'Germany',he:'גרמניה'}, CUR:{en:'Curaçao',he:'קוראסאו'}, CIV:{en:'Ivory Coast',he:'חוף השנהב'}, ECU:{en:'Ecuador',he:'אקוודור'},
  NED:{en:'Netherlands',he:'הולנד'}, JPN:{en:'Japan',he:'יפן'}, SWE:{en:'Sweden',he:'שבדיה'}, TUN:{en:'Tunisia',he:'תוניסיה'},
  BEL:{en:'Belgium',he:'בלגיה'}, EGY:{en:'Egypt',he:'מצרים'}, IRN:{en:'Iran',he:'איראן'}, NZL:{en:'New Zealand',he:'ניו זילנד'},
  ESP:{en:'Spain',he:'ספרד'}, CPV:{en:'Cape Verde',he:'כף ורדה'}, SAU:{en:'Saudi Arabia',he:'ערב הסעודית'}, URU:{en:'Uruguay',he:'אורוגוואי'},
  FRA:{en:'France',he:'צרפת'}, SEN:{en:'Senegal',he:'סנגל'}, IRQ:{en:'Iraq',he:'עיראק'}, NOR:{en:'Norway',he:'נורווגיה'},
  ARG:{en:'Argentina',he:'ארגנטינה'}, ALG:{en:'Algeria',he:"אלג'יריה"}, AUT:{en:'Austria',he:'אוסטריה'}, JOR:{en:'Jordan',he:'ירדן'},
  POR:{en:'Portugal',he:'פורטוגל'}, COD:{en:'Congo DR',he:'קונגו הדמוקרטית'}, UZB:{en:'Uzbekistan',he:'אוזבקיסטן'}, COL:{en:'Colombia',he:'קולומביה'},
  ENG:{en:'England',he:'אנגליה'}, CRO:{en:'Croatia',he:'קרואטיה'}, GHA:{en:'Ghana',he:'גאנה'}, PAN:{en:'Panama',he:'פנמה'},
};

// 3-letter code -> flagcdn ISO code (matches app.js FLAG_ISO exactly).
const FLAG_ISO = {
  ARG:'ar', FRA:'fr', BRA:'br', ENG:'gb-eng', ESP:'es', POR:'pt', NED:'nl', GER:'de',
  BEL:'be', CRO:'hr', URU:'uy', USA:'us', MEX:'mx', SUI:'ch', AUT:'at', SWE:'se',
  SEN:'sn', MAR:'ma', JPN:'jp', KOR:'kr', AUS:'au', CAN:'ca', TUR:'tr',
  NOR:'no', IRN:'ir', SCO:'gb-sct', CZE:'cz', ALG:'dz', CIV:'ci', TUN:'tn', EGY:'eg',
  GHA:'gh', PAN:'pa', PAR:'py', NZL:'nz', UZB:'uz', IRQ:'iq',
  SAU:'sa', JOR:'jo', RSA:'za', HAI:'ht', BIH:'ba', CPV:'cv', COD:'cd', QAT:'qa', CUR:'cw',
  ECU:'ec', COL:'co'
};

const WC2026_GROUPS = {
  A:['MEX','RSA','KOR','CZE'], B:['CAN','BIH','QAT','SUI'], C:['BRA','MAR','HAI','SCO'],
  D:['USA','PAR','AUS','TUR'], E:['GER','CUR','CIV','ECU'], F:['NED','JPN','SWE','TUN'],
  G:['BEL','EGY','IRN','NZL'], H:['ESP','CPV','SAU','URU'], I:['FRA','SEN','IRQ','NOR'],
  J:['ARG','ALG','AUT','JOR'], K:['POR','COD','UZB','COL'], L:['ENG','CRO','GHA','PAN']
};
const WC2026_GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const FINISHED_MATCH_STATUSES = new Set(['FINISHED', 'AWARDED']);

const FIFA_RANKINGS = {
  ARG:1, ESP:2, FRA:3, ENG:4, BRA:5, POR:6, NED:7, BEL:8,
  CRO:9, GER:12, COL:13, MAR:14, URU:15, USA:16, MEX:17, JPN:18, SUI:19,
  SEN:20, IRN:21, KOR:22, AUT:23, ECU:24, SWE:25, AUS:26, TUR:27,
  NOR:28, TUN:29, EGY:30, ALG:31, CAN:32, CZE:33, SCO:34, CIV:35,
  PAR:37, PAN:38, IRQ:40, RSA:42, UZB:43, JOR:44, GHA:47,
  NZL:55, SAU:57, COD:58, BIH:59, HAI:60, CPV:65, QAT:66, CUR:85
};
function fifaRankOf(code){ return FIFA_RANKINGS[code] ?? 999; }

function computeGroupStandings(matches, groupTeams){
  if (window.FBWorldCupRules && typeof window.FBWorldCupRules.computeGroupStandings === 'function') {
    return window.FBWorldCupRules.computeGroupStandings(matches, groupTeams, { strict: true });
  }
  const stats = {};
  groupTeams.forEach(code => {
    stats[code] = { code, played:0, wins:0, draws:0, losses:0, gf:0, ga:0, gd:0, points:0 };
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
    codes.forEach(code => { table[code] = { pts:0, gd:0, gf:0 }; });
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

  const ordered = Object.values(stats).sort((a,b) =>
    (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf) || a.code.localeCompare(b.code));
  const sameOverall = (a,b) => a.points === b.points && a.gd === b.gd && a.gf === b.gf;
  const result = [];
  for (let i = 0; i < ordered.length;) {
    let j = i + 1;
    while (j < ordered.length && sameOverall(ordered[i], ordered[j])) j++;
    if (j - i === 1) { result.push(ordered[i]); i = j; continue; }
    const tied = ordered.slice(i, j);
    const ht = h2h(tied.map(s => s.code));
    tied.sort((a,b) =>
      (ht[b.code].pts - ht[a.code].pts) ||
      (ht[b.code].gd - ht[a.code].gd) ||
      (ht[b.code].gf - ht[a.code].gf) ||
      a.code.localeCompare(b.code));
    result.push(...tied);
    i = j;
  }
  return result;
}

function lateKnockoutSeedFromMatches(matches){
  if (window.FBWorldCupRules && typeof window.FBWorldCupRules.lateKnockoutSeedFromMatches === 'function') {
    const seed = window.FBWorldCupRules.lateKnockoutSeedFromMatches(matches, { strict: true });
    return seed && seed.ok ? { groupPositions: seed.groupPositions, thirdPlaceAdvancers: seed.thirdPlaceAdvancers } : null;
  }
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
  thirds.sort((a,b) =>
    (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf) || a.code.localeCompare(b.code));
  return { groupPositions, thirdPlaceAdvancers: thirds.slice(0, 8).map(s => s.group) };
}

// --- Bracket definitions (mirror app.js) -------------------------------
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

function _resolveThirdSlots(picks){
  const chosen = (picks.thirdPlaceAdvancers || []).filter(Boolean);
  if (chosen.length === 8){
    const helper = window.FB_FIFA_THIRD_PLACE;
    const m = helper && typeof helper.assignment === 'function'
      ? helper.assignment(chosen)
      : null;
    if (m) return m;
  }
  return {};
}
function _resolveFeed(feed, thirdSlots, slotPos, groupPositions){
  if (feed.type === 'gp'){
    const arr = groupPositions[feed.g];
    return arr ? arr[feed.p - 1] : null;
  }
  if (feed.type === 'third'){
    const g = thirdSlots[slotPos];
    if (!g) return null;
    const arr = groupPositions[g];
    return arr ? arr[2] : null;
  }
  return null;
}

// Resolve the full bracket tree from a picks object. Returns
// { r32:[...], r16:[...], qf:[...], sf:[...], final:{...} } where each match
// is { pos, round, home, away, winner }.
function resolveBracket(picks){
  const gp = picks.groupPositions || {};
  const bp = picks.bracketPicks || {};
  const thirdSlots = _resolveThirdSlots(picks);
  const winner = (pos) => bp[pos] || null;

  const r32 = [];
  for (let pos=1; pos<=16; pos++){
    const [a,b] = SP_R32_DEF[pos];
    r32.push({ pos, round:'R32',
      home:_resolveFeed(a,thirdSlots,pos,gp),
      away:_resolveFeed(b,thirdSlots,pos,gp),
      winner:winner(pos) });
  }
  const fromPos = (def, round) => Object.entries(def).map(([pos,[a,b]]) => ({
    pos:+pos, round, home:winner(a), away:winner(b), winner:winner(+pos)
  }));
  const r16 = fromPos(SP_R16_DEF,'R16');
  const qf  = fromPos(SP_QF_DEF,'QF');
  const sf  = fromPos(SP_SF_DEF,'SF');
  const [fa,fb] = SP_FINAL_DEF[31];
  const final = { pos:31, round:'FINAL', home:winner(fa), away:winner(fb), winner:winner(31) };
  return { r32, r16, qf, sf, final };
}

// A team's path up to the final: the match in each round (R32..SF) that team
// won, plus the opponent it beat. Returns [{round, beat}]. Both finalists
// have a full 4-step road (the runner-up wins R32..SF and only loses the
// final). The final itself is rendered separately.
function teamRoad(picks, team, bracket){
  if (!team) return [];
  const b = bracket || resolveBracket(picks);
  const rounds = [
    { key:'R32', matches:b.r32 },
    { key:'R16', matches:b.r16 },
    { key:'QF',  matches:b.qf },
    { key:'SF',  matches:b.sf },
  ];
  const road = [];
  rounds.forEach(({key, matches}) => {
    const m = matches.find(x => x.winner === team && (x.home === team || x.away === team));
    road.push({ round:key, beat: m ? (m.home === team ? m.away : m.home) : null });
  });
  return road;
}
// Back-compat: the champion's road.
function championRoad(picks){
  const champ = picks.tournamentWinner || (picks.bracketPicks||{})[31];
  return teamRoad(picks, champ);
}

// --- Rendering helpers -------------------------------------------------
function teamName(code, lang){
  const t = TEAM_NAMES[code];
  if (!t) return code || '';
  return (lang === 'he' ? t.he : t.en) || code;
}
function flagUrl(code){
  const iso = FLAG_ISO[code];
  return iso ? `https://flagcdn.com/${iso}.svg` : null;
}
function flagImg(code, opts){
  opts = opts || {};
  const url = flagUrl(code);
  const cls = opts.cls || 'fb-flag';
  const style = opts.style || '';
  if (!url) return `<span class="${cls} fb-flag-none" style="${style}">⚽</span>`;
  return `<img class="${cls}" src="${url}" alt="${code||''}" style="${style}" ` +
    `onerror="this.outerHTML='<span class=\\'${cls} fb-flag-none\\'>${code||''}</span>'">`;
}

// --- Demo picks (a realistic, internally-consistent full bet) -----------
// Winners are auto-resolved by better FIFA rank so the bracket is valid;
// real users get their actual picks from Supabase instead.
function buildDemoPicks(lang){
  // 1st..4th per group, roughly by rank but with a couple of upsets for flavor.
  const groupPositions = {
    A:['MEX','KOR','RSA','CZE'], B:['SUI','CAN','BIH','QAT'], C:['BRA','MAR','SCO','HAI'],
    D:['USA','TUR','PAR','AUS'], E:['GER','ECU','CIV','CUR'], F:['NED','JPN','SWE','TUN'],
    G:['BEL','IRN','EGY','NZL'], H:['ESP','URU','CPV','SAU'], I:['FRA','SEN','NOR','IRQ'],
    J:['ARG','AUT','ALG','JOR'], K:['POR','COL','COD','UZB'], L:['ENG','CRO','GHA','PAN']
  };
  // 8 third-place groups that advance.
  const thirdPlaceAdvancers = ['C','E','F','H','I','J','K','L'];
  const picks = { nickname: lang==='he'?'אייל':'Eyal', lang, groupPositions, thirdPlaceAdvancers, bracketPicks:{} };

  // Auto-fill winners by better FIFA rank, round by round.
  const thirdSlots = _resolveThirdSlots(picks);
  const pickBetter = (a,b) => {
    if (!a) return b; if (!b) return a;
    return fifaRankOf(a) <= fifaRankOf(b) ? a : b;
  };
  for (let pos=1; pos<=16; pos++){
    const [fa,fb] = SP_R32_DEF[pos];
    const home = _resolveFeed(fa,thirdSlots,pos,groupPositions);
    const away = _resolveFeed(fb,thirdSlots,pos,groupPositions);
    picks.bracketPicks[pos] = pickBetter(home,away);
  }
  const fill = (def) => Object.entries(def).forEach(([pos,[a,b]]) => {
    picks.bracketPicks[+pos] = pickBetter(picks.bracketPicks[a], picks.bracketPicks[b]);
  });
  fill(SP_R16_DEF); fill(SP_QF_DEF); fill(SP_SF_DEF); fill(SP_FINAL_DEF);
  picks.tournamentWinner = picks.bracketPicks[31];
  picks.topScorer = { player_name: lang==='he'?'ליאו מסי':'Lionel Messi', team_code:'ARG' };
  return picks;
}

// expose
window.FBShare = {
  TEAM_NAMES, FLAG_ISO, WC2026_GROUPS, WC2026_GROUP_LETTERS, FIFA_RANKINGS, fifaRankOf,
  computeGroupStandings, lateKnockoutSeedFromMatches,
  resolveBracket, championRoad, teamRoad, teamName, flagUrl, flagImg, buildDemoPicks
};
