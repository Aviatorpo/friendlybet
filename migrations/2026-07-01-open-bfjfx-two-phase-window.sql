-- Temporarily reopen pool BFJFX for two-phase knockout + top-scorer writes.
--
-- Context:
--   lock_at_override already keeps _auth_writer writes open during a pool grace
--   window, but the later two-phase knockout/top-scorer writer had its own hard
--   cutoff at _late_knockout_cutoff(). This makes the same pool-level override
--   authoritative for the two-phase second phase too.
--
-- Rollback for BFJFX only:
--   update public.pools
--      set lock_at_override = now()
--    where code = 'BFJFX';

begin;

create or replace function public._two_phase_knockout_writer(p_code text, out v_uid uuid, out v_pid uuid)
 returns record
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare
  v_mode text;
  v_unfinished int;
  v_override timestamptz;
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
  if now() >= public._late_knockout_cutoff()
     and (v_override is null or v_override <= now()) then
    raise exception 'pool locked';
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

update public.pools
   set is_locked = false,
       lock_at_override = now() + interval '7 days'
 where code = 'BFJFX'
   and betting_mode = 'two_phase';

commit;
