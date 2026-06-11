-- Block joining existing pools after the World Cup has started.
--
-- Scope: join_pool only. This does NOT block create_pool, and it does not touch
-- prediction writes, recovery windows, or admin approval flows.
--
-- Rationale: locked_at is normally written by the lock job/autolock path, but a
-- newly-created or not-yet-autolocked pool could still have locked_at = null
-- after kickoff. Joining an existing pool must be globally closed after kickoff.

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
begin
  bare := upper(regexp_replace(coalesce(p_recovery_code,''),'[^A-Za-z0-9]','','g'));
  if length(bare) < 12 then raise exception 'invalid recovery code'; end if;
  if coalesce(btrim(p_nickname),'')='' then raise exception 'missing nickname'; end if;
  if length(coalesce(p_nickname,'')) > 60 then raise exception 'nickname too long'; end if;

  select * into v_pool from public.pools where code = p_pool_code;
  if v_pool.id is null then raise exception 'pool not found'; end if;

  -- Hard global cutoff for joining existing pools. lock_at_override may extend
  -- prediction writes for incident recovery, but it must not admit new members.
  if now() >= v_kickoff then raise exception 'pool locked'; end if;
  if coalesce(v_pool.is_locked,false) or v_pool.locked_at is not null then raise exception 'pool locked'; end if;

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
