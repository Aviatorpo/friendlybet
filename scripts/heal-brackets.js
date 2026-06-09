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
const LIMIT = parseInt(process.env.HEAL_LIMIT || '400', 10);

(async () => {
  if (!SUPABASE_KEY) { console.error('[heal-brackets] missing SUPABASE_SECRET_KEY'); process.exit(1); }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/heal_brackets_from_backup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_limit: LIMIT }),
  });
  if (!r.ok) {
    console.error(`[heal-brackets] RPC failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const res = await r.json();
  console.log('[heal-brackets]', JSON.stringify(res));
})().catch(e => { console.error('[heal-brackets] ERROR:', e.message); process.exit(1); });
