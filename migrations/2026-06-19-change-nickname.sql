-- Allow a member to change their display nickname without changing recovery code.
-- The recovery code remains the stable credential; this updates only users.nickname.

begin;

create or replace function public.change_nickname(p_code text, p_nickname text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare
  bare text;
  hyph text;
  v_uid uuid;
  v_nickname text;
begin
  if p_code is null or length(p_code) > 200 then
    raise exception 'invalid recovery code';
  end if;

  bare := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if length(bare) < 12 then
    raise exception 'invalid recovery code';
  end if;
  hyph := regexp_replace(bare, '(.{4})(?=.)', '\1-', 'g');

  select u.id into v_uid
    from public.users u
   where u.recovery_code_hash in (
     encode(extensions.digest(hyph, 'sha256'), 'hex'),
     encode(extensions.digest(bare, 'sha256'), 'hex')
   )
   order by u.id
   limit 1;

  if v_uid is null then
    raise exception 'invalid recovery code';
  end if;

  v_nickname := btrim(coalesce(p_nickname, ''));
  if v_nickname = '' then
    raise exception 'missing nickname';
  end if;
  if char_length(v_nickname) < 2 then
    raise exception 'nickname too short';
  end if;
  if char_length(v_nickname) > 30 then
    raise exception 'nickname too long';
  end if;

  begin
    update public.users
       set nickname = v_nickname
     where id = v_uid;
  exception when unique_violation then
    raise exception 'nickname already taken' using errcode = '23505';
  end;

  return (
    select to_jsonb(u) - 'recovery_code_hash'
      from public.users u
     where u.id = v_uid
  );
end
$function$;

grant execute on function public.change_nickname(text, text) to anon, authenticated;

commit;
