-- ============================================================
-- 2026-06-28: two_phase incident recovery access
-- ============================================================
-- Admin-approved, per-user recovery for the R16 wiring incident.
-- This is available only after the normal pool-wide knockout window closes.
-- The normal save_knockout_picks_2p RPC remains the only pre-cutoff path and
-- still rejects after public._late_knockout_cutoff().

alter table public.knockout_reopen_grants
  add column if not exists incident_key text,
  add column if not exists impact_kind text,
  add column if not exists impact_details jsonb not null default '{}'::jsonb,
  add column if not exists revoked_at timestamptz;

create or replace function public._tp_recovery_match_schedule()
returns table(match_id text, kickoff timestamptz)
language sql
security definer
set search_path to ''
stable as $$
  values
    ('R32_M1','2026-06-28T19:00:00Z'::timestamptz),
    ('R32_M2','2026-06-29T20:30:00Z'::timestamptz),
    ('R32_M3','2026-06-30T01:00:00Z'::timestamptz),
    ('R32_M4','2026-06-29T17:00:00Z'::timestamptz),
    ('R32_M5','2026-06-30T21:00:00Z'::timestamptz),
    ('R32_M6','2026-06-30T17:00:00Z'::timestamptz),
    ('R32_M7','2026-07-01T01:00:00Z'::timestamptz),
    ('R32_M8','2026-07-01T16:00:00Z'::timestamptz),
    ('R32_M9','2026-07-02T00:00:00Z'::timestamptz),
    ('R32_M10','2026-07-01T20:00:00Z'::timestamptz),
    ('R32_M11','2026-07-02T23:00:00Z'::timestamptz),
    ('R32_M12','2026-07-02T19:00:00Z'::timestamptz),
    ('R32_M13','2026-07-03T03:00:00Z'::timestamptz),
    ('R32_M14','2026-07-03T22:00:00Z'::timestamptz),
    ('R32_M15','2026-07-04T01:30:00Z'::timestamptz),
    ('R32_M16','2026-07-03T18:00:00Z'::timestamptz),
    ('R16_M1','2026-07-04T21:00:00Z'::timestamptz),
    ('R16_M2','2026-07-04T17:00:00Z'::timestamptz),
    ('R16_M3','2026-07-05T20:00:00Z'::timestamptz),
    ('R16_M4','2026-07-06T00:00:00Z'::timestamptz),
    ('R16_M5','2026-07-06T19:00:00Z'::timestamptz),
    ('R16_M6','2026-07-07T00:00:00Z'::timestamptz),
    ('R16_M7','2026-07-07T16:00:00Z'::timestamptz),
    ('R16_M8','2026-07-07T20:00:00Z'::timestamptz),
    ('QF_M1','2026-07-09T20:00:00Z'::timestamptz),
    ('QF_M2','2026-07-10T19:00:00Z'::timestamptz),
    ('QF_M3','2026-07-11T21:00:00Z'::timestamptz),
    ('QF_M4','2026-07-12T01:00:00Z'::timestamptz),
    ('SF_M1','2026-07-14T19:00:00Z'::timestamptz),
    ('SF_M2','2026-07-15T19:00:00Z'::timestamptz),
    ('FINAL_M1','2026-07-19T19:00:00Z'::timestamptz)
$$;

create or replace function public._tp_recovery_locked_match_ids(v_now timestamptz default now())
returns text[]
language sql
security definer
set search_path to ''
stable as $$
  with recursive edge(parent_id, child_id) as (
    values
      ('R32_M2','R16_M1'),('R32_M5','R16_M1'),
      ('R32_M1','R16_M2'),('R32_M3','R16_M2'),
      ('R32_M4','R16_M3'),('R32_M6','R16_M3'),
      ('R32_M7','R16_M4'),('R32_M8','R16_M4'),
      ('R32_M11','R16_M5'),('R32_M12','R16_M5'),
      ('R32_M9','R16_M6'),('R32_M10','R16_M6'),
      ('R32_M14','R16_M7'),('R32_M16','R16_M7'),
      ('R32_M13','R16_M8'),('R32_M15','R16_M8'),
      ('R16_M1','QF_M1'),('R16_M2','QF_M1'),
      ('R16_M5','QF_M2'),('R16_M6','QF_M2'),
      ('R16_M3','QF_M3'),('R16_M4','QF_M3'),
      ('R16_M7','QF_M4'),('R16_M8','QF_M4'),
      ('QF_M1','SF_M1'),('QF_M2','SF_M1'),
      ('QF_M3','SF_M2'),('QF_M4','SF_M2'),
      ('SF_M1','FINAL_M1'),('SF_M2','FINAL_M1')
  ),
  ancestors(match_id, ancestor_id) as (
    select child_id, parent_id from edge
    union all
    select a.match_id, e.parent_id
      from ancestors a
      join edge e on e.child_id = a.ancestor_id
  ),
  started as (
    select match_id from public._tp_recovery_match_schedule() where kickoff <= v_now
  )
  select coalesce(array_agg(distinct s.match_id order by s.match_id), array[]::text[])
    from public._tp_recovery_match_schedule() s
   where s.kickoff <= v_now
      or exists (
        select 1
          from ancestors a
          join started st on st.match_id = a.ancestor_id
         where a.match_id = s.match_id
      )
$$;

create or replace function public._tp_r16_incident_affected(v_uid uuid, v_pid uuid)
returns boolean
language sql
security definer
set search_path to ''
stable as $$
  select exists(select 1 from public.pools p where p.id = v_pid and p.betting_mode = 'two_phase')
     and exists(select 1 from public.users u where u.id = v_uid and u.pool_id = v_pid)
     and exists(
       select 1
         from public.knockout_picks k
        where k.user_id = v_uid
          and k.pool_id = v_pid
          and k.bracket_position is null
          and k.created_at >= '2026-06-27T21:00:00Z'::timestamptz
          and k.created_at <  '2026-06-28T10:00:00Z'::timestamptz
     )
$$;

create or replace function public.my_two_phase_knockout_reopen(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout to '5s'
as $$
declare
  v_uid uuid;
  v_pid uuid;
  v_mode text;
  v_affected boolean := false;
  v_g record;
  v_closed boolean;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then return jsonb_build_object('eligible',false,'approved',false,'can_reenter',false); end if;
  select u.pool_id, p.betting_mode into v_pid, v_mode
    from public.users u join public.pools p on p.id = u.pool_id
   where u.id = v_uid;
  if v_pid is null or v_mode <> 'two_phase' then
    return jsonb_build_object('eligible',false,'approved',false,'can_reenter',false);
  end if;

  v_closed := now() >= public._late_knockout_cutoff();
  v_affected := public._tp_r16_incident_affected(v_uid, v_pid);
  select * into v_g
    from public.knockout_reopen_grants
   where user_id = v_uid and pool_id = v_pid and incident_key = 'two_phase_r16_2026';

  return jsonb_build_object(
    'closed', v_closed,
    'eligible', v_affected or v_g.user_id is not null,
    'affected', v_affected,
    'approved', (v_g.user_id is not null and v_g.revoked_at is null and v_g.expires_at > now()),
    'used', (v_g.user_id is not null and v_g.used_at is not null),
    'expires_at', v_g.expires_at,
    'revoked_at', v_g.revoked_at,
    'incident_key', v_g.incident_key,
    'impact_kind', v_g.impact_kind,
    'locked_match_ids', public._tp_recovery_locked_match_ids(),
    'can_reenter', (v_closed and v_g.user_id is not null and v_g.revoked_at is null and v_g.expires_at > now())
  );
end
$$;

create or replace function public.admin_two_phase_knockout_reopen_members(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout to '8s'
as $$
declare
  v_admin uuid;
  v_pid uuid;
  v_is_admin boolean;
  v_mode text;
begin
  v_admin := public._uid_from_code(p_code);
  if v_admin is null then return '[]'::jsonb; end if;
  select u.pool_id, u.is_admin, p.betting_mode into v_pid, v_is_admin, v_mode
    from public.users u join public.pools p on p.id = u.pool_id
   where u.id = v_admin;
  if v_pid is null or coalesce(v_is_admin,false) = false or v_mode <> 'two_phase' then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'affected', public._tp_r16_incident_affected(u.id, v_pid),
      'grant_active', (gr.user_id is not null and gr.revoked_at is null and gr.expires_at > now()),
      'expires_at', gr.expires_at,
      'used_at', gr.used_at,
      'revoked_at', gr.revoked_at,
      'incident_key', gr.incident_key,
      'impact_kind', gr.impact_kind,
      'impact_details', gr.impact_details
    ) order by u.nickname)
    from public.users u
    left join public.knockout_reopen_grants gr
      on gr.user_id = u.id
     and gr.pool_id = u.pool_id
     and gr.incident_key = 'two_phase_r16_2026'
    where u.pool_id = v_pid
      and (public._tp_r16_incident_affected(u.id, v_pid) or gr.user_id is not null)
  ), '[]'::jsonb);
end
$$;

create or replace function public.approve_two_phase_knockout_reopen(p_code text, p_target_user uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout to '8s'
as $$
declare
  v_admin uuid;
  v_pid uuid;
  v_tpid uuid;
  v_is_admin boolean;
  v_mode text;
  v_exp timestamptz;
begin
  if now() < public._late_knockout_cutoff() then
    return jsonb_build_object('ok',false,'reason','not_closed');
  end if;

  v_admin := public._uid_from_code(p_code);
  if v_admin is null then return jsonb_build_object('ok',false,'reason','invalid_code'); end if;
  select u.pool_id, u.is_admin, p.betting_mode into v_pid, v_is_admin, v_mode
    from public.users u join public.pools p on p.id = u.pool_id
   where u.id = v_admin;
  if v_pid is null or coalesce(v_is_admin,false) = false or v_mode <> 'two_phase' then
    return jsonb_build_object('ok',false,'reason','not_admin');
  end if;

  select pool_id into v_tpid from public.users where id = p_target_user;
  if v_tpid is null or v_tpid <> v_pid then return jsonb_build_object('ok',false,'reason','wrong_pool'); end if;
  if not public._tp_r16_incident_affected(p_target_user, v_pid) then
    return jsonb_build_object('ok',false,'reason','not_affected');
  end if;

  insert into public.knockout_reopen_grants(
    user_id, pool_id, approved_by, expires_at, reason, incident_key, impact_kind, impact_details, revoked_at, used_at
  ) values (
    p_target_user, v_pid, v_admin, now() + interval '7 days', 'two_phase_incident_recovery',
    'two_phase_r16_2026', 'r16_bracket_incident',
    jsonb_build_object('reopen_scope','two_phase_incident','admin_reason',left(coalesce(p_reason,''),240)),
    null, null
  )
  on conflict (user_id,pool_id) do update
    set approved_by = excluded.approved_by,
        approved_at = now(),
        expires_at = now() + interval '7 days',
        reason = excluded.reason,
        incident_key = excluded.incident_key,
        impact_kind = excluded.impact_kind,
        impact_details = coalesce(public.knockout_reopen_grants.impact_details,'{}'::jsonb) || excluded.impact_details,
        revoked_at = null,
        used_at = null
  returning expires_at into v_exp;

  return jsonb_build_object('ok',true,'expires_at',v_exp);
end
$$;

create or replace function public.revoke_two_phase_knockout_reopen(p_code text, p_target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout to '8s'
as $$
declare
  v_admin uuid;
  v_pid uuid;
  v_tpid uuid;
  v_is_admin boolean;
  v_mode text;
begin
  v_admin := public._uid_from_code(p_code);
  if v_admin is null then return jsonb_build_object('ok',false,'reason','invalid_code'); end if;
  select u.pool_id, u.is_admin, p.betting_mode into v_pid, v_is_admin, v_mode
    from public.users u join public.pools p on p.id = u.pool_id
   where u.id = v_admin;
  if v_pid is null or coalesce(v_is_admin,false) = false or v_mode <> 'two_phase' then
    return jsonb_build_object('ok',false,'reason','not_admin');
  end if;
  select pool_id into v_tpid from public.users where id = p_target_user;
  if v_tpid is null or v_tpid <> v_pid then return jsonb_build_object('ok',false,'reason','wrong_pool'); end if;

  update public.knockout_reopen_grants
     set revoked_at = now(), expires_at = least(expires_at, now())
   where user_id = p_target_user and pool_id = v_pid and incident_key = 'two_phase_r16_2026';
  return jsonb_build_object('ok',true);
end
$$;

create or replace function public.save_knockout_picks_2p_reopen(p_code text, p_picks jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout to '8s'
as $$
declare
  v_uid uuid;
  v_pid uuid;
  v_mode text;
  v_rules jsonb;
  v_um boolean;
  v_locked text[] := public._tp_recovery_locked_match_ids();
  v_rejected text[];
  v_saved int := 0;
  v_frozen int := 0;
  v_exp timestamptz;
begin
  if now() < public._late_knockout_cutoff() then
    return jsonb_build_object('ok',false,'reason','not_closed');
  end if;

  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select u.pool_id, p.betting_mode, p.scoring_rules, p.use_multipliers into v_pid, v_mode, v_rules, v_um
    from public.users u join public.pools p on p.id = u.pool_id
   where u.id = v_uid;
  if v_pid is null or v_mode <> 'two_phase' then raise exception 'not a two-phase pool'; end if;

  select gr.expires_at into v_exp
    from public.knockout_reopen_grants gr
   where gr.user_id = v_uid
     and gr.pool_id = v_pid
     and gr.incident_key = 'two_phase_r16_2026'
     and gr.revoked_at is null
     and gr.expires_at > now();
  if v_exp is null then raise exception 'no active recovery grant'; end if;

  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 64 then raise exception 'bad payload'; end if;
  if exists(select 1 from jsonb_array_elements(p_picks) e where
       coalesce(btrim(e->>'match_id'),'') = ''
       or coalesce(btrim(e->>'predicted_winner'),'') = ''
       or coalesce(btrim(e->>'round'),'') not in ('R32','R16','QF','SF','FINAL')
       or not exists(select 1 from public._tp_recovery_match_schedule() s where s.match_id = e->>'match_id')) then
    raise exception 'invalid bracket payload';
  end if;
  if exists(select 1 from jsonb_array_elements(p_picks) e
            where e->>'predicted_winner' not in (select code from public.teams)) then
    raise exception 'unknown team code in bracket';
  end if;

  with input as (
    select distinct on (e->>'match_id')
           e->>'match_id' match_id,
           e->>'round' round,
           e->>'predicted_winner' predicted_winner
      from jsonb_array_elements(p_picks) e
     order by e->>'match_id'
  )
  select coalesce(array_agg(i.match_id order by i.match_id), array[]::text[])
    into v_rejected
    from input i
    join public.knockout_picks k
      on k.user_id = v_uid and k.pool_id = v_pid and k.bracket_position is null and k.match_id = i.match_id
   where i.match_id = any(v_locked)
     and coalesce(k.predicted_winner,'') <> i.predicted_winner;

  if array_length(v_rejected, 1) > 0 then
    return jsonb_build_object('ok',false,'reason','locked_changed','rejected',v_rejected,'locked_match_ids',v_locked);
  end if;

  with input as (
    select distinct on (e->>'match_id')
           e->>'match_id' match_id,
           e->>'round' round,
           e->>'predicted_winner' predicted_winner
      from jsonb_array_elements(p_picks) e
     order by e->>'match_id'
  ),
  unlocked as (
    select s.match_id from public._tp_recovery_match_schedule() s where not (s.match_id = any(v_locked))
  )
  delete from public.knockout_picks k
   where k.user_id = v_uid
     and k.pool_id = v_pid
     and k.bracket_position is null
     and k.match_id in (select match_id from unlocked)
     and not exists(select 1 from input i where i.match_id = k.match_id);

  with input as (
    select distinct on (e->>'match_id')
           e->>'match_id' match_id,
           e->>'round' round,
           e->>'predicted_winner' predicted_winner
      from jsonb_array_elements(p_picks) e
     order by e->>'match_id'
  ),
  unlocked_input as (
    select i.* from input i where not (i.match_id = any(v_locked))
  ),
  upserted as (
    insert into public.knockout_picks(pool_id,user_id,match_id,round,predicted_winner,multiplier_applied)
      select v_pid, v_uid, match_id, round, predicted_winner,
             public._pool_team_mult(v_rules, v_um, predicted_winner)
        from unlocked_input
    on conflict (user_id,match_id) do update
      set predicted_winner = excluded.predicted_winner,
          round = excluded.round,
          multiplier_applied = excluded.multiplier_applied
    returning 1
  )
  select count(*) into v_saved from upserted;

  select count(*) into v_frozen
    from jsonb_array_elements(p_picks) e
   where e->>'match_id' = any(v_locked);

  update public.knockout_reopen_grants
     set used_at = now(),
         impact_details = coalesce(impact_details,'{}'::jsonb) || jsonb_build_object(
           'last_save_at', now(),
           'saved_count', v_saved,
           'frozen_count', v_frozen,
           'locked_match_ids', v_locked
         )
   where user_id = v_uid and pool_id = v_pid and incident_key = 'two_phase_r16_2026';

  return jsonb_build_object('ok',true,'saved',v_saved,'frozen',v_frozen,'expires_at',v_exp,'locked_match_ids',v_locked);
end
$$;

revoke all on function public._tp_recovery_match_schedule() from public, anon, authenticated;
revoke all on function public._tp_recovery_locked_match_ids(timestamptz) from public, anon, authenticated;
revoke all on function public._tp_r16_incident_affected(uuid,uuid) from public, anon, authenticated;
revoke all on function public.my_two_phase_knockout_reopen(text) from public;
grant execute on function public.my_two_phase_knockout_reopen(text) to anon, authenticated;
revoke all on function public.admin_two_phase_knockout_reopen_members(text) from public;
grant execute on function public.admin_two_phase_knockout_reopen_members(text) to anon, authenticated;
revoke all on function public.approve_two_phase_knockout_reopen(text,uuid,text) from public;
grant execute on function public.approve_two_phase_knockout_reopen(text,uuid,text) to anon, authenticated;
revoke all on function public.revoke_two_phase_knockout_reopen(text,uuid) from public;
grant execute on function public.revoke_two_phase_knockout_reopen(text,uuid) to anon, authenticated;
revoke all on function public.save_knockout_picks_2p_reopen(text,jsonb) from public;
grant execute on function public.save_knockout_picks_2p_reopen(text,jsonb) to anon, authenticated;
