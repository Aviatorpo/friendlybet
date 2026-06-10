-- ============================================================
-- 2026-06-10: DR ARTIFACT — production definitions of core app RPCs
-- ============================================================
-- READ-ONLY SNAPSHOT (via pg_get_functiondef) of the SECURITY DEFINER RPCs the app
-- depends on. ALL were verified PRESENT in production (none missing). This file makes
-- the repo a faithful copy of prod logic for disaster recovery / review — it is NOT a
-- migration to re-apply blindly (grants/owners are managed separately). Generated 2026-06-10.
-- ============================================================

-- ---- admin_reset_member_code ----
CREATE OR REPLACE FUNCTION public.admin_reset_member_code(p_code text, p_member_id uuid, p_new_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_admin uuid; v_pid uuid; nbare text; hyph text; v_hash text;
begin
  select aa.v_admin, aa.v_pid into v_admin, v_pid from public._auth_admin(p_code) aa;
  nbare := upper(regexp_replace(coalesce(p_new_code,''),'[^A-Za-z0-9]','','g'));
  if length(nbare) < 12 then raise exception 'invalid new code'; end if;
  hyph := regexp_replace(nbare,'(.{4})(?=.)','\1-','g');
  v_hash := encode(extensions.digest(hyph,'sha256'),'hex');
  begin
    -- membership predicate folded into the UPDATE (atomic, no TOCTOU).
    update public.users set recovery_code_hash = v_hash
      where id = p_member_id and pool_id = v_pid;
  exception when unique_violation then
    raise exception 'new code already in use' using errcode='23505';
  end;
  if not found then raise exception 'member not in your pool'; end if;
  insert into public.admin_actions(pool_id,admin_id,action_type,target_user_id)
    values(v_pid,v_admin,'RECOVERY_CODE_RESET',p_member_id);
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- approve_member ----
CREATE OR REPLACE FUNCTION public.approve_member(p_code text, p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_admin uuid; v_pid uuid; v_nick text;
begin
  select aa.v_admin, aa.v_pid into v_admin, v_pid from public._auth_admin(p_code) aa;
  update public.users set approval_status='approved', approved_at=now(), approved_by=v_admin
    where id = p_member_id and pool_id = v_pid
    returning nickname into v_nick;
  if not found then raise exception 'member not in your pool'; end if;
  insert into public.admin_actions(pool_id,admin_id,action_type,target_user_id,details)
    values(v_pid,v_admin,'USER_APPROVED',p_member_id,jsonb_build_object('nickname',v_nick));
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- autolock_pool_if_started ----
CREATE OR REPLACE FUNCTION public.autolock_pool_if_started(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid; v_pid uuid; v_locked timestamptz; v_started boolean;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then raise exception 'no pool'; end if;
  select locked_at into v_locked from public.pools where id = v_pid;
  if v_locked is not null then return jsonb_build_object('locked',true); end if;
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
end$function$
;

-- ---- backup_picks ----
CREATE OR REPLACE FUNCTION public.backup_picks(p_code text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid; v_pid uuid; v_has_content boolean;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'bad code'); end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'no pool'); end if;
  if jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 20000 then
    return jsonb_build_object('ok', false, 'reason', 'bad payload'); end if;
  -- Only store non-empty snapshots so an empty/stale state can never push the
  -- good snapshots out of the bounded window.
  v_has_content := coalesce(p_payload->'bracketPicks', '{}'::jsonb) <> '{}'::jsonb
                or coalesce(p_payload->'groupPositions', '{}'::jsonb) <> '{}'::jsonb;
  if not v_has_content then return jsonb_build_object('ok', true, 'skipped', 'empty'); end if;

  insert into public.pick_backups(user_id, pool_id, payload) values (v_uid, v_pid, p_payload);
  -- Bound growth: keep the latest 12 snapshots per user+pool.
  delete from public.pick_backups b
   where b.user_id = v_uid and b.pool_id = v_pid
     and b.id not in (
       select id from public.pick_backups
        where user_id = v_uid and pool_id = v_pid
        order by created_at desc limit 12);
  return jsonb_build_object('ok', true);
end$function$
;

-- ---- create_pool ----
CREATE OR REPLACE FUNCTION public.create_pool(p_code text, p_name text, p_language text, p_betting_mode text, p_scoring_rules jsonb, p_use_multipliers boolean, p_admin_nickname text, p_recovery_code text, p_signup_source text DEFAULT NULL::text, p_signup_referrer text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_country text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare bare text; hyph text; v_hash text; v_pool_id uuid; v_user_id uuid;
begin
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
end$function$
;

-- ---- delete_pool ----
CREATE OR REPLACE FUNCTION public.delete_pool(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_admin uuid; v_pid uuid;
begin
  select aa.v_admin, aa.v_pid into v_admin, v_pid from public._auth_admin(p_code) aa;
  -- clear pools.locked_by (NO ACTION FK -> users) so deleting the in-pool users
  -- below isn't blocked while the pool row still references one of them.
  update public.pools set locked_by = null where id = v_pid;
  delete from public.group_position_picks   where pool_id = v_pid;
  delete from public.knockout_picks          where pool_id = v_pid;
  delete from public.tournament_winner_picks where pool_id = v_pid;
  delete from public.sp_third_place_picks    where pool_id = v_pid;
  delete from public.top_scorer_picks        where pool_id = v_pid;
  delete from public.group_picks             where pool_id = v_pid;
  delete from public.admin_actions           where pool_id = v_pid;
  -- user_scores + pending_approvals (prod-only) are ON DELETE CASCADE via user_id,
  -- so deleting the users below clears them automatically (no explicit delete -> safe
  -- on staging which lacks those tables).
  delete from public.users                   where pool_id = v_pid;
  delete from public.pools                   where id = v_pid;
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- get_pick_backup ----
CREATE OR REPLACE FUNCTION public.get_pick_backup(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid; v_pid uuid; v jsonb;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then return null; end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then return null; end if;
  select payload into v from public.pick_backups
    where user_id = v_uid and pool_id = v_pid
    order by created_at desc limit 1;
  return v;
end$function$
;

-- ---- get_public_bracket ----
CREATE OR REPLACE FUNCTION public.get_public_bracket(p_user_id uuid, p_pool_id uuid)
 RETURNS TABLE(bracket_position integer, predicted_winner text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  select k.bracket_position, k.predicted_winner
  from public.knockout_picks k
  where k.user_id = p_user_id
    and k.pool_id = p_pool_id
    and k.bracket_position is not null
  order by k.bracket_position;
$function$
;

-- ---- join_pool ----
CREATE OR REPLACE FUNCTION public.join_pool(p_pool_code text, p_nickname text, p_recovery_code text, p_signup_source text DEFAULT NULL::text, p_signup_referrer text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_country text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare bare text; hyph text; v_hash text; v_pool public.pools; v_uid uuid;
begin
  bare := upper(regexp_replace(coalesce(p_recovery_code,''),'[^A-Za-z0-9]','','g'));
  if length(bare) < 12 then raise exception 'invalid recovery code'; end if;
  if coalesce(btrim(p_nickname),'')='' then raise exception 'missing nickname'; end if;
  if length(coalesce(p_nickname,'')) > 60 then raise exception 'nickname too long'; end if;
  select * into v_pool from public.pools where code = p_pool_code;
  if v_pool.id is null then raise exception 'pool not found'; end if;
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
end$function$
;

-- ---- login ----
CREATE OR REPLACE FUNCTION public.login(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare bare text; hyph text; rec jsonb;
begin
  if p_code is null or length(p_code) > 200 then return null; end if;
  bare := upper(regexp_replace(p_code,'[^A-Za-z0-9]','','g'));
  if length(bare) < 12 then return null; end if;
  hyph := regexp_replace(bare,'(.{4})(?=.)','\1-','g');
  select to_jsonb(u) - 'recovery_code_hash' into rec from public.users u
   where u.recovery_code_hash in (encode(extensions.digest(hyph,'sha256'),'hex'),
                                  encode(extensions.digest(bare,'sha256'),'hex'))
   order by u.id limit 1;
  return rec;
end$function$
;

-- ---- mark_predictions_submitted ----
CREATE OR REPLACE FUNCTION public.mark_predictions_submitted(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  update public.users set predictions_submitted_at = coalesce(predictions_submitted_at, now())
    where id = v_uid;
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- pool_knockout_gap_count ----
CREATE OR REPLACE FUNCTION public.pool_knockout_gap_count(p_pool_id uuid, p_exclude uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
  with grp as (select user_id, count(*) n from public.group_position_picks where pool_id = p_pool_id group by 1),
       brk as (select user_id, count(*) n from public.knockout_picks
               where pool_id = p_pool_id and bracket_position is not null group by 1)
  select count(*)::int
  from public.users u
  join public.pools p on p.id = u.pool_id and p.betting_mode = 'single_phase'
  left join grp on grp.user_id = u.id
  left join brk on brk.user_id = u.id
  where u.pool_id = p_pool_id
    and (p_exclude is null or u.id <> p_exclude)
    and coalesce(grp.n, 0) >= 48
    and coalesce(brk.n, 0) < 31;
$function$
;

-- ---- remove_member ----
CREATE OR REPLACE FUNCTION public.remove_member(p_code text, p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_admin uuid; v_pid uuid; v_nick text; v_tadmin boolean;
begin
  select aa.v_admin, aa.v_pid into v_admin, v_pid from public._auth_admin(p_code) aa;
  if p_member_id = v_admin then raise exception 'cannot remove yourself'; end if;
  -- lock the target row so its pool/admin status can't change between check & delete.
  select nickname, is_admin into v_nick, v_tadmin
    from public.users where id = p_member_id and pool_id = v_pid for update;
  if not found then raise exception 'member not in your pool'; end if;
  if coalesce(v_tadmin,false) then raise exception 'cannot remove an admin'; end if;
  perform public._purge_user_picks(p_member_id);   -- explicit; not reliant on FK cascade
  perform public._detach_user_refs(p_member_id);   -- clear NO ACTION FKs (approved_by, admin_actions, locked_by)
  delete from public.users where id = p_member_id;
  -- target_user_id stays NULL: the member row was just deleted and the FK
  -- admin_actions.target_user_id -> users would reject a now-missing id. The
  -- removed member's identity is preserved in details instead.
  insert into public.admin_actions(pool_id,admin_id,action_type,target_user_id,details)
    values(v_pid,v_admin,'USER_REMOVED',null,jsonb_build_object('nickname',v_nick,'member_id',p_member_id));
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- save_group_picks_2p ----
CREATE OR REPLACE FUNCTION public.save_group_picks_2p(p_code text, p_picks jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid; v_pid uuid; v_rules jsonb; v_um boolean;
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 64 then raise exception 'bad payload'; end if;
  if jsonb_array_length(p_picks) = 0 then return jsonb_build_object('ok',true,'skipped','empty'); end if; -- empty = no-op, never wipe
  if exists(select 1 from jsonb_array_elements(p_picks) e where
       coalesce(e->>'group_letter','') !~ '^[A-L]$' or coalesce(btrim(e->>'team_code'),'')='' ) then
    raise exception 'invalid pick payload';
  end if;
  select scoring_rules, use_multipliers into v_rules, v_um from public.pools where id = v_pid;
  delete from public.group_picks where user_id = v_uid and pool_id = v_pid;
  begin
    -- multiple teams per group are valid (2-phase = "who advances"); dedup only
    -- EXACT (group_letter, team_code) duplicates. multiplier computed server-side.
    insert into public.group_picks(pool_id,user_id,group_letter,team_code,multiplier_applied)
      select distinct on (e->>'group_letter', e->>'team_code')
             v_pid, v_uid, e->>'group_letter', e->>'team_code',
             public._pool_team_mult(v_rules, v_um, e->>'team_code')
      from jsonb_array_elements(p_picks) e
      order by e->>'group_letter', e->>'team_code';
  exception when foreign_key_violation then raise exception 'unknown team code in picks';
  end;
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- save_group_position_picks ----
CREATE OR REPLACE FUNCTION public.save_group_position_picks(p_code text, p_picks jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid; v_pid uuid;
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 200 then raise exception 'bad payload'; end if;
  if jsonb_array_length(p_picks) = 0 then return jsonb_build_object('ok',true,'skipped','empty'); end if; -- empty = no-op, never wipe
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
end$function$
;

-- ---- save_knockout_bracket ----
CREATE OR REPLACE FUNCTION public.save_knockout_bracket(p_code text, p_picks jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid; v_pid uuid;
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 64 then raise exception 'bad payload'; end if;
  if jsonb_array_length(p_picks) = 0 then return jsonb_build_object('ok',true,'skipped','empty'); end if; -- empty = no-op, never wipe
  if exists(select 1 from jsonb_array_elements(p_picks) e where
       coalesce(e->>'bracket_position','') !~ '^([1-9]|[12][0-9]|3[01])$'
       or coalesce(btrim(e->>'predicted_winner'),'')='' ) then
    raise exception 'invalid bracket payload';
  end if;
  if exists(select 1 from jsonb_array_elements(p_picks) e
            where e->>'predicted_winner' not in (select code from public.teams)) then
    raise exception 'unknown team code in bracket';
  end if;
  -- v2.9.x: also clear any stray sp_1..sp_31 rows (incl. bracket_position NULL) so
  -- the re-insert below can't hit the (user_id, match_id) unique constraint.
  -- Scoped to this caller + the synthetic single-phase namespace only.
  delete from public.knockout_picks
   where user_id = v_uid and pool_id = v_pid
     and (bracket_position is not null
          or match_id ~ '^sp_([1-9]|[12][0-9]|3[01])$');
  begin
    insert into public.knockout_picks(pool_id,user_id,match_id,round,predicted_winner,bracket_position)
      select distinct on ((e->>'bracket_position')::int)
             v_pid, v_uid, e->>'match_id', e->>'round', e->>'predicted_winner', (e->>'bracket_position')::int
      from jsonb_array_elements(p_picks) e
      order by (e->>'bracket_position')::int;
  exception when foreign_key_violation then raise exception 'unknown team code in bracket';
  end;
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- save_knockout_picks_2p ----
CREATE OR REPLACE FUNCTION public.save_knockout_picks_2p(p_code text, p_picks jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid; v_pid uuid; v_rules jsonb; v_um boolean;
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 64 then raise exception 'bad payload'; end if;
  if jsonb_array_length(p_picks) = 0 then return jsonb_build_object('ok',true,'skipped','empty'); end if; -- empty = no-op, never wipe
  if exists(select 1 from jsonb_array_elements(p_picks) e where
       coalesce(btrim(e->>'match_id'),'')='' or coalesce(btrim(e->>'predicted_winner'),'')='' ) then
    raise exception 'invalid bracket payload';
  end if;
  -- predicted_winner has NO teams FK -> validate explicitly (XSS-via-render defense).
  if exists(select 1 from jsonb_array_elements(p_picks) e
            where e->>'predicted_winner' not in (select code from public.teams)) then
    raise exception 'unknown team code in bracket';
  end if;
  select scoring_rules, use_multipliers into v_rules, v_um from public.pools where id = v_pid;
  delete from public.knockout_picks where user_id = v_uid and pool_id = v_pid and bracket_position is null;
  begin
    insert into public.knockout_picks(pool_id,user_id,match_id,round,predicted_winner,multiplier_applied)
      select distinct on (e->>'match_id')
             v_pid, v_uid, e->>'match_id', e->>'round', e->>'predicted_winner',
             public._pool_team_mult(v_rules, v_um, e->>'predicted_winner')
      from jsonb_array_elements(p_picks) e
      order by e->>'match_id';
  exception when foreign_key_violation then raise exception 'unknown team code in bracket';
  end;
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- save_top_scorer ----
CREATE OR REPLACE FUNCTION public.save_top_scorer(p_code text, p_player_id text, p_player_name text, p_team_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid; v_pid uuid;
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  if length(coalesce(p_player_id,'')) > 64 or length(coalesce(p_player_name,'')) > 120 or length(coalesce(p_team_code,'')) > 8 then raise exception 'bad payload'; end if;
  delete from public.top_scorer_picks where user_id = v_uid and pool_id = v_pid;
  if coalesce(btrim(p_player_id),'') <> '' then
    begin
      insert into public.top_scorer_picks(pool_id,user_id,player_id,player_name,team_code) values(v_pid,v_uid,p_player_id,p_player_name,p_team_code);
    exception when foreign_key_violation then raise exception 'unknown player or team';
    end;
  end if;
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- save_tournament_winner ----
CREATE OR REPLACE FUNCTION public.save_tournament_winner(p_code text, p_team_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid; v_pid uuid;
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  if length(coalesce(p_team_code,'')) > 8 then raise exception 'bad team'; end if;
  delete from public.tournament_winner_picks where user_id = v_uid and pool_id = v_pid;
  if coalesce(btrim(p_team_code),'') <> '' then
    begin
      insert into public.tournament_winner_picks(pool_id,user_id,team_code) values(v_pid,v_uid,p_team_code);
    exception when foreign_key_violation then raise exception 'unknown team code';
    end;
  end if;
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- set_pool_lock ----
CREATE OR REPLACE FUNCTION public.set_pool_lock(p_code text, p_locked boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_admin uuid; v_pid uuid;
begin
  select aa.v_admin, aa.v_pid into v_admin, v_pid from public._auth_admin(p_code) aa;
  update public.pools set
    is_locked = coalesce(p_locked,false),
    locked_at = case when p_locked then now() else null end,
    locked_by = case when p_locked then v_admin else null end
    where id = v_pid;
  insert into public.admin_actions(pool_id,admin_id,action_type)
    values(v_pid,v_admin, case when p_locked then 'POOL_LOCKED' else 'POOL_UNLOCKED' end);
  return jsonb_build_object('ok',true);
end$function$
;

-- ---- update_pool_settings ----
CREATE OR REPLACE FUNCTION public.update_pool_settings(p_code text, p_settings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_admin uuid; v_pid uuid;
begin
  select aa.v_admin, aa.v_pid into v_admin, v_pid from public._auth_admin(p_code) aa;
  if jsonb_typeof(p_settings) <> 'object' then raise exception 'bad payload'; end if;
  if p_settings ? 'name' and (coalesce(btrim(p_settings->>'name'),'')='' or length(p_settings->>'name')>120) then
    raise exception 'invalid name'; end if;
  -- INTEGRITY: once the pool is locked (tournament started) scoring-affecting
  -- fields are frozen, so points can't be retroactively shifted. name/language/
  -- max_participants stay editable.
  if exists(select 1 from public.pools where id=v_pid and (is_locked or locked_at is not null))
     and (p_settings ?| array['scoring_rules','use_multipliers','num_stages','group_pick_type',
            'scoring_group_stage','scoring_r32','scoring_r16','scoring_qf','scoring_sf',
            'scoring_final','top_scorer_enabled','top_scorer_bonus'])
  then raise exception 'cannot change scoring after the pool is locked'; end if;
  if p_settings ? 'scoring_rules' and length((p_settings->'scoring_rules')::text) > 20000 then
    raise exception 'scoring_rules too large'; end if;
  update public.pools set
    name                = case when p_settings ? 'name' then p_settings->>'name' else name end,
    language            = case when p_settings ? 'language' then p_settings->>'language' else language end,
    use_multipliers     = case when p_settings ? 'use_multipliers' then (p_settings->>'use_multipliers')::boolean else use_multipliers end,
    scoring_rules       = case when p_settings ? 'scoring_rules' then p_settings->'scoring_rules' else scoring_rules end,
    num_stages          = case when p_settings ? 'num_stages' then (p_settings->>'num_stages')::int else num_stages end,
    group_pick_type     = case when p_settings ? 'group_pick_type' then p_settings->>'group_pick_type' else group_pick_type end,
    scoring_group_stage = case when p_settings ? 'scoring_group_stage' then (p_settings->>'scoring_group_stage')::int else scoring_group_stage end,
    scoring_r32         = case when p_settings ? 'scoring_r32' then (p_settings->>'scoring_r32')::int else scoring_r32 end,
    scoring_r16         = case when p_settings ? 'scoring_r16' then (p_settings->>'scoring_r16')::int else scoring_r16 end,
    scoring_qf          = case when p_settings ? 'scoring_qf' then (p_settings->>'scoring_qf')::int else scoring_qf end,
    scoring_sf          = case when p_settings ? 'scoring_sf' then (p_settings->>'scoring_sf')::int else scoring_sf end,
    scoring_final       = case when p_settings ? 'scoring_final' then (p_settings->>'scoring_final')::int else scoring_final end,
    top_scorer_enabled  = case when p_settings ? 'top_scorer_enabled' then (p_settings->>'top_scorer_enabled')::boolean else top_scorer_enabled end,
    top_scorer_bonus    = case when p_settings ? 'top_scorer_bonus' then (p_settings->>'top_scorer_bonus')::int else top_scorer_bonus end,
    max_participants    = case when p_settings ? 'max_participants' then (p_settings->>'max_participants')::int else max_participants end
    where id = v_pid;
  insert into public.admin_actions(pool_id,admin_id,action_type) values(v_pid,v_admin,'POOL_SETTINGS_UPDATED');
  return jsonb_build_object('ok',true);
exception when invalid_text_representation or numeric_value_out_of_range then
  -- a non-numeric/non-boolean value for an int/bool setting -> friendly error,
  -- not a raw Postgres 500 leaking the column/type.
  raise exception 'invalid settings value';
end$function$
;

