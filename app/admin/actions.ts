"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/utils";
import { syncMeetings } from "@/lib/loveracing";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");
  return user;
}

export async function approveUser(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("user_id") || "");
  if (id) {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({
        verified: true,
        verification_status: "approved",
        status: "approved",
      })
      .eq("id", id);
  }
  revalidatePath("/admin");
}

export async function rejectUser(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("user_id") || "");
  if (id) {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({
        verified: false,
        verification_status: "rejected",
        status: "rejected",
      })
      .eq("id", id);
  }
  revalidatePath("/admin");
}

export async function markAgentPaid(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("user_id") || "");
  if (id) {
    const admin = createAdminClient();
    await admin.from("subscriptions").upsert(
      {
        user_id: id,
        plan: "agent_custom",
        status: "active",
      },
      { onConflict: "user_id" }
    );
  }
  revalidatePath("/admin");
}

export async function syncNow() {
  await assertAdmin();
  const result = await syncMeetings();
  revalidatePath("/admin");
  revalidatePath("/meetings");
  return result;
}
