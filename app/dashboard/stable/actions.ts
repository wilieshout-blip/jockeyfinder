"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireTrainer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || me.role !== "trainer") redirect("/dashboard");
  return user;
}

export async function inviteStableMember(formData: FormData) {
  const user = await requireTrainer();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "assistant").trim();
  if (!email) redirect("/dashboard?error=member_email");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  await admin.from("stable_members").insert({
    head_id: user.id,
    member_id: profile?.id ?? null,
    invite_email: profile?.id ? null : email,
    role: role === "foreman" ? "foreman" : "assistant",
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function removeStableMember(formData: FormData) {
  const user = await requireTrainer();
  const id = String(formData.get("id") || "");
  if (id) {
    const admin = createAdminClient();
    await admin.from("stable_members").delete().eq("id", id).eq("head_id", user.id);
  }
  revalidatePath("/dashboard");
}
