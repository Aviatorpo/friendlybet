#!/usr/bin/env node

const assert = require('assert');
const { validatePayload } = require('./pundit-news-validate');

const nowMs = Date.parse('2026-06-23T12:00:00Z');

function item(overrides = {}) {
  return {
    id: '2026-06-23-england-ghana',
    confidence: 'reported',
    team: 'ENG',
    topic_date: '2026-06-23T11:00:00Z',
    source_checked_at: '2026-06-23T11:00:00Z',
    expires_at: '2026-06-23T20:00:00Z',
    he: 'England against Ghana has a Group L consequence for prediction forms.',
    en: 'England against Ghana has a Group L consequence for prediction forms.',
    sources: [
      { name: 'The Guardian', url: 'https://www.theguardian.com/football/2026/jun/23/england-ghana-preview' },
      { name: 'BBC Sport', url: 'https://www.bbc.com/sport/football/world-cup/england-ghana-preview' },
    ],
    ...overrides,
  };
}

{
  const errors = validatePayload({ updatedAt: '2026-06-23T11:00:00Z', items: [item()] }, { nowMs });
  assert.deepStrictEqual(errors, []);
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({
      sources: [
        { name: 'The Guardian', url: 'https://www.theguardian.com/football/2026/jun/23/england-ghana-preview' },
        { name: 'Best Odds Daily', url: 'https://example.com/world-cup-betting-accumulator-england-ghana' },
      ],
    })],
  }, { nowMs });
  assert.ok(errors.some(error => /betting\/odds\/promotional/.test(error)));
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({
      confidence: 'confirmed',
      sources: [
        { name: 'FIFA', url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/england-ghana' },
      ],
    })],
  }, { nowMs });
  assert.deepStrictEqual(errors, []);
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ team: 'XYZ' })],
  }, { nowMs });
  assert.ok(errors.some(error => /not a known WC2026 team code/.test(error)));
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ team: undefined, teams: ['ENG', 'GHA'] })],
  }, { nowMs });
  assert.deepStrictEqual(errors, []);
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ team: undefined, teams: ['ENG', 'XYZ'] })],
  }, { nowMs });
  assert.ok(errors.some(error => /teams\[1\].*not a known WC2026 team code/.test(error)));
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ expires_at: '2026-06-23T11:30:00Z' })],
  }, { nowMs });
  assert.deepStrictEqual(errors, []);
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ expires_at: '2026-06-23T11:30:00Z' })],
  }, { nowMs, requireUnexpired: true });
  assert.ok(errors.some(error => /already past/.test(error)));
}

console.log('pundit news validator tests passed');
