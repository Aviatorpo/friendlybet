-- ============================================================
-- 2026-06-29: admin-selected two-phase knockout reopen
-- ============================================================
-- After the two-phase knockout window closes, allow a pool admin to open a
-- per-user knockout correction grant for any member in that same pool,
-- including the admin. The save RPC remains grant-gated and still freezes
-- matches that already started, plus dependent downstream matches.

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
    from public.users u
    join public.pools p on p.id = u.pool_id
   where u.id = v_admin;

  if v_pid is null or coalesce(v_is_admin,false) = false or v_mode <> 'two_phase' then
    return '[]'::jsonb;
  end if;

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
    ) order by u.is_admin desc, u.nickname)
    from public.users u
    left join public.knockout_reopen_grants gr
      on gr.user_id = u.id
     and gr.pool_id = u.pool_id
     and gr.incident_key = 'two_phase_r16_2026'
    where u.pool_id = v_pid
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
  v_affected boolean := false;
begin
  if now() < public._late_knockout_cutoff() then
    return jsonb_build_object('ok',false,'reason','not_closed');
  end if;

  v_admin := public._uid_from_code(p_code);
  if v_admin is null then return jsonb_build_object('ok',false,'reason','invalid_code'); end if;

  select u.pool_id, u.is_admin, p.betting_mode into v_pid, v_is_admin, v_mode
    from public.users u
    join public.pools p on p.id = u.pool_id
   where u.id = v_admin;

  if v_pid is null or coalesce(v_is_admin,false) = false or v_mode <> 'two_phase' then
    return jsonb_build_object('ok',false,'reason','not_admin');
  end if;

  select pool_id into v_tpid from public.users where id = p_target_user;
  if v_tpid is null or v_tpid <> v_pid then
    return jsonb_build_object('ok',false,'reason','wrong_pool');
  end if;

  v_affected := public._tp_r16_incident_affected(p_target_user, v_pid);

  insert into public.knockout_reopen_grants(
    user_id, pool_id, approved_by, expires_at, reason, incident_key, impact_kind, impact_details, revoked_at, used_at
  ) values (
    p_target_user, v_pid, v_admin, now() + interval '7 days', 'admin_manual_two_phase_reopen',
    'two_phase_r16_2026',
    case when v_affected then 'r16_bracket_incident' else 'admin_manual_reopen' end,
    jsonb_build_object(
      'reopen_scope', 'two_phase_admin_manual',
      'admin_reason', left(coalesce(p_reason,''),240),
      'affected_by_incident', v_affected
    ),
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

revoke all on function public.admin_two_phase_knockout_reopen_members(text) from public;
grant execute on function public.admin_two_phase_knockout_reopen_members(text) to anon, authenticated;
revoke all on function public.approve_two_phase_knockout_reopen(text,uuid,text) from public;
grant execute on function public.approve_two_phase_knockout_reopen(text,uuid,text) to anon, authenticated;
