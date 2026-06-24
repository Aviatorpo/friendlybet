#!/usr/bin/env node

const assert = require('assert');
const { validatePayload } = require('./pundit-news-validate');

const nowMs = Date.parse('2026-06-23T12:00:00Z');

function item(overrides = {}) {
  const base = {
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
    story_score: {
      freshness: 4,
      verification: 4,
      friendlybet_relevance: 4,
      drama: 3,
      uniqueness: 3,
      clarity: 5,
      decision: 'publish',
      reason: 'current group-stage match with clear prediction consequence',
    },
    self_review: {
      could_be_wrong: 'lineups, result, and exact table movement can change after kickoff',
      proof_source: 'refresh match state and trusted match centre before live/result copy',
      stale_risk: 'expires before the match window turns stale',
      overclaiming_check: 'does not claim final result, lineup, injury, or qualification',
      privacy_check: 'uses only aggregate prediction framing, no hidden pool data',
      gambling_check: 'social prediction framing only, no odds or money terms',
      repeated_shape_check: 'specific Group L consequence, not generic fixture filler',
      expiry_reason: 'preview expires before kickoff',
    },
    red_team_review: {
      score: 92,
      blockers: [],
      decision: 'approve',
      stale_state_check: 'preview wording expires before kickoff and does not claim live/final state',
      source_check: 'two independent source hosts and matching source ledger rows',
      pool_relevance_check: 'names Group L and prediction-form consequence',
      tone_check: 'sharp but not insulting or personal',
      repetition_check: 'specific to this fixture, not a reused generic shape',
      rewrite_note: 'kept the line direct and removed any unsupported lineup/result implication',
    },
  };
  const merged = { ...base, ...overrides };
  if (!Object.prototype.hasOwnProperty.call(overrides, 'source_ledger')) {
    merged.source_ledger = (Array.isArray(merged.sources) ? merged.sources : []).map((source, index) => ({
      claim: 'England against Ghana has Group L prediction consequences.',
      source: source.name || `Source ${index + 1}`,
      url: source.url,
      tier: 'trusted',
      published_or_updated_at: '2026-06-23T10:30:00Z',
      confirmation: index === 0 ? 'professional preview source' : 'independent professional preview source',
      uncertainty: 'lineups and final score not known before kickoff',
      usable: true,
    }));
  }
  return merged;
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
      source_ledger: [
        {
          claim: 'England against Ghana has Group L prediction consequences.',
          source: 'FIFA',
          url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/england-ghana',
          tier: 'official',
          published_or_updated_at: '2026-06-23T10:30:00Z',
          confirmation: 'official tournament source',
          uncertainty: 'lineups and final score not known before kickoff',
          usable: true,
        },
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

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ source_ledger: undefined })],
  }, { nowMs });
  assert.ok(errors.some(error => /missing source_ledger/.test(error)));
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ story_score: { freshness: 4, verification: 2, friendlybet_relevance: 4, drama: 3, uniqueness: 3, clarity: 5, decision: 'publish', reason: 'weak verification' } })],
  }, { nowMs });
  assert.ok(errors.some(error => /story_score\.verification must be at least 3/.test(error)));
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ self_review: undefined })],
  }, { nowMs });
  assert.ok(errors.some(error => /missing self_review/.test(error)));
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ red_team_review: undefined })],
  }, { nowMs });
  assert.ok(errors.some(error => /missing red_team_review/.test(error)));
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ red_team_review: { score: 89, blockers: [], decision: 'approve', stale_state_check: 'ok', source_check: 'ok', pool_relevance_check: 'ok', tone_check: 'ok', repetition_check: 'ok', rewrite_note: 'ok' } })],
  }, { nowMs });
  assert.ok(errors.some(error => /red_team_review\.score must be at least 90/.test(error)));
}

{
  const errors = validatePayload({
    updatedAt: '2026-06-23T11:00:00Z',
    items: [item({ red_team_review: { score: 95, blockers: ['stale state'], decision: 'approve', stale_state_check: 'failed', source_check: 'ok', pool_relevance_check: 'ok', tone_check: 'ok', repetition_check: 'ok', rewrite_note: 'ok' } })],
  }, { nowMs });
  assert.ok(errors.some(error => /red_team_review\.blockers must be empty/.test(error)));
}

console.log('pundit news validator tests passed');
