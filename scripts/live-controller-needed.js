#!/usr/bin/env node
// Cheap preflight for the long live-match controller workflow. It keeps the
// expensive long-running watcher off unless a non-terminal fixture is active or
// close enough to kickoff that the controller should stay awake.

const fs = require('fs');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const LOOKBACK_MS = (parseInt(process.env.LIVE_CONTROLLER_LOOKBACK_MINUTES || '', 10) || 240) * 60 * 1000;
const LEAD_MS = (parseInt(process.env.LIVE_CONTROLLER_LEAD_MINUTES || '', 10) || 90) * 60 * 1000;
const TERMINAL_STATUSES = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);

function setGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
}

function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function summarize(matches, nowMs) {
  const candidates = (matches || []).filter(match => {
    const status = String(match.status || '').toUpperCase();
    if (TERMINAL_STATUSES.has(status)) return false;
    const kickoff = parseTime(match.match_date);
    return Number.isFinite(kickoff) && kickoff >= nowMs - LOOKBACK_MS && kickoff <= nowMs + LEAD_MS;
  });
  return {
    needed: candidates.length > 0,
    candidates,
    detail: candidates.slice(0, 5).map(match => {
      const kickoff = parseTime(match.match_date);
      const mins = Number.isFinite(kickoff) ? Math.round((kickoff - nowMs) / 60000) : '?';
      return `${match.home_team_code || '?'}-${match.away_team_code || '?'} ${match.status || '?'} kickoff ${mins}m`;
    }).join('; '),
  };
}

async function fetchCandidateMatches(nowMs, fetchImpl = globalThis.fetch) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase URL/key missing');
  const start = new Date(nowMs - LOOKBACK_MS).toISOString();
  const end = new Date(nowMs + LEAD_MS).toISOString();
  const query = [
    'select=id,external_id,status,match_date,home_team_code,away_team_code',
    `match_date=gte.${encodeURIComponent(start)}`,
    `match_date=lte.${encodeURIComponent(end)}`,
    'order=match_date.asc,id.asc',
  ].join('&');
  const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/matches?${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res || !res.ok) {
    const text = res && typeof res.text === 'function' ? await res.text() : '';
    throw new Error(`Supabase live-controller preflight failed (${res && res.status}) ${text}`.trim());
  }
  const matches = await res.json();
  if (!Array.isArray(matches)) throw new Error('Supabase live-controller preflight returned a non-array payload');
  return matches;
}

async function run(options = {}) {
  const nowMs = options.nowMs || Date.now();
  const matches = options.matches || await fetchCandidateMatches(nowMs, options.fetch);
  return summarize(matches, nowMs);
}

if (require.main === module) {
  run().then(result => {
    setGithubOutput('needed', result.needed ? 'true' : 'false');
    setGithubOutput('candidate_count', String(result.candidates.length));
    setGithubOutput('detail', result.detail || 'none');
    console.log(JSON.stringify({
      needed: result.needed,
      candidate_count: result.candidates.length,
      detail: result.detail || 'none',
    }, null, 2));
  }).catch(err => {
    console.error(`live-controller preflight failed open: ${err.message}`);
    setGithubOutput('needed', 'true');
    setGithubOutput('candidate_count', 'unknown');
    setGithubOutput('detail', `failed open: ${err.message}`);
    console.log(JSON.stringify({ needed: true, candidate_count: 'unknown', detail: `failed open: ${err.message}` }, null, 2));
  });
} else {
  module.exports = { run, summarize, fetchCandidateMatches };
}
