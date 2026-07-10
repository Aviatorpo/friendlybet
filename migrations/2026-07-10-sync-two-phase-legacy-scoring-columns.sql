-- Sync legacy two-phase scoring columns from canonical scoring_rules.
--
-- scoring_rules JSONB is the scorer source of truth. The older scoring_* columns
-- are still present as admin/display fallbacks, so stale values there can mislead
-- old code paths even when scores are correct.
--
-- This migration is conservative:
--   * It updates only two_phase pools.
--   * It copies only integer-valued canonical rule keys.
--   * It updates scoring_group_stage only when group_first == group_second,
--     because the single legacy column cannot represent split group points.
--   * It never changes scoring_rules, picks, users, matches, or scores.

do $$
declare
  v_rows integer;
  v_remaining integer;
begin
  with candidate_values as (
    select
      p.id,
      case
        when (p.scoring_rules->>'group_first') ~ '^-?\d+$'
         and (p.scoring_rules->>'group_second') ~ '^-?\d+$'
         and (p.scoring_rules->>'group_first') = (p.scoring_rules->>'group_second')
          then (p.scoring_rules->>'group_first')::integer
        else p.scoring_group_stage
      end as scoring_group_stage_new,
      case
        when (p.scoring_rules->>'round_of_32') ~ '^-?\d+$'
          then (p.scoring_rules->>'round_of_32')::integer
        else p.scoring_r32
      end as scoring_r32_new,
      case
        when (p.scoring_rules->>'round_of_16') ~ '^-?\d+$'
          then (p.scoring_rules->>'round_of_16')::integer
        else p.scoring_r16
      end as scoring_r16_new,
      case
        when (p.scoring_rules->>'quarter_final') ~ '^-?\d+$'
          then (p.scoring_rules->>'quarter_final')::integer
        else p.scoring_qf
      end as scoring_qf_new,
      case
        when (p.scoring_rules->>'semi_final') ~ '^-?\d+$'
          then (p.scoring_rules->>'semi_final')::integer
        else p.scoring_sf
      end as scoring_sf_new,
      case
        when (p.scoring_rules->>'final') ~ '^-?\d+$'
          then (p.scoring_rules->>'final')::integer
        else p.scoring_final
      end as scoring_final_new,
      case
        when (p.scoring_rules->>'top_scorer') ~ '^-?\d+$'
          then (p.scoring_rules->>'top_scorer')::integer
        else p.top_scorer_bonus
      end as top_scorer_bonus_new
    from public.pools p
    where coalesce(p.betting_mode, 'two_phase') = 'two_phase'
      and p.scoring_rules is not null
  ),
  updated as (
    update public.pools p
       set scoring_group_stage = c.scoring_group_stage_new,
           scoring_r32 = c.scoring_r32_new,
           scoring_r16 = c.scoring_r16_new,
           scoring_qf = c.scoring_qf_new,
           scoring_sf = c.scoring_sf_new,
           scoring_final = c.scoring_final_new,
           top_scorer_bonus = c.top_scorer_bonus_new
      from candidate_values c
     where p.id = c.id
       and (
         p.scoring_group_stage is distinct from c.scoring_group_stage_new
         or p.scoring_r32 is distinct from c.scoring_r32_new
         or p.scoring_r16 is distinct from c.scoring_r16_new
         or p.scoring_qf is distinct from c.scoring_qf_new
         or p.scoring_sf is distinct from c.scoring_sf_new
         or p.scoring_final is distinct from c.scoring_final_new
         or p.top_scorer_bonus is distinct from c.top_scorer_bonus_new
       )
    returning p.id
  )
  select count(*) into v_rows from updated;

  if v_rows > 600 then
    raise exception 'two-phase legacy scoring sync expected <= 600 rows, updated %', v_rows;
  end if;

  select count(*) into v_remaining
  from public.pools p
  where coalesce(p.betting_mode, 'two_phase') = 'two_phase'
    and p.scoring_rules is not null
    and (
      (
        (p.scoring_rules->>'group_first') ~ '^-?\d+$'
        and (p.scoring_rules->>'group_second') ~ '^-?\d+$'
        and (p.scoring_rules->>'group_first') = (p.scoring_rules->>'group_second')
        and p.scoring_group_stage is distinct from (p.scoring_rules->>'group_first')::integer
      )
      or (
        (p.scoring_rules->>'round_of_32') ~ '^-?\d+$'
        and p.scoring_r32 is distinct from (p.scoring_rules->>'round_of_32')::integer
      )
      or (
        (p.scoring_rules->>'round_of_16') ~ '^-?\d+$'
        and p.scoring_r16 is distinct from (p.scoring_rules->>'round_of_16')::integer
      )
      or (
        (p.scoring_rules->>'quarter_final') ~ '^-?\d+$'
        and p.scoring_qf is distinct from (p.scoring_rules->>'quarter_final')::integer
      )
      or (
        (p.scoring_rules->>'semi_final') ~ '^-?\d+$'
        and p.scoring_sf is distinct from (p.scoring_rules->>'semi_final')::integer
      )
      or (
        (p.scoring_rules->>'final') ~ '^-?\d+$'
        and p.scoring_final is distinct from (p.scoring_rules->>'final')::integer
      )
      or (
        (p.scoring_rules->>'top_scorer') ~ '^-?\d+$'
        and p.top_scorer_bonus is distinct from (p.scoring_rules->>'top_scorer')::integer
      )
    );

  if v_remaining <> 0 then
    raise exception 'two-phase legacy scoring sync left % representable mismatch(es)', v_remaining;
  end if;

  raise notice 'two-phase legacy scoring columns synced for % pool(s)', v_rows;
end $$;
