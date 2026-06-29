-- ============================================================================
-- 2026-06-29  Heal two-phase group picks from durable backups
-- ----------------------------------------------------------------------------
-- Restores live group_picks only when:
--   * the pool is two_phase;
--   * live group_picks are incomplete (< 32 rows);
--   * pick_backups contains a valid complete 32-pick groupPositions snapshot;
--   * every restored team belongs to its declared group.
--
-- The restore is idempotent and does not invent picks. It mirrors the client
-- auto-heal path, but runs server-side for users whose rows disappeared.
-- ============================================================================

create or replace function public.heal_two_phase_group_picks_from_backup(
  p_pool_ids text default '',
  p_user_ids text default '',
  p_limit int default 500
) returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout to '60s'
as $function$
declare
  v_pool_ids uuid[] := coalesce(
    (select array_agg(trim(raw)::uuid) from unnest(string_to_array(coalesce(p_pool_ids, ''), ',')) as item(raw) where trim(raw) <> ''),
    '{}'::uuid[]
  );
  v_user_ids uuid[] := coalesce(
    (select array_agg(trim(raw)::uuid) from unnest(string_to_array(coalesce(p_user_ids, ''), ',')) as item(raw) where trim(raw) <> ''),
    '{}'::uuid[]
  );
  v_limit int := greatest(1, least(coalesce(p_limit, 500), 2000));
  v_groups constant jsonb := '{
    "MEX":"A","RSA":"A","KOR":"A","CZE":"A",
    "CAN":"B","BIH":"B","QAT":"B","SUI":"B",
    "BRA":"C","MAR":"C","HAI":"C","SCO":"C",
    "USA":"D","PAR":"D","AUS":"D","TUR":"D",
    "GER":"E","CUR":"E","CIV":"E","ECU":"E",
    "NED":"F","JPN":"F","SWE":"F","TUN":"F",
    "BEL":"G","EGY":"G","IRN":"G","NZL":"G",
    "ESP":"H","CPV":"H","SAU":"H","URU":"H",
    "FRA":"I","SEN":"I","IRQ":"I","NOR":"I",
    "ARG":"J","ALG":"J","AUT":"J","JOR":"J",
    "POR":"K","COD":"K","UZB":"K","COL":"K",
    "ENG":"L","CRO":"L","GHA":"L","PAN":"L"
  }'::jsonb;
  r record;
  v_payload jsonb;
  v_restored_count int;
  v_healed int := 0;
  v_skipped_no_valid_backup int := 0;
  v_details jsonb := '[]'::jsonb;
begin
  for r in
    select u.id as user_id, u.pool_id, u.nickname, p.code as pool_code,
           p.scoring_rules, p.use_multipliers, count(gp.team_code)::int as live_count
    from public.users u
    join public.pools p on p.id = u.pool_id
    left join public.group_picks gp on gp.user_id = u.id and gp.pool_id = u.pool_id
    where p.betting_mode = 'two_phase'
      and (array_length(v_pool_ids, 1) is null or u.pool_id = any(v_pool_ids))
      and (array_length(v_user_ids, 1) is null or u.id = any(v_user_ids))
      and exists (
        select 1 from public.pick_backups b
        where b.user_id = u.id and b.pool_id = u.pool_id
      )
    group by u.id, u.pool_id, u.nickname, p.code, p.scoring_rules, p.use_multipliers
    having count(gp.team_code) < 32
    order by count(gp.team_code) asc, p.code asc, u.nickname asc
    limit v_limit
  loop
    with backups as (
      select b.payload, b.created_at
      from public.pick_backups b
      where b.user_id = r.user_id and b.pool_id = r.pool_id
    ),
    expanded as (
      select b.payload, b.created_at, e.key as group_letter,
             case upper(trim(t.team_code))
               when 'CUW' then 'CUR'
               when 'KSA' then 'SAU'
               else upper(trim(t.team_code))
             end as team_code
      from backups b
      cross join lateral jsonb_each(
        case when jsonb_typeof(b.payload->'groupPositions') = 'object'
          then b.payload->'groupPositions'
          else '{}'::jsonb
        end
      ) e
      cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(e.value) = 'array'
          then e.value
          else '[]'::jsonb
        end
      ) t(team_code)
      where e.key in ('A','B','C','D','E','F','G','H','I','J','K','L')
    ),
    scored as (
      select payload, created_at,
             count(*) as raw_total,
             count(distinct group_letter || ':' || team_code) as distinct_rows,
             count(distinct team_code) as distinct_teams,
             count(*) filter (where v_groups->>team_code is distinct from group_letter) as bad_membership,
             count(distinct group_letter) filter (where group_size between 2 and 3) as valid_group_count
      from (
        select e.*,
               count(*) over (partition by payload, group_letter) as group_size
        from expanded e
      ) s
      group by payload, created_at
    )
    select payload into v_payload
    from scored
    where raw_total = 32
      and distinct_rows = 32
      and distinct_teams = 32
      and bad_membership = 0
      and valid_group_count = 12
    order by created_at desc
    limit 1;

    if v_payload is null then
      v_skipped_no_valid_backup := v_skipped_no_valid_backup + 1;
      continue;
    end if;

    delete from public.group_picks
    where user_id = r.user_id and pool_id = r.pool_id;

    insert into public.group_picks(pool_id, user_id, group_letter, team_code, multiplier_applied)
      select r.pool_id, r.user_id, e.key,
             case upper(trim(t.team_code))
               when 'CUW' then 'CUR'
               when 'KSA' then 'SAU'
               else upper(trim(t.team_code))
             end as team_code,
             public._pool_team_mult(
               r.scoring_rules,
               r.use_multipliers,
               case upper(trim(t.team_code))
                 when 'CUW' then 'CUR'
                 when 'KSA' then 'SAU'
                 else upper(trim(t.team_code))
               end
             )
      from jsonb_each(v_payload->'groupPositions') e
      cross join lateral jsonb_array_elements_text(e.value) t(team_code)
      where e.key in ('A','B','C','D','E','F','G','H','I','J','K','L');

    get diagnostics v_restored_count = row_count;
    v_healed := v_healed + 1;
    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'pool_id', r.pool_id,
      'pool_code', r.pool_code,
      'user_id', r.user_id,
      'nickname', r.nickname,
      'live_count_before', r.live_count,
      'restored_count', v_restored_count
    ));
  end loop;

  return jsonb_build_object(
    'healed', v_healed,
    'skipped_no_valid_backup', v_skipped_no_valid_backup,
    'details', v_details
  );
end
$function$;

revoke all on function public.heal_two_phase_group_picks_from_backup(text, text, int) from public, anon, authenticated;
grant execute on function public.heal_two_phase_group_picks_from_backup(text, text, int) to service_role;

-- Immediate recovery sweep. Safe to re-run: already-complete users are skipped.
select public.heal_two_phase_group_picks_from_backup('', '', 500) as healed_two_phase_group_picks;
