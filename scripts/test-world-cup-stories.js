#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stories = JSON.parse(fs.readFileSync(path.join(root, 'public-data', 'world-cup-stories.json'), 'utf8')).items || [];
const matches = JSON.parse(fs.readFileSync(path.join(root, 'public-data', 'matches.json'), 'utf8')).matches || [];
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const stylesCss = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const generatorJs = fs.readFileSync(path.join(root, 'scripts', 'generate-world-cup-stories.js'), 'utf8');
const { TEAM_NAMES } = require('./generate-world-cup-stories');
const byId = new Map(matches.map(match => [match.id, match]));
const seenFallbacks = new Map();
const teamNames = Object.values(TEAM_NAMES || {}).flatMap(item => [item.en, item.he]).filter(Boolean);
teamNames.sort((a, b) => b.length - a.length);
function allGroupsComplete(rows) {
  const byGroup = new Map();
  for (const match of rows || []) {
    if (!match || match.stage !== 'GROUP_STAGE') continue;
    const group = String(match.group_letter || '').trim().toUpperCase();
    if (!group || match.status !== 'FINISHED' || match.home_score == null || match.away_score == null) continue;
    const teams = [match.home_team_code, match.away_team_code].map(code => String(code || '').trim().toUpperCase()).sort();
    if (!teams[0] || !teams[1]) continue;
    if (!byGroup.has(group)) byGroup.set(group, new Set());
    byGroup.get(group).add(teams.join('-'));
  }
  return Array.from(byGroup.values()).filter(fixtures => fixtures.size === 6).length >= 12;
}
const groupStageComplete = allGroupsComplete(matches);
const bannedHeadlineFragments = [
  /Statement made!?/i,
  /No winner, all drama/i,
  /the table felt it/i,
  /\u05d4\u05e6\u05d4\u05e8\u05d4!?/u,
  /\u05d3\u05e8\u05de\u05d4 \u05d1\u05dc\u05d9 \u05d4\u05db\u05e8\u05e2\u05d4/u,
  /\u05d4\u05d8\u05d1\u05dc\u05d4 \u05d4\u05e8\u05d2\u05d9\u05e9\u05d4 \u05d0\u05ea \u05d6\u05d4/u,
];
const bannedFallbackFragments = [
  /makes noise with/i,
  /\u05e2\u05d5\u05e9\u05d4 \u05e8\u05e2\u05e9 \u05e2\u05dd/u,
];
const bannedFocusFragments = [
  /already need[s]? a defense speech/i,
  /\u05db\u05d1\u05e8 \u05e6\u05e8\u05d9\u05da(?:\u05d9\u05dd)? \u05e0\u05d0\u05d5\u05dd \u05d4\u05d2\u05e0\u05d4/u,
];
const stalePostGroupFragments = [
  /\b(Group [A-L] )?(stays open|opens up|is still open|leave[s]? the group open|just getting started|needs? a recovery match|waiting for another group match)\b/i,
  /\b(still alive|route still exists|still possible)\b/i,
  /\u05e0\u05e9\u05d0\u05e8 \u05e4\u05ea\u05d5\u05d7/u,
  /\u05e0\u05e4\u05ea\u05d7 \u05de\u05d7\u05d3\u05e9/u,
  /\u05e2\u05d3\u05d9\u05d9\u05df \u05d7/u,
  /\u05de\u05e9\u05d7\u05e7 \u05d4\u05d1\u05d0/u,
];
const endingEmojiPattern = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?$/u;
const RECENT_STORY_COPY_WINDOW = 10;
const MIN_LATEST_STORY_IMAGE_BYTES = 500000;

function copyShape(text, options = {}) {
  let value = String(text || '');
  if (options.normalizeTeams) {
    for (const name of teamNames) {
      value = value.split(name).join('{team}');
    }
  }
  return value
    .replace(/\{names\}/g, '{names}')
    .replace(/\{team\}/g, '{team}')
    .replace(/\d+\s*-\s*\d+/g, '#-#')
    .replace(/\b[A-Z]{3}\b/g, 'TEAM')
    .replace(/[^\p{Letter}\p{Number}\s{}#-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function focusText(focus, lang) {
  const prefix = lang === 'he' ? 'he_' : 'en_';
  return [
    focus && focus[`${prefix}name`],
    focus && focus[`${prefix}names`],
    focus && focus[`${prefix}count`],
  ].filter(Boolean).join(' ');
}

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
  const image = String(story.image || '');
  if (image.includes('\\')) {
    fail(`${story.id}: story image path must use forward slashes: ${image}`);
  }
  if (!image || !fs.existsSync(path.join(root, image))) {
    fail(`${story.id}: missing story image asset ${story.image || ''}`);
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
  const headlineText = [
    story.he && story.he.headline,
    story.en && story.en.headline,
  ].filter(Boolean).join(' ');
  bannedHeadlineFragments.forEach(pattern => {
    if (pattern.test(headlineText)) {
      fail(`${story.id}: headline uses banned generic story phrasing`);
    }
  });
  const copyText = [
    story.he && story.he.caption,
    story.en && story.en.caption
  ].join(' ');
  const storyText = [
    story.he && story.he.headline,
    story.he && story.he.caption,
    story.en && story.en.headline,
    story.en && story.en.caption,
    ...(Array.isArray(story.pool_focuses) ? story.pool_focuses : [])
      .filter(focus => focus && focus.table === 'group_position_picks')
      .flatMap(focus => [
      focus && focus.he_name,
      focus && focus.he_names,
      focus && focus.he_count,
      focus && focus.en_name,
      focus && focus.en_names,
      focus && focus.en_count,
    ]),
  ].filter(Boolean).join(' ');
  if (groupStageComplete && match.stage === 'GROUP_STAGE') {
    stalePostGroupFragments.forEach(pattern => {
      if (pattern.test(storyText)) {
        fail(`${story.id}: post-group-stage story copy still implies future/open group-stage context (${pattern})`);
      }
    });
  }
  bannedFallbackFragments.forEach(pattern => {
    if (pattern.test(copyText)) {
      fail(`${story.id}: fallback caption uses banned generic story phrasing`);
    }
  });
  ['he', 'en'].forEach(lang => {
    const caption = String(story[lang] && story[lang].caption || '').trim();
    if (!caption) fail(`${story.id}: ${lang} fallback caption is empty`);
    if (!endingEmojiPattern.test(caption)) fail(`${story.id}: ${lang} fallback caption should end with a fitting emoji`);
    const key = `${lang}:${caption}`;
    if (seenFallbacks.has(key)) {
      fail(`${story.id}: ${lang} fallback caption duplicates ${seenFallbacks.get(key)}`);
    }
    seenFallbacks.set(key, story.id);
  });
  if (/מי ש|Anyone who|anyone who/i.test(copyText)) {
    fail(`${story.id}: fallback caption must be match-specific, not generic pick banter`);
  }
  const focuses = Array.isArray(story.pool_focuses) && story.pool_focuses.length ? story.pool_focuses : (story.pool_focus ? [story.pool_focus] : []);
  if (!focuses.length) fail(`${story.id}: missing pool focus data`);
  focuses.forEach((focus, idx) => {
    ['he_count', 'en_count'].forEach(key => {
      if (focus && focus[key] && !String(focus[key]).includes('{names}')) {
        fail(`${story.id}: pool_focuses[${idx}].${key} must preserve participant names`);
      }
    });
    const enFocus = focusText(focus, 'en');
    const heFocus = focusText(focus, 'he');
    ['he_name', 'he_names', 'he_count', 'en_name', 'en_names', 'en_count'].forEach(key => {
      if (focus && focus[key] && !endingEmojiPattern.test(String(focus[key]).trim())) {
        fail(`${story.id}: pool_focuses[${idx}].${key} should end with a fitting emoji`);
      }
    });
    if (/(^|[^\u05d0-\u05ea])\u05e4\u05d5\u05dc([^\u05d0-\u05ea]|$)/u.test(heFocus)) {
      fail(`${story.id}: Hebrew pool_focuses[${idx}] must say heymur/tfasim/chat, not "פול"`);
    }
    bannedFocusFragments.forEach(pattern => {
      if (pattern.test(enFocus) || pattern.test(heFocus)) {
        fail(`${story.id}: pool_focuses[${idx}] uses banned repeated defense-speech phrasing`);
      }
    });
    if (!/picked \{team\} (to (win the World Cup|top the group)|first in the group)/i.test(enFocus)) {
      fail(`${story.id}: pool_focuses[${idx}] English text must name the exact pick type`);
    }
    if (focus.table === 'tournament_winner_picks' && !/picked \{team\} to win the World Cup/i.test(enFocus)) {
      fail(`${story.id}: pool_focuses[${idx}] tournament winner text must say "picked {team} to win the World Cup"`);
    }
    if (focus.table === 'group_position_picks' && !/picked \{team\} (to top the group|first in the group)/i.test(enFocus)) {
      fail(`${story.id}: pool_focuses[${idx}] group-position text must say "{team} to top the group"`);
    }
    const hasHebrewPickType = /(\u05d2\u05d1\u05d9\u05e2 \u05d4\u05e2\u05d5\u05dc\u05dd|\u05de\u05d5\u05e0\u05d3\u05d9\u05d0\u05dc|\u05d1\u05e8\u05d0\u05e9 \u05d4\u05d1\u05d9\u05ea|\u05e8\u05d0\u05e9\u05d5\u05e0\u05d4 \u05d1\u05d1\u05d9\u05ea)/u.test(heFocus);
    if (heFocus && (!heFocus.includes('{team}') || !hasHebrewPickType)) {
      fail(`${story.id}: pool_focuses[${idx}] Hebrew text must name the exact pick type`);
    }
  });
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

for (let i = 1; i < stories.length; i++) {
  const prev = stories[i - 1];
  const current = stories[i];
  ['he', 'en'].forEach(lang => {
    const prevShape = copyShape(prev[lang] && prev[lang].caption);
    const currentShape = copyShape(current[lang] && current[lang].caption);
    if (prevShape && currentShape && prevShape === currentShape) {
      fail(`${current.id}: ${lang} fallback caption structure duplicates adjacent story ${prev.id}`);
    }
  });
}

const latest = stories.slice(0, RECENT_STORY_COPY_WINDOW);
latest.forEach(story => {
  const match = byId.get(story.match_id);
  if (!match) return;
  const draw = Number(match.home_score) === Number(match.away_score);
  const outcome = match.winner_code || (draw ? 'DRAW' : null);
  ['he', 'en'].forEach(lang => {
    ['headline', 'caption'].forEach(key => {
      const value = String(story[lang] && story[lang][key] || '');
      if (!endingEmojiPattern.test(value.trim())) {
        fail(`${story.id}: latest visible ${lang}.${key} should end with a fitting emoji`);
      }
    });
  });
  const focuses = Array.isArray(story.pool_focuses) && story.pool_focuses.length ? story.pool_focuses : (story.pool_focus ? [story.pool_focus] : []);
  const imagePath = path.join(root, String(story.image || ''));
  if (fs.existsSync(imagePath) && fs.statSync(imagePath).size < MIN_LATEST_STORY_IMAGE_BYTES) {
    fail(`${story.id}: latest visible story image is too small for final poster art (${fs.statSync(imagePath).size} bytes)`);
  }
  if (outcome && outcome !== 'DRAW') {
    const first = focuses[0] || {};
    if (first.table !== 'tournament_winner_picks' || first.team_code !== outcome) {
      fail(`${story.id}: latest winning stories must try the winner's tournament-winner picks first`);
    }
    if (!focuses.some(focus => focus.table === 'group_position_picks' && focus.team_code === outcome && Number(focus.position || 1) === 1)) {
      fail(`${story.id}: latest winning stories must include the winner's first-in-group focus`);
    }
  }
});
['he', 'en'].forEach(lang => {
  const seenLatestHeadlines = new Map();
  const seenLatestCaptions = new Map();
  const seenLatestFocuses = new Map();
  latest.forEach(story => {
    const headlineShape = copyShape(story[lang] && story[lang].headline, { normalizeTeams: true });
    if (headlineShape && seenLatestHeadlines.has(headlineShape)) {
      fail(`${story.id}: ${lang} latest-story headline structure duplicates ${seenLatestHeadlines.get(headlineShape)}`);
    }
    if (headlineShape) seenLatestHeadlines.set(headlineShape, story.id);
    const captionShape = copyShape(story[lang] && story[lang].caption, { normalizeTeams: true });
    if (captionShape && seenLatestCaptions.has(captionShape)) {
      fail(`${story.id}: ${lang} latest-story fallback caption structure duplicates ${seenLatestCaptions.get(captionShape)}`);
    }
    seenLatestCaptions.set(captionShape, story.id);
    const focuses = Array.isArray(story.pool_focuses) && story.pool_focuses.length ? story.pool_focuses : (story.pool_focus ? [story.pool_focus] : []);
    focuses.forEach((focus, idx) => {
      const focusShape = copyShape(focusText(focus, lang), { normalizeTeams: true });
      if (focusShape && seenLatestFocuses.has(focusShape)) {
        fail(`${story.id}: ${lang} latest-story pool_focuses[${idx}] structure duplicates ${seenLatestFocuses.get(focusShape)}`);
      }
      if (focusShape) seenLatestFocuses.set(focusShape, `${story.id} pool_focuses[${idx}]`);
    });
  });
});

const visualChecks = [
  [appJs.includes('const _WC_STORY_LAYOUT'), 'app.js must define shared story layout constants'],
  [!appJs.includes('headlineY:'), 'share renderer must not add a duplicate result headline panel'],
  [appJs.includes('captionY: 0.62'), 'share renderer caption must stay in the WhatsApp-safe lower-middle band'],
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
  [stylesCss.includes('top: 62%'), 'dashboard caption panel must stay in the WhatsApp-safe lower-middle band'],
  [!stylesCss.includes('.wc-story-top-label'), 'CSS must not add a duplicate top meme label'],
  [stylesCss.includes('.wc-story-caption-panel[dir="rtl"]') && stylesCss.includes('text-align: right'), 'Hebrew dashboard text must align right'],
  [stylesCss.includes('.wc-story-caption-panel[dir="ltr"]') && stylesCss.includes('text-align: left'), 'English dashboard text must align left'],
  [!stylesCss.includes('[dir="he"]'), 'story CSS must target rtl/ltr dir values, not language codes'],
  [generatorJs.includes('shirt number #') && generatorJs.includes('printed naturally into the jersey fabric'), 'story generator prompt must require real shirt numbers integrated into kits'],
  [generatorJs.includes("table: 'tournament_winner_picks'"), 'story generator must include tournament-winner pool focus choices'],
  [appJs.includes('if (!pickedMembers.length) continue') && appJs.includes('if (!names.length) continue'), 'client story captions must only use pool-specific copy when visible member names are available'],
  [generatorJs.includes('60%-77%'), 'story generator prompt must preserve the current caption safe band'],
  [generatorJs.includes('caption panel, black rectangle, empty box, UI card'), 'story generator prompt must ban baked caption panels and UI boxes'],
  [!generatorJs.includes('yellow result overlay'), 'story generator prompt must not reserve a yellow result overlay'],
  [!generatorJs.includes('50%-64%'), 'story generator prompt must not use the old face-level caption band'],
  [appJs.includes('function _wcStoryFocuses') && appJs.includes('pool_focuses'), 'client must support ordered pool-specific story focus choices'],
  [appJs.includes("table === 'knockout_picks' ? 'predicted_winner' : 'team_code'"), 'client must query specific pick tables by their actual team column'],
];
visualChecks.forEach(([ok, message]) => { if (!ok) fail(message); });

bannedHeadlineFragments.concat(bannedFallbackFragments, bannedFocusFragments).forEach(pattern => {
  if (pattern.test(generatorJs)) {
    fail(`story generator still contains banned generic copy pattern ${pattern}`);
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log(`world cup stories validated: ${stories.length}`);
