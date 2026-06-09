-- ============================================================
-- 2026-06-09: save_knockout_bracket — defensive delete of the sp_ namespace
-- ============================================================
-- The single-phase bracket save deleted only rows with bracket_position NOT NULL.
-- If a user has a stray sp_1..sp_31 row with bracket_position NULL, the insert
-- (which writes the same sp_<pos> match_ids) would hit the (user_id, match_id)
-- unique constraint and the save would fail repeatedly. The function was already
-- WIPE-SAFE (validation runs before the delete; an uncaught insert error rolls
-- back the whole single-transaction function, so the delete is undone), but it
-- could be persistently BLOCKED for such a user.
--
-- ONLY CHANGE vs the deployed version: the delete now also removes the synthetic
-- sp_1..sp_31 namespace (incl. bracket_position NULL strays), so the insert can't
-- collide. Strictly scoped to the caller's own user_id + pool_id + sp_ namespace —
-- never touches two-phase real-match rows. Everything else (auth/lock via
-- _auth_writer, validation order, distinct-on insert, transaction safety) is
-- unchanged. Idempotent (CREATE OR REPLACE preserves grants). Applied to prod.

CREATE OR REPLACE FUNCTION public.save_knockout_bracket(p_code text, p_picks jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare v_uid uuid; v_pid uuid;
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 64 then raise exception 'bad payload'; end if;
  if jsonb_array_length(p_picks) = 0 then return jsonb_build_object('ok',true,'skipped','empty'); end if; -- empty = no-op, never wipe
  if exists(select 1 from jsonb_array_elements(p_picks) e where
       coalesce(e->>'bracket_position','') !~ '^([1-9]|[12][0-9]|3[01])$'
       or coalesce(btrim(e->>'predicted_winner'),'')='' ) then
    raise exception 'invalid bracket payload';
  end if;
  if exists(select 1 from jsonb_array_elements(p_picks) e
            where e->>'predicted_winner' not in (select code from public.teams)) then
    raise exception 'unknown team code in bracket';
  end if;
  -- v2.9.x: also clear any stray sp_1..sp_31 rows (incl. bracket_position NULL) so
  -- the re-insert below can't hit the (user_id, match_id) unique constraint.
  -- Scoped to this caller + the synthetic single-phase namespace only.
  delete from public.knockout_picks
   where user_id = v_uid and pool_id = v_pid
     and (bracket_position is not null
          or match_id ~ '^sp_([1-9]|[12][0-9]|3[01])$');
  begin
    insert into public.knockout_picks(pool_id,user_id,match_id,round,predicted_winner,bracket_position)
      select distinct on ((e->>'bracket_position')::int)
             v_pid, v_uid, e->>'match_id', e->>'round', e->>'predicted_winner', (e->>'bracket_position')::int
      from jsonb_array_elements(p_picks) e
      order by (e->>'bracket_position')::int;
  exception when foreign_key_violation then raise exception 'unknown team code in bracket';
  end;
  return jsonb_build_object('ok',true);
end$function$;
