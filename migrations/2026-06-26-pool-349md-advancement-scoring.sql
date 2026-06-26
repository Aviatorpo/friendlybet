-- Chairman-approved one-pool override:
-- Pool 349MD scores single-phase group picks by advancement, not exact position.
-- Multipliers and the existing per-advancer base point (group_first) still apply.

begin;

update public.pools
set scoring_rules = coalesce(scoring_rules, '{}'::jsonb)
  || '{"group_scoring_mode":"advancement"}'::jsonb
where code = '349MD';

do $$
begin
  if not exists (
    select 1
    from public.pools
    where code = '349MD'
      and scoring_rules->>'group_scoring_mode' = 'advancement'
  ) then
    raise exception 'pool 349MD advancement scoring update failed';
  end if;
end $$;

commit;
