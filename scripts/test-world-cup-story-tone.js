#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const storiesPayload = JSON.parse(fs.readFileSync(path.join(root, 'public-data', 'world-cup-stories.json'), 'utf8'));
const matchesPayload = JSON.parse(fs.readFileSync(path.join(root, 'public-data', 'matches.json'), 'utf8'));
const stories = Array.isArray(storiesPayload.items) ? storiesPayload.items : [];
const matches = Array.isArray(matchesPayload.matches) ? matchesPayload.matches : [];
const matchById = new Map(matches.map(match => [match.id, match]));

const LATEST_STORY_WINDOW = 10;
const endingEmojiPattern = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?$/u;

const weakEnglishPatterns = [
  /\bpoints column\b/i,
  /\bpoints feel(?:s|ing)?\b/i,
  /\bpool table changes?\b/i,
  /\bpool moved fast\b/i,
  /\breal bracket moment\b/i,
  /\b(?:good|bad) (?:call|calls|pick|picks)\b/i,
  /\b(?:big|huge) (?:bracket|pool)?\s*boost\b/i,
  /\bbracket felt it\b/i,
  /\bbrackets feel it\b/i,
  /\bpool feels it\b/i,
  /\bpool feels this result\b/i,
  /\bpool already moved\b/i,
  /\bthe table moves now\b/i,
  /\bthe table answers it\b/i,
  /\bresult goes straight into the table\b/i,
  /\bnext points tell the story\b/i,
  /\bThey move on, and pool brackets feel it right away\b/i,
];

const knockoutMovementPattern = /\b(advance[sd]?|advanced|through|ticket|out|gone|end of the road|road (?:closed|ends|is closed)|closed (?:that road|the door)|run out of road|stops? here|sent .* home|kept the ticket|quarterfinals?|semifinals?|final|next round|moved on)\b/i;

const storyTexturePattern = /\b(receipts?|witness(?:es)?|chat|argument|louder|quiet|brave|spotlight|lawyer|oxygen|ticket|road|forms? aged|personal|material|speak first|old picks|closed the door|breathe|breathing|no longer|audience|souvenir|bandage|smile|chair|water)\b/i;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function englishFields(story) {
  const focuses = Array.isArray(story.pool_focuses) && story.pool_focuses.length
    ? story.pool_focuses
    : (story.pool_focus ? [story.pool_focus] : []);
  return [
    story.en && story.en.headline,
    story.en && story.en.caption,
    ...focuses.flatMap(focus => [
      focus && focus.en_name,
      focus && focus.en_names,
      focus && focus.en_count,
    ]),
  ].filter(Boolean);
}

function scoreOutcome(match) {
  if (!match || match.winner_code === 'DRAW') return 'DRAW';
  if (!match.winner_code && Number(match.home_score) === Number(match.away_score)) return 'DRAW';
  return match.winner_code || null;
}

function isKnockout(match) {
  return String(match && match.stage || '').toUpperCase() !== 'GROUP_STAGE';
}

if (!stories.length) {
  fail('World Cup story tone gate: no stories found.');
}

const latest = stories.slice(0, LATEST_STORY_WINDOW);

for (const story of latest) {
  const match = matchById.get(story.match_id);
  if (!match) {
    fail(`${story.id}: missing source match for tone gate`);
    continue;
  }

  const headline = String(story.en && story.en.headline || '').trim();
  const caption = String(story.en && story.en.caption || '').trim();
  if (!headline) fail(`${story.id}: English headline is empty`);
  if (!caption) fail(`${story.id}: English caption is empty`);
  if (!endingEmojiPattern.test(headline)) fail(`${story.id}: English headline must end with a fitting emoji`);
  if (!endingEmojiPattern.test(caption)) fail(`${story.id}: English caption must end with a fitting emoji`);

  const focuses = Array.isArray(story.pool_focuses) && story.pool_focuses.length
    ? story.pool_focuses
    : (story.pool_focus ? [story.pool_focus] : []);
  focuses.forEach((focus, index) => {
    ['en_name', 'en_names', 'en_count'].forEach(key => {
      const value = String(focus && focus[key] || '').trim();
      if (value && !endingEmojiPattern.test(value)) {
        fail(`${story.id}: pool_focuses[${index}].${key} must end with a fitting emoji`);
      }
    });
  });

  const combined = englishFields(story).join(' ');
  weakEnglishPatterns.forEach(pattern => {
    if (pattern.test(combined)) {
      fail(`${story.id}: latest Story English tone regressed into weak/repetitive copy (${pattern})`);
    }
  });

  const outcome = scoreOutcome(match);
  if (isKnockout(match) && outcome && outcome !== 'DRAW') {
    const visible = `${headline} ${caption}`;
    if (!knockoutMovementPattern.test(visible)) {
      fail(`${story.id}: knockout Story must make advancement/elimination clear in visible English copy`);
    }
    if (!storyTexturePattern.test(combined)) {
      fail(`${story.id}: latest knockout Story needs a social/story texture marker, not just a score report`);
    }
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`world cup story tone validated: ${latest.length} latest stories`);
