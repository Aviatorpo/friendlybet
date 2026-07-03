-- Fix join approval metadata.
--
-- Pools that do not require approval must not create users with
-- approval_status='pending'. The legacy is_approved flag remains true for
-- compatibility, but approval_status drives admin/member UI.

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
  v_requires_approval boolean;
  v_approval_status text;
  v_approved_at timestamptz;
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

  v_requires_approval := coalesce(v_pool.approve_before_betting, false);
  v_approval_status := case when v_requires_approval then 'pending' else 'approved' end;
  v_approved_at := case when v_requires_approval then null else now() end;

  hyph := regexp_replace(bare,'(.{4})(?=.)','\1-','g');
  v_hash := encode(extensions.digest(hyph,'sha256'),'hex');
  begin
    insert into public.users(pool_id,nickname,recovery_code_hash,is_admin,is_approved,approval_status,approved_at,
                             signup_source,signup_referrer,utm_source,utm_medium,utm_campaign,country)
      values(v_pool.id,p_nickname,v_hash,false,true,v_approval_status,v_approved_at,
             p_signup_source,p_signup_referrer,p_utm_source,p_utm_medium,p_utm_campaign,p_country)
      returning id into v_uid;
  exception when unique_violation then
    raise exception 'recovery code already in use' using errcode='23505';
  end;

  return jsonb_build_object('pool',to_jsonb(v_pool),
                            'user',(select to_jsonb(u)-'recovery_code_hash' from public.users u where u.id=v_uid));
end
$function$;

update public.users u
set approval_status = 'approved',
    approved_at = coalesce(u.approved_at, u.joined_at, now())
from public.pools p
where p.id = u.pool_id
  and p.code = '287ZF'
  and coalesce(p.approve_before_betting, false) = false
  and u.is_admin = false
  and coalesce(u.is_approved, false) = true
  and u.approval_status = 'pending';
