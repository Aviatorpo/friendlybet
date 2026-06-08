-- ============================================================
-- pools.lock_at_override — per-pool prediction-lock deadline override
-- ============================================================
-- Dormant lock infrastructure. NULL for every pool today, which means: lock at
-- World Cup kickoff (normal behavior, enforced by scripts/lock-pools.js +
-- autolock_pool_if_started + _auth_writer). It exists so the planned EXTRA-TIME
-- extension for incident-affected single-phase pools is a pure DATA change later
-- (set lock_at_override = kickoff + N days on those pools) with no change to the
-- live lock job. See Codex/PLAN-extra-time-knockout-extension.md.
--
-- Idempotent. Safe to re-run.

alter table public.pools
  add column if not exists lock_at_override timestamptz;

comment on column public.pools.lock_at_override is
  'Per-pool prediction-lock deadline override. NULL = lock at WC kickoff (default). '
  'A future timestamp = this pool stays editable until then (extra-time for '
  'incident-affected pools). Consumed by scripts/lock-pools.js and (when the '
  'extra-time RPC change ships) autolock_pool_if_started.';
