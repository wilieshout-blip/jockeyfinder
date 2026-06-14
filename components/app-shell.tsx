import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";
import { AppNav } from "@/components/app-nav";
import type { Profile, Subscription } from "@/lib/types";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single<Profile>();

  const isAdmin = isAdminEmail(user.email);

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

  return (
    <div className="min-h-screen bg-paper">
      <AppNav
        name={profile?.full_name || user.email || "Account"}
        role={profile?.role ?? "owner"}
        photoUrl={profile?.profile_photo_url ?? null}
        isAdmin={isAdmin}
      />
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
