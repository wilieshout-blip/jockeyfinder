-- NZTR / LoveRacing premiership + claims ingest.
--
-- Source: POST https://loveracing.nz/ServerScript/PremiershipsAndClaims.aspx/
--   GetPremiershipDataJson  {seasonID, jockey, trainer, jumping}
--   GetJockeyClaimsDataJson {apprentice, highweight, jumping}
-- Scraped from the PC via curl (WAF blocks serverless) by scripts/sync-premierships.mjs.
--
-- These feeds are the AUTHORITATIVE season stats LoveRacing shows on its
-- Jockey/Trainer Premiership pages. They replace the old race_results-derived
-- jockey_season_stats (which only had wins from the few meetings we scraped).

-- One row per entity per season per code (flat / jumping).
create table if not exists public.nztr_premierships (
  entity_id    bigint  not null,
  entity_type  text    not null check (entity_type in ('jockey', 'trainer')),
  season_id    int     not null,
  jumping      boolean not null default false,
  name         text    not null,
  wins         int     not null default 0,
  seconds      int     not null default 0,
  thirds       int     not null default 0,
  starts       int     not null default 0,
  stakes       numeric not null default 0,
  strike_rate  numeric not null default 0,
  synced_at    timestamptz not null default now(),
  primary key (entity_id, entity_type, season_id, jumping)
);

create index if not exists nztr_premierships_type_season_idx
  on public.nztr_premierships (entity_type, season_id);
create index if not exists nztr_premierships_name_idx
  on public.nztr_premierships (name);

-- Current apprentice / highweight claim allowances (current season only).
create table if not exists public.nztr_jockey_claims (
  jockey_id     bigint primary key,
  rider         text not null,
  allowance     numeric,
  claim_type    int,        -- WebClaimTypeID (1 = apprentice flat, etc.)
  career_wins   int,
  career_starts int,
  normal_weight numeric,
  jumping       boolean not null default false,
  synced_at     timestamptz not null default now()
);

-- Per-jockey season (latest season_id present) + career (all seasons) aggregates.
create or replace view public.nztr_jockey_stats
with (security_invoker = on) as
with cur as (
  select max(season_id) as m from public.nztr_premierships where entity_type = 'jockey'
)
select
  p.entity_id,
  max(p.name) as name,
  coalesce(sum(p.wins)    filter (where p.season_id = (select m from cur)), 0) as season_wins,
  coalesce(sum(p.seconds) filter (where p.season_id = (select m from cur)), 0) as season_seconds,
  coalesce(sum(p.thirds)  filter (where p.season_id = (select m from cur)), 0) as season_thirds,
  coalesce(sum(p.starts)  filter (where p.season_id = (select m from cur)), 0) as season_starts,
  coalesce(sum(p.stakes)  filter (where p.season_id = (select m from cur)), 0) as season_stakes,
  coalesce(sum(p.wins),   0) as career_wins,
  coalesce(sum(p.seconds),0) as career_seconds,
  coalesce(sum(p.thirds), 0) as career_thirds,
  coalesce(sum(p.starts), 0) as career_starts,
  (select m from cur)        as season_id
from public.nztr_premierships p
where p.entity_type = 'jockey'
group by p.entity_id;

create or replace view public.nztr_trainer_stats
with (security_invoker = on) as
with cur as (
  select max(season_id) as m from public.nztr_premierships where entity_type = 'trainer'
)
select
  p.entity_id,
  max(p.name) as name,
  coalesce(sum(p.wins)    filter (where p.season_id = (select m from cur)), 0) as season_wins,
  coalesce(sum(p.seconds) filter (where p.season_id = (select m from cur)), 0) as season_seconds,
  coalesce(sum(p.thirds)  filter (where p.season_id = (select m from cur)), 0) as season_thirds,
  coalesce(sum(p.starts)  filter (where p.season_id = (select m from cur)), 0) as season_starts,
  coalesce(sum(p.stakes)  filter (where p.season_id = (select m from cur)), 0) as season_stakes,
  coalesce(sum(p.wins),   0) as career_wins,
  coalesce(sum(p.starts), 0) as career_starts,
  (select m from cur)        as season_id
from public.nztr_premierships p
where p.entity_type = 'trainer'
group by p.entity_id;

-- RLS: public read (these are public stats), writes via service role only.
alter table public.nztr_premierships  enable row level security;
alter table public.nztr_jockey_claims enable row level security;

drop policy if exists "nztr_premierships_public_read" on public.nztr_premierships;
create policy "nztr_premierships_public_read" on public.nztr_premierships
  for select to anon, authenticated using (true);
drop policy if exists "nztr_premierships_admin_write" on public.nztr_premierships;
create policy "nztr_premierships_admin_write" on public.nztr_premierships
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "nztr_jockey_claims_public_read" on public.nztr_jockey_claims;
create policy "nztr_jockey_claims_public_read" on public.nztr_jockey_claims
  for select to anon, authenticated using (true);
drop policy if exists "nztr_jockey_claims_admin_write" on public.nztr_jockey_claims;
create policy "nztr_jockey_claims_admin_write" on public.nztr_jockey_claims
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.nztr_jockey_stats  to anon, authenticated;
grant select on public.nztr_trainer_stats to anon, authenticated;
