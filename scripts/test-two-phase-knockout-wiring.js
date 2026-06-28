// Regression test for two-phase knockout wiring.
// Run: node scripts/test-two-phase-knockout-wiring.js

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const fifaThirdPlace = require('../share-assets/fifa-third-place-table.js');

const app = fs.readFileSync('app.js', 'utf8');
const constantsStart = app.indexOf('const SP_R32_DEF = {');
const constantsEnd = app.indexOf('async function spPrepareLateKnockoutBracket()', constantsStart);
const functionsStart = app.indexOf('function _initEmptyKnockoutRounds()');
const functionsEnd = app.indexOf('function findFirstIncompleteRound()', functionsStart);
assert(constantsStart >= 0 && constantsEnd > constantsStart, 'could not extract knockout constants from app.js');
assert(functionsStart >= 0 && functionsEnd > functionsStart, 'could not extract two-phase knockout functions from app.js');

const sandbox = {
  console,
  window: { FB_THIRD_PLACE_ALLOCATION: { resolveThirdPlaceAssignment: fifaThirdPlace.assignment } },
  knockoutState: {
    matches: { R32: [], R16: [], QF: [], SF: [], FINAL: [] },
    selectedGroupTeams: [],
    picks: {}
  }
};
vm.createContext(sandbox);
vm.runInContext(
  app.slice(constantsStart, constantsEnd) +
    '\n' +
    app.slice(functionsStart, functionsEnd) +
    '\nthis.__test = { buildOfficialTwoPhaseKnockout, propagateKnockoutBracket, _bracketFeedSourceIds, _bracketAverageSourceY, knockoutState };',
  sandbox
);

const groupPositions = Object.fromEntries(
  'ABCDEFGHIJKL'.split('').map(letter => [letter, [`1${letter}`, `2${letter}`, `3${letter}`, `4${letter}`]])
);

function eq(label, actual, expected) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

sandbox.__test.buildOfficialTwoPhaseKnockout({
  groupPositions,
  thirdPlaceAdvancers: ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'L']
});

const picks = sandbox.__test.knockoutState.picks;
for (let pos = 1; pos <= 16; pos++) picks[`R32_M${pos}`] = `W${72 + pos}`;
for (let pos = 1; pos <= 8; pos++) picks[`R16_M${pos}`] = `W${88 + pos}`;
for (let pos = 1; pos <= 4; pos++) picks[`QF_M${pos}`] = `W${96 + pos}`;
for (let pos = 1; pos <= 2; pos++) picks[`SF_M${pos}`] = `W${100 + pos}`;
sandbox.__test.propagateKnockoutBracket();

eq(
  'two-phase R16 must follow FIFA M89-M96 wiring',
  sandbox.__test.knockoutState.matches.R16.map(m => [m.id, m.team1, m.team2]),
  [
    ['R16_M1', 'W74', 'W77'],
    ['R16_M2', 'W73', 'W75'],
    ['R16_M3', 'W76', 'W78'],
    ['R16_M4', 'W79', 'W80'],
    ['R16_M5', 'W83', 'W84'],
    ['R16_M6', 'W81', 'W82'],
    ['R16_M7', 'W86', 'W88'],
    ['R16_M8', 'W85', 'W87']
  ]
);

eq(
  'two-phase R16 visual feeds must use real FIFA source matches',
  [
    sandbox.__test._bracketFeedSourceIds('R32', 'R16_M1'),
    sandbox.__test._bracketFeedSourceIds('R32', 'R16_M2'),
    sandbox.__test._bracketFeedSourceIds('R32', 'R16_M7'),
    sandbox.__test._bracketFeedSourceIds('R32', 'R16_M8')
  ],
  [
    ['R32_M2', 'R32_M5'],
    ['R32_M1', 'R32_M3'],
    ['R32_M14', 'R32_M16'],
    ['R32_M13', 'R32_M15']
  ]
);

const displayPositions = {};
for (let pos = 1; pos <= 16; pos++) displayPositions[`R32_M${pos}`] = { y: (pos - 1) * 100 };
assert.strictEqual(
  sandbox.__test._bracketAverageSourceY(displayPositions, 'R32', 'R16_M1', ['R32_M1', 'R32_M2']),
  250,
  'R16_M1 visual position must center between M74 and M77, not adjacent M73/M74'
);

eq(
  'two-phase QF must follow FIFA M97-M100 wiring',
  sandbox.__test.knockoutState.matches.QF.map(m => [m.id, m.team1, m.team2]),
  [
    ['QF_M1', 'W89', 'W90'],
    ['QF_M2', 'W93', 'W94'],
    ['QF_M3', 'W91', 'W92'],
    ['QF_M4', 'W95', 'W96']
  ]
);

eq(
  'two-phase SF must follow FIFA M101-M102 wiring',
  sandbox.__test.knockoutState.matches.SF.map(m => [m.id, m.team1, m.team2]),
  [
    ['SF_M1', 'W97', 'W98'],
    ['SF_M2', 'W99', 'W100']
  ]
);

eq(
  'two-phase final must follow FIFA M104 wiring',
  sandbox.__test.knockoutState.matches.FINAL.map(m => [m.id, m.team1, m.team2]),
  [['FINAL_M1', 'W101', 'W102']]
);

console.log('PASS two-phase knockout wiring follows FIFA M89-M104.');
