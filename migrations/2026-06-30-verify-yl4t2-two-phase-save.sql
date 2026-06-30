-- Rollback-only production smoke test for YL4T2 two-phase knockout saves.
-- This file intentionally leaves no data behind.

begin;

do $$
declare
  v_pid uuid;
  v_uid uuid := gen_random_uuid();
  v_code text := 'TST1-TST2-TST3-TST4';
  v_bare text := regexp_replace(v_code, '[^A-Za-z0-9]', '', 'g');
  v_hyph text := regexp_replace(v_bare, '(.{4})(?=.)', '\1-', 'g');
  v_hash text := encode(extensions.digest(v_hyph, 'sha256'), 'hex');
  v_res jsonb;
begin
  select id into v_pid
  from public.pools
  where code = 'YL4T2';

  if v_pid is null then
    raise exception 'YL4T2 pool not found';
  end if;

  insert into public.users(
    id, pool_id, nickname, recovery_code_hash, is_admin, is_approved,
    approval_status, approved_at
  )
  values (
    v_uid, v_pid, 'Codex save smoke test', v_hash, false, true,
    'approved', now()
  );

  select public.save_knockout_picks_2p(
    v_code,
    '[{"match_id":"codex_smoke_r32","round":"R32","predicted_winner":"ARG"}]'::jsonb
  ) into v_res;

  if coalesce(v_res->>'ok', 'false') <> 'true' then
    raise exception 'save_knockout_picks_2p smoke test failed: %', v_res;
  end if;

  raise notice 'YL4T2 save_knockout_picks_2p smoke test passed: %', v_res;
end $$;

rollback;
