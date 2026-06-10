// Regression test for FIFA World Cup 2026 Annex C third-place allocation.
// Run: node scripts/test-third-place-allocation.js

(async () => {
  const assert = require('assert');
  const { resolveBracket } = await import('../lib/bracket-core.mjs');
  const { SP_THIRD_PLACE_ALLOCATION_ROWS, resolveThirdPlaceAssignment } = await import('../lib/third-place-allocation.mjs');

  const slotAllowed = {
    2:  ['A', 'B', 'C', 'D', 'F'],
    5:  ['C', 'D', 'F', 'G', 'H'],
    7:  ['C', 'E', 'F', 'H', 'I'],
    8:  ['E', 'H', 'I', 'J', 'K'],
    9:  ['B', 'E', 'F', 'I', 'J'],
    10: ['A', 'E', 'H', 'I', 'J'],
    13: ['E', 'F', 'G', 'I', 'J'],
    15: ['D', 'E', 'I', 'J', 'L']
  };

  function combinations(items, k, start = 0, prefix = [], out = []) {
    if (prefix.length === k) {
      out.push(prefix.join(''));
      return out;
    }
    for (let i = start; i <= items.length - (k - prefix.length); i++) {
      prefix.push(items[i]);
      combinations(items, k, i + 1, prefix, out);
      prefix.pop();
    }
    return out;
  }

  const expectedCombos = combinations('ABCDEFGHIJKL'.split(''), 8);
  assert.strictEqual(Object.keys(SP_THIRD_PLACE_ALLOCATION_ROWS).length, 495);
  for (const combo of expectedCombos) {
    const row = resolveThirdPlaceAssignment(combo.split(''));
    assert(row, `missing allocation row for ${combo}`);
    assert.deepStrictEqual(Object.values(row).sort(), combo.split('').sort(), `assignment groups mismatch for ${combo}`);
    for (const [pos, group] of Object.entries(row)) {
      assert(slotAllowed[pos].includes(group), `illegal slot assignment ${combo}: pos ${pos} -> ${group}`);
    }
  }

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

  console.log('PASS third-place allocation: 495 rows valid; Annex C option 486 sends 1E to 3D.');
})();
