-- ============================================================
-- 2026-06-10: Annex C correction window (7 days + admin extension)
-- ============================================================
-- Reuses knockout_reopen_grants for the FIFA Annex C third-place allocation
-- incident. This is knockout-only recovery: group positions, third-place
-- advancers, and top scorer remain fixed. The knockout bracket including the
-- final winner may be updated through the grant-gated RPC.

alter table public.knockout_reopen_grants
  add column if not exists incident_key text,
  add column if not exists impact_kind text,
  add column if not exists impact_details jsonb not null default '{}'::jsonb;

-- Eligibility for an Annex C correction window. Unlike the earlier missing-
-- bracket recovery, a full existing bracket is eligible: users may need to
-- review/edit a complete bracket that was filled against wrong pairings.
create or replace function public._knockout_reopen_eligible(v_uid uuid, v_pid uuid)
returns boolean language sql security definer set search_path to '' stable as $$
  select
    exists(select 1 from public.pools p where p.id=v_pid and p.betting_mode='single_phase')
    and exists(select 1 from public.users u where u.id=v_uid and u.pool_id=v_pid)
    and (select count(*) from public.group_position_picks g where g.user_id=v_uid and g.pool_id=v_pid) >= 48
    and (select count(*) from public.sp_third_place_picks t where t.user_id=v_uid and t.pool_id=v_pid) = 8
    and (
      (select count(*) from public.tournament_winner_picks w where w.user_id=v_uid and w.pool_id=v_pid) = 1
      or exists(select 1 from public.knockout_picks k
                 where k.user_id=v_uid and k.pool_id=v_pid and k.bracket_position=31)
    );
$$;

create or replace function public.approve_knockout_reopen(p_code text, p_target_user uuid)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '8s' as $$
declare v_admin uuid; v_pid uuid; v_tpid uuid; v_exp timestamptz;
begin
  v_admin := public._uid_from_code(p_code);
  if v_admin is null then return jsonb_build_object('ok',false); end if;
  select u.pool_id into v_pid from public.users u where u.id=v_admin and u.is_admin = true;
  if v_pid is null then return jsonb_build_object('ok',false); end if;
  select u.pool_id into v_tpid from public.users u where u.id=p_target_user;
  if v_tpid is null or v_tpid <> v_pid then return jsonb_build_object('ok',false); end if;
  if not public._knockout_reopen_eligible(p_target_user, v_pid) then
    return jsonb_build_object('ok',false,'reason','not_eligible');
  end if;

  insert into public.knockout_reopen_grants(user_id,pool_id,approved_by,expires_at,reason,incident_key,impact_kind)
    values(p_target_user, v_pid, v_admin, now()+interval '7 days', 'admin_extended_7d', 'manual_reopen', 'admin_selected')
    on conflict (user_id,pool_id) do update
      set approved_by=excluded.approved_by,
          approved_at=now(),
          expires_at=greatest(public.knockout_reopen_grants.expires_at, now()) + interval '7 days',
          used_at=null,
          reason='admin_extended_7d',
          incident_key=coalesce(public.knockout_reopen_grants.incident_key, 'manual_reopen'),
          impact_kind=coalesce(public.knockout_reopen_grants.impact_kind, 'admin_selected')
    returning expires_at into v_exp;

  return jsonb_build_object('ok',true,'expires_at',v_exp);
end$$;

create or replace function public.owner_approve_knockout_reopen(p_target_user uuid)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '8s' as $$
declare v_pid uuid; v_exp timestamptz;
begin
  select u.pool_id into v_pid from public.users u where u.id=p_target_user;
  if v_pid is null then return jsonb_build_object('ok',false); end if;
  if not public._knockout_reopen_eligible(p_target_user, v_pid) then
    return jsonb_build_object('ok',false,'reason','not_eligible');
  end if;
  insert into public.knockout_reopen_grants(user_id,pool_id,approved_by,expires_at,reason,incident_key,impact_kind)
    values(p_target_user, v_pid, null, now()+interval '7 days', 'owner_extended_7d', 'manual_reopen', 'owner_selected')
    on conflict (user_id,pool_id) do update
      set approved_at=now(),
          expires_at=greatest(public.knockout_reopen_grants.expires_at, now()) + interval '7 days',
          used_at=null,
          reason='owner_extended_7d',
          incident_key=coalesce(public.knockout_reopen_grants.incident_key, 'manual_reopen'),
          impact_kind=coalesce(public.knockout_reopen_grants.impact_kind, 'owner_selected')
    returning expires_at into v_exp;
  return jsonb_build_object('ok',true,'expires_at',v_exp);
end$$;

create or replace function public.save_knockout_bracket_reopen(p_code text, p_picks jsonb)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '8s' as $$
declare v_uid uuid; v_pid uuid; v_pos31 text; v_cnt int;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select u.pool_id into v_pid from public.users u where u.id=v_uid;
  if v_pid is null then raise exception 'no pool'; end if;
  if not exists(select 1 from public.pools p where p.id=v_pid and p.betting_mode='single_phase'
                and (p.locked_at is not null or coalesce(p.is_locked,false)=true)) then
    raise exception 'pool not locked / not single-phase'; end if;
  if not exists(select 1 from public.knockout_reopen_grants gr
                where gr.user_id=v_uid and gr.pool_id=v_pid and gr.expires_at > now()) then
    raise exception 'no active recovery grant'; end if;
  if not public._knockout_reopen_eligible(v_uid, v_pid) then raise exception 'not eligible'; end if;

  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 64 then raise exception 'bad payload'; end if;
  if jsonb_array_length(p_picks) = 0 then return jsonb_build_object('ok',true,'skipped','empty'); end if;
  if exists(select 1 from jsonb_array_elements(p_picks) e where
       coalesce(e->>'bracket_position','') !~ '^([1-9]|[12][0-9]|3[01])$'
       or coalesce(btrim(e->>'predicted_winner'),'')='') then raise exception 'invalid bracket payload'; end if;
  if exists(select 1 from jsonb_array_elements(p_picks) e
            where e->>'predicted_winner' not in (select code from public.teams)) then
    raise exception 'unknown team code in bracket';
  end if;

  delete from public.knockout_picks where user_id=v_uid and pool_id=v_pid
    and (bracket_position is not null or match_id ~ '^sp_([1-9]|[12][0-9]|3[01])$');

  insert into public.knockout_picks(pool_id,user_id,match_id,round,predicted_winner,bracket_position)
    select distinct on ((e->>'bracket_position')::int)
           v_pid, v_uid,
           'sp_' || (e->>'bracket_position')::int,
           case when (e->>'bracket_position')::int <= 16 then 'r32'
                when (e->>'bracket_position')::int <= 24 then 'r16'
                when (e->>'bracket_position')::int <= 28 then 'qf'
                when (e->>'bracket_position')::int <= 30 then 'sf'
                else 'final' end,
           e->>'predicted_winner', (e->>'bracket_position')::int
    from jsonb_array_elements(p_picks) e
    order by (e->>'bracket_position')::int;

  select e->>'predicted_winner' into v_pos31
    from jsonb_array_elements(p_picks) e
   where (e->>'bracket_position')::int = 31;
  if v_pos31 is not null then
    delete from public.tournament_winner_picks where user_id=v_uid and pool_id=v_pid;
    insert into public.tournament_winner_picks(pool_id,user_id,team_code)
      values(v_pid,v_uid,v_pos31);
  end if;

  select count(*) into v_cnt from public.knockout_picks
    where user_id=v_uid and pool_id=v_pid and bracket_position is not null;
  update public.knockout_reopen_grants set used_at=now() where user_id=v_uid and pool_id=v_pid;
  return jsonb_build_object('ok',true,'saved',v_cnt);
end$$;

create or replace function public.my_knockout_reopen(p_code text)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '5s' as $$
declare v_uid uuid; v_pid uuid; v_locked boolean; v_eligible boolean; v_g record;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then return jsonb_build_object('approved',false,'eligible',false,'can_reenter',false); end if;
  select u.pool_id into v_pid from public.users u where u.id=v_uid;
  select (locked_at is not null or coalesce(is_locked,false)=true) into v_locked from public.pools where id=v_pid;
  v_eligible := public._knockout_reopen_eligible(v_uid, v_pid);
  select * into v_g from public.knockout_reopen_grants where user_id=v_uid and pool_id=v_pid;
  return jsonb_build_object(
    'locked', coalesce(v_locked,false),
    'eligible', v_eligible,
    'approved', (v_g.user_id is not null and v_g.expires_at > now()),
    'used', (v_g.user_id is not null and v_g.used_at is not null),
    'expires_at', v_g.expires_at,
    'incident_key', v_g.incident_key,
    'impact_kind', v_g.impact_kind,
    'reason', v_g.reason,
    'can_reenter', (coalesce(v_locked,false) and v_eligible and v_g.user_id is not null and v_g.expires_at > now())
  );
end$$;

create or replace function public.admin_knockout_reopen_members(p_code text)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '8s' as $$
declare v_admin uuid; v_pid uuid; v_is_admin boolean;
begin
  v_admin := public._uid_from_code(p_code);
  if v_admin is null then return '[]'::jsonb; end if;
  select u.pool_id, u.is_admin into v_pid, v_is_admin from public.users u where u.id=v_admin;
  if v_pid is null or coalesce(v_is_admin,false) = false then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'grant_active', (gr.user_id is not null and gr.expires_at > now()),
      'expires_at', gr.expires_at,
      'used_at', gr.used_at,
      'reason', gr.reason,
      'incident_key', gr.incident_key,
      'impact_kind', gr.impact_kind,
      'impact_details', gr.impact_details
    ) order by u.nickname)
    from public.users u
    left join public.knockout_reopen_grants gr on gr.user_id=u.id and gr.pool_id=u.pool_id
    where u.pool_id = v_pid
      and (gr.user_id is not null or public._knockout_reopen_eligible(u.id, u.pool_id))
  ), '[]'::jsonb);
end$$;

revoke all on function public._knockout_reopen_eligible(uuid,uuid) from public, anon, authenticated;
revoke all on function public.approve_knockout_reopen(text,uuid) from public;
grant execute on function public.approve_knockout_reopen(text,uuid) to anon, authenticated;
revoke all on function public.owner_approve_knockout_reopen(uuid) from public, anon, authenticated;
grant execute on function public.owner_approve_knockout_reopen(uuid) to service_role;
revoke all on function public.save_knockout_bracket_reopen(text,jsonb) from public;
grant execute on function public.save_knockout_bracket_reopen(text,jsonb) to anon, authenticated;
revoke all on function public.my_knockout_reopen(text) from public;
grant execute on function public.my_knockout_reopen(text) to anon, authenticated;
revoke all on function public.admin_knockout_reopen_members(text) from public;
grant execute on function public.admin_knockout_reopen_members(text) to anon, authenticated;
