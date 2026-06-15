"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, RideRequest } from "@/lib/types";

export interface RaceOption {
  id: string;
  race_number: number;
  name: string;
  start_time: string | null;
}

/**
 * Returns scraped races for a meeting (ordered by race_number).
 * Called from the new-request-form client component when the meeting dropdown changes.
 * Returns empty array if no races have been synced yet for this meeting.
 */
export async function fetchRacesForMeeting(meetingId: string): Promise<RaceOption[]> {
  if (!meetingId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("races")
    .select("id, race_number, name, start_time")
    .eq("meeting_id", meetingId)
    .order("race_number");
  return (data ?? []) as RaceOption[];
}

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
  const raceId = String(formData.get("race_id") || "").trim() || null;
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
    race_id: raceId || null,
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
  if ((next === "accepted" || next === "declined") && request.created_by === user.id) {
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

  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/messages");
  redirect("/dashboard/requests");
}
