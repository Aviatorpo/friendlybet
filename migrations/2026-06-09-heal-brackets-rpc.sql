-- ============================================================
-- 2026-06-09: heal_brackets_from_backup() — server-side bracket auto-heal
-- ============================================================
-- Restores a full 31-pick bracket from a user's own pick_backups to live
-- knockout_picks for any single-phase user whose live bracket is incomplete.
-- Makes the client 'bracket save didn't land' failure class irrelevant (a server
-- safety net). Idempotent, bracket-only, service_role-gated. Applied to prod
-- 2026-06-09. Called every 10 min by .github/workflows/heal-brackets.yml.
-- Idempotent (CREATE OR REPLACE); safe to re-run.

-- ============================================================
-- heal_brackets_from_backup() — server-side bracket auto-heal (service_role only)
-- ============================================================
-- Why: a class of clients backs up a full 31-pick bracket (pick_backups) but the
-- live save to knockout_picks never lands (client-side failure we can't reliably
-- reproduce). The DB/RPC accept the data fine. This function makes the client
-- failure IRRELEVANT: for any single-phase user whose LIVE bracket < 31 but who
-- has a backup containing a full, valid 31-pick bracket, it restores the bracket
-- to live from their own backup. Idempotent, bracket-only (never touches groups/
-- champion/top-scorer), and safe (only restores the user's own backed-up picks).
--
-- service_role only (called by the scheduled heal workflow with the service key).
-- Mirrors the proven _private/restore-all-recoverable.cjs logic, in SQL.

create or replace function public.heal_brackets_from_backup(p_limit int default 300)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '120s'
as $$
declare
  v_healed int := 0;
  v_scanned int := 0;
  rec record;
  v_bp jsonb;
begin
  for rec in
    select u.id as user_id, u.pool_id
    from public.users u
    join public.pools p on p.id = u.pool_id and p.betting_mode = 'single_phase'
    where (select count(*) from public.knockout_picks k
           where k.user_id = u.id and k.pool_id = u.pool_id and k.bracket_position is not null) < 31
      and exists (select 1 from public.pick_backups b
                  where b.user_id = u.id and b.pool_id = u.pool_id)
    limit p_limit
  loop
    v_scanned := v_scanned + 1;
    -- most recent backup that holds a full 31-pick bracket with all-valid team codes
    select b.payload -> 'bracketPicks' into v_bp
    from public.pick_backups b
    where b.user_id = rec.user_id and b.pool_id = rec.pool_id
      and jsonb_typeof(b.payload -> 'bracketPicks') = 'object'
      and (select count(*) from jsonb_each_text(b.payload -> 'bracketPicks') e where e.value <> '') = 31
      and not exists (
        select 1 from jsonb_each_text(b.payload -> 'bracketPicks') e
        where e.value <> '' and e.value not in (select code from public.teams))
    order by b.created_at desc
    limit 1;

    if v_bp is null then continue; end if;

    delete from public.knockout_picks
      where user_id = rec.user_id and pool_id = rec.pool_id and bracket_position is not null;

    insert into public.knockout_picks(pool_id, user_id, match_id, round, predicted_winner, bracket_position)
    select rec.pool_id, rec.user_id, 'sp_' || k.key,
           case when (k.key)::int <= 16 then 'r32'
                when (k.key)::int <= 24 then 'r16'
                when (k.key)::int <= 28 then 'qf'
                when (k.key)::int <= 30 then 'sf'
                else 'final' end,
           v_bp ->> k.key,
           (k.key)::int
    from jsonb_object_keys(v_bp) as k(key)
    where v_bp ->> k.key <> '';

    v_healed := v_healed + 1;
  end loop;

  return jsonb_build_object('scanned', v_scanned, 'healed', v_healed);
end$$;

revoke all on function public.heal_brackets_from_backup(int) from public, anon, authenticated;
grant execute on function public.heal_brackets_from_backup(int) to service_role;
