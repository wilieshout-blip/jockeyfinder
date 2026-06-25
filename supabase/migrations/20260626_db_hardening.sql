-- DB hardening from the Supabase security + performance advisors.

-- 0011: pin search_path on the preferred-rider cap trigger fn.
alter function public.enforce_preferred_limit() set search_path = public;

-- 0001: covering indexes for foreign keys (cheap, additive).
create index if not exists idx_agent_jockeys_jockey_id on public.agent_jockeys (jockey_id);
create index if not exists idx_chat_threads_created_by on public.chat_threads (created_by);
create index if not exists idx_chat_threads_meeting_id on public.chat_threads (meeting_id);
create index if not exists idx_messages_sender_id on public.messages (sender_id);
create index if not exists idx_owner_horse_claims_race_entry_id on public.owner_horse_claims (race_entry_id);
create index if not exists idx_owner_horse_links_horse_id on public.owner_horse_links (horse_id);
create index if not exists idx_placeholder_claim_reviews_resolved_by on public.placeholder_claim_reviews (resolved_by);
create index if not exists idx_profiles_placeholder_created_by on public.profiles (placeholder_created_by);
create index if not exists idx_race_results_meeting_id on public.race_results (meeting_id);
create index if not exists idx_races_meeting_id on public.races (meeting_id);
create index if not exists idx_ride_requests_created_by on public.ride_requests (created_by);
create index if not exists idx_ride_requests_meeting_id on public.ride_requests (meeting_id);
create index if not exists idx_ride_requests_race_id on public.ride_requests (race_id);
create index if not exists idx_trainer_horse_links_horse_id on public.trainer_horse_links (horse_id);
create index if not exists idx_trainer_preferred_jockeys_jockey_id on public.trainer_preferred_jockeys (jockey_id);

-- 0028/0029: stop exposing RLS-internal SECURITY DEFINER helpers via the public
-- REST RPC surface. RLS keeps working (EXECUTE is checked when a policy is
-- created, not at runtime). match_trainer_horses / match_owner_horses are
-- intentionally left executable: the app calls them via .rpc() as the user.
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, text) from anon, authenticated;
revoke execute on function public.is_approved_agent_for(uuid, uuid) from anon, authenticated;
revoke execute on function public.is_thread_participant(uuid) from anon, authenticated;
revoke execute on function public.is_verified_role(uuid, text) from anon, authenticated;
revoke execute on function public.shares_request_with(uuid) from anon, authenticated;
revoke execute on function public.shares_thread_with(uuid) from anon, authenticated;
revoke execute on function public.admin_resolve_claim(uuid, boolean) from anon, authenticated;
