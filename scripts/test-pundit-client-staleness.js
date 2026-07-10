const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'app.js');
const src = fs.readFileSync(appPath, 'utf8');
const generatorSrc = fs.readFileSync(path.join(__dirname, 'generate-pundit.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  /_punditState\s*=\s*\{[^}]*cacheUntil:\s*0/.test(src),
  'Pundit state must track cacheUntil so stale feed items can expire before the normal refetch window'
);

assert(
  /now\s*<\s*\(_punditState\.cacheUntil\s*\|\|\s*0\)/.test(src),
  'loadPundit must use cacheUntil as the cache guard, not only loadedAt age'
);

assert(
  /globalFreshUntil\s*=\s*Number\.isFinite\(freshUntil\)\s*\?\s*freshUntil\s*:\s*\(updatedAt\s*\+\s*6\s*\*\s*60\s*\*\s*60\s*\*\s*1000\)/.test(src),
  'Fresh global feed cache must be bounded by feed freshUntil or the updatedAt fallback window'
);

assert(
  /const itemExpiries\s*=\s*items[\s\S]*?expires_at[\s\S]*?filter\(ts => Number\.isFinite\(ts\) && ts > now\)/.test(src),
  'Pundit cache must consider per-item expires_at values'
);

assert(
  /const freshnessBoundaries\s*=\s*\[now \+ 5 \* 60 \* 1000, globalFreshUntil\][\s\S]*?concat\(itemExpiries\)/.test(src),
  'Pundit cacheUntil must use the earliest normal/feed/item freshness boundary'
);

assert(
  /ty === 'live' \|\| ty === 'verification' \|\| ty === 'news'/.test(src),
  'Pundit rotation must rank verification/recovery items as current facts, not evergreen filler'
);

assert(
  /_punditState\.cacheUntil\s*=\s*0;[\s\S]*?_punditState\.pool\s*=\s*null;/.test(src),
  'Pundit context resets must clear cacheUntil'
);

assert(
  /_punditState\.loadedAt\s*=\s*0;\s*\/\/ bypass the in-memory cache[\s\S]*?_punditState\.cacheUntil\s*=\s*0;/.test(src),
  'The 10-minute refresh timer must bypass both loadedAt and cacheUntil'
);

assert(
  /const tournamentStarted\s*=\s*hasScores\s*\|\|\s*Date\.now\(\)\s*>=\s*Date\.parse\(POOL_LOCK_KICKOFF_ISO\)/.test(src),
  'Pool Pundit must treat kickoff as tournament-started even when scoreboard points are still zero'
);

assert(
  /const poolOpenForNewBuzz\s*=\s*!poolLocked\s*&&\s*\(lateEntryOpen\s*\|\|\s*!tournamentStarted\)/.test(src),
  'Pool join/share buzz must be based on effective betting availability, not only poolLocked'
);

assert(
  /function _punditHasDisplayText\(item\)[\s\S]*?item\.key[\s\S]*?item\.he[\s\S]*?item\.en/.test(src),
  'Pool Pundit merge must reject items without a translation key or language copy'
);

assert(
  /const poolCands\s*=\s*_ppDedup\(poolItems\)\.filter\(_punditHasDisplayText\)/.test(src),
  'Pool Pundit candidates must be filtered for renderable text before rotation'
);

assert(
  /function _poolPunditDisplayItem\(it\)[\s\S]*?key:\s*it\.key[\s\S]*?params:\s*it\.params/.test(src),
  'Pool Pundit display items must preserve key/params so translated tournament context cards do not render blank'
);

assert(
  !/id:\s*it\.id,\s*type:\s*'pool',\s*confidence:\s*'confirmed',\s*he:\s*it\.he,\s*en:\s*it\.en,\s*sources:\s*\[\]/.test(src),
  'Pool Pundit must not map key-backed items into he/en-only objects'
);

[
  'יוצא משלב הבתים',
  'leaves the group stage',
  'שלב הבתים מאחורינו',
  'The group stage is behind us',
  'קבלות הבתים',
  'group-stage receipts',
  'אחרי שלב הבתים',
  'After the group stage',
  'מקומות בבית',
  'group places',
].forEach((phrase) => {
  assert(
    !src.includes(phrase),
    `Pool Pundit must not show stale group-stage transition copy during knockout mode: ${phrase}`
  );
  assert(
    !generatorSrc.includes(phrase),
    `Generated Pundit feed must not publish stale group-stage transition copy during knockout mode: ${phrase}`
  );
});

assert(
  !/id:\s*'ev-grp[A-L]'/.test(src),
  'Pundit evergreen deck must not include stale Group A-L preview cards during knockout mode'
);

assert(
  !/group-stage surprise|הפתעה בשלב הבתים|advance from the groups|עולות משלב הבתים/.test(src),
  'Pundit evergreen deck must not include group-stage filler while the live product is in knockout mode'
);

assert(
  /groupStageComplete\s*\?\s*`\$\{n\} מוביל עכשיו עם \$\{s\} נקודות/.test(src),
  'Group-complete pool leader copy must describe the current knockout chase, not a user leaving the group stage'
);

assert(
  /groupStageComplete\s*\?\s*`\$\{n\} leads now with \$\{s\} points/.test(src),
  'English group-complete pool leader copy must describe the current knockout chase'
);

[
  [/if\s*\(\s*poolOpenForNewBuzz\s*&&\s*total\s*<=\s*1\s*\)[\s\S]*?push\('pool-solo'/, 'pool-solo'],
  [/if\s*\(\s*poolOpenForNewBuzz\s*&&\s*recentSubmitter\s*\)[\s\S]*?push\('pool-recent-submit'/, 'pool-recent-submit'],
  [/if\s*\(\s*poolOpenForNewBuzz\s*&&\s*recentJoiner\s*\)[\s\S]*?push\('pool-recent-join'/, 'pool-recent-join'],
  [/if\s*\(\s*poolOpenForNewBuzz\s*&&\s*total\s*>=\s*3\s*\)[\s\S]*?push\('pool-growth'/, 'pool-growth'],
  [/if\s*\(\s*poolOpenForNewBuzz\s*\)\s*\{[\s\S]*?push\('pool-ev-share'/, 'pool-ev-share'],
].forEach(([pattern, id]) => {
  assert(
    pattern.test(src),
    `${id} must be hidden after kickoff unless late entry is explicitly open`
  );
});

assert(
  /if\s*\(\s*!tournamentStarted\s*&&\s*!lateEntryOpen\s*\)\s*\{[\s\S]*?push\('pool-ev-lock'/.test(src),
  'Pre-kickoff lock reminder must not appear as live/recovery-window Pundit copy'
);

console.log('Pundit client staleness tests passed');
