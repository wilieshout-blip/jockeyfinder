-- Public jockey -> agent mapping. agent_jockeys is RLS-locked to the agent /
-- jockey themselves, so the public jockey directory + profiles (anon client)
-- could never show "Represented by ...". This security-definer view exposes the
-- link publicly (an intended feature — trainers need to reach the agent), with
-- the agent's phone gated by the jockey's show_agent_phone preference. Only
-- approved, non-test, non-suspended agents are exposed.
create or replace view public.public_jockey_agents
with (security_invoker = off) as
select
  aj.jockey_id,
  a.id          as agent_id,
  a.full_name   as agent_name,
  case when coalesce(j.show_agent_phone, true) then a.phone else null end as agent_phone
from public.agent_jockeys aj
join public.profiles a
  on a.id = aj.agent_id
 and a.role = 'agent'
 and a.verification_status = 'approved'
 and a.is_test = false
 and a.suspended = false
join public.profiles j
  on j.id = aj.jockey_id;

grant select on public.public_jockey_agents to anon, authenticated;
