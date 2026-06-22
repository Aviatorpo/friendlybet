#!/usr/bin/env node

process.env.RESULT_PREFLIGHT_SOURCE = 'snapshot';
const {
  isCandidate,
  isBackoffDue,
  backoffIntervalMinutes,
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
  match_date: '2026-06-20T03:00:00Z',
  home_team_code: 'TUR',
  away_team_code: 'PAR',
};

check('not candidate before minimum age', !isCandidate(match, minutesAfterKickoff(104)));
check('candidate after minimum age', isCandidate(match, minutesAfterKickoff(115)));
check('complete finished match is not a candidate', !isCandidate({ ...match, status: 'FINISHED', home_score: 1, away_score: 0 }, minutesAfterKickoff(180)));
check('finished match missing score is a candidate', isCandidate({ ...match, status: 'FINISHED', home_score: null, away_score: null }, minutesAfterKickoff(180)));
check('finished match with live residue is a candidate', isCandidate({ ...match, status: 'FINISHED', home_score: 1, away_score: 0, live_clock: "90'+4'" }, minutesAfterKickoff(180)));
check('early overdue interval is 15 minutes', backoffIntervalMinutes(120) === 15);
check('mid overdue interval is 30 minutes', backoffIntervalMinutes(180) === 30);
check('late overdue interval is 60 minutes', backoffIntervalMinutes(360) === 60);
check('first overdue window is due', isBackoffDue(match, minutesAfterKickoff(106), {
  enabled: true,
  minAgeMinutes: 105,
  runEveryMinutes: 15,
}));
check('same early bucket waits on a 5-minute runner', !isBackoffDue(match, minutesAfterKickoff(133), {
  enabled: true,
  minAgeMinutes: 105,
  runEveryMinutes: 5,
}));
check('next early bucket is due', isBackoffDue(match, minutesAfterKickoff(135), {
  enabled: true,
  minAgeMinutes: 105,
  runEveryMinutes: 15,
}));
check('mid backoff waits between 30 minute buckets', !isBackoffDue(match, minutesAfterKickoff(220), {
  enabled: true,
  minAgeMinutes: 105,
  runEveryMinutes: 15,
}));
check('mid backoff is due at next 30 minute bucket', isBackoffDue(match, minutesAfterKickoff(225), {
  enabled: true,
  minAgeMinutes: 105,
  runEveryMinutes: 15,
}));

if (failures) {
  console.error(`final-result verifier preflight tests failed: ${failures}`);
  process.exit(1);
}

console.log('final-result verifier preflight tests passed');
