#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stories = JSON.parse(fs.readFileSync(path.join(root, 'public-data', 'world-cup-stories.json'), 'utf8')).items || [];
const matches = JSON.parse(fs.readFileSync(path.join(root, 'public-data', 'matches.json'), 'utf8')).matches || [];
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const stylesCss = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const byId = new Map(matches.map(match => [match.id, match]));

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

for (const story of stories) {
  const match = byId.get(story.match_id);
  if (!match) {
    fail(`${story.id}: missing source match`);
    continue;
  }
  if (match.status !== 'FINISHED') continue;
  const draw = Number(match.home_score) === Number(match.away_score);
  const outcome = match.winner_code || (draw ? 'DRAW' : null);
  const loser = outcome === match.home_team_code ? match.away_team_code : match.home_team_code;
  const winnerScore = outcome === 'DRAW' ? Number(match.home_score) : (outcome === match.home_team_code ? Number(match.home_score) : Number(match.away_score));
  const loserScore = outcome === 'DRAW' ? Number(match.away_score) : (outcome === match.home_team_code ? Number(match.away_score) : Number(match.home_score));
  const score = `${winnerScore}-${loserScore}`;

  if (story.outcome !== outcome) fail(`${story.id}: outcome ${story.outcome} does not match ${outcome}`);
  if (!story.top_label) fail(`${story.id}: missing top_label`);
  if (outcome === 'DRAW' && story.top_label !== 'DRAW!') fail(`${story.id}: draw top_label must be DRAW!`);
  if (outcome !== 'DRAW' && !story.top_label.endsWith(' WINS!')) fail(`${story.id}: win top_label must end with WINS!`);
  if (outcome !== 'DRAW' && story.result !== `${outcome} ${score} ${loser}`) {
    fail(`${story.id}: result must be winner-first, got "${story.result}"`);
  }
  if (!String(story.he && story.he.headline || '').includes(score)) {
    fail(`${story.id}: Hebrew headline missing score ${score}`);
  }
  if (!String(story.en && story.en.headline || '').includes(score)) {
    fail(`${story.id}: English headline missing score ${score}`);
  }
  if (outcome !== 'DRAW') {
    const heHeadline = String(story.he && story.he.headline || '');
    if (!heHeadline.includes('ניצחה את')) fail(`${story.id}: Hebrew win headline must use "ניצחה את"`);
    const heTitleWithoutScore = heHeadline.split(':')[0].replace(/\d+\s*-\s*\d+/g, '');
    if (/-/.test(heTitleWithoutScore)) fail(`${story.id}: Hebrew win title before colon must not use hyphenated team order`);
    if (!String(story.en && story.en.headline || '').toLowerCase().includes(' beat ')) {
      fail(`${story.id}: English win headline must say beat`);
    }
  }
}

const visualChecks = [
  [appJs.includes('const _WC_STORY_LAYOUT'), 'app.js must define shared story layout constants'],
  [!appJs.includes('headlineY:'), 'share renderer must not add a duplicate result headline panel'],
  [appJs.includes('captionY: 0.695'), 'share renderer caption must stay below the player-head safe zone'],
  [appJs.includes('class="wc-story-caption-text"'), 'dashboard story must wrap caption text for reliable alignment'],
  [!appJs.includes('class="wc-story-headline-panel"'), 'dashboard story must not render a duplicate result headline panel'],
  [appJs.includes('class="wc-story-caption-panel"'), 'dashboard story must render a separate caption panel'],
  [!appJs.includes('class="wc-story-top-label"'), 'top meme label must stay baked into the artwork only'],
  [!appJs.includes('class="wc-story-copy"'), 'dashboard story must not render the old mid-face copy panel'],
  [!appJs.includes('_wcDrawCenteredText(ctx, copy.headline'), 'share image must not draw a duplicate yellow result headline'],
  [appJs.includes("const isRtl = dir === 'rtl'"), 'share image must detect RTL using the rendered dir value'],
  [appJs.includes("const textAlign = isRtl ? 'right' : 'left'"), 'share image must align RTL right and LTR left'],
  [!stylesCss.includes('.wc-story-headline-panel'), 'CSS must not style a duplicate result headline panel'],
  [!stylesCss.includes('.wc-story-copy') && !stylesCss.includes('.wc-story-headline'), 'CSS must not keep old mid-face story copy classes'],
  [stylesCss.includes('.wc-story-caption-panel'), 'CSS must style the separate caption panel'],
  [stylesCss.includes('top: 69.5%'), 'dashboard caption panel must stay below the player-head safe zone'],
  [!stylesCss.includes('.wc-story-top-label'), 'CSS must not add a duplicate top meme label'],
  [stylesCss.includes('.wc-story-caption-panel[dir="rtl"]') && stylesCss.includes('text-align: right'), 'Hebrew dashboard text must align right'],
  [stylesCss.includes('.wc-story-caption-panel[dir="ltr"]') && stylesCss.includes('text-align: left'), 'English dashboard text must align left'],
  [!stylesCss.includes('[dir="he"]'), 'story CSS must target rtl/ltr dir values, not language codes'],
];
visualChecks.forEach(([ok, message]) => { if (!ok) fail(message); });

if (process.exitCode) process.exit(process.exitCode);
console.log(`world cup stories validated: ${stories.length}`);
