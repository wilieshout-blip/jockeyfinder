"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, formatMeetingDate, nzToday } from "@/lib/utils";
import { emailStandDownAlert } from "@/lib/email";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");
  return user;
}

export async function recordStandDown(formData: FormData) {
  const me = await assertAdmin();
  const jockeyId = String(formData.get("jockey_id") || "");
  const meetingId = String(formData.get("meeting_id") || "") || null;
  const fromRaceRaw = String(formData.get("from_race") || "").trim();
  const toRaceRaw = String(formData.get("to_race") || "").trim();
  const endDate = String(formData.get("end_date") || "").trim() || null;
  const reason = String(formData.get("reason") || "").trim() || null;
  if (!jockeyId) redirect("/admin/stand-downs?error=jockey");

  const fromRace = fromRaceRaw ? Number(fromRaceRaw) : null;
  const toRace = toRaceRaw ? Number(toRaceRaw) : fromRace;

  const admin = createAdminClient();
  await admin.from("medical_stand_downs").insert({
    jockey_id: jockeyId,
    meeting_id: meetingId,
    from_race: fromRace,
    to_race: toRace,
    end_date: endDate,
    reason,
    created_by: me.id,
  });

  // Build a human scope description + alert the trainers booked with this jockey
  // in the affected races/window only.
  try {
    const { data: jp } = await admin.from("profiles").select("full_name").eq("id", jockeyId).maybeSingle();
    const jockeyName = jp?.full_name ?? "The jockey";

    let track: string | null = null;
    let meetingDate: string | null = null;
    if (meetingId) {
      const { data: mtg } = await admin
        .from("meetings")
        .select("track, meeting_date")
        .eq("id", meetingId)
        .maybeSingle();
      track = mtg?.track ?? null;
      meetingDate = mtg?.meeting_date ?? null;
    }

    let scopeText: string;
    if (meetingId && fromRace) {
      const races = toRace && toRace !== fromRace ? `Races ${fromRace}–${toRace}` : `Race ${fromRace}`;
      scopeText = `${races}${track ? ` at ${track}` : ""}${meetingDate ? ` on ${formatMeetingDate(meetingDate)}` : ""}`;
    } else if (meetingId) {
      scopeText = `${track ?? "the meeting"}${meetingDate ? ` on ${formatMeetingDate(meetingDate)}` : ""}`;
    } else if (endDate) {
      scopeText = `until ${formatMeetingDate(endDate)}`;
    } else {
      scopeText = "an upcoming ride";
    }

    // Candidate bookings for this jockey.
    let q = admin
      .from("ride_requests")
      .select("trainer_id, race_number, meeting_id, meetings(meeting_date)")
      .eq("jockey_id", jockeyId)
      .in("status", ["assigned", "accepted", "requested"]);
    if (meetingId) q = q.eq("meeting_id", meetingId);
    const { data: bookings } = await q;

    const today = nzToday();
    const trainerIds = new Set<string>();
    for (const b of (bookings ?? []) as any[]) {
      if (!b.trainer_id) continue;
      if (meetingId && fromRace) {
        const rn = b.race_number;
        if (rn == null || rn < fromRace || rn > (toRace ?? fromRace)) continue;
      }
      if (!meetingId && endDate) {
        const md = b.meetings?.meeting_date;
        if (!md || md < today || md > endDate) continue;
      }
      trainerIds.add(b.trainer_id);
    }

    if (trainerIds.size > 0) {
      const { data: trainers } = await admin
        .from("profiles")
        .select("email, full_name")
        .in("id", [...trainerIds]);
      for (const t of trainers ?? []) {
        if (!t.email) continue;
        await emailStandDownAlert({
          to: t.email,
          trainerName: t.full_name ?? "there",
          jockeyName,
          scopeText,
          reason,
        });
      }
    }
  } catch (e) {
    console.error("stand-down alert failed:", e);
  }

  revalidatePath("/admin/stand-downs");
  redirect("/admin/stand-downs?recorded=1");
}

export async function deleteStandDown(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") || "");
  if (id) {
    const admin = createAdminClient();
    await admin.from("medical_stand_downs").delete().eq("id", id);
  }
  revalidatePath("/admin/stand-downs");
}
