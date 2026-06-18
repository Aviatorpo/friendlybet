// ============================================================
// FriendlyBet - Live Match Poller (near-real-time)
// ============================================================
// GitHub Actions scheduled cron is too coarse (>=5 min, and jittery) for live
// scores. This poller runs while a match is live and refreshes the Supabase
// `matches` table every ~60s for the run window, so the DB is ~60s fresh during
// play. Consecutive scheduled launches chain together for continuous coverage.
//
// IMPORTANT: it writes ONLY to the DB - it never commits the CDN snapshot, so it
// adds ZERO Vercel deployments. The client reads live scores straight from the
// DB during live play (see app.js loadMatches), so 60s DB freshness == ~60s
// on-screen freshness, with no deploy-per-update and no Vercel-plan pressure.
//
// ESPN is the only live provider. If it is unavailable, the final-result
// verifier later confirms finished results with ESPN + FIFA before writing.
// ============================================================

const sync = require('./smart-sync.js');
const espn = require('./espn-live-sync.js');

async function runLivePoller(opts = {}) {
  const intervalMs = opts.intervalMs || 60000;          // poll cadence during live
  const runMs      = opts.runMs || 270000;              // ~4.5 min, just under the */5 cron
  const now        = opts.now || (() => Date.now());
  const sleep      = opts.sleep || ((ms) => new Promise(r => setTimeout(r, ms)));

  if (!(await sync.shouldSync())) {
    console.log('No active match right now - live-poller exiting.');
    return 0;
  }

  const end = now() + runMs;
  let polls = 0;
  while (true) {
    try {
      const result = await espn.syncEspnLive(); // ESPN -> DB (score + provider clock)
      if (!result || result.updated === 0) {
        console.warn('ESPN live sync updated no matches - leaving result unchanged until the next ESPN/FIFA check.');
      }
      polls++;
    } catch (e) {
      console.error('ESPN live poll failed (will retry next tick):', e.message);
    }
    if (now() + intervalMs >= end) break;
    await sleep(intervalMs);
    // Stop early the moment nothing is live anymore (saves API calls / minutes).
    if (!(await sync.shouldSync())) {
      console.log('No active match anymore - live-poller exiting.');
      break;
    }
  }
  console.log(`live-poller done: ${polls} poll(s) this run.`);
  return polls;
}

if (require.main === module) {
  runLivePoller({
    intervalMs: parseInt(process.env.LIVE_POLL_INTERVAL_MS || '', 10) || 60000,
    runMs:      parseInt(process.env.LIVE_POLL_RUN_MS || '', 10) || 270000,
  }).then(() => process.exit(0)).catch(e => { console.error('fatal:', e); process.exit(1); });
} else {
  module.exports = { runLivePoller };
}
