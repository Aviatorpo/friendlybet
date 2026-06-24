const assert = require('assert');
const {
  auditLiveWindowRecords,
  auditPunditFeed,
  auditStories,
  auditNews,
} = require('./pundit-academy-audit');

const nowMs = Date.parse('2026-06-24T14:00:00Z');

{
  const report = auditLiveWindowRecords([
    {
      kind: 'pundit_live_window_certification',
      source: 'https://friendlybet.live/',
      checked_at: '2026-06-24T06:00:00Z',
      score: 100,
      passed: true,
      proof_window: true,
      targets: [{ match: 'POR-UZB', phase: 'final', status: 'FINISHED', score: 100 }],
    },
    {
      kind: 'pundit_live_window_certification',
      source: 'https://friendlybet.live/',
      checked_at: '2026-06-24T09:00:00Z',
      score: 100,
      passed: true,
      proof_window: true,
      targets: [{ match: 'ENG-GHA', phase: 'final', status: 'FINISHED', score: 100 }],
    },
  ]);
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.production_proof_windows, 2);
  assert.deepStrictEqual(report.errors, []);
}

{
  const report = auditLiveWindowRecords([
    {
      kind: 'pundit_live_window_certification',
      source: 'local',
      checked_at: '2026-06-24T06:00:00Z',
      score: 100,
      passed: true,
      proof_window: true,
      targets: [{ match: 'POR-UZB', phase: 'final', status: 'FINISHED', score: 100 }],
    },
    {
      kind: 'pundit_live_window_certification',
      source: 'https://friendlybet.live/',
      checked_at: '2026-06-24T14:00:00Z',
      score: 100,
      passed: true,
      proof_window: false,
      targets: [{ match: 'SUI-CAN', phase: 'pre', status: 'TIMED', score: 100 }],
    },
  ]);
  assert.strictEqual(report.ok, false);
  assert.strictEqual(report.production_proof_windows, 0);
  assert.ok(report.errors[0].includes('need at least 2 different production'));
}

{
  const feed = auditPunditFeed(nowMs, {
    updatedAt: '2026-06-24T13:00:00Z',
    freshUntil: '2026-06-24T20:00:00Z',
    items: [
      {
        id: 'result-1',
        he: 'hebrew sample \\uD83D\\uDD25'.replace(/\\uD83D\\uDD25/, '\uD83D\uDD25'),
        en: 'The table moved \uD83D\uDD25',
        expires_at: '2026-06-25T00:00:00Z',
      },
    ],
  });
  assert.strictEqual(feed.ok, true);
  assert.strictEqual(feed.items, 1);
}

{
  const feed = auditPunditFeed(nowMs, {
    updatedAt: '2026-06-24T13:00:00Z',
    freshUntil: '2026-06-24T13:30:00Z',
    items: [{ id: 'dry', he: 'Hebrew sample without emoji', en: 'The table moved' }],
  });
  assert.strictEqual(feed.ok, false);
  assert.ok(feed.errors.some(error => error.includes('stale')));
  assert.ok(feed.errors.some(error => error.includes('without ending emoji')));
}

{
  const stories = auditStories(
    { matches: [{ id: 'm1', home_team_code: 'POR', away_team_code: 'UZB', status: 'FINISHED' }] },
    {
      items: [{
        id: 's1',
        match_id: 'm1',
        he: {
          headline: 'hebrew headline \uD83D\uDD25',
          caption: 'hebrew caption \uD83D\uDC40',
        },
        en: {
          headline: 'The table moved \uD83D\uDD25',
          caption: 'Prediction slips are sweating \uD83D\uDC40',
        },
      }],
    },
  );
  assert.strictEqual(stories.ok, true);
  assert.strictEqual(stories.missing, 0);
}

{
  const stories = auditStories(
    { matches: [{ id: 'm1', home_team_code: 'POR', away_team_code: 'UZB', status: 'FINISHED' }] },
    { items: [] },
  );
  assert.strictEqual(stories.ok, false);
  assert.ok(stories.errors.some(error => error.includes('missing stories')));
}

{
  const news = auditNews(nowMs, {
    updatedAt: '2026-06-24T13:00:00Z',
    items: [{
      id: 'item-1',
      he: 'verified Hebrew sample',
      en: 'Verified source angle',
      confidence: 'reported',
      topic_date: '2026-06-24T13:00:00Z',
      source_checked_at: '2026-06-24T13:00:00Z',
      expires_at: '2026-06-24T18:00:00Z',
      teams: ['POR', 'UZB'],
      sources: [
        { name: 'A', url: 'https://example.com/a' },
        { name: 'B', url: 'https://example.org/b' },
      ],
    }],
  });
  assert.strictEqual(news.ok, true);
  assert.strictEqual(news.unexpired, 1);
}

console.log('Pundit academy audit tests passed');
