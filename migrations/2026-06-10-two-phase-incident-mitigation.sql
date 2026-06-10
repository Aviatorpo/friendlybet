-- ============================================================================
-- 2026-06-10  Two-phase incident mitigation
-- ----------------------------------------------------------------------------
-- Context: two-phase pick saves were lost at scale (silent save failure +
-- sync-teams.js deleting group_picks/knockout_picks every run). Two-phase has no
-- backup, so the data is unrecoverable. This migration installs forward
-- protection + a 72h grace window for the affected pools.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1) BULLETPROOF BACKUP TABLE -------------------------------------------------
-- Make pick_backups APPEND-ONLY for every external role. The ONLY writer is the
-- SECURITY DEFINER backup_picks() RPC (owned by postgres), which can still INSERT
-- and run its own 12-row cap DELETE because definer functions bypass these grants.
-- After this, no client (anon), no logged-in role, and not even a leaked
-- service_role key can DELETE / UPDATE / TRUNCATE a user's backup.
revoke delete, update, truncate on table public.pick_backups from anon;
revoke delete, update, truncate on table public.pick_backups from authenticated;
revoke delete, update, truncate on table public.pick_backups from service_role;
-- keep INSERT/SELECT for service_role (ops read), keep SELECT for the RPC path.

-- 2) GRACE WINDOW: autolock respects a future lock_at_override -----------------
-- Previously autolock_pool_if_started() locked a pool the instant any match
-- kicked off, ignoring lock_at_override. Now: if lock_at_override is set and
-- still in the future, the pool is NOT auto-locked yet (incident extra-time),
-- even after the tournament starts. Once the override passes, locking resumes
-- exactly as before. Behaviour is UNCHANGED when lock_at_override is null.
create or replace function public.autolock_pool_if_started(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare v_uid uuid; v_pid uuid; v_locked timestamptz; v_started boolean; v_override timestamptz;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then raise exception 'no pool'; end if;
  select locked_at, lock_at_override into v_locked, v_override from public.pools where id = v_pid;
  if v_locked is not null then return jsonb_build_object('locked',true); end if;
  -- Incident grace window: a future override defers the auto-lock.
  if v_override is not null and v_override > now() then
    return jsonb_build_object('locked',false,'grace_until',v_override);
  end if;
  -- only a match that has ACTUALLY kicked off (status started AND scheduled time
  -- passed) arms the lock, so a future/mis-statused match row can't prematurely
  -- lock every pool. match_date null tolerated (legacy rows) only if status started.
  select exists(select 1 from public.matches
    where status in ('IN_PLAY','PAUSED','FINISHED','LIVE','started','finished')
      and (match_date is null or match_date <= now()) limit 1) into v_started;
  if v_started then
    update public.pools set locked_at = now() where id = v_pid and locked_at is null;
    return jsonb_build_object('locked',true);
  end if;
  return jsonb_build_object('locked',false);
end$function$;

-- 3) APPLY THE 72h GRACE TO *AFFECTED* TWO-PHASE POOLS ONLY -------------------
-- Kickoff = 2026-06-11 16:00 CDMX (-06:00). +72h = 2026-06-14 16:00 CDMX.
-- Owner decision: only pools that actually LOST work get the extra time, not
-- every two-phase pool. "Affected" = a pool with >=1 member who clearly engaged
-- (active > 5 min after joining) but has fewer than a complete set of saved group
-- picks (< 24) -> their picks were lost. Pools where everyone is fine get nothing.
-- (Live result 2026-06-10: 77 of 313 unlocked two-phase pools, 189 members.)
-- Only set where not already locked / not already overridden (never clobber).
with member as (
  select us.pool_id,
    extract(epoch from (us.last_active_at - us.joined_at)) sec,
    (select count(*) from public.group_picks g where g.user_id = us.id) gp
  from public.users us join public.pools p on p.id = us.pool_id
  where p.betting_mode = 'two_phase' and p.locked_at is null
),
affected_pool as (select distinct pool_id from member where sec > 300 and gp < 24)
update public.pools
   set lock_at_override = timestamptz '2026-06-14 16:00:00-06:00'
 where id in (select pool_id from affected_pool)
   and locked_at is null
   and lock_at_override is null;
