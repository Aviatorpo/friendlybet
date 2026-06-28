#!/usr/bin/env node
const assert = require('assert');
const Summary = require('./live-ops-summary');

const green = Summary.summarize({
  ok: true,
  checked_at: '2026-06-28T09:00:00Z',
  audit: {
    completed_groups: 12,
    result_recovery: { candidates: 0 },
    stories: { missing: 2 },
    pundit: { fresh: true },
    watchdog: { warnings: ['story backlog: World Cup stories missing for 2 finished match(es)'] },
  },
  warnings: [{ code: 'story_backlog_warning_only', message: 'Story backlog is warning-only.' }],
});
assert.ok(green.includes('Status: GREEN'));
assert.ok(green.includes('Missing Stories: 2'));
assert.ok(green.includes('No user-path action needed'));
assert.ok(green.includes('story_backlog_warning_only'));

const red = Summary.summarize({
  ok: false,
  checked_at: '2026-06-28T09:00:00Z',
  checks: [
    { name: 'no unresolved result-recovery candidates', ok: false, detail: 'candidates=1' },
    { name: 'live DB active match state is fresh', ok: false, detail: 'active=1, stale=1' },
  ],
  live_db: {
    freshness: { active: 1, stale: 1 },
    result_recovery: { candidates: 1 },
  },
  audit: {
    completed_groups: 11,
    stories: { missing: 0 },
    pundit: { fresh: true },
    watchdog: { warnings: [] },
  },
});
assert.ok(red.includes('Status: CRITICAL'));
assert.ok(red.includes('Run or inspect final-result-verifier'));
assert.ok(red.includes('Inspect live-poller'));

const invalid = Summary.summarize(Summary.parsePayload('{not json'));
assert.ok(invalid.includes('not valid JSON'));

console.log('Live ops summary tests passed');
