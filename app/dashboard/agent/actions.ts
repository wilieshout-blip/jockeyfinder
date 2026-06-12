"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireApprovedAgent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, verification_status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "agent" || profile.verification_status !== "approved") {
    redirect("/dashboard/agent?error=not_approved");
  }
  return user.id;
}

export async function linkJockeyByEmail(formData: FormData) {
  const agentId = await requireApprovedAgent();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) redirect("/dashboard/agent?error=missing_email");

  const admin = createAdminClient();
  const { data: jockey } = await admin
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .eq("role", "jockey")
    .maybeSingle();

  if (!jockey) redirect("/dashboard/agent?error=not_found");

  const { error } = await admin
    .from("agent_jockeys")
    .upsert(
      { agent_id: agentId, jockey_id: jockey.id },
      { onConflict: "agent_id,jockey_id" }
    );

  if (error) redirect("/dashboard/agent?error=link_failed");

  revalidatePath("/dashboard/agent");
  redirect("/dashboard/agent?linked=1");
}

export async function unlinkJockey(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jockeyId = String(formData.get("jockey_id") || "");
  if (jockeyId) {
    await supabase
      .from("agent_jockeys")
      .delete()
      .eq("agent_id", user.id)
      .eq("jockey_id", jockeyId);
  }

  revalidatePath("/dashboard/agent");
  redirect("/dashboard/agent");
}
