// Regression test for FIFA World Cup 2026 Annex C third-place allocation.
// Run: node scripts/test-third-place-allocation.js

(async () => {
  const assert = require('assert');
  const { resolveBracket } = await import('../lib/bracket-core.mjs');

  const groupPositions = {
    A: ['A1', 'A2', 'A3'],
    B: ['B1', 'B2', 'BIH'],
    C: ['C1', 'C2', 'C3'],
    D: ['D1', 'D2', 'PAR'],
    E: ['GER', 'E2', 'E3'],
    F: ['F1', 'F2', 'F3'],
    G: ['G1', 'G2', 'G3'],
    H: ['H1', 'H2', 'H3'],
    I: ['I1', 'I2', 'I3'],
    J: ['J1', 'J2', 'J3'],
    K: ['K1', 'K2', 'K3'],
    L: ['L1', 'L2', 'L3']
  };

  const bracket = resolveBracket({
    groupPositions,
    thirdPlaceAdvancers: ['A', 'B', 'C', 'D', 'E', 'F', 'I', 'J'],
    bracketPicks: {}
  });

  const germanyR32 = bracket.r32.find(m => m.pos === 2);

  assert.deepStrictEqual(germanyR32, {
    pos: 2,
    round: 'R32',
    home: 'GER',
    away: 'PAR',
    winner: null
  });

  assert.notStrictEqual(germanyR32.away, 'BIH');

  console.log('PASS third-place allocation: Annex C option 486 sends 1E to 3D.');
})();
