-- ============================================================
-- get_public_two_phase_bracket: anon-callable read of one user's
-- shareable two-phase knockout picks for the /share page.
-- ============================================================
-- Two-phase knockout rows intentionally store bracket_position as NULL and
-- use match_id slots such as R32_M1, R16_M1, QF_M1, SF_M1, FINAL_M1.
-- get_public_bracket only exposes single-phase bracket_position rows, so
-- two-phase member share pages could show "knockout picks are not available"
-- even after all 31 knockout picks were saved.

create or replace function public.get_public_two_phase_bracket(p_user_id uuid, p_pool_id uuid)
returns table (match_id text, round text, predicted_winner text)
language sql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
  select k.match_id, k.round, k.predicted_winner
  from public.knockout_picks k
  where k.user_id = p_user_id
    and k.pool_id = p_pool_id
    and k.bracket_position is null
    and k.match_id ~ '^(R32|R16|QF|SF|FINAL)_M[0-9]+$'
  order by
    case split_part(k.match_id, '_M', 1)
      when 'R32' then 1
      when 'R16' then 2
      when 'QF' then 3
      when 'SF' then 4
      when 'FINAL' then 5
      else 9
    end,
    nullif(split_part(k.match_id, '_M', 2), '')::int;
$$;

revoke all on function public.get_public_two_phase_bracket(uuid, uuid) from public;
grant execute on function public.get_public_two_phase_bracket(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
