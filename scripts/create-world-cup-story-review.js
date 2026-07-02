#!/usr/bin/env node
/*
 * Creates review-only Story of the World Cup drafts for newly finished matches.
 * Nothing produced by this script is published until approve-world-cup-story.js runs.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ROOT,
  STORIES_PATH,
  STAR_PROFILES,
  readJson,
  writeJsonIfChanged,
  loadMatchesPayload,
  matchKey,
  outcomeFor,
  assetSlug,
  buildStory,
  validateStory,
  imagePrompt,
  requestImageBuffer,
} = require('./generate-world-cup-stories');
const {
  storyCoverageSet,
  storyCoversMatch,
} = require('./world-cup-story-coverage');

const REVIEW_ROOT = path.join(ROOT, 'story-review');
const PENDING_DIR = path.join(REVIEW_ROOT, 'pending');
const CREATED_PATH = path.join(ROOT, '_story_review_created.json');
const LIMIT = Math.max(1, Number(process.env.WC_STORY_REVIEW_LIMIT || 1));

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function runPython(args) {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  let last = null;
  for (const exe of candidates) {
    const res = spawnSync(exe, args, { cwd: ROOT, stdio: 'inherit' });
    if (res.error && res.error.code === 'ENOENT') {
      last = res.error;
      continue;
    }
    if (res.status !== 0) throw new Error(`${exe} ${args.join(' ')} failed with status ${res.status}`);
    return;
  }
  throw last || new Error('Python not found');
}

function pngDimensions(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function reviewSlug(match) {
  return `${String(match.match_date || '').slice(0, 10)}-${matchKey(match).toLowerCase()}`;
}

function existingPendingSlugs() {
  if (!fs.existsSync(PENDING_DIR)) return new Set();
  return new Set(fs.readdirSync(PENDING_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name));
}

function requiredProfileCodes(match, outcome) {
  if (outcome === 'DRAW') return [match.home_team_code, match.away_team_code];
  const loser = outcome === match.home_team_code ? match.away_team_code : match.home_team_code;
  return [outcome, loser];
}

function assertProfiles(match, outcome) {
  const missing = requiredProfileCodes(match, outcome).filter(code => {
    const profile = STAR_PROFILES[code];
    return !profile || !profile.player || !profile.number || profile.number === 'current';
  });
  if (missing.length) {
    throw new Error(`${matchKey(match)} is missing approved star profiles / shirt numbers for: ${missing.join(', ')}`);
  }
}

function assertCopyQuality(story) {
  const focuses = Array.isArray(story.pool_focuses) ? story.pool_focuses : [];
  if (!focuses.length) throw new Error(`${story.id}: missing pool_focuses`);
  const text = focuses.map(f => [f.en_name, f.en_names, f.en_count].join(' ')).join(' ');
  if (!/picked \{team\} to (win the World Cup|top the group)/i.test(text)) {
    throw new Error(`${story.id}: pool_focuses must name the exact pick type`);
  }
  const fallback = `${story.he && story.he.caption || ''} ${story.en && story.en.caption || ''}`;
  if (/makes noise with .* One match, and the table already looks different/i.test(fallback)) {
    throw new Error(`${story.id}: fallback caption is a reused generic template`);
  }
}

async function createDraft(match) {
  const outcome = outcomeFor(match);
  if (!outcome) throw new Error(`${matchKey(match)} has no usable outcome`);
  assertProfiles(match, outcome);

  const slug = reviewSlug(match);
  const draftDir = path.join(PENDING_DIR, slug);
  const rawPath = path.join(draftDir, 'raw.png');
  const imagePath = path.join(draftDir, 'image.png');
  const contactPath = path.join(draftDir, 'contact-sheet.png');
  const promptPath = path.join(draftDir, 'prompt.txt');
  const storyPath = path.join(draftDir, 'story.json');
  const metaPath = path.join(draftDir, 'meta.json');

  if (fs.existsSync(storyPath)) {
    console.log(`Review draft already exists for ${slug}`);
    return { slug, draftDir, created: false };
  }

  const prompt = imagePrompt(match, outcome);
  const buffer = await requestImageBuffer(prompt, `${matchKey(match)} review`);
  if (!buffer) throw new Error(`Image generation unavailable for ${matchKey(match)}`);

  mkdirp(draftDir);
  fs.writeFileSync(promptPath, prompt + '\n', 'utf8');
  fs.writeFileSync(rawPath, buffer);

  runPython(['scripts/process-story-image.py', 'watermark', rawPath, imagePath]);
  runPython(['scripts/process-story-image.py', 'contact-sheet', contactPath, imagePath]);

  const dims = pngDimensions(imagePath);
  if (dims.width !== 941 || dims.height !== 1672) {
    throw new Error(`${slug}: processed image has wrong dimensions ${dims.width}x${dims.height}`);
  }

  const image = path.join('story-assets', assetSlug(match, outcome)).replace(/\\/g, '/');
  const story = buildStory(match, image, outcome);
  validateStory(story, match);
  assertCopyQuality(story);

  const meta = {
    slug,
    status: 'pending_review',
    created_at: new Date().toISOString(),
    match_id: match.id,
    external_id: match.external_id || null,
    match_date: match.match_date,
    teams: [match.home_team_code, match.away_team_code],
    result: story.result,
    outcome,
    review_image: path.relative(ROOT, imagePath).replace(/\\/g, '/'),
    contact_sheet: path.relative(ROOT, contactPath).replace(/\\/g, '/'),
    final_image: image,
    prompt: path.relative(ROOT, promptPath).replace(/\\/g, '/'),
  };
  writeJsonIfChanged(storyPath, story);
  writeJsonIfChanged(metaPath, meta);
  console.log(`Created review draft ${slug}`);
  return { slug, draftDir, created: true };
}

async function main() {
  const payload = await loadMatchesPayload();
  console.log(`Story review match source: ${payload.source || 'snapshot'} (${(payload.matches || []).length} matches)`);

  if (!process.env.OPENAI_API_KEY) {
    console.log('No OPENAI_API_KEY; skipping World Cup story review draft generation.');
    return;
  }

  const stories = readJson(STORIES_PATH, { items: [] });
  const storyCoverage = storyCoverageSet(stories.items || [], payload.matches || []);
  const pending = existingPendingSlugs();
  const finished = (payload.matches || [])
    .filter(match => match && match.status === 'FINISHED' && match.home_score != null && match.away_score != null)
    .sort((a, b) => new Date(b.match_date) - new Date(a.match_date));

  const created = [];
  const blocked = [];
  for (const match of finished) {
    if (created.length >= LIMIT) break;
    if (storyCoversMatch(storyCoverage, match)) continue;
    const outcome = outcomeFor(match);
    if (!outcome) continue;
    const slug = reviewSlug(match);
    if (pending.has(slug)) continue;
    try {
      const draft = await createDraft(match);
      created.push(draft);
    } catch (err) {
      if (err && /missing approved star profiles/i.test(String(err.message || err))) {
        const reason = String(err.message || err);
        console.warn(`Blocked story review for ${slug}: ${reason}`);
        blocked.push({ slug, match_id: match.id, reason });
        continue;
      }
      throw err;
    }
  }

  mkdirp(REVIEW_ROOT);
  writeJsonIfChanged(CREATED_PATH, {
    updated_at: new Date().toISOString(),
    created: created.map(item => ({ slug: item.slug, draft_dir: path.relative(ROOT, item.draftDir).replace(/\\/g, '/') })),
    blocked,
  });

  if (created.length) {
    console.log(`Created ${created.length} story review draft(s).`);
  } else {
    console.log('No story review drafts needed.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
