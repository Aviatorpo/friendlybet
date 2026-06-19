-- Idempotent setup for the FriendlyBet World Cup story dispatch webhook.
--
-- This file is a template used by scripts/setup-world-cup-story-supabase.js.
-- The script replaces:
--   __WORLD_CUP_STORY_DISPATCH_URL__
--   __STORY_DISPATCH_SECRET__
--
-- Do not commit a rendered copy of this file; it contains the shared webhook
-- secret used by the database trigger to call the Edge Function.

create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_world_cup_story_on_finished()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_request_id bigint;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if coalesce(old.status, '') = 'FINISHED' or coalesce(new.status, '') <> 'FINISHED' then
    return new;
  end if;

  select net.http_post(
    url := __WORLD_CUP_STORY_DISPATCH_URL__,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-friendlybet-secret', __STORY_DISPATCH_SECRET__
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', to_jsonb(old)
    ),
    timeout_milliseconds := 5000
  ) into v_request_id;

  return new;
exception
  when others then
    raise warning 'world cup story dispatch webhook skipped: %', sqlerrm;
    return new;
end;
$$;

revoke all on function public.dispatch_world_cup_story_on_finished() from public, anon, authenticated;
alter function public.dispatch_world_cup_story_on_finished() owner to postgres;

drop trigger if exists matches_world_cup_story_dispatch on public.matches;

create trigger matches_world_cup_story_dispatch
after update of status on public.matches
for each row
when (old.status is distinct from 'FINISHED' and new.status = 'FINISHED')
execute function public.dispatch_world_cup_story_on_finished();
