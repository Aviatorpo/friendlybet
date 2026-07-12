// Test: browser/Supabase live nudge endpoint.
// Run: node scripts/test-live-nudge-api.mjs

import handler, { __setRunLivePollerWindow } from '../api/live-nudge.mjs';

let pass = 0;
let fail = 0;
function ok(name, cond) {
  console.log(`${cond ? 'ok' : 'FAIL'}: ${name}`);
  cond ? pass++ : fail++;
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

async function call(req) {
  const res = mockRes();
  await handler({
    headers: {},
    body: {},
    ...req,
  }, res);
  return res;
}

let runnerCalls = [];
__setRunLivePollerWindow(async (opts) => {
  runnerCalls.push(opts);
  return { polls: 1, leaseSkips: 0, finalDetected: false };
});

delete process.env.LIVE_NUDGE_TOKEN;
delete process.env.LIVE_CONTROLLER_NUDGE_TOKEN;

let res = await call({
  method: 'POST',
  headers: { origin: 'https://friendlybet.live' },
  body: { source: 'browser-nudge' },
});
ok('missing token rejects public nudges', res.statusCode === 401);
ok('missing token does not run the poller', runnerCalls.length === 0);

process.env.LIVE_NUDGE_TOKEN = 'secret';

res = await call({
  method: 'OPTIONS',
  headers: { origin: 'https://friendlybet.live' },
});
ok('OPTIONS preflight succeeds', res.statusCode === 204 && res.ended);
ok('CORS allows production origin', res.headers['Access-Control-Allow-Origin'] === 'https://friendlybet.live');

res = await call({ method: 'GET' });
ok('GET is rejected', res.statusCode === 405);

res = await call({
  method: 'POST',
  headers: { origin: 'https://friendlybet.live', authorization: 'Bearer wrong' },
  body: { source: 'browser-nudge' },
});
ok('bad token is rejected when secret is configured', res.statusCode === 401);

res = await call({
  method: 'POST',
  headers: { origin: 'https://friendlybet.live', authorization: 'Bearer secret' },
  body: { source: 'browser-nudge', reason: 'stale-snapshot' },
});
ok('authorized nudge returns accepted', res.statusCode === 200 && res.body.ok === true && res.body.status === 'accepted');
ok('nudge uses the leased controller path', runnerCalls.length === 1 && runnerCalls[0].requireLease === true);
ok('nudge does not dispatch GitHub Actions', !JSON.stringify(runnerCalls[0]).includes('workflow_dispatch'));

__setRunLivePollerWindow(async () => ({ polls: 0, leaseSkips: 1, finalDetected: false }));
res = await call({
  method: 'POST',
  headers: { authorization: 'Bearer secret', 'x-friendlybet-wake-source': 'supabase-cron' },
  body: { source: 'supabase-cron' },
});
ok('cooldown/no-work response is non-fatal', res.statusCode === 200 && res.body.status === 'no_active_work');

console.log(`\nLive-nudge API tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
