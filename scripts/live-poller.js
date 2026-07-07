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
const controllerState = require('./live-controller-state.js');
const fs = require('fs');

function setGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
}

function writeOutputs(result) {
  setGithubOutput('polls', String(result.polls));
  setGithubOutput('final_detected', result.finalDetected ? 'true' : 'false');
  setGithubOutput('final_detections', String(result.finalDetections));
  if (result.windows != null) setGithubOutput('windows', String(result.windows));
}

async function runLivePollerWindow(opts = {}) {
  const intervalMs = opts.intervalMs || 60000;          // poll cadence during live
  const runMs      = opts.runMs || 270000;              // ~4.5 min, just under the */5 cron
  const now        = opts.now || (() => Date.now());
  const sleep      = opts.sleep || ((ms) => new Promise(r => setTimeout(r, ms)));
  const source     = opts.source || process.env.LIVE_CONTROLLER_SOURCE || 'github-live-poller';
  const leaseMs    = opts.leaseMs || (parseInt(process.env.LIVE_CONTROLLER_LEASE_MS || '', 10) || 90000);
  const cooldownMs = opts.cooldownMs || (parseInt(process.env.LIVE_CONTROLLER_COOLDOWN_MS || '', 10) || 45000);
  const requireLease = opts.requireLease != null ? !!opts.requireLease : process.env.LIVE_CONTROLLER_REQUIRE_LEASE === '1';

  if (!(await sync.shouldSync())) {
    const allFinishedInWindow = sync.shouldSync && sync.shouldSync.lastReason === 'all_finished';
    if (allFinishedInWindow) {
      console.log('Live window has only finished matches - handing off to final-result verifier.');
    }
    console.log('No active match right now - live-poller exiting.');
    return {
      polls: 0,
      finalDetected: allFinishedInWindow,
      finalDetections: allFinishedInWindow ? 1 : 0,
      finalReason: allFinishedInWindow ? 'all_finished_window' : '',
    };
  }

  const end = now() + runMs;
  let polls = 0;
  let leaseSkips = 0;
  let finalDetections = 0;
  while (true) {
    let lease = null;
    try {
      lease = await controllerState.claimControllerLease({
        source,
        leaseMs,
        cooldownMs,
        requireLease,
      });
      if (!lease.claimed) {
        leaseSkips++;
        console.log(`live-controller lease not claimed (${lease.reason}) - skipping this provider poll.`);
      } else if (lease.degraded) {
        console.warn(`live-controller state degraded (${lease.reason}) - falling back to legacy single-run polling.`);
      }
      if (!lease.claimed) {
        if (now() + intervalMs >= end) break;
        await sleep(intervalMs);
        continue;
      }
      const result = await espn.syncEspnLive(); // ESPN -> DB (score + provider clock)
      if (!result || result.updated === 0) {
        console.warn('ESPN live sync updated no matches - leaving result unchanged until the next ESPN/FIFA check.');
      }
      if (lease.release) {
        try {
          await controllerState.upsertLiveMatchJobsFromPollResult(result, { cooldownMs, nextAttemptMs: cooldownMs });
        } catch (jobErr) {
          console.warn('live-controller job state write skipped:', jobErr.message);
        }
        await controllerState.releaseControllerLease(lease, { success: true, pollResult: result, cooldownMs });
      }
      finalDetections += Number(result && result.finalDetected || 0);
      polls++;
    } catch (e) {
      console.error('ESPN live poll failed (will retry next tick):', e.message);
      try {
        if (lease && lease.claimed) await controllerState.releaseControllerLease(lease, { success: false, error: e, cooldownMs });
      } catch (releaseErr) {
        console.warn('live-controller lease release failed after poll error:', releaseErr.message);
      }
    }
    if (now() + intervalMs >= end) break;
    await sleep(intervalMs);
    // Stop early the moment nothing is live anymore (saves API calls / minutes).
    if (!(await sync.shouldSync())) {
      console.log('No active match anymore - live-poller exiting.');
      break;
    }
  }
  const finalDetected = finalDetections > 0;
  return { polls, leaseSkips, finalDetected, finalDetections, finalReason: finalDetected ? 'espn_final' : '' };
}

async function runLivePoller(opts = {}) {
  const intervalMs = opts.intervalMs || 60000;
  const runMs = opts.runMs || 270000;
  const controllerMs = opts.controllerMs || 0;
  const controllerSleepMs = opts.controllerSleepMs || 30000;
  const controllerIdleSleepMs = opts.controllerIdleSleepMs || controllerSleepMs;
  const now = opts.now || (() => Date.now());
  const sleep = opts.sleep || ((ms) => new Promise(r => setTimeout(r, ms)));

  const controllerActive = controllerMs > runMs;
  const controllerEnd = controllerActive ? now() + controllerMs : 0;
  const aggregate = { polls: 0, finalDetected: false, finalDetections: 0, windows: 0 };

  if (controllerActive) {
    console.log(`live-poller controller active for ${Math.round(controllerMs / 60000)} minute(s).`);
  }

  do {
    const remainingMs = controllerActive ? Math.max(0, controllerEnd - now()) : runMs;
    const windowRunMs = controllerActive ? Math.min(runMs, remainingMs) : runMs;
    if (windowRunMs <= 0) break;

    const result = await runLivePollerWindow({ ...opts, intervalMs, runMs: windowRunMs, now, sleep });
    const sawLivePollsBeforeWindow = aggregate.polls > 0;
    const acceptFinal = result.finalDetected
      && (!controllerActive || result.finalReason !== 'all_finished_window' || sawLivePollsBeforeWindow);
    aggregate.polls += result.polls;
    if (acceptFinal) {
      aggregate.finalDetections += result.finalDetections;
      aggregate.finalDetected = true;
    } else if (result.finalDetected) {
      console.log('controller ignored all-finished handoff before seeing live polls in this run.');
    }
    aggregate.windows++;

    if (aggregate.finalDetected || !controllerActive) break;

    const requestedWaitMs = result.polls > 0 ? controllerSleepMs : controllerIdleSleepMs;
    const waitMs = Math.min(requestedWaitMs, Math.max(0, controllerEnd - now()));
    if (waitMs <= 0) break;
    console.log(`controller waiting ${Math.round(waitMs / 1000)}s before the next live-window probe.`);
    await sleep(waitMs);
  } while (controllerActive && now() < controllerEnd);

  console.log(`live-poller done: ${aggregate.polls} poll(s), windows=${aggregate.windows}. finalDetected=${aggregate.finalDetected ? 'true' : 'false'} (${aggregate.finalDetections})`);
  writeOutputs(aggregate);
  return aggregate;
}

if (require.main === module) {
  runLivePoller({
    intervalMs: parseInt(process.env.LIVE_POLL_INTERVAL_MS || '', 10) || 60000,
    runMs:      parseInt(process.env.LIVE_POLL_RUN_MS || '', 10) || 270000,
    controllerMs: parseInt(process.env.LIVE_POLL_CONTROLLER_MS || '', 10) || 0,
    controllerSleepMs: parseInt(process.env.LIVE_POLL_CONTROLLER_SLEEP_MS || '', 10) || 30000,
    controllerIdleSleepMs: parseInt(process.env.LIVE_POLL_CONTROLLER_IDLE_SLEEP_MS || '', 10) || 120000,
  }).then(() => process.exit(0)).catch(e => { console.error('fatal:', e); process.exit(1); });
} else {
  module.exports = { runLivePoller, runLivePollerWindow };
}
