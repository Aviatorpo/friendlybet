-- ============================================================
-- 2026-06-09: heal_brackets_from_backup() — server-side bracket auto-heal
-- ============================================================
-- Restores a full 31-pick bracket from a user's own pick_backups to live
-- knockout_picks for any single-phase user whose live bracket is incomplete.
-- Makes the client "bracket save didn't land" failure class irrelevant (a server
-- safety net). Idempotent, bracket-only, service_role-gated.
--
-- Safety (hardened 2026-06-09 after review):
--   * NEVER touches locked pools (and a global match-started gate disables it
--     entirely once the tournament begins) — so it can't change scoring/fairness.
--   * Per-user sub-transaction: one bad user can't abort the whole batch.
--   * Validates the backup has EXACTLY keys "1".."31", all non-empty, all valid
--     team codes — before it deletes anything.
--   * Defensive delete covers the sp_1..sp_31 namespace (even bracket_position
--     NULL strays) so the (user_id,match_id) unique constraint can't fail it.
--   * Touches ONLY single-phase bracket rows (sp_*) — never groups, champion,
--     third-place, top-scorer, or two-phase knockout rows.
--
-- Idempotent (CREATE OR REPLACE); safe to re-run.

create or replace function public.heal_brackets_from_backup(p_limit int default 200)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '120s'
as $$
declare
  v_scanned int := 0;
  v_healed int := 0;
  v_skipped_no_backup int := 0;
  v_skipped_locked int := 0;
  v_failed int := 0;
  v_failures jsonb := '[]'::jsonb;
  v_started boolean;
  v_still_unlocked boolean;
  rec record;
  v_bp jsonb;
begin
  -- HARD GLOBAL GATE: never heal once any real match has kicked off (in addition
  -- to the per-pool locked_at gate below). Defends the window before the lock job
  -- stamps locked_at. After this point picks are final / scoring is live.
  select exists(
    select 1 from public.matches
    where status in ('IN_PLAY','PAUSED','FINISHED','LIVE','AWARDED','SUSPENDED','started','finished')
       or (match_date is not null and match_date <= now())
  ) into v_started;
  if v_started then
    return jsonb_build_object('scanned',0,'healed',0,'skipped_no_valid_backup',0,
      'skipped_locked',0,'failed',0,'note','tournament started — heal disabled');
  end if;

  for rec in
    select u.id as user_id, u.pool_id
    from public.users u
    join public.pools p
      on p.id = u.pool_id
     and p.betting_mode = 'single_phase'
     and p.locked_at is null                         -- never consider locked pools
     and coalesce(p.is_locked, false) = false
    where (select count(*) from public.knockout_picks k
           where k.user_id = u.id and k.pool_id = u.pool_id and k.bracket_position is not null) < 31
      and exists (select 1 from public.pick_backups b where b.user_id = u.id and b.pool_id = u.pool_id)
    limit p_limit
  loop
    v_scanned := v_scanned + 1;
    begin   -- per-user sub-transaction: an error here rolls back ONLY this user
      -- most recent backup whose bracketPicks is EXACTLY keys "1".."31", every
      -- value non-empty, every value a valid team code.
      v_bp := null;
      select b.payload -> 'bracketPicks' into v_bp
      from public.pick_backups b
      where b.user_id = rec.user_id and b.pool_id = rec.pool_id
        and jsonb_typeof(b.payload -> 'bracketPicks') = 'object'
        and (select count(*) from jsonb_object_keys(b.payload -> 'bracketPicks')) = 31
        and not exists (                              -- every key 1..31 must be present + non-empty
          select 1 from generate_series(1,31) g(pos)
          where coalesce(b.payload -> 'bracketPicks' ->> (g.pos::text), '') = '')
        and not exists (                              -- no key outside 1..31
          select 1 from jsonb_object_keys(b.payload -> 'bracketPicks') as kk(key)
          where kk.key !~ '^[0-9]+$' or (kk.key)::int < 1 or (kk.key)::int > 31)
        and not exists (                              -- every value is a real team code
          select 1 from jsonb_each_text(b.payload -> 'bracketPicks') e
          where e.value not in (select code from public.teams))
      order by b.created_at desc
      limit 1;

      if v_bp is null then
        v_skipped_no_backup := v_skipped_no_backup + 1;
        continue;
      end if;

      -- race guard: re-check the pool is STILL unlocked right before writing.
      select (locked_at is null and coalesce(is_locked,false) = false)
        into v_still_unlocked from public.pools where id = rec.pool_id;
      if not coalesce(v_still_unlocked, false) then
        v_skipped_locked := v_skipped_locked + 1;
        continue;
      end if;

      -- defensive delete: existing bracket rows AND any stray sp_1..sp_31 rows
      -- (even with bracket_position NULL) so the insert can't hit the
      -- (user_id,match_id) unique constraint. Strictly scoped to this user/pool
      -- + the synthetic single-phase namespace — never two-phase rows.
      delete from public.knockout_picks
        where user_id = rec.user_id and pool_id = rec.pool_id
          and (bracket_position is not null
               or match_id ~ '^sp_([1-9]|[12][0-9]|3[01])$');

      insert into public.knockout_picks(pool_id, user_id, match_id, round, predicted_winner, bracket_position)
      select rec.pool_id, rec.user_id, 'sp_' || g.pos,
             case when g.pos <= 16 then 'r32' when g.pos <= 24 then 'r16'
                  when g.pos <= 28 then 'qf'  when g.pos <= 30 then 'sf' else 'final' end,
             v_bp ->> (g.pos::text),
             g.pos
      from generate_series(1,31) g(pos);

      v_healed := v_healed + 1;
    exception when others then
      v_failed := v_failed + 1;
      if jsonb_array_length(v_failures) < 20 then
        v_failures := v_failures || jsonb_build_object(
          'user_id', rec.user_id, 'pool_id', rec.pool_id, 'error', sqlerrm);
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'scanned', v_scanned, 'healed', v_healed,
    'skipped_no_valid_backup', v_skipped_no_backup,
    'skipped_locked', v_skipped_locked,
    'failed', v_failed, 'failures', v_failures);
end$$;

revoke all on function public.heal_brackets_from_backup(int) from public, anon, authenticated;
grant execute on function public.heal_brackets_from_backup(int) to service_role;
