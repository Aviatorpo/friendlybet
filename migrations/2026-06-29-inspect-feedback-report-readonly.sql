-- Read-only feedback report for incident triage.
-- This file intentionally performs SELECTs only.

with feedback_joined as (
  select
    f.created_at,
    f.id as feedback_id,
    f.user_id as feedback_user_id,
    u.nickname as joined_nickname,
    u.pool_id as joined_pool_id,
    p.code as joined_pool_code,
    p.name as joined_pool_name,
    f.pool_code as feedback_pool_code,
    f.category,
    f.reply_email,
    f.language,
    f.screen,
    f.app_version,
    left(regexp_replace(coalesce(f.message, ''), E'[\\n\\r\\t]+', ' ', 'g'), 900) as message_excerpt
  from public.feedback f
  left join public.users u on u.id = f.user_id
  left join public.pools p on p.id = u.pool_id
),
targeted as (
  select *
  from feedback_joined
  where feedback_pool_code = 'FDSXW'
     or joined_pool_code = 'FDSXW'
     or lower(coalesce(joined_nickname, '')) in ('amer', 'amerr', 'amee')
     or lower(coalesce(message_excerpt, '')) like '%fdsxw%'
     or lower(coalesce(message_excerpt, '')) like '%amer%'
     or lower(coalesce(message_excerpt, '')) like '%amerr%'
     or lower(coalesce(message_excerpt, '')) like '%amee%'
     or lower(coalesce(message_excerpt, '')) like '%point%'
     or lower(coalesce(message_excerpt, '')) like '%points%'
     or lower(coalesce(reply_email, '')) like '%amer%'
),
all_with_email as (
  select *
  from feedback_joined
  where reply_email is not null
  order by created_at asc
  limit 200
)
select jsonb_pretty(jsonb_build_object(
  'feedback_total', (select count(*) from public.feedback),
  'targeted_count', (select count(*) from targeted),
  'targeted', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at asc) from targeted t), '[]'::jsonb),
  'all_with_email_count_returned', (select count(*) from all_with_email),
  'all_with_email', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at asc) from all_with_email e), '[]'::jsonb)
)) as feedback_report;
