"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/utils";
import { emailNewSignup } from "@/lib/email";
import { syncMeetings } from "@/lib/loveracing";
import {
  syncUpcomingRaceEntries,
  syncUpcomingRaces,
  type RaceCardSyncResult,
} from "@/lib/loveracing-race-card";
import {
  syncTabNzRaceCards,
  type TabRaceCardSyncResult,
} from "@/lib/tab-racing";

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

/** Set a user's verification state (approved / rejected / pending). */
export async function setUserVerification(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("user_id") || "");
  const status = String(formData.get("status") || "");
  if (id && ["approved", "rejected", "pending"].includes(status)) {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({
        verification_status: status,
        verified: status === "approved",
        status,
      })
      .eq("id", id);
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

/** Change a user's role. */
export async function setUserRole(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("user_id") || "");
  const role = String(formData.get("role") || "");
  if (id && ["jockey", "trainer", "owner", "agent", "admin"].includes(role)) {
    const admin = createAdminClient();
    await admin.from("profiles").update({ role }).eq("id", id);
  }
  revalidatePath("/admin/users");
}

/** Pause or resume a user's account. Suspended users are hidden from public
 * listings and blocked from the dashboard. Cannot suspend yourself. */
export async function setUserSuspended(formData: FormData) {
  const me = await assertAdmin();
  const id = String(formData.get("user_id") || "");
  const suspended = String(formData.get("suspended") || "") === "true";
  if (id && id !== me.id) {
    const admin = createAdminClient();
    await admin.from("profiles").update({ suspended }).eq("id", id);
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

/** Edit a user's core details: name, email, phone, role. Email also updates the
 * underlying auth identity so the user can still sign in. */
export async function editUser(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("user_id") || "");
  if (!id) return;

  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const role = String(formData.get("role") || "").trim();

  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    full_name: fullName || null,
    email: email || null,
    phone: phone || null,
  };
  if (["jockey", "trainer", "owner", "agent", "admin"].includes(role)) {
    update.role = role;
  }
  await admin.from("profiles").update(update).eq("id", id);

  // Keep the auth identity's email in sync so login still works. Placeholder
  // accounts have no auth user, so ignore failures.
  if (email) {
    try {
      await admin.auth.admin.updateUserById(id, { email });
    } catch {
      // no auth user (e.g. placeholder) — profile email is enough
    }
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

/** Delete a user (auth user + profile). Cannot delete yourself. */
export async function deleteUser(formData: FormData) {
  const me = await assertAdmin();
  const id = String(formData.get("user_id") || "");
  if (id && id !== me.id) {
    const admin = createAdminClient();
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      // fall through to profile delete (e.g. placeholder with no auth user)
    }
    await admin.from("profiles").delete().eq("id", id);
  }
  revalidatePath("/admin/users");
}

/** Send a sample "new signup" email to the admin so they can preview the format. */
export async function sendTestSignupEmail(): Promise<{ ok: boolean }> {
  const me = await assertAdmin();
  const ok = await emailNewSignup({
    name: "Jane Rider (test)",
    role: "jockey",
    email: me.email ?? "test@example.com",
    phone: "+64 21 000 0000",
    test: true,
  });
  return { ok };
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

export interface ManualSyncResult {
  ok: boolean;
  meetings: Awaited<ReturnType<typeof syncMeetings>>;
  races: RaceCardSyncResult;
  entries: RaceCardSyncResult;
  tab: TabRaceCardSyncResult;
}

export async function syncNow(): Promise<ManualSyncResult> {
  await assertAdmin();
  const meetings = await syncMeetings();
  const tab = await syncTabNzRaceCards(7);
  const races = meetings.ok
    ? await syncUpcomingRaces()
    : { ok: false, synced: 0, meetings: 0, error: "LoveRacing meeting sync failed" };
  const entries =
    meetings.ok && races.ok
      ? await syncUpcomingRaceEntries()
      : { ok: false, synced: 0, meetings: 0, error: "LoveRacing race sync skipped" };

  revalidatePath("/admin");
  revalidatePath("/meetings");
  revalidatePath("/jockeys");
  revalidatePath("/trainers");

  return {
    ok: tab.ok || (meetings.ok && races.ok && entries.ok),
    meetings,
    races,
    entries,
    tab,
  };
}
