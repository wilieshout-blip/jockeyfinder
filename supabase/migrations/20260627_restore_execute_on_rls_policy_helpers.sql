-- CORRECTION (continues 20260626_restore_rls_helper_execute_grants.sql).
--
-- Functions referenced in an RLS policy expression must be EXECUTEable by the
-- querying role AT RUNTIME. (The "EXECUTE is checked at creation, not runtime"
-- rule applies to TRIGGER functions, NOT to RLS-policy helpers.) The 2026-06-26
-- hardening migration wrongly revoked EXECUTE on several RLS helpers, and the
-- syndicate migration repeated the mistake on the group helpers — both break
-- RLS for signed-in users (403 → e.g. /dashboard redirects to /login).
--
-- The earlier restore migration missed is_verified_role; the group helpers were
-- added later. Restore EXECUTE on the remaining RLS-policy helpers. They stay
-- SECURITY DEFINER so callers cannot escalate privileges.
grant execute on function public.is_verified_role(uuid, text) to anon, authenticated;
grant execute on function public.is_group_manager(uuid) to anon, authenticated;
grant execute on function public.is_group_member(uuid) to anon, authenticated;
