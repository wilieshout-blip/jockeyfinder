-- Admin-recorded medical stand-downs / suspensions. Manually entered (certain),
-- scoped to specific races or a date window, used to alert affected trainers.
create table if not exists public.medical_stand_downs (
  id uuid primary key default gen_random_uuid(),
  jockey_id uuid not null references public.profiles(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  from_race int,
  to_race int,
  end_date date,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_stand_downs_jockey on public.medical_stand_downs (jockey_id);
create index if not exists idx_stand_downs_meeting on public.medical_stand_downs (meeting_id);

alter table public.medical_stand_downs enable row level security;

-- Admins manage; the affected jockey can see their own.
create policy msd_select on public.medical_stand_downs for select
  using (public.is_admin() or jockey_id = auth.uid());
create policy msd_insert on public.medical_stand_downs for insert
  with check (public.is_admin());
create policy msd_update on public.medical_stand_downs for update
  using (public.is_admin()) with check (public.is_admin());
create policy msd_delete on public.medical_stand_downs for delete
  using (public.is_admin());
