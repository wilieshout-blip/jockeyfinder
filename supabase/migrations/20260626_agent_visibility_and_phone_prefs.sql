-- Jockey-controlled contact visibility.
alter table public.profiles
  add column if not exists show_phone boolean not null default false,
  add column if not exists show_agent_phone boolean not null default true;

-- Expose the two new prefs on the public jockey/trainer view (appended columns).
create or replace view public.public_profiles
with (security_invoker = off) as
select
  id, role, first_name, last_name, full_name, profile_photo_url, bio, country,
  base_region, preferred_tracks, licence_type, apprentice, apprentice_claim,
  riding_weight, apprentice_riding_weight, availability_notes, created_at, phone,
  show_phone, show_agent_phone
from public.profiles p
where verified = true
  and verification_status = 'approved'
  and role in ('jockey', 'trainer')
  and is_test = false
  and suspended = false;

grant select on public.public_profiles to anon, authenticated;

-- Public view of approved agents so jockey profiles can link to their agent and
-- an agent profile page can render, without exposing the full profiles table.
create or replace view public.public_agents
with (security_invoker = off) as
select
  id, full_name, first_name, last_name, profile_photo_url, phone, base_region,
  bio, created_at
from public.profiles p
where role = 'agent'
  and verification_status = 'approved'
  and is_test = false
  and suspended = false;

grant select on public.public_agents to anon, authenticated;
