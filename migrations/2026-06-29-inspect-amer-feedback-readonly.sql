-- Read-only incident inspection for feedback related to FDSXW / Amer.
-- This file intentionally performs SELECTs only.

select 'feedback_total' as section, count(*)::text as value
from public.feedback;

with target_pool as (
  select id, code, name
  from public.pools
  where code = 'FDSXW'
),
target_users as (
  select u.id, u.nickname, u.pool_id, p.code as user_pool_code, p.name as user_pool_name
  from public.users u
  join public.pools p on p.id = u.pool_id
  where u.pool_id = (select id from target_pool)
     or lower(u.nickname) in ('amer', 'amerr', 'amee')
),
candidate_feedback as (
  select f.*
  from public.feedback f
  where f.pool_code = 'FDSXW'
     or f.user_id in (select id from target_users)
     or lower(coalesce(f.message, '')) like '%fdsxw%'
     or lower(coalesce(f.message, '')) like '%amer%'
     or lower(coalesce(f.message, '')) like '%amerr%'
     or lower(coalesce(f.message, '')) like '%amee%'
     or lower(coalesce(f.message, '')) like '%point%'
     or lower(coalesce(f.message, '')) like '%points%'
     or lower(coalesce(f.reply_email, '')) like '%amer%'
)
select
  'candidate_feedback' as section,
  f.created_at,
  f.id as feedback_id,
  f.user_id as feedback_user_id,
  tu.nickname as joined_nickname,
  tu.user_pool_code,
  tu.user_pool_name,
  f.pool_code as feedback_pool_code,
  f.category,
  f.reply_email,
  f.language,
  f.screen,
  f.app_version,
  left(regexp_replace(coalesce(f.message, ''), E'[\\n\\r\\t]+', ' ', 'g'), 1200) as message_excerpt
from candidate_feedback f
left join target_users tu on tu.id = f.user_id
order by f.created_at asc;

with target_pool as (
  select id
  from public.pools
  where code = 'FDSXW'
),
target_users as (
  select u.id, u.nickname, u.pool_id, p.code as user_pool_code, p.name as user_pool_name
  from public.users u
  join public.pools p on p.id = u.pool_id
  where u.pool_id = (select id from target_pool)
)
select
  'fdsxw_users' as section,
  u.id as user_id,
  u.nickname,
  u.user_pool_code,
  u.user_pool_name,
  coalesce(gp.group_count, 0) as live_group_picks,
  coalesce(kp.ko_count, 0) as live_knockout_picks,
  ub.backup_rows,
  ub.max_backup_group_total,
  ub.valid_full_group_backups
from target_users u
left join lateral (
  select count(*)::int as group_count
  from public.group_picks gp
  where gp.user_id = u.id and gp.pool_id = u.pool_id
) gp on true
left join lateral (
  select count(*)::int as ko_count
  from public.knockout_picks kp
  where kp.user_id = u.id and kp.pool_id = u.pool_id
) kp on true
left join lateral (
  select
    count(*)::int as backup_rows,
    coalesce(max((
      select coalesce(sum(jsonb_array_length(e.value)), 0)
      from jsonb_each(b.payload->'groupPositions') e
      where jsonb_typeof(b.payload->'groupPositions') = 'object'
        and e.key in ('A','B','C','D','E','F','G','H','I','J','K','L')
        and jsonb_typeof(e.value) = 'array'
    )), 0)::int as max_backup_group_total,
    count(*) filter (where
      jsonb_typeof(b.payload->'groupPositions') = 'object'
      and (
        select count(*)
        from jsonb_each(b.payload->'groupPositions') e
        where e.key in ('A','B','C','D','E','F','G','H','I','J','K','L')
          and jsonb_typeof(e.value) = 'array'
          and jsonb_array_length(e.value) between 2 and 3
      ) = 12
      and (
        select coalesce(sum(jsonb_array_length(e.value)), 0)
        from jsonb_each(b.payload->'groupPositions') e
        where e.key in ('A','B','C','D','E','F','G','H','I','J','K','L')
          and jsonb_typeof(e.value) = 'array'
      ) = 32
    )::int as valid_full_group_backups
  from public.pick_backups b
  where b.user_id = u.id and b.pool_id = u.pool_id
) ub on true
order by u.nickname asc, u.id asc;
