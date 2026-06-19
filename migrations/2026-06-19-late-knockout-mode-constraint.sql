begin;

alter table public.pools
  drop constraint if exists pools_betting_mode_check;

alter table public.pools
  add constraint pools_betting_mode_check
  check (betting_mode = any (array['single_phase'::text, 'two_phase'::text, 'late_knockout'::text]));

commit;
