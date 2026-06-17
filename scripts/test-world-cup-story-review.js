#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pending = path.join(root, 'story-review', 'pending');
let failures = 0;

function fail(message) {
  console.error(message);
  failures += 1;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pngDimensions(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function pickTypeText(story) {
  return (story.pool_focuses || []).map(focus => [
    focus.en_name,
    focus.en_names,
    focus.en_count,
    focus.he_name,
    focus.he_names,
    focus.he_count,
  ].join(' ')).join(' ');
}

if (!fs.existsSync(pending)) {
  console.log('world cup story review drafts validated: 0');
  process.exit(0);
}

const dirs = fs.readdirSync(pending, { withFileTypes: true }).filter(d => d.isDirectory());
for (const dirent of dirs) {
  const dir = path.join(pending, dirent.name);
  const storyFile = path.join(dir, 'story.json');
  const metaFile = path.join(dir, 'meta.json');
  const imageFile = path.join(dir, 'image.png');
  const contactFile = path.join(dir, 'contact-sheet.png');
  const promptFile = path.join(dir, 'prompt.txt');
  for (const file of [storyFile, metaFile, imageFile, contactFile, promptFile]) {
    if (!fs.existsSync(file)) fail(`${dirent.name}: missing ${path.basename(file)}`);
  }
  if (!fs.existsSync(storyFile) || !fs.existsSync(metaFile) || !fs.existsSync(imageFile)) continue;

  const story = readJson(storyFile);
  const meta = readJson(metaFile);
  if (meta.status !== 'pending_review') fail(`${dirent.name}: meta.status must be pending_review`);
  if (meta.slug !== dirent.name) fail(`${dirent.name}: meta.slug mismatch`);
  if (!story.image || !story.image.startsWith('story-assets/')) fail(`${dirent.name}: story.image must point at story-assets/`);
  if (!Array.isArray(story.pool_focuses) || !story.pool_focuses.length) fail(`${dirent.name}: missing pool_focuses`);
  const pickText = pickTypeText(story);
  if (!/picked \{team\} to (win the World Cup|top the group)/i.test(pickText)) {
    fail(`${dirent.name}: pool_focuses must explicitly name the pick type`);
  }
  const fallback = `${story.he && story.he.caption || ''} ${story.en && story.en.caption || ''}`;
  if (/makes noise with .* One match, and the table already looks different/i.test(fallback)) {
    fail(`${dirent.name}: fallback caption is a reused generic template`);
  }
  const dims = pngDimensions(imageFile);
  if (dims.width !== 941 || dims.height !== 1672) fail(`${dirent.name}: image dimensions are ${dims.width}x${dims.height}, expected 941x1672`);
}

if (failures) process.exit(1);
console.log(`world cup story review drafts validated: ${dirs.length}`);
