-- ============================================================================
-- 2026-06-10  Make the 72h incident grace AUTHORITATIVE in the write gate
-- ----------------------------------------------------------------------------
-- _auth_writer() is the SECURITY DEFINER gate every pick-write RPC calls. It
-- rejected writes when is_locked=true OR locked_at is not null, but it did NOT
-- know about pools.lock_at_override. autolock_pool_if_started() already defers
-- the auto-lock during a grace window, but if a pool ever gets locked by another
-- path (admin lock, a future auto-lock change), the grace would become fake and
-- affected users could no longer re-enter. This makes the grace real at the gate:
-- an active (future) lock_at_override keeps writes OPEN even when locked.
--
-- Truth table (verified):
--   unlocked, no override        -> allowed
--   locked,   no override        -> blocked ('pool locked')
--   locked,   future override    -> allowed   (grace)
--   locked,   past override      -> blocked ('pool locked')
--
-- Idempotent CREATE OR REPLACE; signature unchanged.
-- ============================================================================
create or replace function public._auth_writer(p_code text, out v_uid uuid, out v_pid uuid)
 returns record
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare v_locked boolean; v_override timestamptz;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then raise exception 'no pool'; end if;
  select (coalesce(is_locked,false) or locked_at is not null), lock_at_override
    into v_locked, v_override
    from public.pools where id = v_pid for share;
  -- Active grace window keeps writes open even if the pool is otherwise locked.
  if v_override is not null and v_override > now() then return; end if;
  if v_locked then raise exception 'pool locked'; end if;
end$function$;
