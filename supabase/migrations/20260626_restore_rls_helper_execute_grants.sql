-- Fix: Restore EXECUTE on RLS helper functions broken by security hardening migration.
-- 
-- The 2026-06-26 security hardening commit (chore: security advisors) revoked 
-- EXECUTE on is_admin() and related SECURITY DEFINER functions from authenticated/anon
-- to prevent them appearing on the REST /rpc surface.
-- 
-- However PostgreSQL checks EXECUTE at RUNTIME (not policy creation time), so
-- every RLS policy that calls is_admin() started returning 403 for authenticated users.
-- This broke the /dashboard page (profiles query 403 → redirect to /login).
-- 
-- Fix: Re-grant EXECUTE to authenticated and anon for the RLS-internal helpers.
-- The functions remain SECURITY DEFINER so callers cannot escalate privileges.
-- To prevent RPC exposure, raise a notice or rely on Supabase's postgrest.schemas config.

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_agent_for(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.shares_thread_with(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.shares_request_with(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_thread_participant(uuid) TO authenticated, anon;
