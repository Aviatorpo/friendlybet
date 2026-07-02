#!/usr/bin/env node
/*
 * Cheap preflight for Actions: decide whether the current finished matches need
 * story publishing work before installing image tooling or calling OpenAI.
 */

const fs = require('fs');
const path = require('path');

process.env.WC_STORY_MATCH_SOURCE = process.env.WC_STORY_MATCH_SOURCE || 'snapshot';

const {
  ROOT,
  STORIES_PATH,
  MANIFEST_PATH,
  readJson,
  loadMatchesPayload,
  matchKey,
  outcomeFor,
  knownOrGeneratedAsset,
  outcomeBaseAsset,
} = require('./generate-world-cup-stories');
const {
  storyCoverageSet,
  storyCoversMatch,
} = require('./world-cup-story-coverage');

const PENDING_DIR = path.join(ROOT, 'story-review', 'pending');

function reviewSlug(match) {
  return `${String(match.match_date || '').slice(0, 10)}-${matchKey(match).toLowerCase()}`;
}

function pendingSlugs() {
  if (!fs.existsSync(PENDING_DIR)) return new Set();
  return new Set(fs.readdirSync(PENDING_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name));
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
  }
  console.log(`${name}=${value}`);
}

async function main() {
  const payload = await loadMatchesPayload();
  const manifest = readJson(MANIFEST_PATH, { version: 1, items: [] });
  const stories = readJson(STORIES_PATH, { items: [] });
  const storyCoverage = storyCoverageSet(stories.items || [], payload.matches || []);
  const pending = pendingSlugs();
  const missing = [];
  const needsPreparedAsset = [];
  const prepared = [];

  for (const match of payload.matches || []) {
    if (!match || match.status !== 'FINISHED' || match.home_score == null || match.away_score == null) continue;
    if (storyCoversMatch(storyCoverage, match)) continue;
    const outcome = outcomeFor(match);
    if (!outcome) continue;
    const slug = reviewSlug(match);
    if (pending.has(slug)) continue;
    missing.push(`${slug}:${outcome}`);
    if (knownOrGeneratedAsset(manifest, match, outcome) || outcomeBaseAsset(match, outcome)) {
      prepared.push(slug);
    } else {
      needsPreparedAsset.push(slug);
    }
  }

  setOutput('needed', prepared.length ? 'true' : 'false');
  setOutput('publishable', prepared.length ? 'true' : 'false');
  setOutput('missing_count', String(missing.length));
  setOutput('prepared_count', String(prepared.length));
  setOutput('known_count', String(prepared.length));
  setOutput('unprepared_count', String(needsPreparedAsset.length));
  setOutput('review_count', String(needsPreparedAsset.length));
  if (missing.length) console.log(`World Cup stories needed: ${missing.join(', ')}`);
  if (prepared.length) console.log(`Prepared World Cup stories ready to publish: ${prepared.join(', ')}`);
  if (needsPreparedAsset.length) {
    console.log(`World Cup stories skipped until prepared base assets exist: ${needsPreparedAsset.join(', ')}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
