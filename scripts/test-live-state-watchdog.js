#!/usr/bin/env node
// Deterministic tests for live-state watchdog. No network, no DB.

process.env.LIVE_WATCHDOG_SKIP_STORIES = '1';
process.env.LIVE_WATCHDOG_SKIP_LEADERBOARDS = '1';

const assert = require('assert');
const W = require('./live-state-watchdog');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok: ${name}`);
}

const nowMs = Date.parse('2026-06-23T12:00:00Z');
const oldKickoff = '2026-06-23T09:00:00Z';

check('clean finished win has no match errors', () => {
  const errors = [];
  W.auditMatches([{
    id: 'm1',
    status: 'FINISHED',
    match_date: oldKickoff,
    home_score: 2,
    away_score: 0,
    winner_code: 'MEX',
    live_clock: null,
    live_period: null,
    status_detail: null,
    live_source: null,
  }], nowMs, errors, []);
  assert.deepStrictEqual(errors, []);
});

check('finished non-draw without winner is an error', () => {
  const errors = [];
  W.auditMatches([{ id: 'm2', status: 'FINISHED', match_date: oldKickoff, home_score: 1, away_score: 0 }], nowMs, errors, []);
  assert.ok(errors.some(e => /winner_code/.test(e)));
});

check('finished draw may have null winner', () => {
  const errors = [];
  W.auditMatches([{ id: 'm3', status: 'FINISHED', match_date: oldKickoff, home_score: 1, away_score: 1, winner_code: null }], nowMs, errors, []);
  assert.deepStrictEqual(errors, []);
});

check('finished ESPN residue is an error after grace period', () => {
  const errors = [];
  W.auditMatches([{
    id: 'm4',
    status: 'FINISHED',
    match_date: oldKickoff,
    home_score: 1,
    away_score: 0,
    winner_code: 'MEX',
    live_clock: "82'",
    live_period: 2,
    status_detail: "82'",
    live_source: 'espn',
  }], nowMs, errors, []);
  assert.ok(errors.some(e => /live\/provider residue/.test(e)));
});

check('pending ESPN final residue is an error', () => {
  const errors = [];
  W.auditMatches([{
    id: 'm5',
    status: 'FINISHED',
    match_date: oldKickoff,
    home_score: 1,
    away_score: 0,
    winner_code: 'MEX',
    status_detail: 'ESPN final pending verification',
    live_source: 'espn-final',
  }], nowMs, errors, []);
  assert.ok(errors.some(e => /live\/provider residue/.test(e)));
});

check('stale live match is an error', () => {
  const errors = [];
  W.auditMatches([{ id: 'm6', status: 'IN_PLAY', match_date: '2026-06-23T06:00:00Z' }], nowMs, errors, []);
  assert.ok(errors.some(e => /live status is stale/.test(e)));
});

check('stale scheduled match after kickoff is an error', () => {
  const errors = [];
  W.auditMatches([{ id: 'm7', status: 'TIMED', match_date: '2026-06-23T11:00:00Z' }], nowMs, errors, []);
  assert.ok(errors.some(e => /scheduled status is stale/.test(e)));
});

check('near-kickoff scheduled match is allowed inside grace window', () => {
  const errors = [];
  W.auditMatches([{ id: 'm8', status: 'TIMED', match_date: '2026-06-23T11:40:00Z' }], nowMs, errors, []);
  assert.deepStrictEqual(errors, []);
});

check('tournament window detects active match period', () => {
  assert.strictEqual(W.tournamentWindow([{ match_date: '2026-06-23T09:00:00Z' }], nowMs), true);
  assert.strictEqual(W.tournamentWindow([{ match_date: '2026-06-01T09:00:00Z' }], nowMs), false);
});

check('Pundit live item cannot reference stale scheduled match', () => {
  const errors = [];
  const matches = [{ id: 'm9', status: 'TIMED', match_date: '2026-06-23T09:00:00Z' }];
  const feed = {
    updatedAt: '2026-06-23T11:50:00Z',
    freshUntil: '2026-06-23T13:00:00Z',
    items: [{ id: 'live-m9', type: 'live', he: 'x', en: 'x' }],
  };
  W.auditPundit(matches, nowMs, errors, [], feed);
  assert.ok(errors.some(e => /live commentary references non-live match/.test(e)));
});

check('Pundit fixture item cannot reference past-kickoff scheduled match', () => {
  const errors = [];
  const matches = [{ id: 'm10', status: 'TIMED', match_date: '2026-06-23T11:00:00Z' }];
  const feed = {
    updatedAt: '2026-06-23T11:50:00Z',
    freshUntil: '2026-06-23T13:00:00Z',
    items: [{ id: 'fixture-m10', type: 'fixture', he: 'x', en: 'x' }],
  };
  W.auditPundit(matches, nowMs, errors, [], feed);
  assert.ok(errors.some(e => /fixture commentary references past-kickoff match/.test(e)));
});

check('Pundit result item cannot reference pending provider final', () => {
  const errors = [];
  const matches = [{
    id: 'm11',
    status: 'FINISHED',
    match_date: '2026-06-23T09:00:00Z',
    home_score: 1,
    away_score: 0,
    live_source: 'espn-final',
    status_detail: 'ESPN final pending verification',
  }];
  const feed = {
    updatedAt: '2026-06-23T11:50:00Z',
    freshUntil: '2026-06-23T13:00:00Z',
    items: [{ id: 'result-m11', type: 'result', he: 'x', en: 'x' }],
  };
  W.auditPundit(matches, nowMs, errors, [], feed);
  assert.ok(errors.some(e => /result commentary references unverified match/.test(e)));
});

check('Pundit verification item is valid for stale scheduled match', () => {
  const errors = [];
  const matches = [{ id: 'm12', status: 'TIMED', match_date: '2026-06-23T09:00:00Z' }];
  const feed = {
    updatedAt: '2026-06-23T11:50:00Z',
    freshUntil: '2026-06-23T13:00:00Z',
    items: [{ id: 'verify-m12', type: 'verification', he: 'x', en: 'x' }],
  };
  W.auditPundit(matches, nowMs, errors, [], feed);
  assert.deepStrictEqual(errors, []);
});

console.log(`\nLive-state watchdog tests passed: ${passed}`);
