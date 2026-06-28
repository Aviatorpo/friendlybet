#!/usr/bin/env node
// Condense live readiness/audit JSON into an operator-facing status note.

const fs = require('fs');

function readInput(arg) {
  if (arg && arg !== '-') return fs.readFileSync(arg, 'utf8');
  return fs.readFileSync(0, 'utf8');
}

function parsePayload(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      checked_at: new Date().toISOString(),
      parse_error: err.message,
      raw: String(text || '').slice(0, 1200),
    };
  }
}

function detail(value, fallback = 'n/a') {
  return value == null || value === '' ? fallback : String(value);
}

function formatList(items, empty) {
  if (!items || !items.length) return [`- ${empty}`];
  return items.slice(0, 8).map(item => `- ${item}`);
}

function summarizeChecks(payload) {
  const checks = Array.isArray(payload.checks) ? payload.checks : [];
  return checks
    .filter(check => !check.ok)
    .map(check => `${check.name}: ${detail(check.detail, 'no detail')}`);
}

function summarizeWarnings(payload) {
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  const structured = warnings.map(warning => {
    if (typeof warning === 'string') return warning;
    return `${warning.code || 'warning'}: ${warning.message || warning.detail || 'no detail'}`;
  });
  const watchdog = payload.watchdog || (payload.audit && payload.audit.watchdog) || {};
  const watchdogWarnings = Array.isArray(watchdog.warnings)
    ? watchdog.warnings.map(warning => `watchdog: ${warning}`)
    : [];
  return [...structured, ...watchdogWarnings];
}

function actionForFailure(failure) {
  if (/result-recovery|final/i.test(failure)) {
    return 'Run or inspect final-result-verifier/manual-match-results, then re-fetch production public-data.';
  }
  if (/scoring|leaderboard|snapshot/i.test(failure)) {
    return 'Run Calculate User Scores (v2), verify scoring snapshots, and confirm production public-data.';
  }
  if (/live DB|active match|poller/i.test(failure)) {
    return 'Inspect live-poller, run one safe recovery pass if active state is stale, then rerun readiness.';
  }
  if (/Pundit|stories|story/i.test(failure)) {
    return 'Treat as content incident unless result/scoring is also red; refresh Stories/Pundit separately.';
  }
  if (/version/i.test(failure)) {
    return 'Align config.js, service-worker.js, and index.html footer versions before app release.';
  }
  return 'Open the failed GitHub Actions run and inspect the named check.';
}

function firstDistinct(items) {
  return [...new Set(items.filter(Boolean))];
}

function summarize(payload) {
  if (payload.parse_error) {
    return [
      '# FriendlyBet Ops Status',
      '',
      'Status: CRITICAL - readiness output was not valid JSON',
      `Checked at: ${payload.checked_at}`,
      '',
      'Next action:',
      '- Open the GitHub Actions run and inspect the raw failing step.',
      '',
      'Raw output:',
      '```',
      payload.raw || '',
      '```',
    ].join('\n');
  }

  const failures = summarizeChecks(payload);
  const warnings = summarizeWarnings(payload);
  const audit = payload.audit || payload;
  const resultRecovery = (payload.live_db && payload.live_db.result_recovery) || audit.result_recovery || {};
  const stories = audit.stories || {};
  const pundit = audit.pundit || {};
  const liveDbFreshness = payload.live_db && payload.live_db.freshness;
  const production = payload.production || null;

  const status = payload.ok ? 'GREEN' : 'CRITICAL';
  const lines = [
    '# FriendlyBet Ops Status',
    '',
    `Status: ${status}`,
    `Checked at: ${detail(payload.checked_at)}`,
    '',
    'User-path evidence:',
    `- Result recovery candidates: ${detail(resultRecovery.candidates, 0)}`,
    `- Completed groups: ${detail(audit.completed_groups || payload.completed_groups)}`,
    `- Missing Stories: ${detail(stories.missing, 0)}`,
    `- Pundit fresh: ${pundit.fresh === true ? 'yes' : pundit.fresh === false ? 'no' : 'unknown'}`,
  ];

  if (liveDbFreshness) {
    lines.push(`- Live DB active/stale: ${liveDbFreshness.active}/${liveDbFreshness.stale}`);
  }
  if (production) {
    lines.push(`- Production public audit: ${production.audit_ok === true ? 'green' : production.audit_ok === false ? 'red' : 'unknown'}`);
  }

  lines.push('', 'Critical failures:');
  lines.push(...formatList(failures, 'None'));

  lines.push('', 'Warnings:');
  lines.push(...formatList(warnings, 'None').slice(0, 10));

  const nextActions = payload.ok
    ? ['No user-path action needed. Track warnings as separate content/ops backlog.']
    : firstDistinct(failures.map(actionForFailure));
  lines.push('', 'Next action:');
  lines.push(...formatList(nextActions, 'None'));

  return lines.join('\n');
}

if (require.main === module) {
  try {
    const payload = parsePayload(readInput(process.argv[2]));
    console.log(summarize(payload));
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
} else {
  module.exports = { parsePayload, summarize };
}
