#!/usr/bin/env node
/*
 * Audits prepared Story of the World Cup outcome bases.
 *
 * No image generation happens here. The script only reports whether upcoming
 * matches have all three prebuilt base PNGs: home win, away win, draw.
 */

const fs = require('fs');
const path = require('path');
const {
  ROOT,
  loadMatchesPayload,
  matchKey,
  outcomeBaseSlug,
} = require('./generate-world-cup-stories');

const LIMIT = Number(process.env.WC_STORY_BASE_AUDIT_LIMIT || 10);
const SKIP_COVERED = process.env.WC_STORY_BASE_AUDIT_SKIP_COVERED === '1';
const FROM_TIME = process.env.WC_STORY_BASE_AUDIT_FROM
  ? new Date(process.env.WC_STORY_BASE_AUDIT_FROM).getTime()
  : Date.now() - 6 * 60 * 60 * 1000;

function isGroupMatch(match) {
  return match && String(match.stage || '').toUpperCase() === 'GROUP_STAGE';
}

function isFinished(match) {
  return String(match && match.status || '').toUpperCase() === 'FINISHED';
}

function basePath(match, outcome) {
  return path.join(ROOT, 'story-assets', 'outcome-bases', outcomeBaseSlug(match, outcome));
}

function coverageFor(match) {
  const outcomes = [match.home_team_code, match.away_team_code, 'DRAW'];
  const present = [];
  const missing = [];
  for (const outcome of outcomes) {
    const image = path.relative(ROOT, basePath(match, outcome)).replace(/\\/g, '/');
    if (fs.existsSync(basePath(match, outcome))) {
      present.push({ outcome, image });
    } else {
      missing.push({ outcome, image });
    }
  }
  return { present, missing };
}

async function main() {
  const payload = await loadMatchesPayload();
  const candidates = (payload.matches || [])
    .filter(match => isGroupMatch(match) && !isFinished(match))
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

  console.log(`World Cup story base coverage (${payload.source || 'snapshot'}): ${rows.length} match(es)`);
  for (const row of rows) {
    const { match, coverage } = row;
    const key = matchKey(match);
    const date = match.match_date || 'unknown date';
    if (coverage.missing.length) {
      console.log(`MISSING ${key} ${date}`);
      for (const item of coverage.missing) console.log(`  - ${item.outcome}: ${item.image}`);
    } else {
      console.log(`READY   ${key} ${date}`);
    }
  }

  const missingCount = rows.reduce((sum, row) => sum + row.coverage.missing.length, 0);
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
