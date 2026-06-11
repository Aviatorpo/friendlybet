-- Late-entry pools: allow normal one-phase/two-phase play after kickoff only for
-- pools created after kickoff, and only until the first team starts its second
-- group match.
--
-- Cutoffs verified against the app match snapshot and FIFA schedule references:
--   kickoff:        2026-06-11 19:00 UTC
--   late cutoff:    2026-06-18 16:00 UTC (Czechia v South Africa, Group A)
--
-- This migration changes function gates only. It updates no rows.

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
  v_kickoff constant timestamptz := timestamptz '2026-06-11 19:00:00+00';
  v_late_cutoff constant timestamptz := timestamptz '2026-06-18 16:00:00+00';
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then raise exception 'no pool'; end if;

  select (coalesce(is_locked,false) or locked_at is not null), lock_at_override, created_at
    into v_locked, v_override, v_created_at
    from public.pools where id = v_pid for share;

  -- Existing incident recovery grace remains authoritative.
  if v_override is not null and v_override > now() then return; end if;

  if v_locked then raise exception 'pool locked'; end if;

  -- Pre-kickoff pools lock at kickoff. Late-entry pools lock at the first second
  -- group match. Pools created after that cutoff are immediately read-only.
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
  v_deadline timestamptz;
  v_kickoff constant timestamptz := timestamptz '2026-06-11 19:00:00+00';
  v_late_cutoff constant timestamptz := timestamptz '2026-06-18 16:00:00+00';
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then raise exception 'no pool'; end if;

  select locked_at, lock_at_override, created_at
    into v_locked, v_override, v_created_at
    from public.pools where id = v_pid;

  if v_locked is not null then return jsonb_build_object('locked',true); end if;
  if v_override is not null and v_override > now() then
    return jsonb_build_object('locked',false,'grace_until',v_override);
  end if;

  v_deadline := case
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
  if now() >= v_kickoff and coalesce(v_pool.created_at, '-infinity'::timestamptz) < v_kickoff then raise exception 'pool locked'; end if;
  if now() >= v_late_cutoff and coalesce(v_pool.created_at, '-infinity'::timestamptz) >= v_kickoff then raise exception 'pool locked'; end if;

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
  v_late_cutoff constant timestamptz := timestamptz '2026-06-18 16:00:00+00';
begin
  if now() >= v_late_cutoff then raise exception 'pool creation closed'; end if;

  bare := upper(regexp_replace(coalesce(p_recovery_code,''),'[^A-Za-z0-9]','','g'));
  if length(bare) < 12 then raise exception 'invalid recovery code'; end if;
  if coalesce(btrim(p_name),'')='' or coalesce(btrim(p_admin_nickname),'')='' then raise exception 'missing data'; end if;
  if length(coalesce(p_name,'')) > 120 or length(coalesce(p_admin_nickname,'')) > 60 or length(coalesce(p_code,'')) > 24 then raise exception 'field too long'; end if;
  if p_scoring_rules is not null and length(p_scoring_rules::text) > 20000 then raise exception 'scoring_rules too large'; end if;

  hyph := regexp_replace(bare,'(.{4})(?=.)','\1-','g');
  v_hash := encode(extensions.digest(hyph,'sha256'),'hex');
  begin
    insert into public.pools(code,name,language,tournament,status,betting_mode,scoring_rules,use_multipliers)
      values(p_code,p_name,coalesce(p_language,'he'),'wc2026','open',coalesce(p_betting_mode,'single_phase'),p_scoring_rules,coalesce(p_use_multipliers,false))
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
