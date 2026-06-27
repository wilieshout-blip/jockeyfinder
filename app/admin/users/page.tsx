import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/utils";
import { AdminUsersTable, type AdminUser } from "@/components/admin-users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, phone, role, verification_status, verified, registry_match, is_test, is_placeholder, suspended, apprentice_claim, created_at"
    )
    .order("created_at", { ascending: false });

  const users = (data ?? []) as AdminUser[];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm font-medium text-turf-700 hover:underline">
        ← Back to admin
      </Link>
      <div className="mt-4">
        <AdminUsersTable users={users} />
      </div>
    </div>
  );
}
