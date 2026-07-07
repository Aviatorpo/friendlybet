// ============================================================
// FriendlyBet - durable live-controller state
// ============================================================
// Small shared lease/cooldown layer used by GitHub pollers and the browser
// nudge API. It keeps wake-up paths redundant without letting them become
// competing live-score writers.
// ============================================================

const crypto = require('crypto');

const DEFAULT_SUPABASE_URL = 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_URL = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
const STATE_TABLE = 'live_controller_state';
const EVENT_TABLE = 'live_controller_events';
const JOB_TABLE = 'live_match_jobs';
const DEFAULT_CONTROLLER_KEY = 'wc2026-live';

function serviceKey() {
  return process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || '';
}

function controllerStateEnabled() {
  return process.env.LIVE_CONTROLLER_STATE_ENABLED !== '0';
}

function nowDate(value) {
  return value instanceof Date ? value : new Date(value || Date.now());
}

function addMs(date, ms) {
  return new Date(date.getTime() + ms);
}

function parseTime(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : NaN;
}

function isFuture(value, nowMs) {
  const ms = parseTime(value);
  return Number.isFinite(ms) && ms > nowMs;
}

function ownerFor(source) {
  const rawSource = String(source || process.env.LIVE_CONTROLLER_SOURCE || 'live-controller').trim() || 'live-controller';
  if (process.env.GITHUB_RUN_ID) return `${rawSource}:github:${process.env.GITHUB_RUN_ID}`;
  if (process.env.VERCEL_REGION || process.env.VERCEL) return `${rawSource}:vercel`;
  return rawSource;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000, fetchImpl = globalThis.fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callSupabase(method, table, data = null, query = '', options = {}) {
  const key = options.key || serviceKey();
  if (!SUPABASE_URL || !key) throw new Error('Missing Supabase service key for live-controller state');
  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation,resolution=merge-duplicates',
      Accept: 'application/json',
    },
    body: data == null ? undefined : JSON.stringify(data),
  }, options.timeoutMs || 20000, options.fetch || globalThis.fetch);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} failed: ${res.status} - ${text.slice(0, 260)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function ensureControllerRow(options = {}) {
  const now = nowDate(options.now);
  const key = options.controllerKey || DEFAULT_CONTROLLER_KEY;
  const payload = [{
    controller_key: key,
    enabled: true,
    incident_state: 'green',
    consecutive_failures: 0,
    updated_at: now.toISOString(),
  }];
  return callSupabase('POST', STATE_TABLE, payload, '?on_conflict=controller_key', options);
}

async function readControllerState(options = {}) {
  const key = options.controllerKey || DEFAULT_CONTROLLER_KEY;
  const q = `?select=*&controller_key=eq.${encodeURIComponent(key)}&limit=1`;
  const rows = await callSupabase('GET', STATE_TABLE, null, q, options);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function notClaimed(reason, state, extra = {}) {
  return { claimed: false, reason, state: state || null, ...extra };
}

async function claimControllerLease(options = {}) {
  const requireLease = !!options.requireLease;
  if (!controllerStateEnabled()) {
    return {
      claimed: true,
      degraded: true,
      reason: 'controller_state_disabled',
      release: false,
      owner: ownerFor(options.source),
    };
  }

  if (!serviceKey()) {
    if (requireLease) return notClaimed('missing_supabase_service_key', null);
    return {
      claimed: true,
      degraded: true,
      reason: 'missing_supabase_service_key',
      release: false,
      owner: ownerFor(options.source),
    };
  }

  const now = nowDate(options.now);
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const key = options.controllerKey || DEFAULT_CONTROLLER_KEY;
  const owner = ownerFor(options.source);
  const leaseMs = options.leaseMs || 90000;
  const leaseToken = options.leaseToken || crypto.randomUUID();
  const leaseExpiresAt = addMs(now, leaseMs).toISOString();

  try {
    await ensureControllerRow({ ...options, now, controllerKey: key });
    const payload = {
      lease_owner: owner,
      lease_token: leaseToken,
      lease_acquired_at: nowIso,
      lease_expires_at: leaseExpiresAt,
      last_wake_at: nowIso,
      last_wake_source: String(options.source || 'unknown').slice(0, 80),
      updated_at: nowIso,
    };
    const query = [
      `?controller_key=eq.${encodeURIComponent(key)}`,
      'enabled=eq.true',
      `or=(lease_expires_at.is.null,lease_expires_at.lt.${encodeURIComponent(nowIso)})`,
      `or=(cooldown_until.is.null,cooldown_until.lt.${encodeURIComponent(nowIso)})`,
    ].join('&');
    const rows = await callSupabase('PATCH', STATE_TABLE, payload, query, options);
    if (Array.isArray(rows) && rows.length) {
      const row = rows[0];
      return {
        claimed: true,
        degraded: false,
        controllerKey: key,
        owner,
        leaseToken,
        leaseExpiresAt,
        previousFailures: Number(row.consecutive_failures || 0),
        release: true,
      };
    }

    const state = await readControllerState({ ...options, controllerKey: key });
    if (state && state.enabled === false) return notClaimed('disabled', state);
    if (state && isFuture(state.cooldown_until, nowMs)) return notClaimed('cooldown', state);
    if (state && isFuture(state.lease_expires_at, nowMs)) return notClaimed('leased', state);
    return notClaimed('not_claimed', state);
  } catch (err) {
    if (requireLease) return notClaimed('lease_error', null, { error: err.message });
    return {
      claimed: true,
      degraded: true,
      reason: `lease_error: ${err.message}`,
      release: false,
      owner,
    };
  }
}

async function recordControllerEvent(event, options = {}) {
  if (!controllerStateEnabled() || !serviceKey()) return null;
  const now = nowDate(options.now);
  const payload = [{
    controller_key: event.controllerKey || options.controllerKey || DEFAULT_CONTROLLER_KEY,
    event_at: now.toISOString(),
    source: String(event.source || options.source || 'unknown').slice(0, 80),
    event_type: String(event.eventType || event.type || 'event').slice(0, 80),
    severity: String(event.severity || 'info').slice(0, 20),
    match_id: event.matchId || null,
    external_id: event.externalId || null,
    detail: event.detail || {},
  }];
  try {
    return await callSupabase('POST', EVENT_TABLE, payload, '', options);
  } catch (err) {
    return null;
  }
}

async function releaseControllerLease(lease, result = {}, options = {}) {
  if (!lease || !lease.release || !lease.leaseToken) return null;
  const now = nowDate(options.now);
  const nowIso = now.toISOString();
  const cooldownMs = options.cooldownMs || result.cooldownMs || 45000;
  const success = result.success !== false;
  const failures = success ? 0 : Number(lease.previousFailures || 0) + 1;
  const pollResult = result.pollResult || {};
  const warning = success && (!pollResult || Number(pollResult.updated || 0) === 0);
  const payload = {
    lease_owner: null,
    lease_token: null,
    lease_acquired_at: null,
    lease_expires_at: null,
    cooldown_until: addMs(now, cooldownMs).toISOString(),
    last_provider_poll_at: nowIso,
    consecutive_failures: failures,
    incident_state: success ? (warning ? 'warning' : 'green') : (failures >= 3 ? 'critical' : 'warning'),
    updated_at: nowIso,
  };
  if (success) {
    payload.last_success_at = nowIso;
    payload.last_error_at = null;
    payload.last_error_message = null;
  } else {
    payload.last_error_at = nowIso;
    payload.last_error_message = String(result.error && result.error.message || result.error || 'unknown').slice(0, 400);
  }
  const query = `?controller_key=eq.${encodeURIComponent(lease.controllerKey || DEFAULT_CONTROLLER_KEY)}&lease_token=eq.${encodeURIComponent(lease.leaseToken)}`;
  const rows = await callSupabase('PATCH', STATE_TABLE, payload, query, options);
  await recordControllerEvent({
    controllerKey: lease.controllerKey,
    source: lease.owner,
    eventType: success ? 'poll_complete' : 'poll_failed',
    severity: success ? (warning ? 'warning' : 'info') : payload.incident_state,
    detail: {
      checked: pollResult.checked || 0,
      updated: pollResult.updated || 0,
      skipped: pollResult.skipped || 0,
      finalDetected: pollResult.finalDetected || 0,
      degraded: !!lease.degraded,
      error: payload.last_error_message || null,
    },
  }, options);
  return rows;
}

async function upsertLiveMatchJobsFromPollResult(pollResult, options = {}) {
  if (!controllerStateEnabled() || !serviceKey()) return null;
  const applied = Array.isArray(pollResult && pollResult.applied) ? pollResult.applied : [];
  const rows = applied
    .filter(item => item && item.match_id)
    .map(item => {
      const now = nowDate(options.now);
      const nowIso = now.toISOString();
      const status = String(item.status || '').toUpperCase();
      return {
        match_id: item.match_id,
        external_id: item.external_id || null,
        live_status: status || null,
        last_provider_poll_at: nowIso,
        last_success_at: nowIso,
        next_attempt_at: addMs(now, options.nextAttemptMs || 45000).toISOString(),
        cooldown_until: addMs(now, options.cooldownMs || 45000).toISOString(),
        consecutive_failures: 0,
        incident_state: status === 'FINISHED' || status === 'AWARDED' ? 'final_pending' : 'green',
        updated_at: nowIso,
      };
    });
  if (!rows.length) return null;
  return callSupabase('POST', JOB_TABLE, rows, '?on_conflict=match_id', options);
}

module.exports = {
  DEFAULT_CONTROLLER_KEY,
  claimControllerLease,
  releaseControllerLease,
  readControllerState,
  recordControllerEvent,
  upsertLiveMatchJobsFromPollResult,
  __setFetch: (fn) => { globalThis.fetch = fn; },
  __private: { isFuture, ownerFor, parseTime },
};
