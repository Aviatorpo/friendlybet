#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { validatePayload } = require('./pundit-news-validate');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public-data');
const DEFAULT_RECORD = path.join(ROOT, 'tmp', `pundit-live-window-certifications-${new Date().toISOString().slice(0, 10)}.jsonl`);
const SOCIAL_AUDIT = path.join(ROOT, '.codex', 'skills', 'friendlybet-social-content-excellence', 'scripts', 'certification_audit.py');
const PRODUCTION_SOURCE_RE = /^https:\/\/friendlybet\.live\/?$/i;
const ENDING_EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?$/u;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function readJsonl(file) {
  try {
    return fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try { return JSON.parse(line); } catch (_) { return null; }
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function itemHasEndingEmoji(item) {
  return ENDING_EMOJI.test(String(item && item.he || '').trim())
    && ENDING_EMOJI.test(String(item && item.en || '').trim());
}

function auditPunditFeed(nowMs, feed) {
  const errors = [];
  const warnings = [];
  const items = Array.isArray(feed && feed.items) ? feed.items : [];
  const freshUntil = parseTime(feed && feed.freshUntil);
  const updatedAt = parseTime(feed && feed.updatedAt);

  if (!feed || !Array.isArray(feed.items)) errors.push('pundit.json is missing or invalid');
  if (!Number.isFinite(updatedAt)) errors.push('pundit.json missing valid updatedAt');
  if (!Number.isFinite(freshUntil) || freshUntil <= nowMs) errors.push('pundit.json is stale');
  if (!items.length) errors.push('pundit feed is empty');

  const missingEmoji = items.filter(item => !itemHasEndingEmoji(item)).map(item => item && item.id || '(unknown)');
  if (missingEmoji.length) errors.push(`Pundit items without ending emoji: ${missingEmoji.join(', ')}`);

  const expired = items
    .filter(item => item && item.expires_at && parseTime(item.expires_at) <= nowMs)
    .map(item => item.id || '(unknown)');
  if (expired.length) errors.push(`expired Pundit items still present: ${expired.join(', ')}`);

  if (items.length < 5) warnings.push(`pundit feed has only ${items.length} items`);
  return {
    ok: errors.length === 0,
    items: items.length,
    updatedAt: feed && feed.updatedAt,
    freshUntil: feed && feed.freshUntil,
    errors,
    warnings,
  };
}

function auditStories(matchesPayload, storiesPayload) {
  const errors = [];
  const warnings = [];
  const matches = Array.isArray(matchesPayload && matchesPayload.matches) ? matchesPayload.matches : [];
  const stories = Array.isArray(storiesPayload && storiesPayload.items) ? storiesPayload.items : [];
  const finished = matches.filter(match => ['FINISHED', 'AWARDED'].includes(String(match && match.status || '').toUpperCase()));
  const storiesByMatch = new Set(stories.map(story => String(story && story.match_id)).filter(Boolean));
  const missing = finished.filter(match => !storiesByMatch.has(String(match && match.id)));

  if (missing.length) {
    errors.push(`missing stories for finished matches: ${missing.map(match => `${match.home_team_code}-${match.away_team_code}`).join(', ')}`);
  }

  const recent = stories.slice(0, 12);
  const missingEmoji = recent.filter(story => {
    const fields = [
      story && story.he && story.he.headline,
      story && story.he && story.he.caption,
      story && story.en && story.en.headline,
      story && story.en && story.en.caption,
    ];
    return fields.some(value => value && !ENDING_EMOJI.test(String(value).trim()));
  }).map(story => story && story.id || story && story.match_id || '(unknown)');
  if (missingEmoji.length) {
    errors.push(`recent Story headline/caption fields without ending emoji: ${missingEmoji.join(', ')}`);
  }

  if (!stories.length) errors.push('world-cup-stories.json has no stories');
  if (stories.length < finished.length) warnings.push(`story count ${stories.length} is below finished match count ${finished.length}`);

  return {
    ok: errors.length === 0,
    stories: stories.length,
    finished_matches: finished.length,
    missing: missing.length,
    errors,
    warnings,
  };
}

function auditNews(nowMs, newsPayload) {
  const errors = validatePayload(newsPayload || { items: [] }, { nowMs, requireUnexpired: true });
  const items = Array.isArray(newsPayload && newsPayload.items) ? newsPayload.items : [];
  const unexpired = items.filter(item => parseTime(item && item.expires_at) > nowMs);
  const warnings = [];
  if (!items.length) warnings.push('pundit-news.json is empty; match-day desk needs a source ledger note');
  return {
    ok: errors.length === 0,
    items: items.length,
    unexpired: unexpired.length,
    errors,
    warnings,
  };
}

function targetMatch(target) {
  return String(target && target.match || '').toUpperCase();
}

function isProductionSource(source) {
  return PRODUCTION_SOURCE_RE.test(String(source || '').trim());
}

function auditLiveWindowRecords(records) {
  const errors = [];
  const warnings = [];
  const productionProof = [];
  const localProof = [];
  const failed = [];

  for (const record of records) {
    if (record && record.kind !== 'pundit_live_window_certification') continue;
    const targets = Array.isArray(record.targets) ? record.targets : [];
    if (!record.passed || Number(record.score) < 90) {
      failed.push(record);
      continue;
    }
    if (!record.proof_window) continue;
    for (const target of targets) {
      const phase = String(target && target.phase || '');
      if (phase === 'pre') continue;
      const row = {
        source: record.source || 'local',
        checked_at: record.checked_at,
        match: targetMatch(target),
        phase,
        status: target && target.status,
        score: Number(target && target.score),
      };
      if (isProductionSource(record.source)) productionProof.push(row);
      else localProof.push(row);
    }
  }

  const productionMatches = new Set(productionProof.map(row => row.match).filter(Boolean));
  if (productionMatches.size < 2) {
    errors.push(`need at least 2 different production post-kickoff/final proof windows, found ${productionMatches.size}`);
  }
  if (!records.length) errors.push('no live-window JSONL records found');
  if (failed.length) warnings.push(`${failed.length} live-window certification record(s) failed or scored below 90`);

  return {
    ok: errors.length === 0,
    record_count: records.length,
    production_proof_windows: productionMatches.size,
    production_proof: productionProof,
    local_proof: localProof,
    errors,
    warnings,
  };
}

function runSocialAudit() {
  if (!fs.existsSync(SOCIAL_AUDIT)) {
    return {
      ok: false,
      status: 'missing',
      production_ready: false,
      errors: [`missing social certification audit: ${path.relative(ROOT, SOCIAL_AUDIT)}`],
      warnings: [],
    };
  }
  const result = spawnSync('python', [SOCIAL_AUDIT], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 5,
  });
  if (result.status !== 0) {
    return {
      ok: false,
      status: 'failed',
      production_ready: false,
      errors: [String(result.stdout || result.stderr || '').trim() || `social audit exited ${result.status}`],
      warnings: [],
    };
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return {
      ok: true,
      status: parsed.status || 'unknown',
      production_ready: Boolean(parsed.production_ready),
      reason: parsed.reason || '',
      errors: [],
      warnings: parsed.production_ready ? [] : ['social/content academy is not production-ready without Eyal approval or live publish-cycle proof'],
    };
  } catch (err) {
    return {
      ok: false,
      status: 'invalid-output',
      production_ready: false,
      errors: [`cannot parse social audit output: ${err.message}`],
      warnings: [],
    };
  }
}

function parseArgs(argv) {
  const args = {
    record: DEFAULT_RECORD,
    requireTvReady: false,
    json: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--record') args.record = path.resolve(ROOT, argv[++i]);
    else if (arg === '--require-tv-ready') args.requireTvReady = true;
    else if (arg === '--json') args.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function audit(options = {}) {
  const nowMs = options.nowMs || Date.now();
  const matches = readJson(path.join(DATA_DIR, 'matches.json'), { matches: [] });
  const feed = readJson(path.join(DATA_DIR, 'pundit.json'), null);
  const stories = readJson(path.join(DATA_DIR, 'world-cup-stories.json'), { items: [] });
  const news = readJson(path.join(DATA_DIR, 'pundit-news.json'), { items: [] });
  const records = readJsonl(options.record || DEFAULT_RECORD);

  const sections = {
    pundit_feed: auditPunditFeed(nowMs, feed),
    stories: auditStories(matches, stories),
    news: auditNews(nowMs, news),
    live_windows: auditLiveWindowRecords(records),
    social_content_academy: runSocialAudit(),
  };

  const hardErrors = Object.values(sections).flatMap(section => section.errors || []);
  const warnings = Object.values(sections).flatMap(section => section.warnings || []);
  const productionReady = hardErrors.length === 0 && sections.social_content_academy.production_ready;
  const status = productionReady
    ? 'production-ready'
    : hardErrors.length === 0
      ? 'calibrating-with-live-proof'
      : 'calibrating';

  return {
    kind: 'pundit_academy_audit',
    checked_at: new Date(nowMs).toISOString(),
    status,
    production_ready: productionReady,
    record: path.relative(ROOT, options.record || DEFAULT_RECORD),
    sections,
    errors: hardErrors,
    warnings,
  };
}

function printReport(report) {
  console.log(`Pundit academy audit: status=${report.status} production_ready=${report.production_ready}`);
  console.log(`checked_at=${report.checked_at}`);
  console.log(`record=${report.record}`);
  console.log(`pundit=${report.sections.pundit_feed.items} items freshUntil=${report.sections.pundit_feed.freshUntil}`);
  console.log(`stories=${report.sections.stories.stories}/${report.sections.stories.finished_matches} finished covered`);
  console.log(`news=${report.sections.news.items} items, unexpired=${report.sections.news.unexpired}`);
  console.log(`production proof windows=${report.sections.live_windows.production_proof_windows}`);
  console.log(`social academy=${report.sections.social_content_academy.status}, production_ready=${report.sections.social_content_academy.production_ready}`);
  report.errors.forEach(error => console.log(`ERROR: ${error}`));
  report.warnings.forEach(warning => console.log(`warning: ${warning}`));
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv);
    const report = audit({ record: args.record });
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else printReport(report);
    if (args.requireTvReady && !report.production_ready) process.exit(1);
    if (report.errors.length) process.exit(1);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
} else {
  module.exports = {
    audit,
    auditLiveWindowRecords,
    auditPunditFeed,
    auditStories,
    auditNews,
  };
}
