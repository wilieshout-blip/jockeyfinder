import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { Badge, VerifiedBadge } from "@/components/ui/badge";
import type { Profile } from "@/lib/types";

export default async function ProfilePage() {
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

  if (!profile) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
            Your profile
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Profile settings
          </h1>
        </div>
        {profile.verified ? (
          <VerifiedBadge />
        ) : (
          <Badge tone={profile.verification_status === "rejected" ? "red" : "amber"}>
            {profile.verification_status === "rejected"
              ? "Verification declined"
              : "Awaiting verification"}
          </Badge>
        )}
      </div>

      <ProfileForm profile={profile} email={user.email ?? ""} />
    </div>
  );
}
