-- Stable team: a head trainer links assistant trainers / foremen under one
-- operation. They can see the head trainer's ride requests.
create table if not exists public.stable_members (
  id uuid primary key default gen_random_uuid(),
  head_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete cascade,
  invite_email text,
  role text not null default 'assistant' check (role in ('assistant','foreman')),
  created_at timestamptz not null default now(),
  unique (head_id, member_id),
  unique (head_id, invite_email)
);
create index if not exists idx_stable_members_head on public.stable_members (head_id);
create index if not exists idx_stable_members_member on public.stable_members (member_id);

-- SECURITY DEFINER helper (bypasses RLS, avoids recursion). NOTE: keep it
-- EXECUTEable by anon/authenticated — it's used in the ride_requests policy
-- below, and revoking would 403 signed-in users.
create or replace function public.is_stable_member_of(head uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.stable_members where head_id = head and member_id = auth.uid());
$$;
grant execute on function public.is_stable_member_of(uuid) to anon, authenticated;

alter table public.stable_members enable row level security;

create policy sm_select on public.stable_members for select
  using (head_id = auth.uid() or member_id = auth.uid() or public.is_admin());
create policy sm_insert on public.stable_members for insert
  with check (head_id = auth.uid());
create policy sm_update on public.stable_members for update
  using (head_id = auth.uid()) with check (head_id = auth.uid());
create policy sm_delete on public.stable_members for delete
  using (head_id = auth.uid());

-- Additive (permissive) policy: a stable member can read their head trainer's
-- ride requests. Permissive policies are OR'd, so this only grants access.
create policy rr_select_stable on public.ride_requests for select
  using (public.is_stable_member_of(trainer_id));
