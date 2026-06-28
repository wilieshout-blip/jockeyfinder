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

/**
 * Creates a placeholder jockey profile the agent can fully act for before the
 * rider has signed up, and links it to the agent. The profile is verified +
 * active (a verified agent is vouching) and flagged is_placeholder so it can be
 * automatically claimed when the real rider signs up with a matching name,
 * email, or phone. Name is required; email / phone are optional and improve
 * later match confidence.
 */
export async function createPlaceholderJockey(formData: FormData) {
  const agentId = await requireApprovedAgent();

  const firstName = String(formData.get("first_name") || "").trim();
  const lastName = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();

  if (!firstName || !lastName) {
    redirect("/dashboard/agent?error=missing_name");
  }

  const admin = createAdminClient();

  // Auth needs a unique email; synthesise a placeholder one when the agent
  // doesn't have the rider's real address yet.
  const authEmail =
    email || `placeholder+${crypto.randomUUID()}@placeholder.jockeyfinder.com`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    email_confirm: true,
    user_metadata: {
      role: "jockey",
      first_name: firstName,
      last_name: lastName,
      phone: phone || undefined,
      is_placeholder: "true",
      placeholder_created_by: agentId,
    },
  });

  if (createError || !created?.user) {
    redirect("/dashboard/agent?error=create_failed");
  }

  const jockeyId = created.user.id;

  // The handle_new_user trigger created the profile as a placeholder. Make it
  // verified + active and store the real email (null when synthesised).
  await admin
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      role: "jockey",
      is_placeholder: true,
      placeholder_created_by: agentId,
      licence_type: "race_jockey",
      verified: true,
      verification_status: "approved",
      status: "approved",
    })
    .eq("id", jockeyId);

  await admin
    .from("agent_jockeys")
    .upsert(
      { agent_id: agentId, jockey_id: jockeyId },
      { onConflict: "agent_id,jockey_id" }
    );

  revalidatePath("/dashboard/agent");
  redirect("/dashboard/agent?linked=1");
}

/**
 * Lets an approved agent update the details of a PLACEHOLDER rider they manage
 * (a rider who hasn't signed up themselves). Editing a real, signed-up jockey's
 * personal profile is intentionally not allowed — the agent can still handle
 * their bookings, but the rider owns their own details.
 */
export async function updateManagedJockey(formData: FormData) {
  const agentId = await requireApprovedAgent();
  const jockeyId = String(formData.get("jockey_id") || "");
  if (!jockeyId) redirect("/dashboard/agent");

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("agent_jockeys")
    .select("jockey_id, profiles:profiles!jockey_id(is_placeholder)")
    .eq("agent_id", agentId)
    .eq("jockey_id", jockeyId)
    .maybeSingle();
  const prof = (link as any)?.profiles;
  const isPlaceholder = Array.isArray(prof) ? prof[0]?.is_placeholder : prof?.is_placeholder;
  if (!link || !isPlaceholder) {
    redirect("/dashboard/agent?error=cannot_edit");
  }

  const firstName = String(formData.get("first_name") || "").trim();
  const lastName = String(formData.get("last_name") || "").trim();
  const weightRaw = String(formData.get("riding_weight") || "").trim();
  const claimRaw = String(formData.get("apprentice_claim") || "").trim();
  const baseRegion = String(formData.get("base_region") || "").trim();

  const ridingWeight = weightRaw ? Number(weightRaw) : null;
  const claim = claimRaw ? Number(claimRaw) : null;

  const update: Record<string, unknown> = {
    riding_weight: Number.isFinite(ridingWeight as number) ? ridingWeight : null,
    apprentice: claim != null && claim > 0,
    apprentice_claim: claim,
    base_region: baseRegion || null,
  };
  if (firstName) update.first_name = firstName;
  if (lastName) update.last_name = lastName;

  await admin.from("profiles").update(update).eq("id", jockeyId);

  revalidatePath("/dashboard/agent");
  redirect("/dashboard/agent?updated=1");
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
