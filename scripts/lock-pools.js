// ============================================================
// LOCK POOLS AT KICKOFF (server-side guarantee)
// ============================================================
// Guarantees single-phase pools lock when the World Cup kicks off, EVEN IF no
// member opens the app. Complements the client-side autolock_pool_if_started
// and the server-side _auth_writer enforcement (which already rejects writes
// once locked_at/is_locked is set — that part is verified).
//
// Locks a single-phase pool when:
//   - the first scheduled match has kicked off (earliest matches.match_date <= now), AND
//   - the pool isn't already locked (locked_at IS NULL), AND
//   - the pool's effective deadline has passed: lock_at_override IS NULL (normal
//     pool → lock at kickoff) OR lock_at_override <= now (extended pool → lock at
//     its later deadline).
//
// The lock_at_override column is dormant today (NULL everywhere → everyone locks
// at kickoff). It exists so the future "extra-time" extension for incident-
// affected pools is a pure data change (set the override) with NO change to this
// job — see Codex/PLAN-extra-time-knockout-extension.md.
//
// Two-phase pools are intentionally NOT touched here: they have their own lock
// windowing (group-phase lock, then a knockout window). They keep using the
// client autolock. This job is single_phase only.
//
// Usage:
//   node scripts/lock-pools.js            # apply (CI)
//   node scripts/lock-pools.js --dry-run  # read-only: report, never PATCH
//   LOCK_DRY_RUN=1 node scripts/lock-pools.js

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const DRY_RUN = process.argv.includes('--dry-run') || process.env.LOCK_DRY_RUN === '1';

const H = {
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

async function firstKickoff() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=match_date&match_date=not.is.null&order=match_date.asc&limit=1`, { headers: H });
  if (!r.ok) throw new Error(`matches fetch ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const rows = await r.json();
  return rows[0] && rows[0].match_date ? new Date(rows[0].match_date) : null;
}

async function dueCount(filter) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/pools?select=id&${filter}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (!r.ok) throw new Error(`pools count ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const cr = r.headers.get('content-range') || '';
  return parseInt((cr.split('/')[1] || '0'), 10) || 0;
}

async function main() {
  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SECRET_KEY'); process.exit(1); }
  const now = new Date();
  const nowIso = now.toISOString();

  const kickoff = await firstKickoff();
  const reached = !!(kickoff && now >= kickoff);

  // Pools eligible to lock now: single-phase, not yet locked, effective deadline passed.
  const filter = `betting_mode=eq.single_phase&locked_at=is.null&or=(lock_at_override.is.null,lock_at_override.lte.${nowIso})`;
  const due = await dueCount(filter);

  console.log(`[lock-pools] now=${nowIso} | first match=${kickoff ? kickoff.toISOString() : 'none'} | kickoff reached=${reached} | single-phase pools due-to-lock=${due}`);

  if (!reached) { console.log('[lock-pools] kickoff not reached → no-op'); return; }
  if (DRY_RUN) { console.log('[lock-pools] DRY RUN → would lock the pools above, but not writing'); return; }
  if (due === 0) { console.log('[lock-pools] nothing to lock'); return; }

  const patch = await fetch(`${SUPABASE_URL}/rest/v1/pools?${filter}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ locked_at: nowIso }),
  });
  if (!patch.ok) throw new Error(`lock PATCH ${patch.status}: ${(await patch.text()).slice(0, 200)}`);
  console.log(`[lock-pools] ✓ locked ${due} single-phase pool(s) at ${nowIso}`);
}

main().catch(e => { console.error('[lock-pools] ERROR:', e.message); process.exit(1); });
