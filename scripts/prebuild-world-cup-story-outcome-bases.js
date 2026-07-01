#!/usr/bin/env node
/*
 * Prepare the outcome-base prompt index for every match with known teams:
 * - home team wins
 * - away team wins
 * - draw when the match can finish as a draw
 *
 * These bases intentionally contain no final score/title text. After the match,
 * scripts/generate-world-cup-stories.js picks the correct base and renders the
 * exact result title/score deterministically.
 *
 * This script intentionally does not call image-generation APIs. It renders
 * deterministic local PNG bases that can be finalized immediately after the
 * match result is known.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ROOT,
  OUTCOME_BASE_DIR,
  STAR_PROFILES,
  loadMatchesPayload,
  teamName,
  matchKey,
  outcomeBaseSlug,
  outcomeBasePrompt,
} = require('./generate-world-cup-stories');

process.env.WC_STORY_MATCH_SOURCE = process.env.WC_STORY_MATCH_SOURCE || 'snapshot';

const LIMIT = Number(process.env.WC_STORY_PREBUILD_LIMIT || 0);
const GENERATE = process.env.WC_STORY_PREBUILD_GENERATE !== '0';
const PROMPT_INDEX = path.join(OUTCOME_BASE_DIR, 'prompt-index.json');

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
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
    throw new Error(`${matchKey(match)} ${outcome}: missing approved star profiles / shirt numbers for ${missing.join(', ')}`);
  }
}

function hasKnownTeams(match) {
  return Boolean(match && match.home_team_code && match.away_team_code);
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

function renderLocalOutcomeBase(match, outcome, output) {
  runPython([
    'scripts/process-story-image.py',
    'outcome-base',
    output,
    match.home_team_code,
    match.away_team_code,
    teamName(match.home_team_code),
    teamName(match.away_team_code),
    outcome,
    teamName(outcome),
  ]);
}

function isRelevantMatch(match) {
  if (!hasKnownTeams(match)) return false;
  const status = String(match.status || '').toUpperCase();
  return status !== 'FINISHED' && status !== 'CANCELLED';
}

function possibleOutcomes(match) {
  const knockout = String(match.stage || '').toUpperCase() !== 'GROUP_STAGE';
  return knockout
    ? [match.home_team_code, match.away_team_code]
    : [match.home_team_code, match.away_team_code, 'DRAW'];
}

async function main() {
  const payload = await loadMatchesPayload();
  const matches = (payload.matches || [])
    .filter(isRelevantMatch)
    .sort((a, b) => new Date(a.match_date || 0) - new Date(b.match_date || 0));

  mkdirp(OUTCOME_BASE_DIR);
  const promptIndex = [];
  let generated = 0;
  let skipped = 0;

  for (const match of matches) {
    for (const outcome of possibleOutcomes(match)) {
      const slug = outcomeBaseSlug(match, outcome);
      const output = path.join(OUTCOME_BASE_DIR, slug);
      const prompt = outcomeBasePrompt(match, outcome);
      promptIndex.push({
        match_id: match.id,
        match_key: matchKey(match),
        match_date: match.match_date || null,
        outcome,
        image: path.relative(ROOT, output).replace(/\\/g, '/'),
        prompt,
      });

      if (fs.existsSync(output)) {
        skipped++;
        continue;
      }
      if (LIMIT && generated >= LIMIT) continue;

      if (GENERATE) assertProfiles(match, outcome);
      if (!GENERATE) continue;

      renderLocalOutcomeBase(match, outcome, output);
      generated++;
      console.log(`Generated outcome base ${path.relative(ROOT, output).replace(/\\/g, '/')}`);
    }
  }

  fs.writeFileSync(PROMPT_INDEX, JSON.stringify({
    updated_at: new Date().toISOString(),
    source: payload.source || 'snapshot',
    matches: matches.length,
    prompts: promptIndex,
  }, null, 2) + '\n');

  const needed = promptIndex.length - skipped - generated;
  console.log(`World Cup story outcome bases: matches=${matches.length}, prompts=${promptIndex.length}, generated=${generated}, existing=${skipped}, remaining=${needed}`);
  if (needed > 0 && !GENERATE) {
    console.log('Local image generation is disabled; only the prompt index was written.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
