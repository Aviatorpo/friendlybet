#!/usr/bin/env node
/*
 * Audits prepared Story of the World Cup outcome bases.
 *
 * No image generation happens here. The script only reports whether upcoming
 * matches have prebuilt base PNGs for each possible outcome.
 */

const fs = require('fs');
const path = require('path');

process.env.WC_STORY_MATCH_SOURCE = process.env.WC_STORY_MATCH_SOURCE || 'snapshot';

const {
  ROOT,
  loadMatchesPayload,
  matchKey,
  outcomeBaseSlug,
} = require('./generate-world-cup-stories');

const LIMIT = Number(process.env.WC_STORY_BASE_AUDIT_LIMIT || 10);
const MIN_BASE_IMAGE_BYTES = 500000;
const PROMPT_OVERRIDES_PATH = path.join(ROOT, 'story-assets', 'outcome-bases', 'prompt-overrides.json');
const SKIP_COVERED = process.env.WC_STORY_BASE_AUDIT_SKIP_COVERED === '1';
const FROM_TIME = process.env.WC_STORY_BASE_AUDIT_FROM
  ? new Date(process.env.WC_STORY_BASE_AUDIT_FROM).getTime()
  : Date.now() - 6 * 60 * 60 * 1000;

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function hasKnownTeams(match) {
  return Boolean(match && match.home_team_code && match.away_team_code);
}

function isFinished(match) {
  return String(match && match.status || '').toUpperCase() === 'FINISHED';
}

function basePath(match, outcome) {
  return path.join(ROOT, 'story-assets', 'outcome-bases', outcomeBaseSlug(match, outcome));
}

function baseStatus(image, absolutePath) {
  if (!fs.existsSync(absolutePath)) return { ok: false, image, reason: 'missing' };
  const bytes = fs.statSync(absolutePath).size;
  if (bytes < MIN_BASE_IMAGE_BYTES) {
    return { ok: false, image, reason: `too small (${bytes} bytes)` };
  }
  return { ok: true, image, bytes };
}

function coverageFor(match) {
  const knockout = String(match.stage || '').toUpperCase() !== 'GROUP_STAGE';
  const outcomes = knockout
    ? [match.home_team_code, match.away_team_code]
    : [match.home_team_code, match.away_team_code, 'DRAW'];
  const present = [];
  const missing = [];
  for (const outcome of outcomes) {
    const image = path.relative(ROOT, basePath(match, outcome)).replace(/\\/g, '/');
    const status = baseStatus(image, basePath(match, outcome));
    if (status.ok) {
      present.push({ outcome, image, bytes: status.bytes });
    } else {
      missing.push({ outcome, image, reason: status.reason });
    }
  }
  return { present, missing };
}

function overrideRows() {
  const payload = readJson(PROMPT_OVERRIDES_PATH, { prompts: [] });
  const prompts = Array.isArray(payload.prompts) ? payload.prompts : [];
  const rows = [];
  for (const item of prompts) {
    const time = new Date(item.match_date || 0).getTime();
    if (!Number.isFinite(time) || time < FROM_TIME) continue;
    const image = String(item.image || '').replace(/\\/g, '/');
    if (!image) continue;
    const absolutePath = path.join(ROOT, image);
    const status = baseStatus(image, absolutePath);
    rows.push({ item, status });
  }
  return rows.sort((a, b) => {
    const aDate = new Date(a.item.match_date || 0).getTime();
    const bDate = new Date(b.item.match_date || 0).getTime();
    if (aDate !== bDate) return aDate - bDate;
    return String(a.item.match_key || '').localeCompare(String(b.item.match_key || ''))
      || String(a.item.outcome || '').localeCompare(String(b.item.outcome || ''));
  });
}

async function main() {
  const payload = await loadMatchesPayload();
  const candidates = (payload.matches || [])
    .filter(match => hasKnownTeams(match) && !isFinished(match))
    .filter(match => {
      const time = new Date(match.match_date || 0).getTime();
      return Number.isFinite(time) && time >= FROM_TIME;
    })
    .sort((a, b) => new Date(a.match_date || 0) - new Date(b.match_date || 0));

  const rows = [];
  for (const match of candidates) {
    const coverage = coverageFor(match);
    if (SKIP_COVERED && coverage.missing.length === 0) continue;
    rows.push({ match, coverage });
    if (LIMIT && rows.length >= LIMIT) break;
  }

  const overrides = overrideRows();

  console.log(`World Cup story base coverage (${payload.source || 'snapshot'}): ${rows.length} match(es), ${overrides.length} override scenario(s)`);
  for (const row of rows) {
    const { match, coverage } = row;
    const key = matchKey(match);
    const date = match.match_date || 'unknown date';
    if (coverage.missing.length) {
      console.log(`MISSING ${key} ${date}`);
      for (const item of coverage.missing) console.log(`  - ${item.outcome}: ${item.image} (${item.reason})`);
    } else {
      console.log(`READY   ${key} ${date}`);
    }
  }

  for (const row of overrides) {
    const key = row.item.match_key || 'override';
    const date = row.item.match_date || 'unknown date';
    const outcome = row.item.outcome || 'unknown';
    if (row.status.ok) {
      console.log(`READY   ${key} ${date} ${outcome}: ${row.status.image}`);
    } else {
      console.log(`MISSING ${key} ${date} ${outcome}: ${row.status.image} (${row.status.reason})`);
    }
  }

  const missingCount = rows.reduce((sum, row) => sum + row.coverage.missing.length, 0)
    + overrides.filter(row => !row.status.ok).length;
  if (missingCount) {
    console.log(`Missing base PNGs: ${missingCount}`);
    process.exitCode = 1;
  } else {
    console.log('All audited matches have prepared bases.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
