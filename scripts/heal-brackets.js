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
const LIMIT = parseInt(process.env.HEAL_LIMIT || '150', 10);

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
})().catch(e => { console.error('::error::[heal-brackets] ERROR:', e.message); process.exit(1); });
