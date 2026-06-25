import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";
import { getBroadcastAudienceCounts } from "@/app/admin/actions";
import { AdminBroadcast } from "@/components/admin-broadcast";
import { PageHeader } from "@/components/premium";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");

  const audienceCounts = await getBroadcastAudienceCounts();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm font-medium text-turf-700 hover:underline">
        ← Back to admin
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow="Email"
          title="Broadcast email"
          description="Send a templated email to all users or a specific user type. Recipients who turned off announcements are skipped automatically."
        />
      </div>
      <div className="mt-6">
        <AdminBroadcast audienceCounts={audienceCounts} />
      </div>
    </div>
  );
}
