// Test: ESPN/FIFA final-result verifier transforms only exact, final fixtures and
// requires consensus before updating.
// Run: node scripts/test-final-result-verifier.js

process.env.PROD_ANON_KEY = 'test';
process.env.RESULT_EMERGENCY_SOURCES = '1';

const F = require('./final-result-verifier.js');

function ok(name, cond) {
  if (!cond) {
    console.error('FAIL:', name);
    process.exit(1);
  }
  console.log('ok:', name);
}

function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error(`FAIL: ${name}\n  got:  ${g}\n  want: ${w}`);
    process.exit(1);
  }
  console.log('ok:', name);
}

const db = {
  external_id: '537327',
  home_team_code: 'MEX',
  away_team_code: 'RSA',
  status: 'TIMED',
  stage: 'GROUP_STAGE',
  match_date: '2026-06-11T19:00:00Z'
};

const espnFinal = {
  id: '760415',
  date: '2026-06-11T19:00Z',
  competitions: [{
    startDate: '2026-06-11T19:00Z',
    status: { type: { name: 'STATUS_FINAL', state: 'post', completed: true } },
    competitors: [
      { homeAway: 'home', score: '1', winner: false, team: { displayName: 'Mexico', abbreviation: 'MEX' } },
      { homeAway: 'away', score: '1', winner: false, team: { displayName: 'South Africa', abbreviation: 'RSA' } }
    ]
  }]
};

const espnLive = {
  ...espnFinal,
  competitions: [{
    ...espnFinal.competitions[0],
    status: { type: { name: 'STATUS_SECOND_HALF', state: 'in', completed: false } }
  }]
};

const fifaFinal = {
  IdMatch: '400021443',
  Date: '2026-06-11T19:00:00Z',
  MatchStatus: 0,
  Home: { IdCountry: 'MEX', IdTeam: '43911', Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'Mexico' }] },
  Away: { IdCountry: 'RSA', IdTeam: '111', Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'South Africa' }] },
  Winner: null
};

ok('stuck candidate after age threshold', F.isStuckCandidate(db, Date.parse('2026-06-11T21:10:00Z')));
ok('not stuck before age threshold', !F.isStuckCandidate(db, Date.parse('2026-06-11T20:00:00Z')));
ok('finished match with complete clean result is not stuck',
  !F.isStuckCandidate({ ...db, status: 'FINISHED', home_score: 1, away_score: 1 }, Date.parse('2026-06-11T21:10:00Z')));
ok('finished tied knockout without advancer is still recoverable',
  F.isStuckCandidate({ ...db, stage: 'ROUND_OF_32', status: 'FINISHED', home_score: 1, away_score: 1, winner_code: null }, Date.parse('2026-06-11T21:10:00Z')));
ok('finished tied knockout with advancer is clean',
  !F.isStuckCandidate({ ...db, stage: 'ROUND_OF_32', status: 'FINISHED', home_score: 1, away_score: 1, winner_code: 'MEX' }, Date.parse('2026-06-11T21:10:00Z')));
ok('finished match missing score is still recoverable',
  F.isStuckCandidate({ ...db, status: 'FINISHED', home_score: null, away_score: null }, Date.parse('2026-06-11T21:10:00Z')));
ok('finished scored match with live residue is not final-result recovery work',
  !F.isStuckCandidate({ ...db, status: 'FINISHED', home_score: 1, away_score: 1, live_clock: "90'+4'" }, Date.parse('2026-06-11T21:10:00Z')));
ok('stale knockout paused state is recoverable before normal age threshold',
  F.isStuckCandidate({
    external_id: '400021516',
    home_team_code: 'BRA',
    away_team_code: 'JPN',
    status: 'PAUSED',
    stage: 'ROUND_OF_32',
    match_date: '2026-06-29T17:00:00Z',
    home_score: 1,
    away_score: 1,
    status_detail: "59'",
    live_source: 'espn',
    source_updated_at: '2026-06-29T18:21:21Z',
  }, Date.parse('2026-06-29T18:40:00Z')));
ok('fresh paused state is not stale-live recoverable',
  !F.isStaleLiveCandidate({
    external_id: '400021516',
    home_team_code: 'BRA',
    away_team_code: 'JPN',
    status: 'PAUSED',
    stage: 'ROUND_OF_32',
    match_date: '2026-06-29T17:00:00Z',
    source_updated_at: '2026-06-29T18:35:00Z',
  }, Date.parse('2026-06-29T18:40:00Z')));

const espnTransformed = F.transformEspnEvent(espnFinal);
eq('transform ESPN final event', {
  homeCode: espnTransformed.homeCode,
  awayCode: espnTransformed.awayCode,
  statusShort: espnTransformed.statusShort,
  homeScore: espnTransformed.homeScore,
  awayScore: espnTransformed.awayScore,
  winnerCode: espnTransformed.winnerCode
}, {
  homeCode: 'MEX',
  awayCode: 'RSA',
  statusShort: 'FT',
  homeScore: 1,
  awayScore: 1,
  winnerCode: null
});

ok('finds exact ESPN fixture', !!F.findMatchingFixture(db, [espnFinal], F.transformEspnEvent).match);
ok('rejects non-matching ESPN fixture', !F.findMatchingFixture(db, [{
  ...espnFinal,
  competitions: [{
    ...espnFinal.competitions[0],
    competitors: [
      { homeAway: 'home', score: '1', winner: true, team: { displayName: 'Canada', abbreviation: 'CAN' } },
      { homeAway: 'away', score: '1', winner: false, team: { displayName: 'South Africa', abbreviation: 'RSA' } }
    ]
  }]
}], F.transformEspnEvent).match);

eq('builds final update', F.buildUpdateFromVerifiedFixture(espnTransformed, '2026-06-11T21:00:00Z').update, {
  home_score: 1,
  away_score: 1,
  status: 'FINISHED',
  winner_code: null,
  live_clock: null,
  live_period: null,
  status_detail: null,
  live_source: null,
  source_updated_at: '2026-06-11T21:00:00Z',
  last_updated: '2026-06-11T21:00:00Z'
});

ok('does not build update from ESPN live event',
  !F.buildUpdateFromVerifiedFixture(F.transformEspnEvent(espnLive)).update);
ok('does not build knockout update from tied final without advancer',
  !F.buildUpdateFromVerifiedFixture(espnTransformed, '2026-06-11T21:00:00Z', { stage: 'ROUND_OF_32' }).update);
ok('builds knockout penalty update from tied final with advancer',
  !!F.buildUpdateFromVerifiedFixture({ ...espnTransformed, winnerCode: 'MEX' }, '2026-06-11T21:00:00Z', { stage: 'ROUND_OF_32' }).update);
ok('rejects winner that contradicts decisive score',
  !F.buildUpdateFromVerifiedFixture({ ...espnTransformed, homeScore: 2, awayScore: 1, winnerCode: 'RSA' }, '2026-06-11T21:00:00Z', { stage: 'ROUND_OF_32' }).update);

eq('fetches adjacent ESPN scoreboard dates for late UTC kickoff',
  F.espnScoreboardDatesFor([{ match_date: '2026-06-12T02:00:00.000Z' }]),
  ['20260611', '20260612', '20260613']);

eq('accepts ESPN abbreviation fallback when display name is missing',
  F.normalizeTeamCode(null, 'KOR'),
  'KOR');
eq('normalizes provider aliases through shared World Cup rules', [
  F.normalizeTeamCode(null, 'KSA'),
  F.normalizeTeamCode(null, 'CUW'),
], [
  'SAU',
  'CUR',
]);

const fifaTransformed = F.transformFifaMatch(fifaFinal);
eq('transform FIFA final match', {
  homeCode: fifaTransformed.homeCode,
  awayCode: fifaTransformed.awayCode,
  statusShort: fifaTransformed.statusShort,
  homeScore: fifaTransformed.homeScore,
  awayScore: fifaTransformed.awayScore,
  winnerCode: fifaTransformed.winnerCode
}, {
  homeCode: 'MEX',
  awayCode: 'RSA',
  statusShort: 'FT',
  homeScore: 1,
  awayScore: 1,
  winnerCode: null
});

ok('matches KSA provider alias against SAU db code', !!F.findMatchingFixture({
  ...db,
  home_team_code: 'SAU',
  away_team_code: 'URU',
  match_date: '2026-06-15T22:00:00Z',
}, [{
  ...fifaFinal,
  IdMatch: '400021486',
  Date: '2026-06-15T22:00:00Z',
  Home: { IdCountry: 'KSA', IdTeam: '1', Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'Saudi Arabia' }] },
  Away: { IdCountry: 'URU', IdTeam: '2', Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'Uruguay' }] },
}], F.transformFifaMatch).match);
ok('matches CUW provider alias against CUR db code', !!F.findMatchingFixture({
  ...db,
  home_team_code: 'ECU',
  away_team_code: 'CUR',
  match_date: '2026-06-21T00:00:00Z',
}, [{
  ...fifaFinal,
  IdMatch: '400021501',
  Date: '2026-06-21T00:00:00Z',
  Home: { IdCountry: 'ECU', IdTeam: '1', Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'Ecuador' }] },
  Away: { IdCountry: 'CUW', IdTeam: '2', Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'Curacao' }] },
}], F.transformFifaMatch).match);

const penaltyDb = {
  ...db,
  external_id: '400021599',
  home_team_code: 'GER',
  away_team_code: 'PAR',
  stage: 'ROUND_OF_32',
  match_date: '2026-06-29T20:00:00Z',
};

const liveScorePenalty = F.transformLiveScoreEvent({
  id: '1691868',
  homeTeam: { name: 'Germany', abbreviation: 'GER' },
  awayTeam: { name: 'Paraguay', abbreviation: 'PAR' },
  startDateTimeString: '20260629200000',
  eventStatus: 'PAST',
  statusDescription: 'FINISHED_AFTER_PENALTIES',
  homeTeamScore: '1',
  awayTeamScore: '1',
  penaltyHomeScore: '3',
  penaltyAwayScore: '4',
  isFinishedAfterPenalties: true,
  winner: 'AWAY',
});
eq('transforms LiveScore penalty final with advancing team', {
  homeCode: liveScorePenalty.homeCode,
  awayCode: liveScorePenalty.awayCode,
  statusShort: liveScorePenalty.statusShort,
  homeScore: liveScorePenalty.homeScore,
  awayScore: liveScorePenalty.awayScore,
  winnerCode: liveScorePenalty.winnerCode,
}, {
  homeCode: 'GER',
  awayCode: 'PAR',
  statusShort: 'PEN',
  homeScore: 1,
  awayScore: 1,
  winnerCode: 'PAR',
});
ok('LiveScore penalty final is scoreable for knockout', !!F.buildUpdateFromVerifiedFixture(liveScorePenalty, '2026-06-29T23:00:00Z', penaltyDb).update);

const foxCards = F.parseFoxScoreCards(`
  <div id="c12d20260629">
    <a class="score-chip final" href="/soccer/fifa-world-cup-men-germany-vs-paraguay-jun-29-2026-game-boxscore-111">
      <div class="score-team-row is-loser">
        <span class="score-team-logo" title="Germany">Germany</span>
        <span title="GER">GER</span>
        <div class="score-team-score"><span class="scores-text"><span class="scores-team-pk">3</span> 1</span></div>
      </div>
      <div class="score-team-row">
        <span class="score-team-logo" title="Paraguay">Paraguay</span>
        <span title="PAR">PAR</span>
        <div class="score-team-score"><span class="scores-text"><span class="scores-team-pk">4</span> 1</span></div>
      </div>
    </a>
  </div>`);
eq('parses FOX penalty score card', foxCards.length, 1);
const foxPenalty = F.transformFoxScoreCard(foxCards[0], penaltyDb);
eq('transforms FOX final card with penalty winner', {
  homeCode: foxPenalty.homeCode,
  awayCode: foxPenalty.awayCode,
  homeScore: foxPenalty.homeScore,
  awayScore: foxPenalty.awayScore,
  winnerCode: foxPenalty.winnerCode,
}, {
  homeCode: 'GER',
  awayCode: 'PAR',
  homeScore: 1,
  awayScore: 1,
  winnerCode: 'PAR',
});

const yahooRows = F.parseYahooScoreboard(
  'x name\\":\\"Germany vs. Paraguay (Final: GER 1-1 PAR) y startDate\\":\\"2026-06-29T20:00:00Z\\" Paraguay wins on penalties and advances to the Round of 16',
  '2026-06-29'
);
eq('parses Yahoo scoreboard row and infers penalty advancer from page text', {
  count: yahooRows.length,
  winnerCode: yahooRows[0] && yahooRows[0].winnerCode,
}, {
  count: 1,
  winnerCode: 'PAR',
});
eq('article score parser ignores penalty shootout score as match score',
  F.firstScoreFromText('Paraguay beat Germany 4-3 on penalties after a 1-1 draw.'),
  { homeScore: 1, awayScore: 1 });

const articlePenalty = F.transformArticleResult({
  source: 'guardian',
  url: 'https://www.theguardian.com/football/live/example',
  matchExternalId: penaltyDb.external_id,
  title: 'Paraguay beat Germany on penalties to reach last 16 of World Cup 2026',
  trailText: 'Paraguay advanced after a 1-1 draw.',
  bodyText: 'Paraguay beat Germany after a 1-1 draw and advanced to the Round of 16.',
}, penaltyDb);
ok('trusted article source can confirm tied knockout advancer when score is present', !!F.buildUpdateFromVerifiedFixture(articlePenalty, '2026-06-29T23:00:00Z', penaltyDb).update);

const espnUpdate = F.buildUpdateFromVerifiedFixture(espnTransformed, '2026-06-11T21:00:00Z').update;
const fifaUpdate = F.buildUpdateFromVerifiedFixture(fifaTransformed, '2026-06-11T21:00:00Z').update;
ok('ESPN alone is not enough by default', !F.consensusUpdate([{ source: 'espn', update: espnUpdate }]).update);
ok('FIFA official source is enough by default', !!F.consensusUpdate([{ source: 'fifa', update: fifaUpdate }]).update);
ok('ESPN alone is enough only with explicit emergency override', !!F.consensusUpdate([
  { source: 'espn', update: espnUpdate }
], { minSources: 1, requiredSources: [] }).update);
ok('ESPN + FIFA agreeing produce the default consensus', !!F.consensusUpdate([
  { source: 'espn', update: espnUpdate },
  { source: 'fifa', update: fifaUpdate }
]).update);
const defaultConsensus = F.consensusUpdate([
  { source: 'espn', update: espnUpdate, sourceId: '760415' },
  { source: 'fifa', update: fifaUpdate, sourceId: '400021443' }
]);
eq('default consensus exposes independent source family count', defaultConsensus.familyCount, 2);
eq('default consensus exposes grouped agreeing source evidence', defaultConsensus.groups.map(group => ({
  familyCount: group.familyCount,
  sources: group.sources.map(source => source.source)
})), [{
  familyCount: 2,
  sources: ['espn', 'fifa']
}]);
eq('source rotation selects one source per bucket', [
  F.sourcesForRun(new Date('2026-06-11T19:00:00Z'), { mode: 'rotate', sources: ['espn', 'fifa'], rotationMinutes: 15 }),
  F.sourcesForRun(new Date('2026-06-11T19:15:00Z'), { mode: 'rotate', sources: ['espn', 'fifa'], rotationMinutes: 15 }),
  F.sourcesForRun(new Date('2026-06-11T19:30:00Z'), { mode: 'rotate', sources: ['espn', 'fifa'], rotationMinutes: 15 })
], [
  ['espn'],
  ['fifa'],
  ['espn']
]);
eq('retired football-data source is not selectable for final-result verification',
  F.sourcesForRun(new Date('2026-06-11T19:00:00Z'), { mode: 'all', sources: ['espn', 'fifa', 'football_data'] }),
  ['espn', 'fifa']);
eq('emergency sources are selectable only from the approved registry',
  F.sourcesForRun(new Date('2026-06-11T19:00:00Z'), { mode: 'all', sources: ['livescore', 'fox', 'yahoo', 'guardian', 'ap', 'houston_chronicle', 'nypost', 'football_data'] }),
  ['livescore', 'fox', 'yahoo', 'guardian', 'ap', 'houston_chronicle', 'nypost']);
eq('source hints classify verified emergency article domains',
  F.parseSourceHints('houston_chronicle=https://www.houstonchronicle.com/world-cup/article/example.php https://nypost.com/2026/06/29/sports/example/').map(h => h.source),
  ['houston_chronicle', 'nypost']);
ok('duplicate ESPN-family confirmations do not count as independent consensus', !F.consensusUpdate([
  { source: 'espn', update: espnUpdate },
  { source: 'espn', update: espnUpdate }
], { minSources: 2, requiredSources: [] }).update);
ok('three independent non-official families can produce consensus when explicitly allowed', !!F.consensusUpdate([
  { source: 'espn', update: espnUpdate },
  { source: 'livescore', update: espnUpdate },
  { source: 'guardian', update: espnUpdate },
  { source: 'fox', update: { ...espnUpdate, status_detail: null } },
], { minSources: 3, requiredSources: [] }).update);
const fallbackConsensus = F.consensusUpdate([
  { source: 'espn', update: espnUpdate },
  { source: 'livescore', update: espnUpdate },
  { source: 'guardian', update: espnUpdate },
], { minSources: 2, requiredSources: ['espn', 'fifa'], fallbackMinSources: 3 });
ok('three independent families can fallback when FIFA is unavailable', !!fallbackConsensus.update && fallbackConsensus.fallback === true);
ok('fallback consensus does not overrule explicit FIFA disagreement', !F.consensusUpdate([
  { source: 'espn', update: espnUpdate },
  { source: 'livescore', update: espnUpdate },
  { source: 'guardian', update: espnUpdate },
  { source: 'fifa', update: { ...fifaUpdate, away_score: 2 } },
], { minSources: 2, requiredSources: ['espn', 'fifa'], fallbackMinSources: 3 }).update);
ok('conflicting sources do not produce consensus', !F.consensusUpdate([
  { source: 'fifa', update: fifaUpdate },
  { source: 'espn', update: { ...espnUpdate, away_score: 2 } }
], 2).update);
ok('provider-confirmed waiting candidates do not require operational attention',
  !F.needsResultAttention({ checked: 2, updated: 0, skipped: 2, waiting: 2, attention_skips: 0 }));
ok('conflicting or fully final-but-unresolved candidates require operational attention',
  F.needsResultAttention({ checked: 2, updated: 1, skipped: 1, waiting: 0, attention_skips: 1 }));
ok('clean verifier run does not require operational attention',
  !F.needsResultAttention({ checked: 2, updated: 2, skipped: 0 }));
ok('provider unavailability requires operational attention',
  F.needsResultAttention({ checked: 0, updated: 0, skipped: 0, unavailable: true }));

async function testStructuredReport() {
  const stuckMatch = {
    ...db,
    home_score: null,
    away_score: null,
    winner_code: null,
    live_clock: null,
    live_period: null,
    status_detail: null,
    live_source: null
  };
  F.__setFetch(async (url) => {
    const textUrl = String(url);
    if (textUrl.includes('/rest/v1/matches')) {
      return {
        ok: true,
        text: async () => JSON.stringify([stuckMatch])
      };
    }
    if (textUrl.includes('site.api.espn.com')) {
      return {
        ok: true,
        json: async () => ({ events: textUrl.includes('20260611') ? [espnFinal] : [] })
      };
    }
    if (textUrl.includes('api.fifa.com')) {
      return {
        ok: true,
        json: async () => ({ Results: [fifaFinal] })
      };
    }
    throw new Error(`unexpected fetch: ${textUrl}`);
  });

  const result = await F.verifyFinalResults({ now: new Date('2026-06-11T21:10:00Z') });
  eq('structured report summarizes dry-run verifier result', {
    checked: result.checked,
    updated: result.updated,
    skipped: result.skipped,
    action: result.report.candidates[0].action,
    sourceStatuses: result.report.source_statuses,
    observationStates: result.report.candidates[0].observations.map(o => `${o.source}:${o.state}`),
    consensusOk: result.report.candidates[0].consensus.ok,
    familyCount: result.report.candidates[0].consensus.family_count
  }, {
    checked: 1,
    updated: 0,
    skipped: 0,
    action: 'dry_run',
    sourceStatuses: {
      espn: { ok: true, loaded: 1 },
      fifa: { ok: true, loaded: 1 }
    },
    observationStates: ['espn:confirmed_result', 'fifa:confirmed_result'],
    consensusOk: true,
    familyCount: 2
  });
}

testStructuredReport()
  .then(() => {
    console.log('\nFinal result verifier tests passed');
  })
  .catch(err => {
    console.error('FAIL: structured report test');
    console.error(err);
    process.exit(1);
  });
