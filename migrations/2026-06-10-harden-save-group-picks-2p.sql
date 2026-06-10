-- ============================================================================
-- 2026-06-10  Harden save_group_picks_2p against impossible scoring shapes
-- ----------------------------------------------------------------------------
-- The RPC stored almost anything (any [A-L] letter + any non-empty team_code, up
-- to 64 rows), so a client bug or tampering could persist team-in-wrong-group,
-- the same team advancing from two groups, >3 per group, or an over-complete
-- (>32) set that inflates two-phase group scoring. This adds server-side
-- validation while still allowing partial DRAFT autosaves (any valid subset of a
-- legal 32-pick set). Empty payload stays a no-op (never wipes). The matching
-- client guard caps total picks at 32 so a legal in-progress draft never trips
-- the new limit.
--
-- WC2026: 12 groups x 4. Knockout = 32 (top-2 of each group = 24, plus 8 best
-- third-placed teams), so a complete advancing set is EXACTLY 32 with 2-3 per
-- group. This RPC enforces the upper bounds (<=3/group, <=32 total, correct
-- membership, no team in two groups); the exact-32 + >=2/group final shape is
-- enforced by the client (finishGroupBetting) and by scoring.
--
-- Idempotent CREATE OR REPLACE; signature unchanged.
-- ============================================================================
create or replace function public.save_group_picks_2p(p_code text, p_picks jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare
  v_uid uuid; v_pid uuid; v_rules jsonb; v_um boolean;
  -- canonical WC2026 team -> group membership
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
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 64 then raise exception 'bad payload'; end if;
  if jsonb_array_length(p_picks) = 0 then return jsonb_build_object('ok',true,'skipped','empty'); end if; -- empty = no-op, never wipe
  if exists(select 1 from jsonb_array_elements(p_picks) e where
       coalesce(e->>'group_letter','') !~ '^[A-L]$' or coalesce(btrim(e->>'team_code'),'')='' ) then
    raise exception 'invalid pick payload';
  end if;
  -- (1) every team must belong to the group it was picked under (this also
  --     rejects unknown team codes — they map to null and fail the comparison).
  if exists(select 1 from jsonb_array_elements(p_picks) e
            where v_groups->>(e->>'team_code') is distinct from (e->>'group_letter')) then
    raise exception 'team does not belong to its group';
  end if;
  -- (2) at most 3 advancing picks per group.
  if exists(select 1 from (
        select e->>'group_letter' gl, count(distinct e->>'team_code') n
        from jsonb_array_elements(p_picks) e group by 1) g where g.n > 3) then
    raise exception 'too many picks in a group (max 3)';
  end if;
  -- (3) at most 32 distinct advancing picks total (over-complete is invalid).
  if (select count(*) from (
        select distinct e->>'group_letter' gl, e->>'team_code' tc
        from jsonb_array_elements(p_picks) e) d) > 32 then
    raise exception 'too many advancing picks (max 32)';
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
end$function$;
