-- ============================================================
-- 2026-06-10: 72h knockout recovery for bug-affected users (admin-approved)
-- ============================================================
-- Emergency, tightly-scoped path: an affected single-phase user may re-enter ONLY
-- their knockout bracket after the pool locks, for up to 72h after kickoff, after
-- their pool admin (or owner) approves them. Does NOT touch _auth_writer or the
-- normal save_knockout_bracket (both stay lock-rejecting). The ONLY post-lock
-- bracket write path. Champion stays LOCKED (bracket pos 31 must equal the saved
-- tournament winner). Third-place advancers must already exist (the bracket is
-- built from them). Idempotent.
--
-- GLOBAL CAP: 2026-06-14 19:00 UTC (kickoff 2026-06-11 19:00 UTC + 72h).
-- ⚠️ DRIFT: must match scripts/lock-pools.js LOCK_KICKOFF_ISO + 72h. Update both if kickoff moves.

create table if not exists public.knockout_reopen_grants (
  user_id     uuid not null,
  pool_id     uuid not null,
  approved_by uuid,
  approved_at timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  reason      text,
  created_at  timestamptz not null default now(),
  primary key (user_id, pool_id)
);
alter table public.knockout_reopen_grants enable row level security;
revoke all on public.knockout_reopen_grants from anon, authenticated;  -- only SECURITY DEFINER RPCs touch it

-- Strict eligibility (used at BOTH approval and save). All must hold:
-- single-phase pool · submitted · 48 group picks · exactly 8 third-place advancers
-- · exactly 1 tournament winner · live bracket < 31.
create or replace function public._knockout_reopen_eligible(v_uid uuid, v_pid uuid)
returns boolean language sql security definer set search_path to '' stable as $$
  select
    exists(select 1 from public.pools p where p.id=v_pid and p.betting_mode='single_phase')
    and exists(select 1 from public.users u where u.id=v_uid and u.pool_id=v_pid and u.predictions_submitted_at is not null)
    and (select count(*) from public.group_position_picks g where g.user_id=v_uid and g.pool_id=v_pid) >= 48
    and (select count(*) from public.sp_third_place_picks t where t.user_id=v_uid and t.pool_id=v_pid) = 8
    and (select count(*) from public.tournament_winner_picks w where w.user_id=v_uid and w.pool_id=v_pid) = 1
    and (select count(*) from public.knockout_picks k where k.user_id=v_uid and k.pool_id=v_pid and k.bracket_position is not null) < 31;
$$;

-- Admin approval (caller is an admin of the same pool, via recovery code).
create or replace function public.approve_knockout_reopen(p_code text, p_target_user uuid)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '8s' as $$
declare v_admin uuid; v_pid uuid; v_tpid uuid; v_cap constant timestamptz := timestamptz '2026-06-14 19:00:00+00';
begin
  v_admin := public._uid_from_code(p_code);
  if v_admin is null then return jsonb_build_object('ok',false); end if;
  select u.pool_id into v_pid from public.users u where u.id=v_admin and u.is_admin = true;
  if v_pid is null then return jsonb_build_object('ok',false); end if;                 -- caller not an admin
  select u.pool_id into v_tpid from public.users u where u.id=p_target_user;
  if v_tpid is null or v_tpid <> v_pid then return jsonb_build_object('ok',false); end if; -- not same pool (no existence oracle)
  if now() >= v_cap then return jsonb_build_object('ok',false,'reason','window_closed'); end if;
  if not public._knockout_reopen_eligible(p_target_user, v_pid) then return jsonb_build_object('ok',false,'reason','not_eligible'); end if;
  insert into public.knockout_reopen_grants(user_id,pool_id,approved_by,expires_at,reason)
    values(p_target_user, v_pid, v_admin, least(now()+interval '72 hours', v_cap), 'admin_approved')
    on conflict (user_id,pool_id) do update
      set approved_by=excluded.approved_by, approved_at=now(),
          expires_at=least(now()+interval '72 hours', v_cap), used_at=null, reason='admin_approved';
  return jsonb_build_object('ok',true);
end$$;

-- Owner approval (service-role only — server-side tooling, NOT a browser secret).
create or replace function public.owner_approve_knockout_reopen(p_target_user uuid)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '8s' as $$
declare v_pid uuid; v_cap constant timestamptz := timestamptz '2026-06-14 19:00:00+00';
begin
  select u.pool_id into v_pid from public.users u where u.id=p_target_user;
  if v_pid is null then return jsonb_build_object('ok',false); end if;
  if now() >= v_cap then return jsonb_build_object('ok',false,'reason','window_closed'); end if;
  if not public._knockout_reopen_eligible(p_target_user, v_pid) then return jsonb_build_object('ok',false,'reason','not_eligible'); end if;
  insert into public.knockout_reopen_grants(user_id,pool_id,approved_by,expires_at,reason)
    values(p_target_user, v_pid, null, least(now()+interval '72 hours', v_cap), 'owner_approved')
    on conflict (user_id,pool_id) do update
      set approved_at=now(), expires_at=least(now()+interval '72 hours', v_cap), used_at=null, reason='owner_approved';
  return jsonb_build_object('ok',true);
end$$;

-- The ONLY post-lock bracket write path. Mirrors save_knockout_bracket's validation
-- + defensive delete, adds the grant/lock/eligibility/champion-match gates.
create or replace function public.save_knockout_bracket_reopen(p_code text, p_picks jsonb)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '8s' as $$
declare v_uid uuid; v_pid uuid; v_champ text; v_pos31 text; v_cnt int;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select u.pool_id into v_pid from public.users u where u.id=v_uid;
  if v_pid is null then raise exception 'no pool'; end if;
  -- must be a LOCKED single-phase pool
  if not exists(select 1 from public.pools p where p.id=v_pid and p.betting_mode='single_phase'
                and (p.locked_at is not null or coalesce(p.is_locked,false)=true)) then
    raise exception 'pool not locked / not single-phase'; end if;
  -- active, unexpired, unused grant
  if not exists(select 1 from public.knockout_reopen_grants gr
                where gr.user_id=v_uid and gr.pool_id=v_pid and gr.used_at is null and gr.expires_at > now()) then
    raise exception 'no active recovery grant'; end if;
  -- re-check full eligibility (groups 48 / third-place 8 / champion 1 / bracket<31 / single-phase)
  if not public._knockout_reopen_eligible(v_uid, v_pid) then raise exception 'not eligible'; end if;
  -- payload validation (same strictness as save_knockout_bracket)
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 64 then raise exception 'bad payload'; end if;
  if jsonb_array_length(p_picks) = 0 then return jsonb_build_object('ok',true,'skipped','empty'); end if;
  if exists(select 1 from jsonb_array_elements(p_picks) e where
       coalesce(e->>'bracket_position','') !~ '^([1-9]|[12][0-9]|3[01])$'
       or coalesce(btrim(e->>'predicted_winner'),'')='') then raise exception 'invalid bracket payload'; end if;
  if exists(select 1 from jsonb_array_elements(p_picks) e
            where e->>'predicted_winner' not in (select code from public.teams)) then
    raise exception 'unknown team code in bracket'; end if;
  -- CHAMPION LOCK: if the payload includes position 31, it MUST equal the saved champion.
  select team_code into v_champ from public.tournament_winner_picks where user_id=v_uid and pool_id=v_pid;
  if v_champ is null then raise exception 'no saved champion'; end if;
  select e->>'predicted_winner' into v_pos31 from jsonb_array_elements(p_picks) e where (e->>'bracket_position')::int = 31;
  if v_pos31 is not null and v_pos31 <> v_champ then raise exception 'final must equal locked champion'; end if;
  -- defensive delete (sp_ namespace incl. null-position strays) + insert
  delete from public.knockout_picks where user_id=v_uid and pool_id=v_pid
    and (bracket_position is not null or match_id ~ '^sp_([1-9]|[12][0-9]|3[01])$');
  begin
    insert into public.knockout_picks(pool_id,user_id,match_id,round,predicted_winner,bracket_position)
      select distinct on ((e->>'bracket_position')::int)
             v_pid, v_uid, e->>'match_id', e->>'round', e->>'predicted_winner', (e->>'bracket_position')::int
      from jsonb_array_elements(p_picks) e order by (e->>'bracket_position')::int;
  exception when foreign_key_violation then raise exception 'unknown team code in bracket'; end;
  -- one-shot: mark the grant used once the bracket is complete
  select count(*) into v_cnt from public.knockout_picks
    where user_id=v_uid and pool_id=v_pid and bracket_position is not null;
  if v_cnt >= 31 then
    update public.knockout_reopen_grants set used_at=now() where user_id=v_uid and pool_id=v_pid;
  end if;
  return jsonb_build_object('ok',true,'saved',v_cnt);
end$$;

-- Client read-path so the UI can render the right banner (no member/PII leakage).
create or replace function public.my_knockout_reopen(p_code text)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '5s' as $$
declare v_uid uuid; v_pid uuid; v_locked boolean; v_eligible boolean; v_g record;
  v_cap constant timestamptz := timestamptz '2026-06-14 19:00:00+00';
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
    'approved', (v_g.user_id is not null and v_g.used_at is null and v_g.expires_at > now()),
    'used', (v_g.user_id is not null and v_g.used_at is not null),
    'expires_at', v_g.expires_at,
    'can_reenter', (coalesce(v_locked,false) and v_eligible and v_g.user_id is not null
                    and v_g.used_at is null and v_g.expires_at > now() and now() < v_cap)
  );
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
