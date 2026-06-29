-- ============================================================
-- 2026-06-29 QA staging minimum schema repair
-- ============================================================
-- Idempotent staging/QA support. This intentionally avoids replaying older
-- destructive data migrations and only adds columns/tables required for the
-- synthetic QA scoring rehearsal.
-- ============================================================

alter table public.teams add column if not exists name_en text;
alter table public.teams add column if not exists name_he text;
alter table public.teams add column if not exists group_letter text;
alter table public.teams add column if not exists tier text;
alter table public.teams add column if not exists fifa_ranking integer;
alter table public.teams add column if not exists flag_emoji text;

update public.teams
set name_en = coalesce(name_en, name)
where name_en is null;

alter table public.matches add column if not exists external_id text;
alter table public.matches add column if not exists stage text;
alter table public.matches add column if not exists group_letter text;
alter table public.matches add column if not exists home_team_code text;
alter table public.matches add column if not exists away_team_code text;
alter table public.matches add column if not exists home_team_name text;
alter table public.matches add column if not exists away_team_name text;
alter table public.matches add column if not exists home_score integer;
alter table public.matches add column if not exists away_score integer;
alter table public.matches add column if not exists venue text;
alter table public.matches add column if not exists last_updated timestamptz default now();
alter table public.matches add column if not exists winner_code text;
alter table public.matches add column if not exists scorers jsonb;
alter table public.matches add column if not exists live_clock text;
alter table public.matches add column if not exists live_period integer;
alter table public.matches add column if not exists status_detail text;
alter table public.matches add column if not exists live_source text;
alter table public.matches add column if not exists source_updated_at timestamptz;

create unique index if not exists idx_matches_external_id
  on public.matches(external_id)
  where external_id is not null;

create index if not exists idx_matches_status on public.matches(status);
create index if not exists idx_matches_stage on public.matches(stage);
create index if not exists idx_matches_date on public.matches(match_date);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select_all on public.app_settings;
create policy app_settings_select_all
  on public.app_settings for select
  using (true);

insert into public.app_settings(key, value)
values (
  'qa_schema_repair',
  jsonb_build_object('applied_at', now(), 'purpose', 'qa-staging-minimum-schema')
)
on conflict (key)
do update set value = excluded.value, updated_at = now();
