// Regression test for FIFA World Cup 2026 Annex C third-place placement.
// Run: node scripts/test-fifa-bracket.js

const assert = require('assert');
const fifaThirdPlace = require('../share-assets/fifa-third-place-table.js');

function eq(label, got, want) {
  assert.deepStrictEqual(got, want);
  console.log(`ok - ${label}`);
}

(async () => {
  eq('Annex C has all 495 combinations', Object.keys(fifaThirdPlace.table).length, 495);

  const assignment = fifaThirdPlace.assignment(['C', 'D', 'E', 'F', 'G', 'H', 'I', 'L']);
  eq('CDEFGHIL uses FIFA option 43 slot assignment', assignment, {
    7: 'C',   // 1A vs 3C
    13: 'G',  // 1B vs 3G
    9: 'E',   // 1D vs 3E
    2: 'D',   // 1E vs 3D
    10: 'H',  // 1G vs 3H
    5: 'F',   // 1I vs 3F
    15: 'L',  // 1K vs 3L
    8: 'I',   // 1L vs 3I
  });

  const { resolveBracket } = await import('../lib/bracket-core.mjs');
  const groupPositions = {
    A: ['1A', '2A', '3A', '4A'],
    B: ['1B', '2B', '3B', '4B'],
    C: ['1C', '2C', '3C', '4C'],
    D: ['1D', '2D', '3D', '4D'],
    E: ['1E', '2E', '3E', '4E'],
    F: ['1F', '2F', '3F', '4F'],
    G: ['1G', '2G', '3G', '4G'],
    H: ['1H', '2H', '3H', '4H'],
    I: ['1I', '2I', '3I', '4I'],
    J: ['1J', '2J', '3J', '4J'],
    K: ['1K', '2K', '3K', '4K'],
    L: ['1L', '2L', '3L', '4L'],
  };
  const bracketPicks = {
    1: 'W73', 2: 'W74', 3: 'W75', 4: 'W76',
    5: 'W77', 6: 'W78', 7: 'W79', 8: 'W80',
    9: 'W81', 10: 'W82', 11: 'W83', 12: 'W84',
    13: 'W85', 14: 'W86', 15: 'W87', 16: 'W88',
    17: 'W89', 18: 'W90', 19: 'W91', 20: 'W92',
    21: 'W93', 22: 'W94', 23: 'W95', 24: 'W96',
    25: 'W97', 26: 'W98', 27: 'W99', 28: 'W100',
    29: 'W101', 30: 'W102', 31: 'W104',
  };
  const bracket = resolveBracket({
    groupPositions,
    thirdPlaceAdvancers: ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'L'],
    bracketPicks,
  });

  eq('R32 matches follow FIFA slots for CDEFGHIL', bracket.r32.map(m => [m.pos, m.home, m.away]), [
    [1, '2A', '2B'],
    [2, '1E', '3D'],
    [3, '1F', '2C'],
    [4, '1C', '2F'],
    [5, '1I', '3F'],
    [6, '2E', '2I'],
    [7, '1A', '3C'],
    [8, '1L', '3I'],
    [9, '1D', '3E'],
    [10, '1G', '3H'],
    [11, '2K', '2L'],
    [12, '1H', '2J'],
    [13, '1B', '3G'],
    [14, '1J', '2H'],
    [15, '1K', '3L'],
    [16, '2D', '2G'],
  ]);

  eq('R16 matches follow FIFA M89-M96 wiring', bracket.r16.map(m => [m.pos, m.home, m.away]), [
    [17, 'W74', 'W77'],
    [18, 'W73', 'W75'],
    [19, 'W76', 'W78'],
    [20, 'W79', 'W80'],
    [21, 'W83', 'W84'],
    [22, 'W81', 'W82'],
    [23, 'W86', 'W88'],
    [24, 'W85', 'W87'],
  ]);

  eq('Quarterfinals follow FIFA M97-M100 wiring', bracket.qf.map(m => [m.pos, m.home, m.away]), [
    [25, 'W89', 'W90'],
    [26, 'W93', 'W94'],
    [27, 'W91', 'W92'],
    [28, 'W95', 'W96'],
  ]);

  eq('Semifinals follow FIFA M101-M102 wiring', bracket.sf.map(m => [m.pos, m.home, m.away]), [
    [29, 'W97', 'W98'],
    [30, 'W99', 'W100'],
  ]);

  eq('Final follows FIFA M104 wiring', bracket.final, {
    pos: 31, round: 'FINAL', home: 'W101', away: 'W102', winner: 'W104'
  });
})();
