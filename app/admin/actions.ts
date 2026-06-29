"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/utils";
import { emailNewSignup, sendBroadcastEmail } from "@/lib/email";
import { isAudience } from "@/lib/email-templates";
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

/**
 * One-click: set a jockey's apprentice claim to the official NZTR allowance
 * (surfaced from nztr_jockey_claims on the users page). Kept separate from
 * editUser so applying it can't disturb the user's other fields. Admin stays in
 * control — nothing auto-changes; this only runs on an explicit click.
 */
export async function applyApprenticeClaim(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("user_id") || "");
  const claimRaw = String(formData.get("claim") || "").trim();
  if (!id) return;
  const claim = claimRaw ? Number(claimRaw) : null;
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ apprentice_claim: claim, apprentice: claim != null && claim > 0 })
    .eq("id", id);
  revalidatePath("/admin/users");
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
  const claimRaw = String(formData.get("apprentice_claim") || "").trim();

  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    full_name: fullName || null,
    email: email || null,
    phone: phone || null,
  };
  if (["jockey", "trainer", "owner", "agent", "admin"].includes(role)) {
    update.role = role;
  }
  // Apprentice claim (manual downgrade — e.g. 3kg → 2kg as wins tally up). Blank
  // clears it / marks no longer claiming.
  if (formData.has("apprentice_claim")) {
    const claim = claimRaw ? Number(claimRaw) : null;
    update.apprentice_claim = claim;
    update.apprentice = claim != null && claim > 0;
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

/** Count broadcast-eligible recipients per audience (for the console preview). */
export async function getBroadcastAudienceCounts(): Promise<Record<string, number>> {
  await assertAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role")
    .neq("verification_status", "rejected")
    .eq("is_test", false)
    .eq("is_placeholder", false)
    .eq("suspended", false)
    .eq("email_notify_marketing", true)
    .not("email", "is", null);
  const counts: Record<string, number> = { all: 0 };
  for (const r of data ?? []) {
    counts.all += 1;
    counts[r.role ?? "?"] = (counts[r.role ?? "?"] ?? 0) + 1;
  }
  return counts;
}

/** Send an admin-authored broadcast to an audience. Respects the marketing
 * opt-out and never emails rejected, suspended, test or placeholder accounts.
 * {{first_name}} in the subject/body is personalised per recipient. */
export async function sendBroadcast(input: {
  audience: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; sent: number; total: number; error?: string }> {
  await assertAdmin();

  const subject = (input.subject ?? "").trim();
  const body = (input.body ?? "").trim();
  if (!isAudience(input.audience)) return { ok: false, sent: 0, total: 0, error: "Invalid audience" };
  if (!subject) return { ok: false, sent: 0, total: 0, error: "Subject is required" };
  if (!body) return { ok: false, sent: 0, total: 0, error: "Body is required" };

  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id, email, first_name, full_name, role")
    .neq("verification_status", "rejected")
    .eq("is_test", false)
    .eq("is_placeholder", false)
    .eq("suspended", false)
    .eq("email_notify_marketing", true)
    .not("email", "is", null);
  if (input.audience !== "all") query = query.eq("role", input.audience);

  const { data: recipients, error } = await query;
  if (error) return { ok: false, sent: 0, total: 0, error: error.message };

  const list = recipients ?? [];
  let sent = 0;
  for (const r of list) {
    if (!r.email) continue;
    const firstName = r.first_name || (r.full_name ? r.full_name.split(/\s+/)[0] : "") || "there";
    const personalSubject = subject.replaceAll("{{first_name}}", firstName);
    const personalBody = body.replaceAll("{{first_name}}", firstName);
    const ok = await sendBroadcastEmail(r.email, personalSubject, personalBody);
    if (ok) sent += 1;
  }

  return { ok: true, sent, total: list.length };
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
