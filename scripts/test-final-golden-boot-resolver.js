// Test: final Golden Boot resolver gates on final truth and FIFA Golden Boot rules.
// Run: node scripts/test-final-golden-boot-resolver.js

process.env.PROD_ANON_KEY = 'test';

const R = require('./resolve-final-golden-boot.js');

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

const candidates = [
  { key: 'messi', player_id: 'messi-id', player_name: 'Lionel Messi', aliases: ['lionel messi', 'messi'] },
  { key: 'mbappe', player_id: 'mbappe-id', player_name: 'Kylian Mbappe', aliases: ['kylian mbappe', 'mbappe'] }
];

const finalMatch = {
  external_id: '400021543',
  stage: 'FINAL',
  home_team_code: 'ESP',
  away_team_code: 'ARG',
  home_score: 1,
  away_score: 2,
  winner_code: 'ARG',
  status: 'FINISHED'
};

ok('scheduled final is not resolved', !R.finalMatchResolved({ ...finalMatch, status: 'SCHEDULED', home_score: null, away_score: null }));
ok('finished final with winner is resolved', R.finalMatchResolved(finalMatch));
ok('generic final text is not post-final proof',
  !R.sourceMentionsCompletedFinal('Argentina and Spain are in the World Cup final. Kylian Mbappe was a previous Golden Boot winner.', finalMatch));
ok('winner-loser final text is post-final proof',
  R.sourceMentionsCompletedFinal('Argentina beat Spain in the World Cup final and lifted the trophy.', finalMatch));

(async () => {
  const preFinal = await R.observeSource({
    key: 'talksport',
    label: 'TalkSport',
    family: 'media:talksport',
    official: false,
    url: 'https://talksport.com/example'
  }, 'Mbappe leads with 10 goals and 4 assists. Messi has 8 goals and 4 assists with the final set to follow.', candidates, finalMatch);
  ok('pre-final tracker text is not decisive after final', !preFinal.verdictKey);

  const officialGoals = await R.observeSource({
    key: 'fifa_stats',
    label: 'FIFA player statistics',
    family: 'official:fifa',
    official: true,
    url: 'https://www.fifa.com/stats'
  }, 'Rank | Player | Goals | Assists | Minutes Played 1 | Lionel Messi | 11 | 4 | 722 2 | Kylian Mbappe | 10 | 4 | 666', candidates, finalMatch);
  eq('official FIFA stats decide by goals', officialGoals.verdictKey, 'messi');

  const scoreboardDirect = await R.observeSource({
    key: 'livescore_world_cup',
    label: 'LiveScore',
    family: 'scoreboard:livescore',
    official: false,
    url: 'https://www.livescore.com/example'
  }, 'Argentina beat Spain in the World Cup final. Kylian Mbappe is a Golden Boot winner.', candidates, finalMatch);
  ok('scoreboard pages cannot decide from direct Golden Boot wording alone', !scoreboardDirect.verdictKey);

  const fewerMinutes = R.statsWinner({
    messi: { goals: 10, assists: 4, minutes: 650 },
    mbappe: { goals: 10, assists: 4, minutes: 666 }
  });
  eq('FIFA rule uses fewer minutes after goals and assists', fewerMinutes, { key: 'messi', reason: 'fewer minutes' });

  const sourceA = {
    source: 'ap_article',
    family: 'wire:ap',
    official: false,
    verdictKey: 'mbappe'
  };
  const sourceB = {
    source: 'talksport',
    family: 'media:talksport',
    official: false,
    verdictKey: 'mbappe'
  };
  const consensus = R.selectResolution([sourceA, sourceB], candidates);
  ok('two secondary families can decide when FIFA is stale', consensus.decisive && consensus.candidate.key === 'mbappe');

  const conflict = R.selectResolution([
    { source: 'fifa_stats', family: 'official:fifa', official: true, verdictKey: 'messi' },
    { source: 'fifa_key_stats', family: 'official:fifa', official: true, verdictKey: 'mbappe' }
  ], candidates);
  ok('conflicting FIFA official observations block writes', !conflict.decisive);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
