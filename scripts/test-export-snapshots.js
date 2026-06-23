#!/usr/bin/env node
// Deterministic tests for public snapshot sanitization. No network, no DB.

const assert = require('assert');
const { isPendingProviderFinal, sanitizeMatchForSnapshot } = require('./export-snapshots');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok: ${name}`);
}

check('clean verified final removes public live residue', () => {
  const raw = {
    id: 'm1',
    status: 'FINISHED',
    match_date: '2026-06-23T09:00:00Z',
    home_score: 2,
    away_score: 0,
    winner_code: 'MEX',
    live_clock: "90'+5'",
    live_period: 2,
    live_source: 'espn',
    status_detail: 'Full Time',
    source_updated_at: '2026-06-23T11:01:00Z',
  };
  const clean = sanitizeMatchForSnapshot(raw);
  assert.strictEqual(clean.live_clock, null);
  assert.strictEqual(clean.live_period, null);
  assert.strictEqual(clean.live_source, null);
  assert.strictEqual(clean.status_detail, null);
  assert.strictEqual(clean.source_updated_at, raw.source_updated_at);
  assert.strictEqual(raw.live_source, 'espn');
});

check('pending provider final keeps residue for verifier and watchdog', () => {
  const pending = {
    id: 'm2',
    status: 'FINISHED',
    home_score: 1,
    away_score: 0,
    winner_code: 'USA',
    live_source: 'espn-final',
    status_detail: 'ESPN final pending verification',
  };
  const clean = sanitizeMatchForSnapshot(pending);
  assert.strictEqual(isPendingProviderFinal(clean), true);
  assert.strictEqual(clean.live_source, 'espn-final');
  assert.strictEqual(clean.status_detail, 'ESPN final pending verification');
});

check('live match keeps live fields', () => {
  const live = {
    id: 'm3',
    status: 'IN_PLAY',
    home_score: 1,
    away_score: 1,
    live_clock: "63'",
    live_period: 2,
    live_source: 'espn',
    status_detail: "63'",
  };
  assert.deepStrictEqual(sanitizeMatchForSnapshot(live), live);
});

check('scheduled match remains unchanged', () => {
  const scheduled = {
    id: 'm4',
    status: 'TIMED',
    match_date: '2026-06-24T19:00:00Z',
    home_score: null,
    away_score: null,
    status_detail: null,
  };
  assert.deepStrictEqual(sanitizeMatchForSnapshot(scheduled), scheduled);
});

console.log(`\nExport snapshot tests passed: ${passed}`);
