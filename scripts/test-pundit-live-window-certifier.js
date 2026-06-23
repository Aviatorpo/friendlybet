const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  phaseFor,
  scoreTarget,
  recordReport,
  mentionsTeamCode,
  certifyWithPayloads,
  assetUrl,
  normaliseBaseUrl,
} = require('./pundit-live-window-certifier');

const kickoff = '2026-06-23T17:00:00Z';
const match = {
  id: 'm-por-uzb',
  match_date: kickoff,
  home_team_code: 'POR',
  away_team_code: 'UZB',
  status: 'TIMED',
  group_letter: 'K',
};

function ctx(now, items, stories = [], news = []) {
  return {
    nowMs: Date.parse(now),
    feedItems: items,
    storiesByMatch: new Set(stories),
    newsItems: news,
  };
}

function fixtureItem(expiresAt = kickoff) {
  return {
    id: 'fixture-m-por-uzb',
    type: 'fixture',
    he: 'פורטוגל נגד אוזבקיסטן, היום 20:00. אחרי התיקו, הטבלה והטפסים מזיעים.',
    en: 'Portugal vs Uzbekistan, today 20:00. After the draw, the table and prediction slips are sweating.',
    expires_at: expiresAt,
  };
}

function resultItem() {
  return {
    id: 'result-m-por-uzb',
    type: 'result',
    he: 'פורטוגל ניצחה 2:0, והטבלה של בית K מזיזה טפסים.',
    en: 'Portugal won 2-0, and the Group K table is moving prediction slips.',
    expires_at: '2026-06-24T17:00:00Z',
  };
}

function verifyItem() {
  return {
    id: 'verify-m-por-uzb',
    type: 'verification',
    he: 'פורטוגל נגד אוזבקיסטן בבדיקה לפני שהטבלה מקבלת נקודות.',
    en: 'Portugal vs Uzbekistan is being checked before the table gets points.',
    expires_at: '2026-06-23T18:00:00Z',
  };
}

assert.strictEqual(phaseFor(match, Date.parse('2026-06-23T16:30:00Z')), 'pre');
assert.strictEqual(phaseFor(match, Date.parse('2026-06-23T17:10:00Z')), 'kickoff_grace');
assert.strictEqual(phaseFor(match, Date.parse('2026-06-23T17:50:00Z')), 'stale_scheduled');
assert.strictEqual(phaseFor({ ...match, status: 'IN_PLAY' }, Date.parse('2026-06-23T17:30:00Z')), 'live');
assert.strictEqual(phaseFor({ ...match, status: 'FINISHED', home_score: 2, away_score: 0, winner_code: 'POR' }, Date.parse('2026-06-23T19:00:00Z')), 'final');
assert.strictEqual(mentionsTeamCode({ team: 'ENG', source: 'BBC Sport' }, 'POR'), false);
assert.strictEqual(mentionsTeamCode({ teams: ['POR'] }, 'POR'), true);
assert.strictEqual(mentionsTeamCode({ team: 'ENG', url: 'https://example.com/POR-UZB-preview' }, 'POR'), false);
assert.strictEqual(mentionsTeamCode({ url: 'https://example.com/POR-UZB-preview' }, 'POR'), true);
assert.strictEqual(normaliseBaseUrl('https://friendlybet.live'), 'https://friendlybet.live/');
assert.strictEqual(assetUrl('https://friendlybet.live', 'public-data/pundit.json', 123), 'https://friendlybet.live/public-data/pundit.json?v=pundit-certifier-123');
assert.throws(() => normaliseBaseUrl('file:///tmp/feed'), /http\(s\)/);

{
  const report = scoreTarget(match, ctx(
    '2026-06-23T16:30:00Z',
    [fixtureItem()],
    [],
    [{ id: 'por-preview', team: 'POR', en: 'Portugal pressure preview', expires_at: kickoff }],
  ));
  assert.strictEqual(report.score, 100);
  assert.deepStrictEqual(report.errors, []);
}

{
  const report = scoreTarget(match, ctx(
    '2026-06-23T16:30:00Z',
    [fixtureItem()],
    [],
    [{ id: 'por-stale-preview', team: 'POR', en: 'Portugal pressure preview', expires_at: '2026-06-23T18:00:00Z' }],
  ));
  assert.ok(report.errors.includes('pre-kickoff news item por-stale-preview does not expire at kickoff'));
}

{
  const report = scoreTarget(match, ctx('2026-06-23T17:10:00Z', [fixtureItem()]));
  assert.ok(report.errors.includes('fixture item remains after kickoff'));
}

{
  const report = scoreTarget(match, ctx('2026-06-23T17:50:00Z', [verifyItem()]));
  assert.deepStrictEqual(report.errors, []);
}

{
  const finalMatch = { ...match, status: 'FINISHED', home_score: 2, away_score: 0, winner_code: 'POR' };
  const report = scoreTarget(finalMatch, ctx('2026-06-23T19:00:00Z', [resultItem()], ['m-por-uzb']));
  assert.strictEqual(report.score, 100);
  assert.deepStrictEqual(report.errors, []);
}

{
  const finalMatch = { ...match, status: 'FINISHED', home_score: 2, away_score: 0, winner_code: 'POR' };
  const report = scoreTarget(finalMatch, ctx('2026-06-23T19:00:00Z', [resultItem()]));
  assert.ok(report.errors.includes('finished match lacks World Cup story'));
}

{
  const report = certifyWithPayloads(
    { match: 'POR-UZB', now: '2026-06-23T16:30:00Z', minScore: 90 },
    {
      source: 'https://friendlybet.live/',
      matchesPayload: { matches: [match] },
      feed: {
        updatedAt: '2026-06-23T16:00:00Z',
        freshUntil: '2026-06-23T20:00:00Z',
        items: [fixtureItem()],
      },
      stories: { items: [] },
      news: { items: [{ id: 'por-preview', teams: ['POR', 'UZB'], en: 'Portugal pressure preview', expires_at: kickoff }] },
    },
  );
  assert.strictEqual(report.source, 'https://friendlybet.live/');
  assert.strictEqual(report.passed, true);
  assert.strictEqual(report.targets[0].score, 100);
}

{
  const recordPath = 'tmp/pundit-live-window-certifier-test.jsonl';
  const absolute = path.join(__dirname, '..', recordPath);
  if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  recordReport({ checked_at: '2026-06-23T19:00:00.000Z', score: 100, passed: true }, recordPath);
  const rows = fs.readFileSync(absolute, 'utf8').trim().split('\n').map(row => JSON.parse(row));
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].kind, 'pundit_live_window_certification');
  assert.strictEqual(rows[0].passed, true);
  fs.unlinkSync(absolute);
}

assert.throws(
  () => recordReport({ checked_at: '2026-06-23T19:00:00.000Z', score: 100, passed: true }, '../outside.jsonl'),
  /inside the repository/,
);

console.log('Pundit live-window certifier tests passed');
