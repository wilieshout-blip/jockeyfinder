"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSyndicateUpdate } from "@/lib/email";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Confirms the signed-in user manages the given group, else redirects. */
async function assertManager(groupId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ownership_groups")
    .select("id, name")
    .eq("id", groupId)
    .eq("manager_id", userId)
    .maybeSingle();
  if (!data) redirect("/dashboard/syndicates?error=not_manager");
  return data;
}

export async function createSyndicate(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/dashboard/syndicates?error=name");
  await supabase.from("ownership_groups").insert({ name, manager_id: user.id });
  revalidatePath("/dashboard/syndicates");
  redirect("/dashboard/syndicates");
}

export async function deleteSyndicate(formData: FormData) {
  const { user } = await requireUser();
  const groupId = String(formData.get("group_id") || "");
  if (groupId) {
    await assertManager(groupId, user.id);
    const admin = createAdminClient();
    await admin.from("ownership_groups").delete().eq("id", groupId);
  }
  revalidatePath("/dashboard/syndicates");
  redirect("/dashboard/syndicates");
}

export async function addSyndicateMember(formData: FormData) {
  const { user } = await requireUser();
  const groupId = String(formData.get("group_id") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const shareLabel = String(formData.get("share_label") || "").trim() || null;
  if (!groupId || !email) redirect("/dashboard/syndicates?error=member");

  await assertManager(groupId, user.id);
  const admin = createAdminClient();

  // Link to an existing account if the email matches one; otherwise store the
  // email as a pending invite.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  await admin.from("ownership_memberships").insert({
    group_id: groupId,
    user_id: profile?.id ?? null,
    invite_email: profile?.id ? null : email,
    share_label: shareLabel,
    role: "member",
  });

  revalidatePath("/dashboard/syndicates");
  redirect("/dashboard/syndicates");
}

export async function removeSyndicateMember(formData: FormData) {
  const { user } = await requireUser();
  const membershipId = String(formData.get("membership_id") || "");
  const groupId = String(formData.get("group_id") || "");
  if (membershipId && groupId) {
    await assertManager(groupId, user.id);
    const admin = createAdminClient();
    await admin.from("ownership_memberships").delete().eq("id", membershipId);
  }
  revalidatePath("/dashboard/syndicates");
  redirect("/dashboard/syndicates");
}

export async function addSyndicateHorse(formData: FormData) {
  const { user } = await requireUser();
  const groupId = String(formData.get("group_id") || "");
  const horseId = String(formData.get("horse_id") || "");
  if (groupId && horseId) {
    await assertManager(groupId, user.id);
    const admin = createAdminClient();
    await admin.from("group_horses").upsert(
      { group_id: groupId, horse_id: horseId },
      { onConflict: "group_id,horse_id" }
    );
  }
  revalidatePath("/dashboard/syndicates");
  redirect("/dashboard/syndicates");
}

export async function removeSyndicateHorse(formData: FormData) {
  const { user } = await requireUser();
  const groupId = String(formData.get("group_id") || "");
  const horseId = String(formData.get("horse_id") || "");
  if (groupId && horseId) {
    await assertManager(groupId, user.id);
    const admin = createAdminClient();
    await admin.from("group_horses").delete().eq("group_id", groupId).eq("horse_id", horseId);
  }
  revalidatePath("/dashboard/syndicates");
  redirect("/dashboard/syndicates");
}

export async function postSyndicateUpdate(formData: FormData) {
  const { user } = await requireUser();
  const groupId = String(formData.get("group_id") || "");
  const body = String(formData.get("body") || "").trim();
  if (!groupId || !body) redirect("/dashboard/syndicates?error=update");

  const group = await assertManager(groupId, user.id);
  const admin = createAdminClient();
  await admin.from("syndicate_updates").insert({
    group_id: groupId,
    author_id: user.id,
    body,
  });

  // Email all members who have an account, an email, and haven't opted out.
  const { data: members } = await admin
    .from("ownership_memberships")
    .select("user_id, invite_email, profiles:profiles!user_id(email, first_name, email_notify_marketing, suspended, is_test)")
    .eq("group_id", groupId);

  for (const m of (members ?? []) as any[]) {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const email = p?.email ?? m.invite_email ?? null;
    if (!email) continue;
    if (p && (p.suspended || p.is_test || p.email_notify_marketing === false)) continue;
    await emailSyndicateUpdate({
      to: email,
      firstName: p?.first_name ?? "there",
      groupName: group.name,
      body,
    });
  }

  revalidatePath("/dashboard/syndicates");
  redirect("/dashboard/syndicates");
}
