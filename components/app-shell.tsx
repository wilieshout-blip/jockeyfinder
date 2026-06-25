import { headers } from "next/headers";
import { getAccessStatus, canAccess } from "@/lib/subscription";
import { BILLING_START_DATE, ROLE_PRICE_DISPLAY } from "@/lib/stripe";
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

  // Paused accounts are locked out of the app (and hidden from public listings
  // via the public_* views). Admins are never locked out.
  if (profile?.suspended && !isAdmin) {
    return (
      <div className="app-surface min-h-screen">
        <AppNav
          name={profile?.full_name || user.email || "Account"}
          role={profile?.role ?? "owner"}
          photoUrl={profile?.profile_photo_url ?? null}
          isAdmin={isAdmin}
        />
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8 lg:pt-9">
          <div className="mx-auto max-w-xl border border-amber-200 bg-amber-50 p-8 text-center shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">Account paused</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">Your account is on hold</h1>
            <p className="mt-3 text-sm text-zinc-600">
              Your JockeyFinder account has been paused by an administrator, so it is
              temporarily hidden and your dashboard is unavailable. If you think this is
              a mistake, reply to your welcome email and the team will take a look.
            </p>
          </div>
        </main>
      </div>
    );
  }

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
  if (["jockey", "trainer", "owner"].includes(profile?.role ?? "") && !isAdmin) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle<Subscription>();
    const accessStatus = getAccessStatus({
          role: profile?.role ?? "",
          trialStartDate: profile?.trial_start_date ?? null,
          stripeStatus: sub?.status ?? null,
          licenceType: profile?.licence_type ?? null,
        });
        if (!canAccess(accessStatus)) {
          paywallActive = true;
        }
  }

  // Allow lapsed jockeys to still reach billing and profile so they can resubscribe.
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const paywallBypassed =
    pathname.startsWith("/dashboard/billing") ||
    pathname.startsWith("/dashboard/profile");

  return (
    <div className="app-surface min-h-screen">
      <AppNav
        name={profile?.full_name || user.email || "Account"}
        role={profile?.role ?? "owner"}
        photoUrl={profile?.profile_photo_url ?? null}
        isAdmin={isAdmin}
      />
      {profile?.is_test ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-amber-900 sm:px-6 lg:px-8">
            <span>
              <span className="font-semibold">Test account.</span> You&apos;re signed in as{" "}
              {profile.full_name || user.email}. Log out to return to your own account.
            </span>
            <form action="/auth/signout" method="post">
              <button className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                Leave test account
              </button>
            </form>
          </div>
        </div>
      ) : null}
      {managedJockeys.length > 0 && (
        <AgentBar jockeys={managedJockeys} />
      )}
      {paywallActive && !paywallBypassed ? (
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8 lg:pt-9">
          <div className="mx-auto max-w-xl border border-gold-200 bg-gold-50 p-8 text-center shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">Subscription required</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">Your free trial has ended</h1>
            <p className="mt-3 text-sm text-zinc-600">
              JockeyFinder is {ROLE_PRICE_DISPLAY[profile?.role ?? ""] ?? ""} after your free trial.
              Subscribe to continue accessing ride requests, attendance, and messaging.
            </p>
            <a href="/dashboard/billing" className="mt-5 inline-block rounded-full bg-turf-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-turf-700">
              View billing and subscribe
            </a>
          </div>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8 lg:pt-9">
          {children}
        </main>
      )}
    </div>
  );
}
