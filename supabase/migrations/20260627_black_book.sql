-- Jockeys/agents privately "black-book" horses they've ridden or like.
create table if not exists public.black_book (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  horse_id uuid references public.horses(id) on delete set null,
  horse_name text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, horse_name)
);

create index if not exists idx_black_book_user on public.black_book (user_id);
create index if not exists idx_black_book_horse_name on public.black_book (lower(horse_name));

alter table public.black_book enable row level security;

create policy bb_select on public.black_book for select using (user_id = auth.uid());
create policy bb_insert on public.black_book for insert with check (user_id = auth.uid());
create policy bb_update on public.black_book for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bb_delete on public.black_book for delete using (user_id = auth.uid());
