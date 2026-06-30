#!/usr/bin/env node

process.env.RESULT_PREFLIGHT_SOURCE = 'snapshot';
const {
  isCandidate,
  isBackoffDue,
  backoffIntervalMinutes,
  isStaleLiveCandidate,
} = require('./final-result-verifier-needed.js');

let failures = 0;

function check(label, condition) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures++;
    console.error(`FAIL ${label}`);
  }
}

function minutesAfterKickoff(minutes) {
  return Date.parse('2026-06-20T03:00:00Z') + minutes * 60000;
}

const match = {
  status: 'TIMED',
  stage: 'GROUP_STAGE',
  match_date: '2026-06-20T03:00:00Z',
  home_team_code: 'TUR',
  away_team_code: 'PAR',
};

check('not candidate before minimum age', !isCandidate(match, minutesAfterKickoff(94)));
check('candidate after minimum age', isCandidate(match, minutesAfterKickoff(95)));
check('candidate is still covered after 72 hours', isCandidate(match, minutesAfterKickoff(72 * 60)));
check('candidate is still covered after 10 days', isCandidate(match, minutesAfterKickoff(10 * 24 * 60)));
check('candidate is outside bounded recovery after 337 hours', !isCandidate(match, minutesAfterKickoff(337 * 60)));
check('complete finished match is not a candidate', !isCandidate({ ...match, status: 'FINISHED', home_score: 1, away_score: 0 }, minutesAfterKickoff(180)));
check('complete finished group draw is not a candidate', !isCandidate({ ...match, status: 'FINISHED', home_score: 1, away_score: 1, winner_code: null }, minutesAfterKickoff(180)));
check('finished tied knockout without advancer is a candidate', isCandidate({ ...match, stage: 'ROUND_OF_32', status: 'FINISHED', home_score: 1, away_score: 1, winner_code: null }, minutesAfterKickoff(180)));
check('finished tied knockout with advancer is not a candidate', !isCandidate({ ...match, stage: 'ROUND_OF_32', status: 'FINISHED', home_score: 1, away_score: 1, winner_code: 'TUR' }, minutesAfterKickoff(180)));
check('finished match missing score is a candidate', isCandidate({ ...match, status: 'FINISHED', home_score: null, away_score: null }, minutesAfterKickoff(180)));
check('finished scored match with live residue is not a final-result candidate', !isCandidate({ ...match, status: 'FINISHED', home_score: 1, away_score: 0, live_clock: "90'+4'" }, minutesAfterKickoff(180)));

const staleKnockoutLive = {
  status: 'PAUSED',
  stage: 'ROUND_OF_32',
  match_date: '2026-06-29T17:00:00Z',
  home_team_code: 'BRA',
  away_team_code: 'JPN',
  home_score: 1,
  away_score: 1,
  status_detail: "59'",
  live_source: 'espn',
  source_updated_at: '2026-06-29T18:21:21Z',
};
check('stale knockout live state is a verifier candidate before normal 95 minute fallback', isCandidate(
  staleKnockoutLive,
  Date.parse('2026-06-29T18:40:00Z')
));
check('stale knockout live state is due immediately despite fallback backoff', isBackoffDue(
  staleKnockoutLive,
  Date.parse('2026-06-29T18:40:00Z'),
  { enabled: true, minAgeMinutes: 95, runEveryMinutes: 15 }
));
check('fresh paused live state is not an early stale-live candidate', !isStaleLiveCandidate(
  { ...staleKnockoutLive, source_updated_at: '2026-06-29T18:35:00Z' },
  Date.parse('2026-06-29T18:40:00Z')
));
check('normal 60 minute halftime-ish live state is not an early stale-live candidate', !isCandidate(
  { ...staleKnockoutLive, source_updated_at: '2026-06-29T17:59:00Z' },
  Date.parse('2026-06-29T18:00:00Z')
));
check('early overdue interval is 15 minutes', backoffIntervalMinutes(120) === 15);
check('mid overdue interval is 30 minutes', backoffIntervalMinutes(180) === 30);
check('late overdue interval is 60 minutes', backoffIntervalMinutes(360) === 60);
check('first overdue window is due', isBackoffDue(match, minutesAfterKickoff(106), {
  enabled: true,
  minAgeMinutes: 95,
  runEveryMinutes: 15,
}));
check('same early bucket waits on a 5-minute runner', !isBackoffDue(match, minutesAfterKickoff(133), {
  enabled: true,
  minAgeMinutes: 95,
  runEveryMinutes: 5,
}));
check('next early bucket is due', isBackoffDue(match, minutesAfterKickoff(135), {
  enabled: true,
  minAgeMinutes: 95,
  runEveryMinutes: 15,
}));
check('mid backoff waits between 30 minute buckets', !isBackoffDue(match, minutesAfterKickoff(210), {
  enabled: true,
  minAgeMinutes: 95,
  runEveryMinutes: 15,
}));
check('mid backoff is due at next 30 minute bucket', isBackoffDue(match, minutesAfterKickoff(215), {
  enabled: true,
  minAgeMinutes: 95,
  runEveryMinutes: 15,
}));

if (failures) {
  console.error(`final-result verifier preflight tests failed: ${failures}`);
  process.exit(1);
}

console.log('final-result verifier preflight tests passed');
