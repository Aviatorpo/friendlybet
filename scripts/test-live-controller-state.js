// Test: durable live-controller lease/cooldown behavior.
// Run: node scripts/test-live-controller-state.js

process.env.SUPABASE_SECRET_KEY = 'test-service-key';
process.env.LIVE_CONTROLLER_STATE_ENABLED = '1';

const C = require('./live-controller-state.js');

let pass = 0;
let fail = 0;
function ok(name, cond) {
  console.log(`${cond ? 'ok' : 'FAIL'}: ${name}`);
  cond ? pass++ : fail++;
}

let stateRow = null;
const events = [];
const jobs = [];

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
    json: async () => data,
  };
}

function tableFromUrl(url) {
  const u = new URL(url);
  return u.pathname.split('/rest/v1/')[1];
}

function future(value, nowMs) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) && ms > nowMs;
}

C.__setFetch(async (url, opts = {}) => {
  const method = opts.method || 'GET';
  const table = tableFromUrl(url);
  const u = new URL(url);
  const body = opts.body ? JSON.parse(opts.body) : null;

  if (table === 'live_controller_state') {
    if (method === 'POST') {
      const row = body[0];
      stateRow = stateRow || { ...row };
      stateRow.updated_at = row.updated_at;
      return response([stateRow]);
    }
    if (method === 'GET') {
      return response(stateRow ? [stateRow] : []);
    }
    if (method === 'PATCH') {
      if (!stateRow) return response([]);
      const nowMs = Date.parse(body.lease_acquired_at || body.updated_at || '2026-07-07T00:00:00Z');
      const tokenFilter = u.searchParams.get('lease_token');
      if (tokenFilter && tokenFilter.startsWith('eq.') && stateRow.lease_token !== tokenFilter.slice(3)) {
        return response([]);
      }
      if (!tokenFilter) {
        if (stateRow.enabled === false) return response([]);
        if (future(stateRow.lease_expires_at, nowMs)) return response([]);
        if (future(stateRow.cooldown_until, nowMs)) return response([]);
      }
      stateRow = { ...stateRow, ...body };
      return response([stateRow]);
    }
  }

  if (table === 'live_controller_events' && method === 'POST') {
    events.push(...body);
    return response(body);
  }

  if (table === 'live_match_jobs' && method === 'POST') {
    jobs.push(...body);
    return response(body);
  }

  return response([]);
});

(async () => {
  const t0 = new Date('2026-07-07T12:00:00.000Z');
  const lease1 = await C.claimControllerLease({
    source: 'github-test',
    now: t0,
    leaseMs: 60000,
    cooldownMs: 45000,
    requireLease: true,
  });
  ok('first wake-up claims the controller lease', lease1.claimed && !lease1.degraded);
  ok('lease owner is recorded', stateRow.lease_owner.includes('github-test'));

  const lease2 = await C.claimControllerLease({
    source: 'browser-test',
    now: new Date('2026-07-07T12:00:10.000Z'),
    leaseMs: 60000,
    cooldownMs: 45000,
    requireLease: true,
  });
  ok('second wake-up is fenced while lease is alive', !lease2.claimed && lease2.reason === 'leased');

  await C.releaseControllerLease(lease1, {
    success: true,
    pollResult: { checked: 1, updated: 1, skipped: 0, finalDetected: 0 },
    cooldownMs: 45000,
  }, { now: new Date('2026-07-07T12:00:20.000Z') });
  ok('successful release clears the active lease', stateRow.lease_token === null && stateRow.lease_owner === null);
  ok('successful release writes cooldown', future(stateRow.cooldown_until, Date.parse('2026-07-07T12:00:30.000Z')));
  ok('poll completion is logged privately', events.some(e => e.event_type === 'poll_complete'));

  const lease3 = await C.claimControllerLease({
    source: 'supabase-test',
    now: new Date('2026-07-07T12:00:30.000Z'),
    requireLease: true,
  });
  ok('cooldown blocks immediate duplicate wake-up', !lease3.claimed && lease3.reason === 'cooldown');

  const lease4 = await C.claimControllerLease({
    source: 'supabase-test',
    now: new Date('2026-07-07T12:01:10.000Z'),
    requireLease: true,
  });
  ok('wake-up can claim after cooldown expires', lease4.claimed);

  await C.upsertLiveMatchJobsFromPollResult({
    applied: [{
      match_id: '00000000-0000-0000-0000-000000000001',
      external_id: '760201',
      status: 'IN_PLAY',
    }],
  }, { now: new Date('2026-07-07T12:01:11.000Z') });
  ok('per-match job state is written for applied live rows', jobs.length === 1 && jobs[0].live_status === 'IN_PLAY');

  await C.releaseControllerLease(lease4, {
    success: false,
    error: new Error('provider unavailable'),
    cooldownMs: 45000,
  }, { now: new Date('2026-07-07T12:01:12.000Z') });
  ok('failed release records warning state', stateRow.incident_state === 'warning' && stateRow.consecutive_failures === 1);

  console.log(`\nLive-controller state tests: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
