-- Per-jockey career totals + suspension summary, scraped from the
-- server-rendered LoveRacing profile page (Stats Overview table) by
-- scripts/sync-premierships.mjs --profiles. This is the TRUE all-time career
-- (e.g. Elen Nicholas 149 wins / 1528 starts) which the premiership feed alone
-- undercounts (it only spans ~5 seasons), plus the career suspension count.
create table if not exists public.nztr_jockey_profiles (
  entity_id           bigint primary key,
  career_wins         int,
  career_starts       int,
  career_stakes       numeric,
  premiership_place   int,
  rides_since_win     int,
  suspensions_count   int,
  last_suspension_date date,
  synced_at           timestamptz not null default now()
);

alter table public.nztr_jockey_profiles enable row level security;
drop policy if exists "nztr_jockey_profiles_public_read" on public.nztr_jockey_profiles;
create policy "nztr_jockey_profiles_public_read" on public.nztr_jockey_profiles
  for select to anon, authenticated using (true);
drop policy if exists "nztr_jockey_profiles_admin_write" on public.nztr_jockey_profiles;
create policy "nztr_jockey_profiles_admin_write" on public.nztr_jockey_profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Rebuild the jockey stats view to PREFER the true career (profile scrape) when
-- present, falling back to the premiership-season sum, and to expose suspensions.
drop view if exists public.nztr_jockey_stats;
create view public.nztr_jockey_stats
with (security_invoker = on) as
with cur as (
  select max(season_id) as m from public.nztr_premierships where entity_type = 'jockey'
),
agg as (
  select
    p.entity_id,
    max(p.name) as name,
    coalesce(sum(p.wins)    filter (where p.season_id = (select m from cur)), 0) as season_wins,
    coalesce(sum(p.seconds) filter (where p.season_id = (select m from cur)), 0) as season_seconds,
    coalesce(sum(p.thirds)  filter (where p.season_id = (select m from cur)), 0) as season_thirds,
    coalesce(sum(p.starts)  filter (where p.season_id = (select m from cur)), 0) as season_starts,
    coalesce(sum(p.stakes)  filter (where p.season_id = (select m from cur)), 0) as season_stakes,
    coalesce(sum(p.wins),   0) as prem_career_wins,
    coalesce(sum(p.starts), 0) as prem_career_starts,
    (select m from cur) as season_id
  from public.nztr_premierships p
  where p.entity_type = 'jockey'
  group by p.entity_id
)
select
  agg.entity_id,
  agg.name,
  agg.season_wins,
  agg.season_seconds,
  agg.season_thirds,
  agg.season_starts,
  agg.season_stakes,
  agg.season_id,
  coalesce(prof.career_wins,   agg.prem_career_wins)   as career_wins,
  coalesce(prof.career_starts, agg.prem_career_starts) as career_starts,
  (prof.career_wins is not null)                        as career_is_true,
  prof.career_stakes,
  prof.premiership_place,
  prof.suspensions_count,
  prof.last_suspension_date
from agg
left join public.nztr_jockey_profiles prof on prof.entity_id = agg.entity_id;

grant select on public.nztr_jockey_stats to anon, authenticated;
