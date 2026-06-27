-- ── Syndicate / structured ownership model ──────────────────────────────────
create table if not exists public.ownership_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ownership_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.ownership_groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  invite_email text,
  share_label text,
  role text not null default 'member' check (role in ('manager','member')),
  created_at timestamptz not null default now(),
  unique (group_id, user_id),
  unique (group_id, invite_email)
);

create table if not exists public.group_horses (
  group_id uuid not null references public.ownership_groups(id) on delete cascade,
  horse_id uuid not null references public.horses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, horse_id)
);

create table if not exists public.syndicate_updates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.ownership_groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ownership_groups_manager on public.ownership_groups (manager_id);
create index if not exists idx_ownership_memberships_group on public.ownership_memberships (group_id);
create index if not exists idx_ownership_memberships_user on public.ownership_memberships (user_id);
create index if not exists idx_group_horses_horse on public.group_horses (horse_id);
create index if not exists idx_syndicate_updates_group on public.syndicate_updates (group_id);

-- Helper fns (SECURITY DEFINER, owned by the migration role so they bypass RLS
-- and avoid recursive policy evaluation).
create or replace function public.is_group_manager(g uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.ownership_groups where id = g and manager_id = auth.uid());
$$;

create or replace function public.is_group_member(g uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.ownership_memberships where group_id = g and user_id = auth.uid());
$$;

-- NOTE: these helpers are used in the RLS policies below, so the querying role
-- needs EXECUTE at runtime. Keep them executable (do NOT revoke — that breaks RLS).
grant execute on function public.is_group_manager(uuid) to anon, authenticated;
grant execute on function public.is_group_member(uuid) to anon, authenticated;

alter table public.ownership_groups enable row level security;
alter table public.ownership_memberships enable row level security;
alter table public.group_horses enable row level security;
alter table public.syndicate_updates enable row level security;

-- ownership_groups
create policy og_select on public.ownership_groups for select
  using (manager_id = auth.uid() or public.is_group_member(id) or public.is_admin());
create policy og_insert on public.ownership_groups for insert
  with check (manager_id = auth.uid());
create policy og_update on public.ownership_groups for update
  using (manager_id = auth.uid()) with check (manager_id = auth.uid());
create policy og_delete on public.ownership_groups for delete
  using (manager_id = auth.uid());

-- ownership_memberships
create policy om_select on public.ownership_memberships for select
  using (public.is_group_manager(group_id) or public.is_group_member(group_id) or user_id = auth.uid() or public.is_admin());
create policy om_insert on public.ownership_memberships for insert
  with check (public.is_group_manager(group_id));
create policy om_update on public.ownership_memberships for update
  using (public.is_group_manager(group_id)) with check (public.is_group_manager(group_id));
create policy om_delete on public.ownership_memberships for delete
  using (public.is_group_manager(group_id));

-- group_horses
create policy gh_select on public.group_horses for select
  using (public.is_group_manager(group_id) or public.is_group_member(group_id) or public.is_admin());
create policy gh_insert on public.group_horses for insert
  with check (public.is_group_manager(group_id));
create policy gh_delete on public.group_horses for delete
  using (public.is_group_manager(group_id));

-- syndicate_updates
create policy su_select on public.syndicate_updates for select
  using (public.is_group_manager(group_id) or public.is_group_member(group_id) or public.is_admin());
create policy su_insert on public.syndicate_updates for insert
  with check (public.is_group_manager(group_id) and author_id = auth.uid());
