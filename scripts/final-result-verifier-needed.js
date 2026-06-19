#!/usr/bin/env node
/*
 * Cheap preflight for the final-result verifier workflow.
 *
 * The expensive provider checks should run only when at least one non-terminal
 * match is old enough to plausibly need final-result recovery.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MATCHES_PATH = path.join(ROOT, 'public-data', 'matches.json');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || 'sb_publishable_Aj_p7rZjAat_-ros9gzD_g_AsPtotpU';

const TERMINAL = new Set(['FINISHED', 'AWARDED', 'CANCELLED', 'POSTPONED']);
const MIN_AGE_MINUTES = parseInt(process.env.RESULT_FALLBACK_MIN_AGE_MINUTES || '', 10) || 115;
const LOOKBACK_HOURS = parseInt(process.env.RESULT_FALLBACK_LOOKBACK_HOURS || '', 10) || 48;

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
  }
  console.log(`${name}=${value}`);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

async function fetchMatchesFromSupabase() {
  const endpoint = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/matches?select=id,external_id,status,match_date,home_team_code,away_team_code&order=match_date.asc,id.asc`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase matches preflight failed (${res.status}): ${body.slice(0, 180)}`);
  }
  const matches = await res.json();
  if (!Array.isArray(matches)) throw new Error('Supabase matches preflight returned a non-array payload');
  return { source: 'supabase', matches };
}

async function loadMatchesPayload() {
  if (process.env.RESULT_PREFLIGHT_SOURCE === 'snapshot') {
    return { source: 'snapshot', ...readJson(MATCHES_PATH, { matches: [] }) };
  }
  try {
    return await fetchMatchesFromSupabase();
  } catch (err) {
    console.warn(`Supabase preflight unavailable; falling back to snapshot: ${err.message}`);
    return { source: 'snapshot', ...readJson(MATCHES_PATH, { matches: [] }) };
  }
}

function isCandidate(match, nowMs) {
  if (!match || TERMINAL.has(String(match.status || '').toUpperCase())) return false;
  const kickoff = Date.parse(match.match_date || '');
  if (!Number.isFinite(kickoff)) return false;
  const ageMs = nowMs - kickoff;
  return ageMs >= MIN_AGE_MINUTES * 60 * 1000
    && ageMs <= LOOKBACK_HOURS * 60 * 60 * 1000;
}

async function main() {
  const nowMs = process.env.RESULT_PREFLIGHT_NOW
    ? Date.parse(process.env.RESULT_PREFLIGHT_NOW)
    : Date.now();
  if (!Number.isFinite(nowMs)) throw new Error('Invalid RESULT_PREFLIGHT_NOW');

  const payload = await loadMatchesPayload();
  const candidates = (payload.matches || []).filter(match => isCandidate(match, nowMs));
  setOutput('needed', candidates.length ? 'true' : 'false');
  setOutput('candidate_count', String(candidates.length));
  setOutput('source', payload.source || 'unknown');

  if (candidates.length) {
    console.log('Final-result verifier candidates:');
    for (const match of candidates.slice(0, 10)) {
      console.log(`- ${match.home_team_code}-${match.away_team_code} ${match.status} ${match.match_date}`);
    }
  } else {
    console.log('No final-result verifier candidates in the current match window.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
