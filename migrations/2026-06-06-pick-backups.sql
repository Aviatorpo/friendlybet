-- ============================================================
-- DURABLE, APPEND-ONLY BACKUP of every user's single-phase bet.
-- ============================================================
-- Why: on 2026-06-02 a draw-fix migration ran `DELETE FROM knockout_picks`
-- (and group/winner tables) and there was NO way to recover the picks. Separately
-- a silent save-failure class lost ~531 users' brackets. The live pick tables are
-- mutable (the save RPCs delete-then-insert) and a future bug/migration could wipe
-- them again. This table is an INDEPENDENT, append-only snapshot store that the
-- normal save flow never deletes, so a wipe of the live tables is always
-- recoverable. It is written/read only through SECURITY DEFINER RPCs (no direct
-- anon access), and bounded to the latest 12 snapshots per user+pool.
--
-- Idempotent. Run in the Supabase SQL editor (prod).

create table if not exists public.pick_backups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  pool_id     uuid not null references public.pools(id) on delete cascade,
  payload     jsonb not null,                 -- full snapshot: {groupPositions, thirdPlaceAdvancers, bracketPicks, tournamentWinner, topScorer}
  created_at  timestamptz not null default now()
);
create index if not exists pick_backups_user_pool_idx
  on public.pick_backups(user_id, pool_id, created_at desc);

-- Locked down: only the definer RPCs below touch it.
alter table public.pick_backups enable row level security;
revoke all on public.pick_backups from anon, authenticated;

-- ---- write: append a full snapshot (anon-callable via recovery code) ----
create or replace function public.backup_picks(p_code text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s'
as $$
declare v_uid uuid; v_pid uuid; v_has_content boolean;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'bad code'); end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'no pool'); end if;
  if jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 20000 then
    return jsonb_build_object('ok', false, 'reason', 'bad payload'); end if;
  -- Only store non-empty snapshots so an empty/stale state can never push the
  -- good snapshots out of the bounded window.
  v_has_content := coalesce(p_payload->'bracketPicks', '{}'::jsonb) <> '{}'::jsonb
                or coalesce(p_payload->'groupPositions', '{}'::jsonb) <> '{}'::jsonb;
  if not v_has_content then return jsonb_build_object('ok', true, 'skipped', 'empty'); end if;

  insert into public.pick_backups(user_id, pool_id, payload) values (v_uid, v_pid, p_payload);
  -- Bound growth: keep the latest 12 snapshots per user+pool.
  delete from public.pick_backups b
   where b.user_id = v_uid and b.pool_id = v_pid
     and b.id not in (
       select id from public.pick_backups
        where user_id = v_uid and pool_id = v_pid
        order by created_at desc limit 12);
  return jsonb_build_object('ok', true);
end$$;
revoke all on function public.backup_picks(text, jsonb) from public;
grant execute on function public.backup_picks(text, jsonb) to anon, authenticated;

-- ---- read: latest snapshot for the caller (client auto-heal from server) ----
create or replace function public.get_pick_backup(p_code text)
returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '5s'
as $$
declare v_uid uuid; v_pid uuid; v jsonb;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then return null; end if;
  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then return null; end if;
  select payload into v from public.pick_backups
    where user_id = v_uid and pool_id = v_pid
    order by created_at desc limit 1;
  return v;
end$$;
revoke all on function public.get_pick_backup(text) from public;
grant execute on function public.get_pick_backup(text) to anon, authenticated;

notify pgrst, 'reload schema';
