"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMeetingDate } from "@/lib/utils";
import {
  emailNewRequest,
  emailRequestAccepted,
  emailRequestDeclined,
  emailRideAssigned,
} from "@/lib/email";
import type { Profile, RideRequest } from "@/lib/types";

/**
 * Creates a ride request. Who sits on each side depends on the caller:
 * trainers request a jockey, jockeys request a trainer, and approved agents
 * request a trainer on behalf of a managed jockey. RLS enforces that only
 * verified accounts can create requests at all.
 */
export async function createRideRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!me) redirect("/login");

  const meetingId = String(formData.get("meeting_id") || "");
  const counterpart = String(formData.get("counterpart_id") || "");
  const managedJockey = String(formData.get("managed_jockey_id") || "");
  const horseName = String(formData.get("horse_name") || "").trim();
  const raceNumberRaw = String(formData.get("race_number") || "").trim();
  const note = String(formData.get("note") || "").trim();

  let trainerId: string;
  let jockeyId: string;

  if (me.role === "trainer") {
    trainerId = user.id;
    jockeyId = counterpart;
  } else if (me.role === "jockey") {
    jockeyId = user.id;
    trainerId = counterpart;
  } else if (me.role === "agent") {
    jockeyId = managedJockey;
    trainerId = counterpart;
  } else {
    redirect("/dashboard/requests?error=role");
  }

  if (!meetingId || !trainerId || !jockeyId) {
    redirect("/dashboard/requests/new?error=missing");
  }

  const { error } = await supabase.from("ride_requests").insert({
    meeting_id: meetingId,
    trainer_id: trainerId,
    jockey_id: jockeyId,
    horse_name: horseName || null,
    race_number: raceNumberRaw ? Number(raceNumberRaw) : null,
    note: note || null,
    status: "requested",
    created_by: user.id,
  });

  if (error) {
    redirect(
      `/dashboard/requests/new?error=${encodeURIComponent(error.message)}`
    );
  }

  // ── Email the counterpart about the new request ───────────────────────────
  try {
    const admin = createAdminClient();
    const recipientId = me.role === "trainer" ? jockeyId : trainerId;
    const [recipResult, meetResult] = await Promise.all([
      admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", recipientId)
        .single(),
      admin
        .from("meetings")
        .select("track, meeting_date")
        .eq("id", meetingId)
        .single(),
    ]);
    if (recipResult.data?.email) {
      await emailNewRequest({
        to: recipResult.data.email,
        senderName: me.full_name ?? user.email ?? "Someone",
        horseName: horseName || null,
        track: meetResult.data?.track ?? null,
        meetingDate: meetResult.data?.meeting_date
          ? formatMeetingDate(meetResult.data.meeting_date)
          : null,
      });
    }
  } catch (err) {
    console.error("[email] createRideRequest notification failed:", err);
  }
  // ─────────────────────────────────────────────────────────────────────────

  revalidatePath("/dashboard/requests");
  redirect("/dashboard/requests?created=1");
}

const ALLOWED: Record<string, string[]> = {
  requested: ["accepted", "declined", "cancelled", "assigned"],
  accepted: ["assigned", "cancelled"],
};

/**
 * Moves a request through its lifecycle. When a trainer assigns the ride,
 * a chat thread is created automatically between the trainer, the jockey,
 * and the agent if one made the request.
 */
export async function updateRequestStatus(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const requestId = String(formData.get("request_id") || "");
  const next = String(formData.get("next_status") || "");

  const { data: request } = await supabase
    .from("ride_requests")
    .select("*")
    .eq("id", requestId)
    .single<RideRequest>();

  if (!request) redirect("/dashboard/requests?error=notfound");
  if (!ALLOWED[request.status]?.includes(next)) {
    redirect("/dashboard/requests?error=transition");
  }

  // Basic permission checks. RLS limits rows to participants already;
  // this controls which transitions each side can make.
  const isTrainer = request.trainer_id === user.id;
  const isJockeySide =
    request.jockey_id === user.id || request.created_by === user.id;

  if (next === "assigned" && !isTrainer) {
    redirect("/dashboard/requests?error=onlytrainer");
  }
  if (
    (next === "accepted" || next === "declined") &&
    request.created_by === user.id
  ) {
    redirect("/dashboard/requests?error=ownrequest");
  }
  if (next === "cancelled" && !isTrainer && !isJockeySide) {
    redirect("/dashboard/requests?error=notyours");
  }

  const { error } = await supabase
    .from("ride_requests")
    .update({ status: next })
    .eq("id", requestId);

  if (error) {
    redirect(`/dashboard/requests?error=${encodeURIComponent(error.message)}`);
  }

  if (next === "assigned") {
    // Reuse an existing thread for this request if one was already made.
    const { data: existing } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("ride_request_id", request.id)
      .maybeSingle();

    if (!existing) {
      const { data: thread } = await supabase
        .from("chat_threads")
        .insert({
          type: "ride",
          meeting_id: request.meeting_id,
          ride_request_id: request.id,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (thread) {
        const participantIds = Array.from(
          new Set([request.trainer_id, request.jockey_id, request.created_by])
        );
        await supabase.from("chat_participants").insert(
          participantIds.map((uid) => ({ thread_id: thread.id, user_id: uid }))
        );
        await supabase.from("messages").insert({
          thread_id: thread.id,
          sender_id: user.id,
          body: `Ride assigned${request.horse_name ? `: ${request.horse_name}` : ""}${
            request.race_number ? ` (Race ${request.race_number})` : ""
          }. Use this chat for gear, transport, and race day plans.`,
        });
      }
    }
  }

  // ── Email the relevant party about the status change ──────────────────────
  if (["accepted", "declined", "assigned"].includes(next)) {
    try {
      const admin = createAdminClient();

      const [actorResult, meetResult] = await Promise.all([
        admin
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single(),
        request.meeting_id
          ? admin
              .from("meetings")
              .select("track, meeting_date")
              .eq("id", request.meeting_id)
              .single()
          : Promise.resolve({ data: null }),
      ]);

      const actorName = actorResult.data?.full_name ?? "Someone";
      const meetData = (meetResult as any).data;
      const sharedOpts = {
        horseName: request.horse_name ?? null,
        track: meetData?.track ?? null,
        meetingDate: meetData?.meeting_date
          ? formatMeetingDate(meetData.meeting_date)
          : null,
      };

      if (next === "accepted") {
        const { data: trainerProfile } = await admin
          .from("profiles")
          .select("email")
          .eq("id", request.trainer_id)
          .single();
        if (trainerProfile?.email) {
          await emailRequestAccepted({
            to: trainerProfile.email,
            jockeyName: actorName,
            ...sharedOpts,
          });
        }
      } else if (next === "declined") {
        const { data: creatorProfile } = await admin
          .from("profiles")
          .select("email")
          .eq("id", request.created_by)
          .single();
        if (creatorProfile?.email) {
          await emailRequestDeclined({
            to: creatorProfile.email,
            jockeyName: actorName,
            ...sharedOpts,
          });
        }
      } else if (next === "assigned") {
        const { data: jockeyProfile } = await admin
          .from("profiles")
          .select("email")
          .eq("id", request.jockey_id)
          .single();
        if (jockeyProfile?.email) {
          await emailRideAssigned({
            to: jockeyProfile.email,
            trainerName: actorName,
            ...sharedOpts,
          });
        }
      }
    } catch (err) {
      console.error("[email] updateRequestStatus notification failed:", err);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/messages");
  redirect("/dashboard/requests");
}
