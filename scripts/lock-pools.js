// ============================================================
// LOCK POOLS AT KICKOFF (server-side guarantee)
// ============================================================
// Guarantees pools lock when the World Cup kicks off, EVEN IF no
// member opens the app. Complements the client-side autolock_pool_if_started
// and the server-side _auth_writer enforcement (which already rejects writes
// once locked_at/is_locked is set — that part is verified).
//
// Locks a pool when:
//   - the pool isn't already locked (locked_at IS NULL), AND
//   - its deadline has passed:
//       * pre-kickoff pools lock at kickoff
//       * pools created from kickoff until the first second group match lock at
//         the late-entry cutoff
//       * lock_at_override can still extend incident-recovery pools
//
// The lock_at_override column is dormant today (NULL everywhere → everyone locks
// at kickoff). It exists so the future "extra-time" extension for incident-
// affected pools is a pure data change (set the override) with NO change to this
// job — see Codex/PLAN-extra-time-knockout-extension.md.
//
// Applies to single_phase and two_phase. A future lock_at_override keeps the pool
// editable until that deadline, so incident grace windows remain authoritative.
//
// Usage:
//   node scripts/lock-pools.js            # apply (CI)
//   node scripts/lock-pools.js --dry-run  # read-only: report, never PATCH
//   LOCK_DRY_RUN=1 node scripts/lock-pools.js

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const DRY_RUN = process.argv.includes('--dry-run') || process.env.LOCK_DRY_RUN === '1';
// Explicit kickoff trigger (NOT min(matches.match_date)) so a stale/test/misdated
// DB row can't lock every pool early. Override via env if FIFA shifts the opener.
const CONFIGURED_KICKOFF_ISO = process.env.LOCK_KICKOFF_ISO || '2026-06-11T19:00:00.000Z';
const LATE_ENTRY_CUTOFF_ISO = process.env.LATE_ENTRY_CUTOFF_ISO || '2026-06-18T16:00:00.000Z';

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

  // Kickoff trigger = explicit constant. Read the DB earliest match only as a
  // sanity/log signal; a DB row earlier than the configured kickoff must NOT
  // trigger an early global lock.
  const configuredKickoff = new Date(CONFIGURED_KICKOFF_ISO);
  const dbKickoff = await firstKickoff();
  if (dbKickoff) {
    const diffMin = Math.round((dbKickoff.getTime() - configuredKickoff.getTime()) / 60000);
    if (dbKickoff < configuredKickoff) {
      console.warn(`[lock-pools] WARNING: DB earliest match ${dbKickoff.toISOString()} is BEFORE configured kickoff ${CONFIGURED_KICKOFF_ISO} by ${-diffMin} min — ignoring DB, using configured kickoff to avoid a premature global lock.`);
    } else if (diffMin > 5) {
      console.warn(`[lock-pools] note: DB earliest match ${dbKickoff.toISOString()} is ${diffMin} min AFTER configured kickoff.`);
    }
  }
  const lateEntryCutoff = new Date(LATE_ENTRY_CUTOFF_ISO);
  const reached = now >= configuredKickoff;
  const reachedLateCutoff = now >= lateEntryCutoff;

  // Pools eligible to lock now: not yet locked, effective deadline passed.
  const nowParam = encodeURIComponent(nowIso);
  const baseFilter = `betting_mode=in.(single_phase,two_phase)&locked_at=is.null&or=(lock_at_override.is.null,lock_at_override.lte.${nowParam})`;
  const filter = reachedLateCutoff
    ? baseFilter
    : `${baseFilter}&created_at=lt.${encodeURIComponent(CONFIGURED_KICKOFF_ISO)}`;
  const before = await dueCount(filter);

  console.log(`[lock-pools] now=${nowIso} | kickoff=${CONFIGURED_KICKOFF_ISO} | late cutoff=${LATE_ENTRY_CUTOFF_ISO} | db earliest=${dbKickoff ? dbKickoff.toISOString() : 'none'} | kickoff reached=${reached} | late reached=${reachedLateCutoff} | pools due-to-lock=${before}`);

  if (!reached) { console.log('[lock-pools] kickoff not reached → no-op'); return; }
  if (DRY_RUN) { console.log('[lock-pools] DRY RUN → would lock the pools above, but not writing'); return; }
  if (before === 0) { console.log('[lock-pools] nothing to lock'); return; }

  const patch = await fetch(`${SUPABASE_URL}/rest/v1/pools?${filter}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ locked_at: nowIso }),
  });
  if (!patch.ok) throw new Error(`lock PATCH ${patch.status}: ${(await patch.text()).slice(0, 200)}`);

  // Verify the write took effect — fail loud if no progress (a silent
  // permission/filter issue would otherwise leave the workflow green).
  const after = await dueCount(filter);
  console.log(`[lock-pools] PATCH ok | due before=${before} after=${after}`);
  if (after >= before) {
    throw new Error(`[lock-pools] lock made NO progress: ${after} pools still due (was ${before}) — possible permission/filter failure`);
  }
  console.log(`[lock-pools] ✓ locked ${before - after} pool(s) at ${nowIso}`);
}

main().catch(e => { console.error('[lock-pools] ERROR:', e.message); process.exit(1); });
