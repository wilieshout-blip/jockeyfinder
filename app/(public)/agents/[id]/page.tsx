export const revalidate = 900;

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { hasSupabaseSessionCookie } from "@/lib/supabase/session-cookie";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { startDirectMessage } from "@/app/dashboard/messages/actions";

interface PublicAgent {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  phone: string | null;
  base_region: string | null;
  bio: string | null;
}

interface ManagedJockey {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  riding_weight: number | null;
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createPublicClient();

  const { data: agent } = await supabase
    .from("public_agents")
    .select("id, full_name, profile_photo_url, phone, base_region, bio")
    .eq("id", id)
    .maybeSingle<PublicAgent>();
  if (!agent) notFound();

  // Jockeys this agent manages.
  let jockeys: ManagedJockey[] = [];
  const { data: links } = await supabase
    .from("agent_jockeys")
    .select("jockey_id")
    .eq("agent_id", agent.id);
  const jockeyIds = (links ?? []).map((l) => l.jockey_id);
  if (jockeyIds.length > 0) {
    const { data } = await supabase
      .from("public_profiles")
      .select("id, full_name, profile_photo_url, riding_weight")
      .eq("role", "jockey")
      .in("id", jockeyIds)
      .order("full_name", { ascending: true })
      .returns<ManagedJockey[]>();
    jockeys = data ?? [];
  }

  let user: { id: string } | null = null;
  if (await hasSupabaseSessionCookie()) {
    const sessionClient = await createClient();
    const {
      data: { user: signedInUser },
    } = await sessionClient.auth.getUser();
    user = signedInUser ? { id: signedInUser.id } : null;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/jockeys" className="text-sm font-medium text-zinc-500 hover:text-ink">← All jockeys</Link>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-5">
          <Avatar src={agent.profile_photo_url} name={agent.full_name} size="xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {agent.full_name ?? "Jockeys' agent"}
              </h1>
              <Badge tone="neutral">Agent</Badge>
            </div>
            {agent.base_region ? <p className="mt-2 text-sm text-zinc-500">Based in {agent.base_region}</p> : null}
          </div>
        </div>
        {user && user.id !== agent.id ? (
          <form action={startDirectMessage} className="shrink-0">
            <input type="hidden" name="user_id" value={agent.id} />
            <button type="submit" className={buttonClasses("accent", "md")}>Message</button>
          </form>
        ) : null}
      </div>

      {agent.bio ? <p className="mt-6 max-w-2xl text-zinc-700">{agent.bio}</p> : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Contact</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">Phone</dt>
                <dd className="font-medium text-ink">
                  {agent.phone ? (
                    <a href={`tel:${agent.phone}`} className="hover:underline">{agent.phone}</a>
                  ) : (
                    "Not listed"
                  )}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Jockeys represented · {jockeys.length}
            </h2>
            {jockeys.length > 0 ? (
              <div className="space-y-2">
                {jockeys.map((j) => (
                  <Link
                    key={j.id}
                    href={`/jockeys/${j.id}`}
                    className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2 transition-colors hover:border-turf-300 hover:bg-turf-50/40"
                  >
                    <Avatar src={j.profile_photo_url} name={j.full_name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{j.full_name}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No jockeys listed yet.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
