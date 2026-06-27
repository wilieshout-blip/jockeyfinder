-- Private bucket for jockey audio notes (pre/post-race).
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

create table if not exists public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'note' check (kind in ('pre_race','post_race','note')),
  audio_path text not null,
  duration_s int,
  created_at timestamptz not null default now()
);
create index if not exists idx_voice_notes_thread on public.voice_notes (thread_id);

alter table public.voice_notes enable row level security;

create policy vn_select on public.voice_notes for select
  using (public.is_thread_participant(thread_id));
create policy vn_insert on public.voice_notes for insert
  with check (public.is_thread_participant(thread_id) and sender_id = auth.uid());
create policy vn_delete on public.voice_notes for delete
  using (sender_id = auth.uid());

-- Storage object policies: only thread participants can read/write objects under
-- voice-notes/<thread_id>/...  (thread_id is the first path segment).
create policy vn_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'voice-notes' and public.is_thread_participant(((storage.foldername(name))[1])::uuid));
create policy vn_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'voice-notes' and public.is_thread_participant(((storage.foldername(name))[1])::uuid));
create policy vn_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'voice-notes' and public.is_thread_participant(((storage.foldername(name))[1])::uuid));
