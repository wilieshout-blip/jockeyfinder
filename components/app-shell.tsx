import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";
import { AppNav } from "@/components/app-nav";
import type { Profile } from "@/lib/types";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const isAdmin = isAdminEmail(user.email);

  return (
    <div className="min-h-screen bg-paper">
      <AppNav
        name={profile?.full_name || user.email || "Account"}
        role={profile?.role ?? "owner"}
        photoUrl={profile?.profile_photo_url ?? null}
        isAdmin={isAdmin}
      />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pl-6">
        {children}
      </main>
    </div>
  );
}
