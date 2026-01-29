-- JockeyFinder clean Supabase schema (NZ only)
-- Run this in Supabase SQL Editor on a NEW project.

-- Extensions
create extension if not exists "pgcrypto";

-- PROFILES (one row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'jockey', -- jockey | trainer | owner | agent | admin
  verified boolean not null default false,
  verification_status text not null default 'pending', -- pending | ai_passed | approved | rejected
  first_name text,
  last_name text,
  full_name text,
  phone text,
  country text default 'NZ',
  licence_type text, -- jockey_full | trials_only etc (optional)
  riding_weight numeric,
  apprentice boolean not null default false,
  apprentice_claim numeric,
  bio text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- MEETINGS (race days / trials / jumpouts)
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  nztr_day_id bigint unique,
  meeting_date date not null,
  track text not null,
  club text,
  source text default 'loveracing',
  created_at timestamptz not null default now()
);

create index if not exists meetings_date_idx on public.meetings(meeting_date);

-- ATTENDANCE (jockey self-mark)
create table if not exists public.meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  jockey_id uuid not null references public.profiles(id) on delete cascade,
  attending boolean not null default true,
  -- snapshot fields so the public list stays consistent for that meeting
  weight_snapshot numeric,
  apprentice_snapshot boolean,
  claim_snapshot numeric,
  created_at timestamptz not null default now(),
  unique (meeting_id, jockey_id)
);

-- PUBLIC VIEW: only VERIFIED jockeys appear
create or replace view public.public_meeting_attendance as
select
  ma.meeting_id,
  ma.jockey_id,
  p.first_name,
  p.last_name,
  coalesce(ma.weight_snapshot, p.riding_weight) as riding_weight,
  coalesce(ma.apprentice_snapshot, p.apprentice) as apprentice,
  coalesce(ma.claim_snapshot, p.apprentice_claim) as apprentice_claim
from public.meeting_attendance ma
join public.profiles p on p.id = ma.jockey_id
where p.verified = true and p.role = 'jockey';

-- NZTR registry list (trainers + agents) for phone auto-approve
create table if not exists public.nztr_people_registry (
  id bigserial primary key,
  role text not null, -- trainer | agent
  full_name text,
  phone text not null,
  phone_normalized text not null,
  category text,
  location text,
  created_at timestamptz not null default now()
);

create unique index if not exists nztr_people_registry_role_phone_key
on public.nztr_people_registry(role, phone_normalized);

-- helpers
create or replace function public.normalize_phone(p text)
returns text language sql immutable as $$
  select regexp_replace(coalesce(p,''), '[^0-9]+', '', 'g');
$$;

create or replace function public.apply_auto_approval()
returns trigger
language plpgsql
as $$
declare
  phone_norm text;
  exists_trainer boolean;
  exists_agent boolean;
begin
  phone_norm := public.normalize_phone(new.phone);

  select exists(
    select 1 from public.nztr_people_registry r
    where r.role = 'trainer' and r.phone_normalized = phone_norm
  ) into exists_trainer;

  select exists(
    select 1 from public.nztr_people_registry r
    where r.role = 'agent' and r.phone_normalized = phone_norm
  ) into exists_agent;

  -- Trainers: auto-approved if phone matches NZTR list
  if new.role = 'trainer' and exists_trainer then
    new.verified := true;
    new.verification_status := 'approved';
  end if;

  -- Agents: phone match helps, but still manual approve (extra security)
  if new.role = 'agent' and exists_agent then
    new.verified := false;
    new.verification_status := 'pending';
  end if;

  -- Jockeys: always manual approve
  if new.role = 'jockey' then
    new.verified := false;
    new.verification_status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_auto_approval on public.profiles;
create trigger trg_profiles_auto_approval
before insert or update of phone, role
on public.profiles
for each row
execute function public.apply_auto_approval();

-- RLS
alter table public.profiles enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_attendance enable row level security;
alter table public.nztr_people_registry enable row level security;

-- PROFILES policies
drop policy if exists "public can read verified jockey public fields" on public.profiles;
create policy "public can read verified jockey public fields"
on public.profiles
for select
to anon, authenticated
using (
  role = 'jockey' and verified = true
);

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

-- MEETINGS public read
drop policy if exists "public can read meetings" on public.meetings;
create policy "public can read meetings"
on public.meetings
for select
to anon, authenticated
using (true);

-- ATTENDANCE read:
-- public can read attendance via the VIEW (view uses meetings_attendance + profiles)
-- allow select on meeting_attendance so the view can work
drop policy if exists "public can read meeting attendance rows" on public.meeting_attendance;
create policy "public can read meeting attendance rows"
on public.meeting_attendance
for select
to anon, authenticated
using (true);

-- ATTENDANCE insert/update:
-- Any jockey can mark attending, but only verified will show publicly (via view)
drop policy if exists "jockeys can upsert their own attendance" on public.meeting_attendance;
create policy "jockeys can upsert their own attendance"
on public.meeting_attendance
for insert
to authenticated
with check (
  jockey_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'jockey')
);

drop policy if exists "jockeys can update their own attendance" on public.meeting_attendance;
create policy "jockeys can update their own attendance"
on public.meeting_attendance
for update
to authenticated
using (jockey_id = auth.uid())
with check (jockey_id = auth.uid());

drop policy if exists "jockeys can delete their own attendance" on public.meeting_attendance;
create policy "jockeys can delete their own attendance"
on public.meeting_attendance
for delete
to authenticated
using (jockey_id = auth.uid());

-- REGISTRY: only service role / admin should manage it (keep locked from anon/auth)
-- (No policies = nobody can access via client)
