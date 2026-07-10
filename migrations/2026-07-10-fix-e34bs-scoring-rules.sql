-- Repair E34BS scoring_rules drift.
-- The pool's visible legacy settings are 1/2/3/4/8, but the canonical JSONB
-- scorer rules still held 1/2/4/8/16. This guard updates exactly that mismatch.
do $$
declare
  v_pool_id uuid;
  v_admin_id uuid;
  v_rows integer;
begin
  select p.id,
         coalesce(p.admin_user_id, (select u.id from public.users u where u.pool_id = p.id and u.is_admin = true order by u.joined_at asc limit 1))
    into v_pool_id, v_admin_id
  from public.pools p
  where upper(p.code) = 'E34BS'
    and p.betting_mode = 'two_phase'
    and p.scoring_r32 = 1
    and p.scoring_r16 = 2
    and p.scoring_qf = 3
    and p.scoring_sf = 4
    and p.scoring_final = 8
    and p.scoring_rules->>'round_of_32' = '1'
    and p.scoring_rules->>'round_of_16' = '2'
    and p.scoring_rules->>'quarter_final' = '4'
    and p.scoring_rules->>'semi_final' = '8'
    and p.scoring_rules->>'final' = '16';

  if v_pool_id is null then
    raise exception 'E34BS scoring repair guard mismatch; no rows updated';
  end if;

  update public.pools
     set scoring_rules = coalesce(scoring_rules, '{}'::jsonb) || jsonb_build_object(
       'round_of_32', scoring_r32,
       'round_of_16', scoring_r16,
       'quarter_final', scoring_qf,
       'semi_final', scoring_sf,
       'final', scoring_final,
       'top_scorer', top_scorer_bonus
     )
   where id = v_pool_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'E34BS scoring repair expected 1 row, updated %', v_rows;
  end if;

  insert into public.admin_actions(pool_id, admin_id, action_type, details)
  values (
    v_pool_id,
    v_admin_id,
    'POOL_SETTINGS_UPDATED',
    jsonb_build_object(
      'reason', 'scoring_rules repaired to match visible pre-tournament knockout settings',
      'before_knockout', jsonb_build_object('round_of_32',1,'round_of_16',2,'quarter_final',4,'semi_final',8,'final',16),
      'after_knockout', jsonb_build_object('round_of_32',1,'round_of_16',2,'quarter_final',3,'semi_final',4,'final',8),
      'source', '2026-07-10 E34BS scoring audit'
    )
  );
end $$;