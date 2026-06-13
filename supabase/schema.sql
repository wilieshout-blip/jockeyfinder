-- ============================================================
-- JockeyFinder database schema
-- Run this whole file once in the Supabase SQL editor.
-- Safe to re-run: objects are created with IF NOT EXISTS or
-- replaced where possible.
-- ============================================================

create extension if not exists pgcrypto;

-- Function bodies reference tables created later in this file,
-- so defer validation to runtime exactly like pg_dump does.
set check_function_bodies = off;

-- ------------------------------------------------------------
-- 1. Helper functions
-- ------------------------------------------------------------

-- Normalises NZ phone numbers so registry matching is reliable.
-- Strips everything that is not a digit, then converts the
-- international prefixes 0064 and 64 back to a leading 0.
create or replace function public.normalize_phone(input text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if input is null then
    return null;
  end if;
  digits := regexp_replace(input, '[^0-9]', '', 'g');
  if digits = '' then
    return null;
  end if;
  if digits like '0064%' then
    digits := '0' || substring(digits from 5);
  elsif digits like '64%' and length(digits) >= 10 then
    digits := '0' || substring(digits from 3);
  end if;
  return digits;
end;
$$;

-- The single admin account, identified by email.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'wilieshout@gmail.com';
$$;

create or replace function public.has_role(uid uuid, r text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = r
  );
$$;

create or replace function public.is_verified_role(uid uuid, r text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and p.role = r
      and p.verified = true
      and p.verification_status = 'approved'
  );
$$;

create or replace function public.is_approved_agent_for(agent uuid, jockey uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agent_jockeys aj
    join public.profiles ag on ag.id = aj.agent_id
    where aj.agent_id = agent
      and aj.jockey_id = jockey
      and ag.role = 'agent'
      and ag.verification_status = 'approved'
  );
$$;

create or replace function public.is_thread_participant(thread uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_participants cp
    where cp.thread_id = thread and cp.user_id = auth.uid()
  );
$$;

-- True when the current user shares at least one chat thread
-- with the given user. Lets chat partners see each other's name.
create or replace function public.shares_thread_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_participants mine
    join public.chat_participants theirs
      on mine.thread_id = theirs.thread_id
    where mine.user_id = auth.uid()
      and theirs.user_id = other
  );
$$;

-- True when the current user and the given user appear on the
-- same ride request, in any combination of roles.
create or replace function public.shares_request_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ride_requests r
    where (r.trainer_id = auth.uid() or r.jockey_id = auth.uid() or r.created_by = auth.uid())
      and (r.trainer_id = other or r.jockey_id = other or r.created_by = other)
  );
$$;

-- ------------------------------------------------------------
-- 2. Tables
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  full_name text,
  role text not null default 'owner'
    check (role in ('jockey', 'trainer', 'owner', 'agent', 'admin')),
  phone text,
  phone_normalized text,
  country text default 'New Zealand',
  profile_photo_url text,
  bio text,
  verified boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  status text not null default 'pending',
  registry_match boolean not null default false,
  licence_type text
    check (licence_type is null or licence_type in ('race_jockey', 'trial_jumpout_only')),
  apprentice boolean not null default false,
  apprentice_claim numeric
    check (apprentice_claim is null or apprentice_claim in (1, 2, 3, 4)),
  riding_weight numeric check (riding_weight is null or (riding_weight > 30 and riding_weight < 90)),
  apprentice_riding_weight numeric
    check (apprentice_riding_weight is null or (apprentice_riding_weight > 30 and apprentice_riding_weight < 90)),
  base_region text,
  preferred_tracks text,
  availability_notes text,
  id_document_path text,
  id_document_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_phone_normalized_idx on public.profiles (phone_normalized);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- NZTR people registry, imported from CSV. Used to auto verify
-- trainers and flag agents.
create table if not exists public.nztr_people_registry (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('trainer', 'agent', 'jockey')),
  full_name text,
  location text,
  phone text,
  phone_normalized text,
  created_at timestamptz not null default now(),
  unique (role, phone_normalized)
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  nztr_day_id bigint unique,
  meeting_date date not null,
  track text not null,
  club text,
  source text default 'loveracing',
  meeting_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meetings_date_idx on public.meetings (meeting_date);

-- Race level rows. Not populated by the V1 sync, reserved for the
-- race card integration.
create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings (id) on delete cascade,
  nztr_day_id bigint,
  race_number integer not null,
  name text,
  start_time timestamptz,
  created_at timestamptz not null default now(),
  unique (nztr_day_id, race_number)
);

create table if not exists public.meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attending boolean not null default true,
  riding_weight_snapshot numeric,
  apprentice_snapshot boolean,
  apprentice_claim_snapshot numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);

create index if not exists attendance_user_idx on public.meeting_attendance (user_id);
create index if not exists attendance_meeting_idx on public.meeting_attendance (meeting_id);

create table if not exists public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings (id) on delete set null,
  race_id uuid references public.races (id) on delete set null,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  jockey_id uuid not null references public.profiles (id) on delete cascade,
  horse_name text,
  race_number integer,
  note text,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'cancelled', 'assigned')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ride_requests_trainer_idx on public.ride_requests (trainer_id);
create index if not exists ride_requests_jockey_idx on public.ride_requests (jockey_id);
create index if not exists ride_requests_status_idx on public.ride_requests (status);

create table if not exists public.agent_jockeys (
  agent_id uuid not null references public.profiles (id) on delete cascade,
  jockey_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, jockey_id)
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct'
    check (type in ('direct', 'ride', 'meeting_group')),
  meeting_id uuid references public.meetings (id) on delete set null,
  ride_request_id uuid references public.ride_requests (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists chat_threads_request_idx on public.chat_threads (ride_request_id);

create table if not exists public.chat_participants (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists chat_participants_user_idx on public.chat_participants (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,
  status text,
  trial_end timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

-- ------------------------------------------------------------
-- 3. Triggers
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists meetings_updated_at on public.meetings;
create trigger meetings_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

drop trigger if exists attendance_updated_at on public.meeting_attendance;
create trigger attendance_updated_at
  before update on public.meeting_attendance
  for each row execute function public.set_updated_at();

drop trigger if exists ride_requests_updated_at on public.ride_requests;
create trigger ride_requests_updated_at
  before update on public.ride_requests
  for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Keeps registry phone numbers normalised on the way in.
create or replace function public.handle_registry_row()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized := public.normalize_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists registry_normalize on public.nztr_people_registry;
create trigger registry_normalize
  before insert or update on public.nztr_people_registry
  for each row execute function public.handle_registry_row();

-- Creates a profile row for every new auth user.
-- The signup form passes role, first_name, last_name and phone
-- through raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := coalesce(nullif(meta ->> 'role', ''), 'owner');
  v_first text := nullif(meta ->> 'first_name', '');
  v_last text := nullif(meta ->> 'last_name', '');
  v_phone text := nullif(meta ->> 'phone', '');
  v_verified boolean := false;
  v_vstatus text := 'pending';
  v_status text := 'pending';
begin
  if v_role not in ('jockey', 'trainer', 'owner', 'agent') then
    v_role := 'owner';
  end if;

  -- The admin account is recognised by email and fully unlocked.
  if lower(coalesce(new.email, '')) = 'wilieshout@gmail.com' then
    v_role := 'admin';
    v_verified := true;
    v_vstatus := 'approved';
    v_status := 'approved';
  elsif v_role = 'owner' then
    -- Owners are view only, no review needed.
    v_verified := true;
    v_vstatus := 'approved';
    v_status := 'approved';
  end if;

  insert into public.profiles (
    id, email, first_name, last_name, role, phone,
    verified, verification_status, status
  ) values (
    new.id, new.email, v_first, v_last, v_role, v_phone,
    v_verified, v_vstatus, v_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profile bookkeeping plus the security core of the platform:
--   1. full_name and phone_normalized stay in sync
--   2. regular users can never grant themselves verification,
--      change their role, or fake a registry match. Those columns
--      silently reset to their previous values unless the change
--      comes from the service role, the admin, or direct SQL.
--   3. trainers whose phone matches the NZTR registry are auto
--      approved. Agents with a match are only flagged, an admin
--      still signs them off.
create or replace function public.handle_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt jsonb := auth.jwt();
  is_privileged boolean;
  matched boolean;
begin
  new.full_name := nullif(trim(concat_ws(' ', new.first_name, new.last_name)), '');
  new.phone_normalized := public.normalize_phone(new.phone);

  is_privileged := jwt is null
    or coalesce(jwt ->> 'role', '') = 'service_role'
    or public.is_admin();

  if tg_op = 'UPDATE' and not is_privileged then
    new.verified := old.verified;
    new.verification_status := old.verification_status;
    new.status := old.status;
    new.role := old.role;
    new.registry_match := old.registry_match;
  end if;

  if new.role in ('trainer', 'agent', 'jockey') and new.phone_normalized is not null then
    select exists (
      select 1 from public.nztr_people_registry r
      where r.role = new.role
        and r.phone_normalized = new.phone_normalized
    ) into matched;

    if matched then
      new.registry_match := true;
      -- Trainers and jockeys on the official register are trusted on
      -- the spot. Agents still need a manual admin sign off.
      if new.role in ('trainer', 'jockey') then
        new.verified := true;
        new.verification_status := 'approved';
        new.status := 'approved';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_before_change on public.profiles;
create trigger profiles_before_change
  before insert or update on public.profiles
  for each row execute function public.handle_profile_changes();

-- Snapshot the jockey's weight and claim the moment they mark a
-- meeting, so race day data does not drift when profiles change.
create or replace function public.fill_attendance_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  if new.riding_weight_snapshot is null
     or new.apprentice_snapshot is null then
    select riding_weight, apprentice, apprentice_claim
      into p
      from public.profiles
      where id = new.user_id;

    if found then
      new.riding_weight_snapshot := coalesce(new.riding_weight_snapshot, p.riding_weight);
      new.apprentice_snapshot := coalesce(new.apprentice_snapshot, p.apprentice);
      new.apprentice_claim_snapshot := coalesce(new.apprentice_claim_snapshot, p.apprentice_claim);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_snapshot on public.meeting_attendance;
create trigger attendance_snapshot
  before insert on public.meeting_attendance
  for each row execute function public.fill_attendance_snapshot();

-- ------------------------------------------------------------
-- 4. Row level security
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.nztr_people_registry enable row level security;
alter table public.meetings enable row level security;
alter table public.races enable row level security;
alter table public.meeting_attendance enable row level security;
alter table public.ride_requests enable row level security;
alter table public.agent_jockeys enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_participants enable row level security;
alter table public.messages enable row level security;
alter table public.subscriptions enable row level security;

-- profiles ----------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_admin()
    or public.is_approved_agent_for(auth.uid(), id)
    or public.shares_thread_with(id)
    or public.shares_request_with(id)
  );

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (
    id = auth.uid()
    or public.is_admin()
    or public.is_approved_agent_for(auth.uid(), id)
  )
  with check (
    id = auth.uid()
    or public.is_admin()
    or public.is_approved_agent_for(auth.uid(), id)
  );

-- registry ----------------------------------------------------
drop policy if exists "registry_admin_all" on public.nztr_people_registry;
create policy "registry_admin_all" on public.nztr_people_registry
  for all using (public.is_admin()) with check (public.is_admin());

-- meetings and races: public calendar -------------------------
drop policy if exists "meetings_public_read" on public.meetings;
create policy "meetings_public_read" on public.meetings
  for select to anon, authenticated using (true);

drop policy if exists "meetings_admin_write" on public.meetings;
create policy "meetings_admin_write" on public.meetings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "races_public_read" on public.races;
create policy "races_public_read" on public.races
  for select to anon, authenticated using (true);

drop policy if exists "races_admin_write" on public.races;
create policy "races_admin_write" on public.races
  for all using (public.is_admin()) with check (public.is_admin());

-- meeting_attendance ------------------------------------------
-- Raw rows stay private. The public calendar reads the
-- public_meeting_attendance view further down.
drop policy if exists "attendance_select" on public.meeting_attendance;
create policy "attendance_select" on public.meeting_attendance
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_approved_agent_for(auth.uid(), user_id)
  );

drop policy if exists "attendance_insert" on public.meeting_attendance;
create policy "attendance_insert" on public.meeting_attendance
  for insert with check (
    (user_id = auth.uid() and public.has_role(auth.uid(), 'jockey'))
    or public.is_approved_agent_for(auth.uid(), user_id)
  );

drop policy if exists "attendance_update" on public.meeting_attendance;
create policy "attendance_update" on public.meeting_attendance
  for update using (
    user_id = auth.uid()
    or public.is_approved_agent_for(auth.uid(), user_id)
  )
  with check (
    user_id = auth.uid()
    or public.is_approved_agent_for(auth.uid(), user_id)
  );

drop policy if exists "attendance_delete" on public.meeting_attendance;
create policy "attendance_delete" on public.meeting_attendance
  for delete using (
    user_id = auth.uid()
    or public.is_approved_agent_for(auth.uid(), user_id)
  );

-- ride_requests ------------------------------------------------
drop policy if exists "requests_select" on public.ride_requests;
create policy "requests_select" on public.ride_requests
  for select using (
    trainer_id = auth.uid()
    or jockey_id = auth.uid()
    or created_by = auth.uid()
    or public.is_admin()
    or public.is_approved_agent_for(auth.uid(), jockey_id)
  );

drop policy if exists "requests_insert" on public.ride_requests;
create policy "requests_insert" on public.ride_requests
  for insert with check (
    created_by = auth.uid()
    and status = 'requested'
    and (
      (created_by = trainer_id and public.is_verified_role(auth.uid(), 'trainer'))
      or (created_by = jockey_id and public.is_verified_role(auth.uid(), 'jockey'))
      or (
        public.is_verified_role(auth.uid(), 'agent')
        and public.is_approved_agent_for(auth.uid(), jockey_id)
      )
    )
  );

drop policy if exists "requests_update" on public.ride_requests;
create policy "requests_update" on public.ride_requests
  for update using (
    trainer_id = auth.uid()
    or jockey_id = auth.uid()
    or created_by = auth.uid()
    or public.is_admin()
    or public.is_approved_agent_for(auth.uid(), jockey_id)
  )
  with check (
    trainer_id = auth.uid()
    or jockey_id = auth.uid()
    or created_by = auth.uid()
    or public.is_admin()
    or public.is_approved_agent_for(auth.uid(), jockey_id)
  );

-- agent_jockeys ------------------------------------------------
drop policy if exists "agent_jockeys_select" on public.agent_jockeys;
create policy "agent_jockeys_select" on public.agent_jockeys
  for select using (
    agent_id = auth.uid()
    or jockey_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "agent_jockeys_insert" on public.agent_jockeys;
create policy "agent_jockeys_insert" on public.agent_jockeys
  for insert with check (
    agent_id = auth.uid()
    and public.is_verified_role(auth.uid(), 'agent')
  );

drop policy if exists "agent_jockeys_delete" on public.agent_jockeys;
create policy "agent_jockeys_delete" on public.agent_jockeys
  for delete using (
    agent_id = auth.uid()
    or jockey_id = auth.uid()
    or public.is_admin()
  );

-- chat ----------------------------------------------------------
drop policy if exists "threads_select" on public.chat_threads;
create policy "threads_select" on public.chat_threads
  for select using (
    public.is_thread_participant(id)
    or created_by = auth.uid()
    or public.is_admin()
  );

drop policy if exists "threads_insert" on public.chat_threads;
create policy "threads_insert" on public.chat_threads
  for insert with check (created_by = auth.uid());

drop policy if exists "participants_select" on public.chat_participants;
create policy "participants_select" on public.chat_participants
  for select using (public.is_thread_participant(thread_id));

drop policy if exists "participants_insert" on public.chat_participants;
create policy "participants_insert" on public.chat_participants
  for insert with check (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.created_by = auth.uid()
    )
  );

drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (public.is_thread_participant(thread_id));

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_thread_participant(thread_id)
  );

-- subscriptions --------------------------------------------------
-- Written only by the service role (Stripe webhook and admin
-- actions), so there are no insert or update policies.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- 5. Public views
-- The app never exposes the profiles table to anonymous
-- visitors. These owner level views publish only verified
-- people and only safe columns.
-- ------------------------------------------------------------

create or replace view public.public_profiles
with (security_invoker = off) as
select
  p.id,
  p.role,
  p.first_name,
  p.last_name,
  p.full_name,
  p.profile_photo_url,
  p.bio,
  p.country,
  p.base_region,
  p.preferred_tracks,
  p.licence_type,
  p.apprentice,
  p.apprentice_claim,
  p.riding_weight,
  p.apprentice_riding_weight,
  p.availability_notes,
  p.created_at
from public.profiles p
where p.verified = true
  and p.verification_status = 'approved'
  and p.role in ('jockey', 'trainer');

grant select on public.public_profiles to anon, authenticated;

create or replace view public.public_meeting_attendance
with (security_invoker = off) as
select
  ma.meeting_id,
  p.id as jockey_id,
  p.first_name,
  p.last_name,
  p.full_name,
  p.profile_photo_url,
  coalesce(ma.riding_weight_snapshot, p.riding_weight) as riding_weight,
  coalesce(ma.apprentice_claim_snapshot, p.apprentice_claim) as apprentice_claim,
  coalesce(ma.apprentice_snapshot, p.apprentice) as apprentice,
  p.availability_notes as availability
from public.meeting_attendance ma
join public.profiles p on p.id = ma.user_id
where ma.attending = true
  and p.role = 'jockey'
  and p.verified = true
  and p.verification_status = 'approved';

grant select on public.public_meeting_attendance to anon, authenticated;

-- ------------------------------------------------------------
-- 6. Storage: avatars bucket
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Note: no select policy on the avatars bucket. Public buckets
-- serve object URLs without one, and omitting it prevents
-- clients from listing every file.
drop policy if exists "avatars_public_read" on storage.objects;

drop policy if exists "avatars_own_insert" on storage.objects;
create policy "avatars_own_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_own_update" on storage.objects;
create policy "avatars_own_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_own_delete" on storage.objects;
create policy "avatars_own_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Private bucket for identity documents. No public access at all,
-- admins read through short lived signed URLs created server side.
insert into storage.buckets (id, name, public)
values ('identity-docs', 'identity-docs', false)
on conflict (id) do nothing;

drop policy if exists "identity_own_insert" on storage.objects;
create policy "identity_own_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'identity-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "identity_own_update" on storage.objects;
create policy "identity_own_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'identity-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public directory listing of registry people. Names and locations
-- only, never phone numbers. People who have claimed their listing by
-- signing up are excluded because their live profile shows instead.
create or replace view public.public_registry_people
with (security_invoker = off) as
select
  r.id,
  r.role,
  r.full_name,
  r.location
from public.nztr_people_registry r
where r.role in ('jockey', 'trainer')
  and r.full_name is not null
  and not exists (
    select 1 from public.profiles p
    where p.role = r.role
      and p.phone_normalized = r.phone_normalized
      and p.verified = true
  );

grant select on public.public_registry_people to anon, authenticated;

-- Self refreshing race calendar. Every hour the database asks
-- LoveRacing for the next three months of meetings and upserts them.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.loveracing_sync_state (
  id bigint generated always as identity primary key,
  request_id bigint not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  meetings_upserted int
);

alter table public.loveracing_sync_state enable row level security;

create or replace function public.sync_loveracing()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pending record;
  upserted int;
  req_id bigint;
  nz_today date := (now() at time zone 'Pacific/Auckland')::date;
begin
  for pending in
    select s.id, s.request_id
    from public.loveracing_sync_state s
    where s.processed_at is null
    order by s.requested_at
  loop
    if exists (
      select 1 from net._http_response r
      where r.id = pending.request_id and r.status_code = 200
    ) then
      with raw as (
        select (r.content::jsonb ->> 'd')::jsonb as arr
        from net._http_response r
        where r.id = pending.request_id
      ),
      events as (
        select distinct on (((e ->> 'DayID')::bigint))
          (e ->> 'DayID')::bigint as nztr_day_id,
          (
            to_timestamp(((regexp_match(e ->> 'RaceDate', '[0-9]+'))[1])::bigint / 1000)
            at time zone 'Pacific/Auckland'
          )::date as meeting_date,
          coalesce(nullif(e ->> 'TrackAppName', ''), nullif(e ->> 'Racecourse', ''), 'TBC') as track,
          nullif(e ->> 'Club', '') as club,
          coalesce(nullif(e ->> 'WebMeetingType', ''), nullif(e ->> 'WebDateType', '')) as meeting_type
        from raw, jsonb_array_elements(raw.arr) as e
        where e ->> 'DayID' is not null
          and e ->> 'RaceDate' ~ '[0-9]+'
        order by ((e ->> 'DayID')::bigint)
      ),
      ins as (
        insert into public.meetings (nztr_day_id, meeting_date, track, club, meeting_type, source)
        select nztr_day_id, meeting_date, track, club, meeting_type, 'loveracing'
        from events
        on conflict (nztr_day_id) do update set
          meeting_date = excluded.meeting_date,
          track = excluded.track,
          club = excluded.club,
          meeting_type = excluded.meeting_type,
          updated_at = now()
        returning 1
      )
      select count(*) into upserted from ins;

      update public.loveracing_sync_state
      set processed_at = now(), meetings_upserted = upserted
      where id = pending.id;
    elsif now() - pending.requested_at > interval '6 hours' then
      update public.loveracing_sync_state
      set processed_at = now(), meetings_upserted = 0
      where id = pending.id;
    end if;
  end loop;

  select net.http_post(
    url := 'https://loveracing.nz/ServerScript/RaceInfo.aspx/GetCalendarEvents',
    body := jsonb_build_object(
      'start', to_char(nz_today, 'DD-Mon-YYYY'),
      'end', to_char(nz_today + interval '3 months', 'DD-Mon-YYYY')
    ),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 20000
  ) into req_id;

  insert into public.loveracing_sync_state (request_id) values (req_id);

  delete from public.loveracing_sync_state
  where processed_at is not null and processed_at < now() - interval '7 days';
end;
$$;

revoke execute on function public.sync_loveracing() from public, anon, authenticated;

select cron.schedule(
  'loveracing-hourly-sync',
  '5 * * * *',
  $$select public.sync_loveracing()$$
);

-- ------------------------------------------------------------
-- 7. Realtime for chat
-- ------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 8. Hardening, follows the Supabase advisor output
-- ------------------------------------------------------------

alter function public.set_updated_at() set search_path = public;
alter function public.handle_registry_row() set search_path = public;
alter function public.normalize_phone(text) set search_path = public;

-- Trigger and utility functions are not part of the client API.
-- Triggers keep firing after this: execute privilege is checked
-- when the trigger is created, not when it runs.
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.handle_registry_row() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_profile_changes() from anon, authenticated;
revoke execute on function public.fill_attendance_snapshot() from anon, authenticated;
revoke execute on function public.normalize_phone(text) from anon, authenticated;

-- RLS helpers stay executable for signed in users because
-- policies evaluate them as the querying user. Anonymous visitors
-- only touch meetings and the public views. is_admin stays granted
-- to anon because the meetings and races policies reference it.
revoke execute on function public.has_role(uuid, text) from anon;
revoke execute on function public.is_verified_role(uuid, text) from anon;
revoke execute on function public.is_approved_agent_for(uuid, uuid) from anon;
revoke execute on function public.is_thread_participant(uuid) from anon;
revoke execute on function public.shares_thread_with(uuid) from anon;
revoke execute on function public.shares_request_with(uuid) from anon;
