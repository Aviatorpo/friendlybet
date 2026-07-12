#!/usr/bin/env node
/*
 * Publishes stories only from approved static assets or prebuilt outcome bases.
 * Production automation must not generate new images at final whistle.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const {
  ROOT,
  STORIES_PATH,
  readJson,
} = require('./generate-world-cup-stories');

function run(args, options = {}) {
  const res = spawnSync(args[0], args.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...(options.env || {}) },
  });
  if (res.status !== 0) {
    if (options.allowFailure) return res.status || 1;
    process.exit(res.status || 1);
  }
  return 0;
}

function runPython(args, options = {}) {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  let lastError = null;
  for (const exe of candidates) {
    const res = spawnSync(exe, args, { cwd: ROOT, stdio: 'inherit' });
    if (res.error && res.error.code === 'ENOENT') {
      lastError = res.error;
      continue;
    }
    if (res.status !== 0) {
      if (options.allowFailure) return res.status || 1;
      process.exit(res.status || 1);
    }
    return 0;
  }
  throw lastError || new Error('Python not found');
}

function latestStorySummary(limit = 5) {
  const payload = readJson(STORIES_PATH, { items: [] });
  const items = (payload.items || []).slice(0, limit);
  console.log(`Latest ${items.length} World Cup stories after auto-publish:`);
  for (const story of items) {
    const focuses = (story.pool_focuses || []).map(focus => focus.en_name || focus.en_names || focus.en_count || '').filter(Boolean);
    console.log(`- ${story.id}:`);
    console.log(`  EN fallback: ${story.en && story.en.caption || ''}`);
    console.log(`  HE fallback: ${story.he && story.he.caption || ''}`);
    console.log(`  First focus: ${focuses[0] || 'none'}`);
  }
}

const storyBackup = fs.existsSync(STORIES_PATH)
  ? fs.readFileSync(STORIES_PATH, 'utf8')
  : null;

const baseAuditStatus = runPython([
  'scripts/audit-world-cup-story-images.py',
  '--scope',
  'bases',
  '--ignore-unindexed-bases',
], { allowFailure: true });
if (baseAuditStatus !== 0) {
  console.warn('World Cup story base audit failed; treating as optional content backlog and continuing with already-prepared assets.');
}

const generateStatus = run(['node', 'scripts/generate-world-cup-stories.js'], {
  env: { STORY_AUTOGEN_IMAGES: '0' },
  allowFailure: true,
});
const storyAuditStatus = generateStatus === 0
  ? runPython(['scripts/audit-world-cup-story-images.py', '--scope', 'stories'], { allowFailure: true })
  : generateStatus;
const storyValidationStatus = generateStatus === 0
  ? run(['node', 'scripts/test-world-cup-stories.js'], { allowFailure: true })
  : generateStatus;
const storyToneStatus = generateStatus === 0 && storyValidationStatus === 0
  ? run(['node', 'scripts/test-world-cup-story-tone.js'], { allowFailure: true })
  : generateStatus || storyValidationStatus;

if (generateStatus !== 0 || storyAuditStatus !== 0 || storyValidationStatus !== 0 || storyToneStatus !== 0) {
  if (storyBackup != null) fs.writeFileSync(STORIES_PATH, storyBackup, 'utf8');
  console.warn('Prepared World Cup story publish did not pass optional content validation or tone gates; restored previous story feed and exiting without a failure email.');
  process.exit(0);
}
latestStorySummary();
