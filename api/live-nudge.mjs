import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { runLivePollerWindow } = require('../scripts/live-poller.js');

const ALLOWED_ORIGINS = new Set([
  'https://friendlybet.live',
  'https://www.friendlybet.live',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]);

let testRunner = null;

function setCors(req, res) {
  const origin = req.headers && req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Live-Nudge-Token, X-FriendlyBet-Wake-Source');
  res.setHeader('Cache-Control', 'no-store');
}

function json(res, status, body) {
  res.status(status).json(body);
}

function authorized(req) {
  const token = process.env.LIVE_NUDGE_TOKEN || process.env.LIVE_CONTROLLER_NUDGE_TOKEN || '';
  if (!token) return false;
  const bearer = String((req.headers && req.headers.authorization) || '').replace(/^Bearer\s+/i, '');
  const headerToken = String((req.headers && req.headers['x-live-nudge-token']) || '');
  return bearer === token || headerToken === token;
}

function bodyObject(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  try {
    return JSON.parse(String(body));
  } catch (_) {
    return {};
  }
}

function wakeSource(req, body) {
  const header = req.headers && req.headers['x-friendlybet-wake-source'];
  const raw = body.source || header || 'browser-nudge';
  const safe = String(raw).toLowerCase().replace(/[^a-z0-9:_-]+/g, '-').slice(0, 60);
  if (safe.includes('supabase')) return 'supabase-cron';
  return safe || 'browser-nudge';
}

export function __setRunLivePollerWindow(fn) {
  testRunner = fn;
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, status: 'method_not_allowed' });
    return;
  }
  if (!authorized(req)) {
    json(res, 401, { ok: false, status: 'unauthorized' });
    return;
  }

  const body = bodyObject(req.body);
  const source = wakeSource(req, body);
  const runMs = Math.max(1000, Math.min(parseInt(process.env.LIVE_NUDGE_RUN_MS || '', 10) || 1200, 8000));
  const intervalMs = Math.max(1000, Math.min(parseInt(process.env.LIVE_NUDGE_INTERVAL_MS || '', 10) || 1000, 8000));
  const cooldownMs = Math.max(30000, Math.min(parseInt(process.env.LIVE_CONTROLLER_COOLDOWN_MS || '', 10) || 45000, 120000));

  try {
    const runner = testRunner || runLivePollerWindow;
    const result = await runner({
      source,
      intervalMs,
      runMs,
      cooldownMs,
      requireLease: true,
    });
    json(res, 200, {
      ok: true,
      status: result && result.polls > 0 ? 'accepted' : 'no_active_work',
      polls: result && result.polls || 0,
      leaseSkips: result && result.leaseSkips || 0,
      finalDetected: !!(result && result.finalDetected),
    });
  } catch (err) {
    json(res, 503, {
      ok: false,
      status: 'temporarily_unavailable',
    });
  }
}
