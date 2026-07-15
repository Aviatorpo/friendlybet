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

process.env.WC_STORY_MATCH_SOURCE = process.env.WC_STORY_MATCH_SOURCE || 'snapshot';

const {
  ROOT,
  OUTCOME_BASE_DIR,
  STORIES_PATH,
  readJson,
  loadMatchesPayload,
  teamName,
  matchKey,
  outcomeFor,
  outcomeBaseSlug,
} = require('./generate-world-cup-stories');

const LIMIT = Number(process.env.WC_STORY_PREBUILD_LIMIT || 0);
const GENERATE = process.env.WC_STORY_PREBUILD_GENERATE !== '0';
const PROMPT_INDEX = path.join(OUTCOME_BASE_DIR, 'prompt-index.json');
const PROMPT_OVERRIDES = path.join(OUTCOME_BASE_DIR, 'prompt-overrides.json');

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
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

function localOutcomeBasePrompt(match, outcome) {
  const outcomeText = outcome === 'DRAW'
    ? `${teamName(match.home_team_code)} and ${teamName(match.away_team_code)} draw`
    : `${teamName(outcome)} advances over ${teamName(outcome === match.home_team_code ? match.away_team_code : match.home_team_code)}`;
  return [
    'LOCAL_DETERMINISTIC_OUTCOME_BASE',
    `Match context: ${teamName(match.home_team_code)} vs ${teamName(match.away_team_code)} at FIFA World Cup 2026.`,
    `Prepared outcome: ${outcomeText}.`,
    'Generated locally from FriendlyBet deterministic templates; no OpenAI/API image generation is used.',
    'The exact score and result title will be added later by deterministic rendering after the match.',
  ].join('\n');
}

function loadPromptOverrides() {
  const payload = readJson(PROMPT_OVERRIDES, { prompts: [] });
  return Array.isArray(payload.prompts)
    ? payload.prompts.filter(item => item && item.image && item.prompt)
    : [];
}

function promptKey(item) {
  return `${String(item.image || '').replace(/\\/g, '/')}::${String(item.outcome || '')}`;
}

function mergePromptOverrides(prompts) {
  const byKey = new Map();
  for (const item of prompts) byKey.set(promptKey(item), item);
  for (const override of loadPromptOverrides()) {
    const normalized = {
      ...override,
      image: String(override.image || '').replace(/\\/g, '/'),
      prompt: Array.isArray(override.prompt)
        ? override.prompt.join('\n')
        : String(override.prompt || ''),
    };
    const key = promptKey(normalized);
    byKey.set(key, {
      ...(byKey.get(key) || {}),
      ...normalized,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const aDate = new Date(a.match_date || 0).getTime();
    const bDate = new Date(b.match_date || 0).getTime();
    if (aDate !== bDate) return aDate - bDate;
    return String(a.match_key || '').localeCompare(String(b.match_key || ''))
      || String(a.outcome || '').localeCompare(String(b.outcome || ''));
  });
}

function isRelevantMatch(match) {
  if (!hasKnownTeams(match)) return false;
  const status = String(match.status || '').toUpperCase();
  if (status === 'CANCELLED') return false;
  if (status === 'FINISHED') return Boolean(outcomeFor(match));
  return true;
}

function possibleOutcomes(match) {
  if (String(match.status || '').toUpperCase() === 'FINISHED') {
    const outcome = outcomeFor(match);
    return outcome ? [outcome] : [];
  }
  const knockout = String(match.stage || '').toUpperCase() !== 'GROUP_STAGE';
  return knockout
    ? [match.home_team_code, match.away_team_code]
    : [match.home_team_code, match.away_team_code, 'DRAW'];
}

async function main() {
  const payload = await loadMatchesPayload();
  const stories = readJson(STORIES_PATH, { items: [] });
  const matchesWithStories = new Set((stories.items || []).map(story => story && story.match_id).filter(Boolean));
  const matches = (payload.matches || [])
    .filter(isRelevantMatch)
    .filter(match => !matchesWithStories.has(match.id))
    .sort((a, b) => new Date(a.match_date || 0) - new Date(b.match_date || 0));

  mkdirp(OUTCOME_BASE_DIR);
  const promptIndex = [];
  let generated = 0;
  let skipped = 0;

  for (const match of matches) {
    for (const outcome of possibleOutcomes(match)) {
      const slug = outcomeBaseSlug(match, outcome);
      const output = path.join(OUTCOME_BASE_DIR, slug);
      const prompt = localOutcomeBasePrompt(match, outcome);
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

      if (!GENERATE) continue;

      renderLocalOutcomeBase(match, outcome, output);
      generated++;
      console.log(`Generated outcome base ${path.relative(ROOT, output).replace(/\\/g, '/')}`);
    }
  }

  const mergedPromptIndex = mergePromptOverrides(promptIndex);
  const matchCount = new Set(mergedPromptIndex.map(item => item.match_id || item.match_key).filter(Boolean)).size;

  fs.writeFileSync(PROMPT_INDEX, JSON.stringify({
    updated_at: new Date().toISOString(),
    source: `${payload.source || 'snapshot'}+overrides`,
    matches: matchCount,
    prompts: mergedPromptIndex,
  }, null, 2) + '\n');

  const needed = promptIndex.length - skipped - generated;
  console.log(`World Cup story outcome bases: matches=${matches.length}, prompts=${promptIndex.length}, overrides=${mergedPromptIndex.length - promptIndex.length}, generated=${generated}, existing=${skipped}, remaining=${needed}`);
  if (needed > 0 && !GENERATE) {
    console.log('Local image generation is disabled; only the prompt index was written.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
