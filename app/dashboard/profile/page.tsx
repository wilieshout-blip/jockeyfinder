import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { Badge, VerifiedBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/premium";
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
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow="Your profile"
        title="Profile settings"
        description="Keep the identity, contact and racing details shown across your account accurate."
        action={profile.verified ? (
          <VerifiedBadge />
        ) : (
          <Badge tone={profile.verification_status === "rejected" ? "red" : "amber"}>
            {profile.verification_status === "rejected"
              ? "Verification declined"
              : "Awaiting verification"}
          </Badge>
        )}
      />

      <ProfileForm profile={profile} email={user.email ?? ""} />
    </div>
  );
}
