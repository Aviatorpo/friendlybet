#!/usr/bin/env node
/*
 * Applies a reviewed Story of the World Cup draft to the public feed/assets.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ROOT,
  STORIES_PATH,
  MANIFEST_PATH,
  MATCHES_PATH,
  readJson,
  writeJsonIfChanged,
  validateStory,
} = require('./generate-world-cup-stories');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/approve-world-cup-story.js <slug>');
  process.exit(1);
}

const pendingDir = path.join(ROOT, 'story-review', 'pending', slug);
const storyPath = path.join(pendingDir, 'story.json');
const metaPath = path.join(pendingDir, 'meta.json');
const imagePath = path.join(pendingDir, 'image.png');

function die(message) {
  console.error(message);
  process.exit(1);
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function pngDimensions(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function updateManifest(story) {
  const manifest = readJson(MANIFEST_PATH, { version: 1, items: [] });
  if (!Array.isArray(manifest.items)) manifest.items = [];
  let item = manifest.items.find(entry => entry && entry.match_id === story.match_id);
  if (!item) {
    item = { match_id: story.match_id, teams: story.teams || [], outcomes: {} };
    manifest.items.push(item);
  }
  item.teams = story.teams || item.teams || [];
  item.outcomes = item.outcomes || {};
  item.outcomes[story.outcome] = story.image;
  writeJsonIfChanged(MANIFEST_PATH, manifest);
}

function updateStories(story, meta) {
  const payload = readJson(STORIES_PATH, { items: [] });
  const matchesPayload = readJson(MATCHES_PATH, { matches: [] });
  const times = new Map((matchesPayload.matches || []).map(match => [match.id, new Date(match.match_date).getTime()]));
  if (meta && meta.match_id && meta.match_date) times.set(meta.match_id, new Date(meta.match_date).getTime());
  const existing = Array.isArray(payload.items) ? payload.items.filter(item => item && item.match_id !== story.match_id) : [];
  const items = [story]
    .concat(existing)
    .sort((a, b) => (times.get(b && b.match_id) || 0) - (times.get(a && a.match_id) || 0))
    .slice(0, Number(process.env.WC_STORY_LIMIT || 24));
  writeJsonIfChanged(STORIES_PATH, { updated_at: new Date().toISOString(), items });
}

function removePendingDraft() {
  fs.rmSync(pendingDir, { recursive: true, force: true });
}

function runValidation() {
  const res = spawnSync('node', ['scripts/test-world-cup-stories.js'], { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status || 1);
}

if (!fs.existsSync(storyPath)) die(`Pending story draft not found: ${storyPath}`);
if (!fs.existsSync(metaPath)) die(`Pending story metadata not found: ${metaPath}`);
if (!fs.existsSync(imagePath)) die(`Pending story image not found: ${imagePath}`);

const story = readJson(storyPath, null);
const meta = readJson(metaPath, null);
if (!story || !story.match_id || !story.image || !story.outcome) die(`Invalid story draft: ${storyPath}`);
if (!meta || meta.status !== 'pending_review') die(`Invalid pending story metadata: ${metaPath}`);

const dims = pngDimensions(imagePath);
if (dims.width !== 941 || dims.height !== 1672) {
  die(`Pending story image has wrong dimensions ${dims.width}x${dims.height}`);
}

if (meta && meta.final_image && meta.final_image !== story.image) {
  die(`Story image mismatch: meta=${meta.final_image} story=${story.image}`);
}

const matchesPayload = readJson(MATCHES_PATH, { matches: [] });
const match = (matchesPayload.matches || []).find(item => item.id === story.match_id);
if (match) validateStory(story, match);

copyFile(imagePath, path.join(ROOT, story.image));
updateManifest(story);
updateStories(story, meta);
removePendingDraft();
runValidation();

console.log(`Approved World Cup story: ${slug}`);
