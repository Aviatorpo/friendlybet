#!/usr/bin/env node
const assert = require('assert');
const WCR = require('../share-assets/world-cup-rules.js');

function m(group, home, away, hs, as) {
  return {
    stage: 'GROUP_STAGE',
    group_letter: group,
    status: 'FINISHED',
    home_team_code: home,
    away_team_code: away,
    home_score: hs,
    away_score: as
  };
}

{
  const matches = [
    m('A', 'MEX', 'RSA', 1, 0),
    m('A', 'KOR', 'CZE', 1, 0),
    m('A', 'MEX', 'KOR', 0, 1),
    m('A', 'RSA', 'CZE', 2, 0),
    m('A', 'MEX', 'CZE', 2, 0),
    m('A', 'RSA', 'KOR', 1, 0)
  ];
  const rows = WCR.computeGroupStandings(matches, WCR.WC2026_GROUPS.A, { strict: true });
  assert.deepStrictEqual(rows.map(r => r.code), ['MEX', 'RSA', 'KOR', 'CZE']);
}

{
  const thirds = [
    { code:'MEX', group:'A', points:5, gd:2, gf:4 },
    { code:'CAN', group:'B', points:5, gd:1, gf:4 },
    { code:'BRA', group:'C', points:4, gd:2, gf:4 },
    { code:'USA', group:'D', points:4, gd:1, gf:5 },
    { code:'GER', group:'E', points:4, gd:1, gf:4 },
    { code:'NED', group:'F', points:4, gd:0, gf:4 },
    { code:'BEL', group:'G', points:3, gd:0, gf:4 },
    { code:'ESP', group:'H', points:3, gd:0, gf:3 },
    { code:'FRA', group:'I', points:3, gd:0, gf:3 },
    { code:'ARG', group:'J', points:2, gd:0, gf:2 },
    { code:'POR', group:'K', points:1, gd:-1, gf:2 },
    { code:'ENG', group:'L', points:0, gd:-2, gf:1 }
  ];
  const strict = WCR.rankThirdPlacedTeamsDetailed(thirds, { strict: true });
  assert.strictEqual(strict.status, 'needs_fair_play', 'tie on the 8th-place boundary must wait for fair play');
  const withConduct = thirds.map(r => ({ ...r, fair_play_score: r.code === 'ESP' ? 0 : -1 }));
  const resolved = WCR.rankThirdPlacedTeamsDetailed(withConduct, { strict: true });
  assert.strictEqual(resolved.status, 'ready');
  assert.deepStrictEqual(resolved.best8.map(r => r.group), ['A','B','C','D','E','F','G','H']);
}

{
  const thirds = [
    { code:'MEX', group:'A', points:5, gd:2, gf:4 },
    { code:'CAN', group:'B', points:5, gd:1, gf:4 },
    { code:'BRA', group:'C', points:4, gd:2, gf:4 },
    { code:'USA', group:'D', points:4, gd:1, gf:5 },
    { code:'GER', group:'E', points:4, gd:1, gf:4 },
    { code:'NED', group:'F', points:4, gd:0, gf:4 },
    { code:'BEL', group:'G', points:3, gd:0, gf:4 },
    { code:'ESP', group:'H', points:3, gd:0, gf:3 },
    { code:'FRA', group:'I', points:3, gd:0, gf:3 },
    { code:'ARG', group:'J', points:2, gd:0, gf:2 },
    { code:'POR', group:'K', points:1, gd:-1, gf:2 },
    { code:'ENG', group:'L', points:0, gd:-2, gf:1 }
  ];
  const fairPlayResolutions = {
    resolutions: [{
      status: 'consensus_resolved',
      conductScores: { ESP: -2, FRA: -4 }
    }]
  };
  const resolved = WCR.rankThirdPlacedTeamsDetailed(thirds, { strict: true, fairPlayResolutions });
  assert.strictEqual(resolved.status, 'ready');
  assert.deepStrictEqual(resolved.best8.map(r => r.group), ['A','B','C','D','E','F','G','H']);
}

console.log('World Cup rules tests passed');
