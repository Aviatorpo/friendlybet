-- Open the intended second write phase for two_phase pools.
-- Pre-group picks remain locked after kickoff; only knockout + top-scorer writes
-- are allowed after all group matches are terminal and before the knockout cutoff.

create or replace function public._two_phase_knockout_writer(p_code text, out v_uid uuid, out v_pid uuid)
 returns record
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare
  v_mode text;
  v_unfinished int;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;

  select pool_id into v_pid from public.users where id = v_uid;
  if v_pid is null then raise exception 'no pool'; end if;

  select betting_mode
    into v_mode
    from public.pools
    where id = v_pid
    for share;

  if v_mode <> 'two_phase' then raise exception 'not a two-phase pool'; end if;
  if now() >= public._late_knockout_cutoff() then raise exception 'pool locked'; end if;

  select count(*) into v_unfinished
  from public.matches m
  where m.stage = 'GROUP_STAGE'
    and (
      coalesce(upper(m.status),'') not in ('FINISHED','AWARDED')
      or lower(coalesce(m.status_detail,'')) like '%pending verification%'
      or lower(coalesce(m.live_source,'')) = 'espn-final'
    );

  if v_unfinished > 0 then raise exception 'group stage not complete'; end if;
end
$function$;

create or replace function public.save_knockout_picks_2p(p_code text, p_picks jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare
  v_uid uuid;
  v_pid uuid;
  v_rules jsonb;
  v_um boolean;
begin
  select aw.v_uid, aw.v_pid into v_uid, v_pid from public._two_phase_knockout_writer(p_code) aw;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 64 then raise exception 'bad payload'; end if;
  if jsonb_array_length(p_picks) = 0 then return jsonb_build_object('ok',true,'skipped','empty'); end if;

  if exists(select 1 from jsonb_array_elements(p_picks) e where
       coalesce(btrim(e->>'match_id'),'') = ''
       or coalesce(btrim(e->>'predicted_winner'),'') = ''
       or coalesce(btrim(e->>'round'),'') not in ('R32','R16','QF','SF','FINAL')) then
    raise exception 'invalid bracket payload';
  end if;

  if exists(select 1 from jsonb_array_elements(p_picks) e
            where e->>'predicted_winner' not in (select code from public.teams)) then
    raise exception 'unknown team code in bracket';
  end if;

  select scoring_rules, use_multipliers into v_rules, v_um from public.pools where id = v_pid;

  delete from public.knockout_picks
  where user_id = v_uid and pool_id = v_pid and bracket_position is null;

  insert into public.knockout_picks(pool_id,user_id,match_id,round,predicted_winner,multiplier_applied)
    select distinct on (e->>'match_id')
           v_pid, v_uid, e->>'match_id', e->>'round', e->>'predicted_winner',
           public._pool_team_mult(v_rules, v_um, e->>'predicted_winner')
    from jsonb_array_elements(p_picks) e
    order by e->>'match_id';

  return jsonb_build_object('ok',true);
end
$function$;

create or replace function public.save_top_scorer(p_code text, p_player_id text, p_player_name text, p_team_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare
  v_uid uuid;
  v_pid uuid;
  v_mode text;
begin
  v_uid := public._uid_from_code(p_code);
  if v_uid is null then raise exception 'invalid recovery code'; end if;
  select u.pool_id, p.betting_mode into v_pid, v_mode
    from public.users u
    join public.pools p on p.id = u.pool_id
    where u.id = v_uid;
  if v_pid is null then raise exception 'no pool'; end if;

  if v_mode = 'two_phase' then
    select aw.v_uid, aw.v_pid into v_uid, v_pid from public._two_phase_knockout_writer(p_code) aw;
  else
    select aw.v_uid, aw.v_pid into v_uid, v_pid from public._auth_writer(p_code) aw;
  end if;

  delete from public.top_scorer_picks where user_id = v_uid and pool_id = v_pid;
  if coalesce(btrim(p_player_id),'') = '' then
    return jsonb_build_object('ok',true,'deleted',true);
  end if;
  if coalesce(btrim(p_team_code),'') not in (select code from public.teams) then
    raise exception 'unknown team code';
  end if;

  insert into public.top_scorer_picks(pool_id,user_id,player_id,player_name,team_code)
  values (v_pid, v_uid, p_player_id, left(coalesce(p_player_name,''), 120), p_team_code);

  return jsonb_build_object('ok',true);
end
$function$;

revoke all on function public._two_phase_knockout_writer(text) from public;
grant execute on function public._two_phase_knockout_writer(text) to anon, authenticated;
revoke all on function public.save_knockout_picks_2p(text,jsonb) from public;
grant execute on function public.save_knockout_picks_2p(text,jsonb) to anon, authenticated;
revoke all on function public.save_top_scorer(text,text,text,text) from public;
grant execute on function public.save_top_scorer(text,text,text,text) to anon, authenticated;
