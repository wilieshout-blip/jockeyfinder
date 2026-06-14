import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";
import { AppNav } from "@/components/app-nav";
import { AgentBar } from "@/components/agent-bar";
import type { Profile, Subscription } from "@/lib/types";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single<Profile>();

  const isAdmin = isAdminEmail(user.email);

  // Fetch managed jockeys for agents (approved only)
  let managedJockeys: { id: string; full_name: string | null; profile_photo_url: string | null }[] = [];
  if (profile?.role === "agent" && profile.verification_status === "approved") {
    const { data: links } = await supabase
      .from("agent_jockeys")
      .select("jockey_id")
      .eq("agent_id", user.id);
    const ids = (links ?? []).map((l) => l.jockey_id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, profile_photo_url")
        .in("id", ids)
        .order("full_name");
      managedJockeys = data ?? [];
    }
  }

  let paywallActive = false;
  if (profile?.role === "jockey" && !isAdmin) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle<Subscription>();
    if (sub && !["trialing", "active"].includes(sub.status ?? "")) {
      paywallActive = true;
    }
  }

  // ── Notification counts ─────────────────────────────────────────────────────
  // pendingRequestCount: requests awaiting MY action (I didn't create them)
  // unreadThreadCount: threads where last message in the past 7 days is from
  //                   someone else (proxy for "unread")
  let pendingRequestCount = 0;
  let unreadThreadCount = 0;

  if (profile && !paywallActive) {
    const [reqResult, participantRows] = await Promise.all([
      supabase
        .from("ride_requests")
        .select("id", { count: "exact", head: true })
        .or(`trainer_id.eq.${user.id},jockey_id.eq.${user.id}`)
        .neq("created_by", user.id)
        .eq("status", "requested"),
      supabase
        .from("chat_participants")
        .select("thread_id")
        .eq("user_id", user.id),
    ]);

    pendingRequestCount = reqResult.count ?? 0;

    const threadIds = (participantRows.data ?? []).map((r) => r.thread_id);
    if (threadIds.length > 0) {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: msgs } = await supabase
        .from("messages")
        .select("thread_id, sender_id")
        .in("thread_id", threadIds)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(200);

      const seen = new Set<string>();
      for (const m of msgs ?? []) {
        if (!seen.has(m.thread_id)) {
          seen.add(m.thread_id);
          if (m.sender_id !== user.id) unreadThreadCount++;
        }
      }
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-paper">
      <AppNav
        name={profile?.full_name || user.email || "Account"}
        role={profile?.role ?? "owner"}
        photoUrl={profile?.profile_photo_url ?? null}
        isAdmin={isAdmin}
        requestBadge={pendingRequestCount}
        messageBadge={unreadThreadCount}
      />
      {managedJockeys.length > 0 && (
        <AgentBar jockeys={managedJockeys} />
      )}
      {paywallActive ? (
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pl-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">Subscription required</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">Your free trial has ended</h1>
            <p className="mt-3 text-sm text-zinc-600">
              JockeyFinder is $40 NZD/month for jockeys after the free trial.
              Subscribe to continue accessing ride requests, attendance, and messaging.
            </p>
            <a href="/dashboard/billing" className="mt-5 inline-block rounded-full bg-turf-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-turf-700">
              View billing and subscribe
            </a>
          </div>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pl-6">
          {children}
        </main>
      )}
    </div>
  );
      }
