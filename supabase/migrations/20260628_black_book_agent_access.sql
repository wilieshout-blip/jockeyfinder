-- Let an approved agent manage the black book of a jockey they represent.
create or replace function public.is_agent_for_jockey(j uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.agent_jockeys aj
    join public.profiles p on p.id = aj.agent_id
    where aj.agent_id = auth.uid()
      and aj.jockey_id = j
      and p.role = 'agent'
      and p.verification_status = 'approved'
  );
$$;
-- Keep EXECUTE (used in RLS policies below — revoking would 403 signed-in users).
grant execute on function public.is_agent_for_jockey(uuid) to anon, authenticated;

-- Additive (permissive, OR'd) policies — existing "manage own" access is unchanged.
create policy bb_select_agent on public.black_book for select
  using (public.is_agent_for_jockey(user_id));
create policy bb_insert_agent on public.black_book for insert
  with check (public.is_agent_for_jockey(user_id));
create policy bb_update_agent on public.black_book for update
  using (public.is_agent_for_jockey(user_id)) with check (public.is_agent_for_jockey(user_id));
create policy bb_delete_agent on public.black_book for delete
  using (public.is_agent_for_jockey(user_id));
