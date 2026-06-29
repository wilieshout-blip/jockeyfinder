import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, registryKey } from "@/lib/utils";
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

  // Official apprentice allowances from the NZTR claims feed, matched to our
  // jockeys by initial+surname, so the admin can one-click apply the real value.
  const { data: claims } = await admin
    .from("nztr_jockey_claims")
    .select("rider, allowance");
  const claimByKey = new Map<string, number>();
  for (const c of claims ?? []) {
    const k = registryKey((c as any).rider);
    if (k && (c as any).allowance != null) claimByKey.set(k, Number((c as any).allowance));
  }

  const users = ((data ?? []) as AdminUser[]).map((u) =>
    u.role === "jockey"
      ? { ...u, official_claim: claimByKey.get(registryKey(u.full_name)) ?? null }
      : u
  );

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
