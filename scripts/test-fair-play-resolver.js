#!/usr/bin/env node
const assert = require('assert');
const Resolver = require('./resolve-fair-play');

function source(name, scores, mode = 'structured') {
  return {
    source: name,
    mode,
    conductScores: scores
  };
}

{
  const scope = { type: 'third-place-fair-play-needed', teams: ['ESP', 'FRA'] };
  const result = Resolver.resolveConsensus(scope, [
    source('espn', { ESP: -3, FRA: -5 }),
    source('bbc', { ESP: -3, FRA: -5 }),
    source('guardian', { ESP: -3, FRA: -5 }),
    source('prose-only', null)
  ]);
  assert.strictEqual(result.status, 'consensus_resolved');
  assert.deepStrictEqual(result.effectiveOrder, ['ESP', 'FRA']);
  assert.strictEqual(result.agreeingSources, 3);
}

{
  const scope = { type: 'third-place-fair-play-needed', teams: ['ESP', 'FRA'] };
  const result = Resolver.resolveConsensus(scope, [
    source('fifa', { ESP: -9, FRA: -1 }, 'official'),
    source('espn', { ESP: -1, FRA: -9 }),
    source('bbc', { ESP: -1, FRA: -9 }),
    source('guardian', { ESP: -1, FRA: -9 })
  ]);
  assert.strictEqual(result.status, 'official_resolved');
  assert.deepStrictEqual(result.effectiveOrder, ['FRA', 'ESP']);
}

{
  const scope = { type: 'third-place-fair-play-needed', teams: ['ESP', 'FRA'] };
  const result = Resolver.resolveConsensus(scope, [
    source('espn', { ESP: -3, FRA: -5 }),
    source('bbc', { ESP: -5, FRA: -3 }),
    { source: 'guardian', text: 'Spain had fewer cards' }
  ]);
  assert.strictEqual(result.status, 'blocked_no_consensus');
  assert.strictEqual(result.agreeingSources, 1);
}

{
  const scope = { type: 'third-place-fair-play-needed', teams: ['ESP', 'FRA'] };
  const result = Resolver.resolveConsensus(scope, [
    source('espn', { ESP: -2, FRA: -2 }),
    source('bbc', { ESP: -2, FRA: -2 }),
    source('guardian', { ESP: -2, FRA: -2 })
  ]);
  assert.strictEqual(result.status, 'conduct_equal_use_fifa_ranking');
  assert.deepStrictEqual(result.effectiveOrder, ['ESP', 'FRA']);
}

{
  const stats = Resolver.statsFromEspnSummary({
    boxscore: {
      teams: [
        { team: { abbreviation: 'ESP' }, statistics: [{ name: 'yellowCards', value: 2 }, { name: 'redCards', value: 0 }] },
        { team: { abbreviation: 'FRA' }, statistics: [{ name: 'yellowCards', displayValue: '4' }, { name: 'redCards', displayValue: '0' }] }
      ]
    }
  });
  assert.deepStrictEqual(stats, {
    ESP: { yellowCards: 2, redCards: 0 },
    FRA: { yellowCards: 4, redCards: 0 }
  });
}

console.log('fair-play resolver tests passed');
