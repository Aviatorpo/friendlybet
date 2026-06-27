// FriendlyBet World Cup 2026 rules helpers.
// Shared by browser app, scoring scripts, and readiness gates.
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FBWorldCupRules = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const WC2026_GROUPS = {
    A:['MEX','RSA','KOR','CZE'], B:['CAN','BIH','QAT','SUI'], C:['BRA','MAR','HAI','SCO'],
    D:['USA','PAR','AUS','TUR'], E:['GER','CUR','CIV','ECU'], F:['NED','JPN','SWE','TUN'],
    G:['BEL','EGY','IRN','NZL'], H:['ESP','CPV','SAU','URU'], I:['FRA','SEN','IRQ','NOR'],
    J:['ARG','ALG','AUT','JOR'], K:['POR','COD','UZB','COL'], L:['ENG','CRO','GHA','PAN']
  };
  const WC2026_GROUP_LETTERS = Object.keys(WC2026_GROUPS);
  const FIFA_RANKINGS = {
    ARG:1, ESP:2, FRA:3, ENG:4, BRA:5, POR:6, NED:7, BEL:8,
    CRO:9, GER:12, COL:13, MAR:14, URU:15, USA:16, MEX:17, JPN:18, SUI:19,
    SEN:20, IRN:21, KOR:22, AUT:23, ECU:24, SWE:25, AUS:26, TUR:27,
    NOR:28, TUN:29, EGY:30, ALG:31, CAN:32, CZE:33, SCO:34, CIV:35,
    PAR:37, PAN:38, IRQ:40, RSA:42, UZB:43, JOR:44, GHA:47,
    NZL:55, SAU:57, COD:58, BIH:59, HAI:60, CPV:65, QAT:66, CUR:85
  };
  const TERMINAL_MATCH_STATUS = new Set(['FINISHED', 'AWARDED']);

  function fifaRankOf(code) {
    const n = FIFA_RANKINGS[code];
    return Number.isFinite(n) ? n : 999;
  }

  function isPendingProviderFinal(m) {
    const source = String((m && m.live_source) || '').toLowerCase();
    const detail = String((m && m.status_detail) || '').toLowerCase();
    return source === 'espn-final' || detail.includes('pending verification');
  }

  function isTerminalMatch(m) {
    return !!m && TERMINAL_MATCH_STATUS.has(String(m.status || '').toUpperCase()) && !isPendingProviderFinal(m);
  }

  function groupMatchIdentity(m) {
    if (!m) return '';
    const group = String(m.group_letter || m.group || '');
    const home = String(m.home_team_code || '');
    const away = String(m.away_team_code || '');
    if (home && away) return `group:${group}|teams:${[home, away].sort().join('|')}`;
    if (m.external_id != null) return `external:${m.external_id}`;
    if (m.id != null) return `id:${m.id}`;
    return `${group}|${String(m.match_date || '')}|${home}|${away}`;
  }

  function groupIsComplete(matches) {
    const terminalMatches = (matches || []).filter(isTerminalMatch);
    const terminalFixtures = new Set();
    (matches || []).forEach((m, idx) => {
      if (isTerminalMatch(m)) terminalFixtures.add(groupMatchIdentity(m) || `anonymous:${idx}`);
    });
    return terminalMatches.length === 6 && terminalFixtures.size === 6;
  }

  function _num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function _validConductCode(code) {
    return /^[A-Z0-9]{2,4}$/.test(String(code || ''));
  }

  const RESOLVED_FAIR_PLAY_STATUSES = new Set([
    'official',
    'official_resolved',
    'consensus_fallback',
    'consensus_resolved',
    'conduct_equal_use_fifa_ranking'
  ]);

  function _resolvedConductScores(options = {}) {
    const out = {};
    const direct = options.conductScores || options.fairPlayConductScores || null;
    if (direct && typeof direct === 'object') {
      Object.entries(direct).forEach(([code, value]) => {
        const n = Number(value);
        if (_validConductCode(code) && Number.isFinite(n)) out[String(code)] = n;
      });
    }
    const payload = options.fairPlayResolutions || options.fair_play_resolutions || null;
    const rows = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.resolutions) ? payload.resolutions : []);
    rows.forEach(row => {
      const status = String(row && row.status || '').toLowerCase();
      if (!RESOLVED_FAIR_PLAY_STATUSES.has(status)) return;
      const scores = row && row.conductScores;
      if (!scores || typeof scores !== 'object') return;
      Object.entries(scores).forEach(([code, value]) => {
        const n = Number(value);
        if (_validConductCode(code) && Number.isFinite(n)) out[String(code)] = n;
      });
    });
    return out;
  }

  function _conductValue(row, conductScores = {}) {
    const keys = ['team_conduct_score', 'fair_play_score', 'conduct_points', 'fair_play_points'];
    for (const key of keys) {
      if (row && row[key] != null && Number.isFinite(Number(row[key]))) return Number(row[key]);
    }
    const resolved = conductScores && row && conductScores[row.code];
    if (resolved != null && Number.isFinite(Number(resolved))) return Number(resolved);
    return null;
  }

  function _buildStats(matches, groupTeams, options = {}) {
    const conductScores = _resolvedConductScores(options);
    const stats = {};
    (groupTeams || []).forEach((code, seed) => {
      const conduct = conductScores[code];
      stats[code] = { code, played:0, wins:0, draws:0, losses:0, gf:0, ga:0, gd:0, points:0, seed, fifa_rank:fifaRankOf(code) };
      if (conduct != null && Number.isFinite(Number(conduct))) stats[code].team_conduct_score = Number(conduct);
    });
    (matches || []).forEach(m => {
      const h = stats[m && m.home_team_code];
      const a = stats[m && m.away_team_code];
      const hs = Number(m && m.home_score);
      const as = Number(m && m.away_score);
      if (!h || !a || !Number.isFinite(hs) || !Number.isFinite(as)) return;
      h.played++; a.played++;
      h.gf += hs; h.ga += as; h.gd = h.gf - h.ga;
      a.gf += as; a.ga += hs; a.gd = a.gf - a.ga;
      if (hs > as) { h.wins++; a.losses++; h.points += 3; }
      else if (hs < as) { a.wins++; h.losses++; a.points += 3; }
      else { h.draws++; a.draws++; h.points++; a.points++; }
    });
    return stats;
  }

  function _h2h(matches, codes) {
    const set = new Set(codes);
    const table = {};
    codes.forEach(code => { table[code] = { pts:0, gd:0, gf:0 }; });
    (matches || []).forEach(m => {
      if (!set.has(m && m.home_team_code) || !set.has(m && m.away_team_code)) return;
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
  }

  function _sameGroupRank(a, b, h2h) {
    return a.points === b.points && a.gd === b.gd && a.gf === b.gf &&
      h2h[a.code].pts === h2h[b.code].pts &&
      h2h[a.code].gd === h2h[b.code].gd &&
      h2h[a.code].gf === h2h[b.code].gf;
  }

  function computeGroupStandingsDetailed(matches, groupTeams, options = {}) {
    const strict = options.strict !== false;
    const conductScores = _resolvedConductScores(options);
    const stats = _buildStats(matches, groupTeams, options);
    const rows = Object.values(stats);
    const unresolved = [];

    rows.sort((a, b) => (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf) || (a.seed - b.seed));
    const out = [];
    for (let i = 0; i < rows.length;) {
      let j = i + 1;
      while (j < rows.length && rows[i].points === rows[j].points && rows[i].gd === rows[j].gd && rows[i].gf === rows[j].gf) j++;
      const chunk = rows.slice(i, j);
      if (chunk.length === 1) {
        out.push(chunk[0]);
        i = j;
        continue;
      }
      const ht = _h2h(matches, chunk.map(s => s.code));
      chunk.sort((a, b) =>
        (ht[b.code].pts - ht[a.code].pts) ||
        (ht[b.code].gd - ht[a.code].gd) ||
        (ht[b.code].gf - ht[a.code].gf) ||
        ((_conductValue(b, conductScores) ?? 0) - (_conductValue(a, conductScores) ?? 0)) ||
        (fifaRankOf(a.code) - fifaRankOf(b.code)) ||
        (a.seed - b.seed)
      );
      for (let k = 0; k < chunk.length;) {
        let l = k + 1;
        while (l < chunk.length && _sameGroupRank(chunk[k], chunk[l], ht)) l++;
        if (l - k > 1 && strict && chunk.slice(k, l).some(r => _conductValue(r, conductScores) == null)) {
          unresolved.push({
            type: 'group-fair-play-needed',
            teams: chunk.slice(k, l).map(r => r.code)
          });
        }
        out.push(...chunk.slice(k, l));
        k = l;
      }
      i = j;
    }
    return { standings: out, status: unresolved.length ? 'needs_fair_play' : 'ready', unresolved };
  }

  function computeGroupStandings(matches, groupTeams, options = {}) {
    return computeGroupStandingsDetailed(matches, groupTeams, options).standings;
  }

  function rankThirdPlacedTeamsDetailed(thirds, options = {}) {
    const strict = options.strict !== false;
    const conductScores = _resolvedConductScores(options);
    const rows = (thirds || []).slice();
    rows.sort((a, b) =>
      (_num(b.points) - _num(a.points)) ||
      (_num(b.gd) - _num(a.gd)) ||
      (_num(b.gf) - _num(a.gf)) ||
      ((_conductValue(b, conductScores) ?? 0) - (_conductValue(a, conductScores) ?? 0)) ||
      (fifaRankOf(a.code) - fifaRankOf(b.code))
    );
    let unresolved = [];
    if (strict && rows.length >= 9) {
      const cutA = rows[7], cutB = rows[8];
      if (cutA && cutB && cutA.points === cutB.points && cutA.gd === cutB.gd && cutA.gf === cutB.gf) {
        const tied = rows.filter(r => r.points === cutA.points && r.gd === cutA.gd && r.gf === cutA.gf);
        if (tied.some(r => _conductValue(r, conductScores) == null)) {
          unresolved = [{ type:'third-place-fair-play-needed', teams:tied.map(r => r.code), groups:tied.map(r => r.group).filter(Boolean) }];
        }
      }
    }
    return {
      rows,
      best8: rows.slice(0, 8),
      status: unresolved.length ? 'needs_fair_play' : 'ready',
      unresolved
    };
  }

  function buildGroupState(matches, options = {}) {
    const strict = options.strict !== false;
    const allGroupMatchesAny = (matches || []).filter(m => {
      const stage = String((m && m.stage) || '').toUpperCase();
      return stage === 'GROUP_STAGE' || !!(m && (m.group_letter || m.group));
    });
    const standings = {};
    const groupPositions = {};
    const thirdStats = {};
    const advanced = new Set();
    const completeGroups = [];
    const unresolved = [];

    for (const letter of WC2026_GROUP_LETTERS) {
      const groupMatches = allGroupMatchesAny.filter(m => (m.group_letter || m.group) === letter);
      if (!groupIsComplete(groupMatches)) continue;
      const terminal = groupMatches.filter(isTerminalMatch);
      const fromMatches = new Set();
      groupMatches.forEach(m => {
        if (m.home_team_code) fromMatches.add(m.home_team_code);
        if (m.away_team_code) fromMatches.add(m.away_team_code);
      });
      const officialTeams = WC2026_GROUPS[letter] || [];
      const groupTeams = officialTeams.every(code => fromMatches.has(code)) ? officialTeams : Array.from(fromMatches);
      if (groupTeams.length !== 4) continue;
      const detail = computeGroupStandingsDetailed(terminal, groupTeams, { ...options, strict });
      if (detail.unresolved.length) unresolved.push(...detail.unresolved.map(u => ({ ...u, group: letter })));
      const rows = detail.standings;
      standings[letter] = rows.map(s => s.code);
      groupPositions[letter] = rows.slice(0, 4).map(s => s.code);
      thirdStats[letter] = rows[2] ? { ...rows[2], group: letter } : null;
      if (rows[0]) advanced.add(rows[0].code);
      if (rows[1]) advanced.add(rows[1].code);
      completeGroups.push(letter);
    }

    let realBest8Thirds = null;
    let thirdPlaceGroups = [];
    if (Object.values(thirdStats).filter(Boolean).length === 12) {
      const ranked = rankThirdPlacedTeamsDetailed(Object.values(thirdStats), { ...options, strict });
      if (ranked.unresolved.length) unresolved.push(...ranked.unresolved);
      if (ranked.status === 'ready' || !strict) {
        realBest8Thirds = new Set(ranked.best8.map(s => s.code));
        thirdPlaceGroups = ranked.best8.map(s => s.group);
        ranked.best8.forEach(s => advanced.add(s.code));
      }
    }

    return {
      allGroupMatchesAny,
      standings,
      groupPositions,
      thirdStats,
      realBest8Thirds,
      thirdPlaceGroups,
      advanced,
      completeGroups,
      status: unresolved.length ? 'needs_verification' : (completeGroups.length === 12 ? 'ready' : 'groups_incomplete'),
      unresolved
    };
  }

  function lateKnockoutSeedFromMatches(matches, options = {}) {
    const state = buildGroupState(matches, options);
    if (state.status !== 'ready') return { ok:false, status:state.status, reason:state.status, unresolved:state.unresolved, state };
    if (Object.keys(state.groupPositions).length < 12 || !state.thirdPlaceGroups || state.thirdPlaceGroups.length !== 8) {
      return { ok:false, status:'standings_incomplete', reason:'standings-incomplete', unresolved:state.unresolved, state };
    }
    return { ok:true, status:'ready', groupPositions:state.groupPositions, thirdPlaceAdvancers:state.thirdPlaceGroups, state };
  }

  return {
    WC2026_GROUPS,
    WC2026_GROUP_LETTERS,
    FIFA_RANKINGS,
    TERMINAL_MATCH_STATUS,
    fifaRankOf,
    isPendingProviderFinal,
    isTerminalMatch,
    groupMatchIdentity,
    groupIsComplete,
    computeGroupStandingsDetailed,
    computeGroupStandings,
    rankThirdPlacedTeamsDetailed,
    buildGroupState,
    lateKnockoutSeedFromMatches,
    resolvedConductScores: _resolvedConductScores
  };
});
