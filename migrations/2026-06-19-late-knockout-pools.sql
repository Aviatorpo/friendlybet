-- Late knockout pools: after the second-match cutoff, new pools are knockout-only.
--
-- Rules:
--   * normal pre-kickoff and first-late-entry behavior stays unchanged
--   * after 2026-06-18 16:00 UTC, create_pool creates betting_mode='late_knockout'
--   * late_knockout pools accept members and knockout writes until first R32 kickoff
--   * group-position and top-scorer writes are rejected for late_knockout pools

begin;

create or replace function public._late_knockout_cutoff()
returns timestamptz
language sql
security definer
set search_path to ''
set statement_timeout to '5s'
as $$
  select coalesce(
    (
      select min(match_date)
      from public.matches
      where match_date is not null
        and stage is not null
        and upper(stage) not in ('GROUP_STAGE','THIRD_PLACE')
    ),
    timestamptz '2026-06-28 19:00:00+00'
  );
$$;

create or replace function public._auth_writer(p_code text, out v_uid uuid, out v_pid uuid)
 returns record
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare
  v_locked boolean;
  v_override timestamptz;
  v_created_at timestamptz;
  v_mode text;
  v_kickoff constant timestamptz := timestamptz '2026-06-11 19:00:00+00';
  v_late_cutoff constant timestamptz := timestamptz '2026-06-18 16:00:00+00';
  v_knockout_cutoff timestamptz := public._late_knockout_cutoff();
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then raise exception 'no pool'; end if;

  select (coalesce(is_locked,false) or locked_at is not null), lock_at_override, created_at, betting_mode
    into v_locked, v_override, v_created_at, v_mode
    from public.pools where id = v_pid for share;

  if v_override is not null and v_override > now() then return; end if;
  if v_locked then raise exception 'pool locked'; end if;

  if v_mode = 'late_knockout' then
    if now() >= v_knockout_cutoff then raise exception 'pool locked'; end if;
    return;
  end if;

  if now() >= v_kickoff and coalesce(v_created_at, '-infinity'::timestamptz) < v_kickoff then
    raise exception 'pool locked';
  end if;
  if now() >= v_late_cutoff and coalesce(v_created_at, '-infinity'::timestamptz) >= v_kickoff then
    raise exception 'pool locked';
  end if;
end
$function$;

create or replace function public.autolock_pool_if_started(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare
  v_uid uuid;
  v_pid uuid;
  v_locked timestamptz;
  v_override timestamptz;
  v_created_at timestamptz;
  v_mode text;
  v_deadline timestamptz;
  v_kickoff constant timestamptz := timestamptz '2026-06-11 19:00:00+00';
  v_late_cutoff constant timestamptz := timestamptz '2026-06-18 16:00:00+00';
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then raise exception 'no pool'; end if;

  select locked_at, lock_at_override, created_at, betting_mode
    into v_locked, v_override, v_created_at, v_mode
    from public.pools where id = v_pid;

  if v_locked is not null then return jsonb_build_object('locked',true); end if;
  if v_override is not null and v_override > now() then
    return jsonb_build_object('locked',false,'grace_until',v_override);
  end if;

  v_deadline := case
    when v_mode = 'late_knockout' then public._late_knockout_cutoff()
    when coalesce(v_created_at, '-infinity'::timestamptz) >= v_kickoff then v_late_cutoff
    else v_kickoff
  end;

  if now() < v_deadline then
    return jsonb_build_object('locked',false,'deadline',v_deadline);
  end if;

  update public.pools set locked_at = now() where id = v_pid and locked_at is null;
  return jsonb_build_object('locked',true);
end
$function$;

create or replace function public.join_pool(
  p_pool_code text,
  p_nickname text,
  p_recovery_code text,
  p_signup_source text default null::text,
  p_signup_referrer text default null::text,
  p_utm_source text default null::text,
  p_utm_medium text default null::text,
  p_utm_campaign text default null::text,
  p_country text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
declare
  bare text;
  hyph text;
  v_hash text;
  v_pool public.pools;
  v_uid uuid;
  v_kickoff constant timestamptz := timestamptz '2026-06-11 19:00:00+00';
  v_late_cutoff constant timestamptz := timestamptz '2026-06-18 16:00:00+00';
begin
  bare := upper(regexp_replace(coalesce(p_recovery_code,''),'[^A-Za-z0-9]','','g'));
  if length(bare) < 12 then raise exception 'invalid recovery code'; end if;
  if coalesce(btrim(p_nickname),'')='' then raise exception 'missing nickname'; end if;
  if length(coalesce(p_nickname,'')) > 60 then raise exception 'nickname too long'; end if;

  select * into v_pool from public.pools where code = p_pool_code;
  if v_pool.id is null then raise exception 'pool not found'; end if;

  if coalesce(v_pool.is_locked,false) or v_pool.locked_at is not null then raise exception 'pool locked'; end if;
  if v_pool.betting_mode = 'late_knockout' then
    if now() >= public._late_knockout_cutoff() then raise exception 'pool locked'; end if;
  else
    if now() >= v_kickoff and coalesce(v_pool.created_at, '-infinity'::timestamptz) < v_kickoff then raise exception 'pool locked'; end if;
    if now() >= v_late_cutoff and coalesce(v_pool.created_at, '-infinity'::timestamptz) >= v_kickoff then raise exception 'pool locked'; end if;
  end if;

  hyph := regexp_replace(bare,'(.{4})(?=.)','\1-','g');
  v_hash := encode(extensions.digest(hyph,'sha256'),'hex');
  begin
    insert into public.users(pool_id,nickname,recovery_code_hash,is_admin,is_approved,approval_status,
                             signup_source,signup_referrer,utm_source,utm_medium,utm_campaign,country)
      values(v_pool.id,p_nickname,v_hash,false,true,'pending',
             p_signup_source,p_signup_referrer,p_utm_source,p_utm_medium,p_utm_campaign,p_country)
      returning id into v_uid;
  exception when unique_violation then
    raise exception 'recovery code already in use' using errcode='23505';
  end;

  return jsonb_build_object('pool',to_jsonb(v_pool),
                            'user',(select to_jsonb(u)-'recovery_code_hash' from public.users u where u.id=v_uid));
end
$function$;

create or replace function public.create_pool(
  p_code text,
  p_name text,
  p_language text,
  p_betting_mode text,
  p_scoring_rules jsonb,
  p_use_multipliers boolean,
  p_admin_nickname text,
  p_recovery_code text,
  p_signup_source text default null::text,
  p_signup_referrer text default null::text,
  p_utm_source text default null::text,
  p_utm_medium text default null::text,
  p_utm_campaign text default null::text,
  p_country text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
declare
  bare text;
  hyph text;
  v_hash text;
  v_pool_id uuid;
  v_user_id uuid;
  v_mode text;
  v_rules jsonb;
  v_late_cutoff constant timestamptz := timestamptz '2026-06-18 16:00:00+00';
begin
  if now() >= public._late_knockout_cutoff() then raise exception 'pool creation closed'; end if;
  v_mode := case when now() >= v_late_cutoff or p_betting_mode = 'late_knockout'
    then 'late_knockout'
    else coalesce(p_betting_mode,'single_phase')
  end;
  v_rules := coalesce(p_scoring_rules, case when v_mode = 'late_knockout' then
    '{"group_first":0,"group_second":0,"group_third":0,"group_fourth":0,"third_place_advance":0,"round_of_32":2,"round_of_16":4,"quarter_final":8,"semi_final":16,"final":32,"top_scorer":0}'::jsonb
    else null::jsonb end);

  bare := upper(regexp_replace(coalesce(p_recovery_code,''),'[^A-Za-z0-9]','','g'));
  if length(bare) < 12 then raise exception 'invalid recovery code'; end if;
  if coalesce(btrim(p_name),'')='' or coalesce(btrim(p_admin_nickname),'')='' then raise exception 'missing data'; end if;
  if length(coalesce(p_name,'')) > 120 or length(coalesce(p_admin_nickname,'')) > 60 or length(coalesce(p_code,'')) > 24 then raise exception 'field too long'; end if;
  if v_rules is not null and length(v_rules::text) > 20000 then raise exception 'scoring_rules too large'; end if;

  hyph := regexp_replace(bare,'(.{4})(?=.)','\1-','g');
  v_hash := encode(extensions.digest(hyph,'sha256'),'hex');
  begin
    insert into public.pools(code,name,language,tournament,status,betting_mode,scoring_rules,use_multipliers)
      values(p_code,p_name,coalesce(p_language,'he'),'wc2026','open',v_mode,v_rules,coalesce(p_use_multipliers,false))
      returning id into v_pool_id;
    insert into public.users(pool_id,nickname,recovery_code_hash,is_admin,is_approved,approval_status,approved_at,
                             signup_source,signup_referrer,utm_source,utm_medium,utm_campaign,country)
      values(v_pool_id,p_admin_nickname,v_hash,true,true,'approved',now(),
             p_signup_source,p_signup_referrer,p_utm_source,p_utm_medium,p_utm_campaign,p_country)
      returning id into v_user_id;
    update public.pools set admin_user_id=v_user_id where id=v_pool_id;
  exception when unique_violation then
    raise exception 'pool code or recovery code already in use' using errcode='23505';
  end;

  return jsonb_build_object('pool',(select to_jsonb(p) from public.pools p where p.id=v_pool_id),
                            'user',(select to_jsonb(u)-'recovery_code_hash' from public.users u where u.id=v_user_id));
end
$function$;

create or replace function public.save_group_position_picks(p_code text, p_picks jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare v_uid uuid; v_pid uuid; v_mode text;
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  select betting_mode into v_mode from public.pools where id = v_pid;
  if v_mode = 'late_knockout' then raise exception 'group picks closed'; end if;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 200 then raise exception 'bad payload'; end if;
  if jsonb_array_length(p_picks) = 0 then return jsonb_build_object('ok',true,'skipped','empty'); end if;
  if exists(select 1 from jsonb_array_elements(p_picks) e where
       coalesce(e->>'group_letter','') !~ '^[A-L]$'
       or coalesce(e->>'position','') !~ '^[1-4]$'
       or coalesce(btrim(e->>'team_code'),'')='' ) then
    raise exception 'invalid pick payload';
  end if;
  delete from public.group_position_picks where user_id = v_uid and pool_id = v_pid;
  begin
    insert into public.group_position_picks(pool_id,user_id,group_letter,position,team_code)
      select distinct on (e->>'group_letter',(e->>'position')::int)
             v_pid, v_uid, e->>'group_letter', (e->>'position')::int, e->>'team_code'
      from jsonb_array_elements(p_picks) e
      order by e->>'group_letter',(e->>'position')::int;
  exception when foreign_key_violation then raise exception 'unknown team code in picks';
  end;
  return jsonb_build_object('ok',true);
end
$function$;

create or replace function public.save_top_scorer(p_code text, p_player_id text, p_player_name text, p_team_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare v_uid uuid; v_pid uuid; v_mode text;
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  select betting_mode into v_mode from public.pools where id = v_pid;
  if v_mode = 'late_knockout' then raise exception 'top scorer closed'; end if;
  delete from public.top_scorer_picks where user_id = v_uid and pool_id = v_pid;
  if coalesce(btrim(p_player_id),'') <> '' then
    if coalesce(btrim(p_player_name),'') = '' or coalesce(btrim(p_team_code),'') = '' then raise exception 'missing top scorer data'; end if;
    insert into public.top_scorer_picks(pool_id,user_id,player_id,player_name,team_code)
      values(v_pid,v_uid,p_player_id,p_player_name,p_team_code);
  end if;
  return jsonb_build_object('ok',true);
end
$function$;

revoke all on function public._late_knockout_cutoff() from public;
grant execute on function public._late_knockout_cutoff() to anon, authenticated;
revoke all on function public._auth_writer(text) from public;
grant execute on function public._auth_writer(text) to anon, authenticated;
revoke all on function public.autolock_pool_if_started(text) from public;
grant execute on function public.autolock_pool_if_started(text) to anon, authenticated;
revoke all on function public.join_pool(text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.join_pool(text,text,text,text,text,text,text,text,text) to anon, authenticated;
revoke all on function public.create_pool(text,text,text,text,jsonb,boolean,text,text,text,text,text,text,text,text) from public;
grant execute on function public.create_pool(text,text,text,text,jsonb,boolean,text,text,text,text,text,text,text,text) to anon, authenticated;
revoke all on function public.save_group_position_picks(text,jsonb) from public;
grant execute on function public.save_group_position_picks(text,jsonb) to anon, authenticated;
revoke all on function public.save_top_scorer(text,text,text,text) from public;
grant execute on function public.save_top_scorer(text,text,text,text) to anon, authenticated;

commit;
