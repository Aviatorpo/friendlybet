#!/usr/bin/env node

const assert = require('assert');
const {
  stageCode,
  transform,
  validatePlacementStages
} = require('./update-fifa-world-cup-schedule.js');

function localized(description) {
  return [{ Locale: 'en-GB', Description: description }];
}

function rawMatch(matchNumber, stageName, home, away) {
  return {
    IdMatch: String(400021439 + matchNumber),
    MatchNumber: matchNumber,
    StageName: localized(stageName),
    GroupName: [],
    Date: matchNumber === 103 ? '2026-07-18T21:00:00Z' : '2026-07-19T19:00:00Z',
    MatchStatus: 1,
    ResultType: 0,
    Home: { Abbreviation: home, TeamName: localized(home), Score: null },
    Away: { Abbreviation: away, TeamName: localized(away), Score: null },
    Stadium: {}
  };
}

assert.strictEqual(stageCode('Bronze final'), 'THIRD_PLACE');
assert.strictEqual(stageCode('Match for third place'), 'THIRD_PLACE');
assert.strictEqual(stageCode('Final'), 'FINAL');
assert.strictEqual(stageCode('Final', 103), 'THIRD_PLACE');
assert.strictEqual(stageCode('Bronze final', 104), 'FINAL');

const thirdPlace = transform(rawMatch(103, 'Bronze final', 'FRA', 'ENG'));
const final = transform(rawMatch(104, 'Final', 'ESP', 'ARG'));
assert.strictEqual(thirdPlace.stage, 'THIRD_PLACE');
assert.strictEqual(final.stage, 'FINAL');
assert.strictEqual(thirdPlace.home_team_code, 'FRA');
assert.strictEqual(thirdPlace.away_team_code, 'ENG');
assert.strictEqual(final.home_team_code, 'ESP');
assert.strictEqual(final.away_team_code, 'ARG');
assert.doesNotThrow(() => validatePlacementStages([thirdPlace, final]));
assert.throws(
  () => validatePlacementStages([{ ...thirdPlace, stage: 'FINAL' }, final]),
  /match 103 must be classified as THIRD_PLACE/
);

console.log('FIFA schedule stage normalization tests passed');
