-- 2026-06-30: make per-pool lock_at_override authoritative for two-phase
-- knockout/top-scorer writes too.
--
-- Context: pools.lock_at_override already keeps group writes open via
-- _auth_writer and prevents the lock job from re-locking the pool. The second
-- two-phase write gate, _two_phase_knockout_writer, was added later and still
-- hard-blocked after the knockout cutoff. That made a pool look open while
-- knockout saves failed with "pool locked".

create or replace function public._two_phase_knockout_writer(p_code text, out v_uid uuid, out v_pid uuid)
 returns record
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare
  v_mode text;
  v_override timestamptz;
  v_unfinished int;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;

  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then raise exception 'no pool'; end if;

  select betting_mode, lock_at_override
    into v_mode, v_override
    from public.pools
    where id = v_pid
    for share;

  if v_mode <> 'two_phase' then raise exception 'not a two-phase pool'; end if;

  -- A future per-pool override extends this write phase. Without it, the normal
  -- global knockout cutoff still closes two-phase knockout/top-scorer writes.
  if not (v_override is not null and v_override > now()) then
    if now() >= public._late_knockout_cutoff() then raise exception 'pool locked'; end if;
  end if;

  select count(*) into v_unfinished
  from public.matches m
  where m.stage = 'GROUP_STAGE'
    and (
      coalesce(upper(m.status),'') not in ('FINISHED','AWARDED')
      or lower(coalesce(m.status_detail,'')) like '%pending verification%'
      or lower(coalesce(m.live_source,'')) = 'espn-final'
    );

  if v_unfinished > 0 then raise exception 'group stage not complete'; end if;
end
$function$;

revoke all on function public._two_phase_knockout_writer(text) from public;
grant execute on function public._two_phase_knockout_writer(text) to anon, authenticated;
