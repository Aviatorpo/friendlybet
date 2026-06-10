// ============================================================
// HEAL BRACKETS FROM BACKUP (scheduled)
// ============================================================
// Calls the service_role-only RPC heal_brackets_from_backup(), which restores a
// full 31-pick bracket from a user's own pick_backups to live knockout_picks for
// any single-phase user whose live bracket is incomplete. This makes the
// client-side "bracket save didn't land" failure class IRRELEVANT: a user who
// completes their bracket (→ backup) gets it persisted server-side within minutes
// even if their browser's live save keeps failing. Idempotent; bracket-only.
//
// Runs from .github/workflows/heal-brackets.yml. Uses the service key (the RPC is
// service_role-only). No-op once there's nothing to heal.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
// Smaller batches are fine — the job runs every 10 min and the RPC isolates
// per-user failures, so there's no benefit to a large single run.
const LIMIT = parseInt(process.env.HEAL_LIMIT || '1000', 10);  // raised from 150 to clear the 2026-06-10 sync-teams wipe backlog in one run; safe (RPC isolates per-user, bounded by statement_timeout)

(async () => {
  if (!SUPABASE_KEY) { console.error('[heal-brackets] missing SUPABASE_SECRET_KEY'); process.exit(1); }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/heal_brackets_from_backup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_limit: LIMIT }),
  });
  if (!r.ok) {
    // total RPC failure (auth/permission/timeout) → fail the workflow loudly.
    console.error(`::error::[heal-brackets] RPC failed ${r.status}: ${(await r.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const body = await r.json();
  const t = (Array.isArray(body) ? body[0] : body) || {};   // PostgREST returns the jsonb value (object)
  console.log('[heal-brackets]', JSON.stringify(t));
  if (t.note) console.log(`[heal-brackets] note: ${t.note}`);

  // MASS-LOSS ALARM (added after the 2026-06-10 knockout_picks mass-delete incident,
  // whose root cause was a destructive sync job — sync-teams.js — deleting all picks).
  // Steady-state this job heals 0–few brackets per run. A spike means a large number
  // of brackets just vanished from live knockout_picks and were auto-restored from
  // backup THIS run — i.e. a mass-delete just happened (a destructive sync job, a
  // blanket REST DELETE, or a manual TRUNCATE). Fail loudly so the owner gets the
  // red-workflow email (a healthy save flow never produces this). Tune via HEAL_MASS_ALERT.
  const MASS_HEAL_ALERT = parseInt(process.env.HEAL_MASS_ALERT || '50', 10);
  let massEvent = false;
  const NEXT_STEPS = 'NEXT STEPS: 1) check `gh run list` for a sync/score job that ran just now; '
    + '2) read Supabase Postgres logs around now for DELETE/TRUNCATE on knockout_picks; '
    + '3) confirm scripts/lib-guard.js still guards every callSupabase/sb helper; '
    + '4) the heal already restored from backup — verify counts on the incident dashboard.';
  if ((t.healed || 0) >= MASS_HEAL_ALERT) {
    massEvent = true;
    console.error(`::error::[heal-brackets] MASS-LOSS ALARM — healed ${t.healed} brackets in ONE run (>=${MASS_HEAL_ALERT}). A large number of live brackets just disappeared and were auto-restored from backup — likely a destructive sync job / blanket DELETE / TRUNCATE on knockout_picks. ${NEXT_STEPS}`);
  }
  // Failure policy: a single isolated bad user is a warning (other users still
  // healed). Persistent breakage is loud (red workflow → owner notified):
  //   - >= 5 failed in one run, OR
  //   - failed > 0 while NOTHING healed (looks systemic, not one stray user).
  // skipped_no_valid_backup is NOT a failure (those users just need to re-enter).
  const failed = t.failed || 0;
  if (failed > 0) {
    const sample = JSON.stringify((t.failures || []).slice(0, 5));
    if (failed >= 5 || (t.healed || 0) === 0) {
      console.error(`::error::[heal-brackets] ${failed} user(s) failed to heal (healed=${t.healed || 0}) — sample: ${sample}`);
      process.exit(1);
    }
    console.error(`::warning::[heal-brackets] ${failed} user(s) failed to heal — sample: ${sample}`);
  }

  // Record an incident snapshot so the owner dashboard can chart the gap shrinking
  // over time. Best-effort — never fail the heal run over telemetry.
  try {
    const sr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_incident_snapshot`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (sr.ok) {
      const snap = await sr.json();
      console.log('[heal-brackets] snapshot:', JSON.stringify(snap));
      // Second mass-loss signal: must-re-enter (submitted users with no live
      // bracket) far above the normal baseline (~370–400). The TRUNCATE pushed it
      // to ~1290. A wipe that backups CAN'T fully restore (post-kickoff heal
      // disabled, or no-backup users) won't show as a `healed` spike, but it WILL
      // spike this. Threshold sits well clear of normal pre-kickoff drift.
      const GAP_ALERT = parseInt(process.env.HEAL_GAP_ALERT || '650', 10);
      const gap = (snap && (snap.gap_submitted != null ? snap.gap_submitted : snap.must_reenter)) || 0;
      if (gap >= GAP_ALERT) {
        massEvent = true;
        console.error(`::error::[heal-brackets] MASS-LOSS ALARM — must-re-enter=${gap} (>=${GAP_ALERT}, normal ~370). A large number of submitted users have no live bracket — likely a wipe that backups couldn't fully restore. Investigate immediately.`);
      }
    } else console.log(`[heal-brackets] snapshot skipped (${sr.status})`);
  } catch (e) { console.log('[heal-brackets] snapshot error:', e.message); }

  // If either mass-loss alarm tripped, exit red so GitHub emails the owner.
  if (massEvent) process.exit(1);
})().catch(e => { console.error('::error::[heal-brackets] ERROR:', e.message); process.exit(1); });
