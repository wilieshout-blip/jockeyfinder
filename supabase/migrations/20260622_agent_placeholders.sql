-- ============================================================
-- Agent-managed placeholder jockeys + claim-on-signup linking
-- ============================================================
-- Builds on the existing verified-agent model (agent_jockeys +
-- is_approved_agent_for). Adds:
--   1. placeholder jockey profiles an approved agent can fully
--      act for before the rider has signed up;
--   2. automatic, conflict-safe linking of a real signup to its
--      placeholder by email / phone / normalised name;
--   3. an admin review queue for ambiguous matches.
-- Idempotent: safe to re-run.
-- ============================================================

set check_function_bodies = off;

-- ------------------------------------------------------------
-- 1. Profile columns
-- ------------------------------------------------------------

alter table public.profiles
  add column if not exists is_placeholder boolean not null default false,
  add column if not exists placeholder_created_by uuid
    references public.profiles (id) on delete set null;

create index if not exists profiles_is_placeholder_idx
  on public.profiles (is_placeholder) where is_placeholder;

-- ------------------------------------------------------------
-- 2. Name normaliser (mirrors lib/claim-matching.ts)
-- ------------------------------------------------------------

create or replace function public.normalize_name(input text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', ' ', 'g')),
    ''
  );
$$;

-- ------------------------------------------------------------
-- 3. Admin review queue
-- ------------------------------------------------------------
-- candidate_profile_id has no FK: a placeholder is deleted the
-- moment it is claimed, so we snapshot its name instead.

create table if not exists public.placeholder_claim_reviews (
  id uuid primary key default gen_random_uuid(),
  new_user_id uuid not null references public.profiles (id) on delete cascade,
  new_user_email text,
  new_user_phone text,
  new_user_full_name text,
  candidate_profile_id uuid,
  candidate_full_name text,
  match_email boolean not null default false,
  match_phone boolean not null default false,
  match_name boolean not null default false,
  match_reason text,
  status text not null default 'pending'
    check (status in ('pending', 'auto_linked', 'resolved', 'rejected')),
  auto boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

create index if not exists placeholder_claim_reviews_status_idx
  on public.placeholder_claim_reviews (status);
create index if not exists placeholder_claim_reviews_user_idx
  on public.placeholder_claim_reviews (new_user_id);

alter table public.placeholder_claim_reviews enable row level security;

drop policy if exists "claim_reviews_select" on public.placeholder_claim_reviews;
create policy "claim_reviews_select" on public.placeholder_claim_reviews
  for select using (new_user_id = auth.uid() or public.is_admin());

drop policy if exists "claim_reviews_admin_write" on public.placeholder_claim_reviews;
create policy "claim_reviews_admin_write" on public.placeholder_claim_reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 4. Matching
-- ------------------------------------------------------------
-- Returns placeholder jockey profiles that match the given
-- contact details on any of email / phone / normalised name.

create or replace function public.find_placeholder_matches(
  p_email text,
  p_phone_normalized text,
  p_full_name text
)
returns table (
  candidate_id uuid,
  match_email boolean,
  match_phone boolean,
  match_name boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    (p_email is not null and lower(p.email) = lower(p_email)),
    (p_phone_normalized is not null and p.phone_normalized = p_phone_normalized),
    (p_full_name is not null
      and public.normalize_name(p.full_name) = public.normalize_name(p_full_name))
  from public.profiles p
  where p.is_placeholder = true
    and p.role = 'jockey'
    and (
      (p_email is not null and lower(p.email) = lower(p_email))
      or (p_phone_normalized is not null and p.phone_normalized = p_phone_normalized)
      or (p_full_name is not null
        and public.normalize_name(p.full_name) = public.normalize_name(p_full_name))
    );
$$;

-- ------------------------------------------------------------
-- 5. Claim / merge — conflict-safe repoint of every child row
-- ------------------------------------------------------------
-- Moves all history from a placeholder profile onto a real user
-- profile, copies racing + verification data, records the link,
-- then deletes the placeholder (cascades from auth.users).

create or replace function public.claim_placeholder_jockey(
  p_new_user uuid,
  p_placeholder uuid,
  p_reason text default 'auto'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ph public.profiles%rowtype;
begin
  if p_new_user is null or p_placeholder is null or p_new_user = p_placeholder then
    return;
  end if;

  select * into ph from public.profiles
    where id = p_placeholder and is_placeholder = true;
  if not found then
    return;
  end if;

  -- agent_jockeys (PK agent_id, jockey_id)
  update public.agent_jockeys aj set jockey_id = p_new_user
    where aj.jockey_id = p_placeholder
      and not exists (
        select 1 from public.agent_jockeys x
        where x.agent_id = aj.agent_id and x.jockey_id = p_new_user
      );
  delete from public.agent_jockeys where jockey_id = p_placeholder;
  update public.agent_jockeys aj set agent_id = p_new_user
    where aj.agent_id = p_placeholder
      and not exists (
        select 1 from public.agent_jockeys x
        where x.agent_id = p_new_user and x.jockey_id = aj.jockey_id
      );
  delete from public.agent_jockeys where agent_id = p_placeholder;

  -- meeting_attendance (unique meeting_id, user_id)
  update public.meeting_attendance ma set user_id = p_new_user
    where ma.user_id = p_placeholder
      and not exists (
        select 1 from public.meeting_attendance x
        where x.meeting_id = ma.meeting_id and x.user_id = p_new_user
      );
  delete from public.meeting_attendance where user_id = p_placeholder;

  -- ride_requests (no unique constraints on these columns)
  update public.ride_requests set jockey_id = p_new_user where jockey_id = p_placeholder;
  update public.ride_requests set trainer_id = p_new_user where trainer_id = p_placeholder;
  update public.ride_requests set created_by = p_new_user where created_by = p_placeholder;

  -- chat
  update public.chat_participants cp set user_id = p_new_user
    where cp.user_id = p_placeholder
      and not exists (
        select 1 from public.chat_participants x
        where x.thread_id = cp.thread_id and x.user_id = p_new_user
      );
  delete from public.chat_participants where user_id = p_placeholder;
  update public.chat_threads set created_by = p_new_user where created_by = p_placeholder;
  update public.messages set sender_id = p_new_user where sender_id = p_placeholder;

  -- horse links / claims (defensive: a placeholder is a jockey, but
  -- repoint anyway so nothing is ever orphaned)
  update public.trainer_horse_links thl set trainer_id = p_new_user
    where thl.trainer_id = p_placeholder
      and not exists (
        select 1 from public.trainer_horse_links x
        where x.trainer_id = p_new_user and x.horse_id = thl.horse_id
      );
  delete from public.trainer_horse_links where trainer_id = p_placeholder;
  update public.owner_horse_links ohl set owner_id = p_new_user
    where ohl.owner_id = p_placeholder
      and not exists (
        select 1 from public.owner_horse_links x
        where x.owner_id = p_new_user and x.horse_id = ohl.horse_id
      );
  delete from public.owner_horse_links where owner_id = p_placeholder;
  update public.owner_horse_claims ohc set user_id = p_new_user
    where ohc.user_id = p_placeholder
      and not exists (
        select 1 from public.owner_horse_claims x
        where x.user_id = p_new_user and x.race_entry_id = ohc.race_entry_id
      );
  delete from public.owner_horse_claims where user_id = p_placeholder;
  update public.horses set owner_id = p_new_user where owner_id = p_placeholder;
  update public.horses set trainer_id = p_new_user where trainer_id = p_placeholder;

  -- subscriptions (PK user_id)
  update public.subscriptions s set user_id = p_new_user
    where s.user_id = p_placeholder
      and not exists (select 1 from public.subscriptions x where x.user_id = p_new_user);
  delete from public.subscriptions where user_id = p_placeholder;

  -- Copy racing + verification data onto the real profile. The new
  -- user keeps the name / email / phone they signed up with; the
  -- placeholder supplies everything the agent had already set up.
  update public.profiles np set
    verified = ph.verified,
    verification_status = ph.verification_status,
    status = ph.status,
    registry_match = ph.registry_match,
    riding_weight = coalesce(np.riding_weight, ph.riding_weight),
    apprentice = ph.apprentice,
    apprentice_claim = coalesce(np.apprentice_claim, ph.apprentice_claim),
    apprentice_riding_weight = coalesce(np.apprentice_riding_weight, ph.apprentice_riding_weight),
    licence_type = coalesce(np.licence_type, ph.licence_type),
    base_region = coalesce(np.base_region, ph.base_region),
    preferred_tracks = coalesce(np.preferred_tracks, ph.preferred_tracks),
    availability_notes = coalesce(np.availability_notes, ph.availability_notes),
    bio = coalesce(np.bio, ph.bio),
    profile_photo_url = coalesce(np.profile_photo_url, ph.profile_photo_url),
    is_placeholder = false,
    placeholder_created_by = null
  where np.id = p_new_user;

  -- Audit the link and resolve any pending reviews for this user.
  insert into public.placeholder_claim_reviews (
    new_user_id, new_user_email, new_user_phone, new_user_full_name,
    candidate_profile_id, candidate_full_name, match_reason, status,
    auto, resolved_at
  )
  select np.id, np.email, np.phone, np.full_name,
    p_placeholder, ph.full_name, p_reason, 'auto_linked',
    (p_reason = 'auto'), now()
  from public.profiles np where np.id = p_new_user;

  update public.placeholder_claim_reviews
    set status = 'resolved', resolved_at = now()
    where new_user_id = p_new_user and status = 'pending';

  -- Drop the placeholder. Deleting the auth user cascades to the
  -- now-empty placeholder profile.
  delete from auth.users where id = p_placeholder;
end;
$$;

-- ------------------------------------------------------------
-- 6. Orchestrator — decides auto-link vs admin review
-- ------------------------------------------------------------
-- Exactly one candidate  -> auto-link.
-- More than one          -> queue every candidate for admin review.
-- Zero                   -> normal new jockey, no action.

create or replace function public.attempt_placeholder_claim(p_new_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  cand record;
  n_candidates int;
begin
  select * into me from public.profiles where id = p_new_user;
  if not found then return; end if;
  if me.is_placeholder then return; end if;      -- placeholders never claim
  if me.role <> 'jockey' then return; end if;     -- only jockeys claim jockey placeholders

  select count(*) into n_candidates
  from public.find_placeholder_matches(me.email, me.phone_normalized, me.full_name)
  where candidate_id <> p_new_user;

  if n_candidates = 1 then
    select * into cand
    from public.find_placeholder_matches(me.email, me.phone_normalized, me.full_name)
    where candidate_id <> p_new_user
    limit 1;

    perform public.claim_placeholder_jockey(
      p_new_user,
      cand.candidate_id,
      case
        when cand.match_email then 'email'
        when cand.match_phone then 'phone'
        else 'name'
      end
    );
  elsif n_candidates > 1 then
    insert into public.placeholder_claim_reviews (
      new_user_id, new_user_email, new_user_phone, new_user_full_name,
      candidate_profile_id, candidate_full_name,
      match_email, match_phone, match_name, match_reason, status, auto
    )
    select
      p_new_user, me.email, me.phone, me.full_name,
      c.candidate_id,
      (select full_name from public.profiles where id = c.candidate_id),
      c.match_email, c.match_phone, c.match_name,
      'ambiguous: ' || n_candidates || ' placeholder candidates', 'pending', true
    from public.find_placeholder_matches(me.email, me.phone_normalized, me.full_name) c
    where c.candidate_id <> p_new_user;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 7. Admin manual resolution
-- ------------------------------------------------------------

create or replace function public.admin_resolve_claim(
  p_review_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.placeholder_claim_reviews%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into r from public.placeholder_claim_reviews where id = p_review_id;
  if not found then return; end if;

  if p_approve then
    perform public.claim_placeholder_jockey(r.new_user_id, r.candidate_profile_id, 'admin_approved');
    update public.placeholder_claim_reviews
      set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
      where new_user_id = r.new_user_id and status = 'pending';
  else
    update public.placeholder_claim_reviews
      set status = 'rejected', resolved_at = now(), resolved_by = auth.uid()
      where id = p_review_id;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 8. Hook signup into the claim flow
-- ------------------------------------------------------------
-- Re-creates handle_new_user with the original behaviour plus:
--   * honouring is_placeholder / placeholder_created_by metadata
--   * attempting a placeholder claim for real jockey signups

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
  v_is_placeholder boolean := coalesce(lower(nullif(meta ->> 'is_placeholder', '')) = 'true', false);
  v_ph_creator uuid := nullif(meta ->> 'placeholder_created_by', '')::uuid;
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
    v_verified := true;
    v_vstatus := 'approved';
    v_status := 'approved';
  end if;

  insert into public.profiles (
    id, email, first_name, last_name, role, phone,
    verified, verification_status, status,
    is_placeholder, placeholder_created_by
  ) values (
    new.id, new.email, v_first, v_last, v_role, v_phone,
    v_verified, v_vstatus, v_status,
    v_is_placeholder, v_ph_creator
  )
  on conflict (id) do nothing;

  -- Some users created through direct admin/SQL tooling can receive NULL
  -- token strings. GoTrue expects strings and otherwise fails all password
  -- logins with "Database error querying schema".
  update auth.users
  set
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, '')
  where id = new.id
    and (
      confirmation_token is null
      or recovery_token is null
      or email_change_token_new is null
      or email_change is null
    );

  -- A real jockey signing up may be claiming a placeholder the agent
  -- already set up. Placeholders themselves never trigger this.
  if v_role = 'jockey' and not v_is_placeholder then
    perform public.attempt_placeholder_claim(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 9. Grants / hardening (mirrors the rest of schema.sql)
-- ------------------------------------------------------------

alter function public.normalize_name(text) set search_path = public;

revoke execute on function public.normalize_name(text) from public;
grant execute on function public.normalize_name(text) to authenticated;

-- Internal-only: only the signup trigger and admin RPC may run these.
revoke execute on function public.find_placeholder_matches(text, text, text) from public, anon, authenticated;
revoke execute on function public.claim_placeholder_jockey(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.attempt_placeholder_claim(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Admin RPC: callable by signed-in users, but guarded by is_admin() inside.
revoke execute on function public.admin_resolve_claim(uuid, boolean) from public, anon;
grant execute on function public.admin_resolve_claim(uuid, boolean) to authenticated;
