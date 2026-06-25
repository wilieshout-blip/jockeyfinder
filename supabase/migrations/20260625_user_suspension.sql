-- Account suspension ("pause"): a real lockout flag, separate from verification.
-- Suspended users are hidden from public directories/listings and are blocked
-- from the dashboard (enforced in components/app-shell.tsx).
alter table public.profiles
  add column if not exists suspended boolean not null default false;

-- Hide suspended users from the public directories/listings.
create or replace view public.public_profiles
with (security_invoker = off) as
select
  id, role, first_name, last_name, full_name, profile_photo_url, bio, country,
  base_region, preferred_tracks, licence_type, apprentice, apprentice_claim,
  riding_weight, apprentice_riding_weight, availability_notes, created_at, phone
from public.profiles p
where verified = true
  and verification_status = 'approved'
  and role in ('jockey', 'trainer')
  and is_test = false
  and suspended = false;

grant select on public.public_profiles to anon, authenticated;

-- Hide suspended jockeys from meeting "Riding here" attendance.
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
  and p.verification_status = 'approved'
  and p.is_test = false
  and p.suspended = false;

grant select on public.public_meeting_attendance to anon, authenticated;
