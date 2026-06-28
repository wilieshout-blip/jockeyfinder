"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface RequestRideArgs {
  meetingId: string;
  raceId: string | null;
  raceNumber: number;
  horseName: string;
  trainerName: string | null;
  /** When an approved agent acts for a managed jockey, the jockey's id. */
  jockeyId?: string | null;
}

type ActingClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Works out whose attendance / request an action is for and checks the caller
 * is allowed to act for them. A jockey acts for themselves; an approved agent
 * may act for any jockey they are linked to in agent_jockeys. The database RLS
 * is the real guard — this just surfaces a friendly error before we hit it.
 */
async function resolveActingJockey(
  supabase: ActingClient,
  callerId: string,
  callerRole: string | null,
  requestedJockeyId?: string | null
): Promise<{ jockeyId?: string; error?: string }> {
  // No explicit target, or acting for self: caller must be a jockey.
  if (!requestedJockeyId || requestedJockeyId === callerId) {
    if (callerRole !== "jockey") {
      return { error: "Only jockeys can do this for themselves" };
    }
    return { jockeyId: callerId };
  }

  // Acting for someone else: only an approved agent linked to that jockey.
  if (callerRole !== "agent") {
    return { error: "Only an approved agent can act for another jockey" };
  }
  const { data: link } = await supabase
    .from("agent_jockeys")
    .select("jockey_id")
    .eq("agent_id", callerId)
    .eq("jockey_id", requestedJockeyId)
    .maybeSingle();
  if (!link) {
    return { error: "You are not linked to this jockey" };
  }
  return { jockeyId: requestedJockeyId };
}

/**
 * Quick "Request Ride" from the Race Day card.
 * Looks up the trainer by full_name if possible; creates the ride request.
 * A jockey requests for themselves; an approved agent passes the managed
 * jockey via args.jockeyId.
 */
export async function requestRideFromRaceCard(
  args: RequestRideArgs
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return { success: false, error: "Profile not found" };
  if (profile.role !== "jockey" && profile.role !== "agent") {
    return { success: false, error: "Only jockeys or agents can request rides" };
  }

  const resolved = await resolveActingJockey(
    supabase,
    user.id,
    profile.role,
    args.jockeyId
  );
  if (resolved.error || !resolved.jockeyId) {
    return { success: false, error: resolved.error ?? "Could not resolve jockey" };
  }
  const jockeyId = resolved.jockeyId;

  // Prevent duplicate requests for the same horse in the same meeting
  const { data: existing } = await supabase
    .from("ride_requests")
    .select("id")
    .eq("jockey_id", jockeyId)
    .eq("meeting_id", args.meetingId)
    .eq("horse_name", args.horseName)
    .maybeSingle();

  if (existing) return { success: true };

  // Try to find the trainer's profile by full_name
  let trainerId: string | null = null;
  if (args.trainerName) {
    const { data: trainerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("full_name", args.trainerName)
      .eq("role", "trainer")
      .maybeSingle();
    trainerId = trainerProfile?.id ?? null;
  }

  const { error } = await supabase.from("ride_requests").insert({
    meeting_id: args.meetingId,
    race_id: args.raceId,
    race_number: args.raceNumber,
    horse_name: args.horseName,
    jockey_id: jockeyId,
    trainer_id: trainerId,
    status: "requested",
    created_by: user.id,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * "I'm attending" toggle for a meeting.
 * Upserts a row in meeting_attendance (unique on meeting_id + user_id).
 * A jockey marks themselves; an approved agent marks a managed jockey via
 * args.jockeyId. RLS enforces the same rule at the database.
 */
export async function setMeetingAttendance(args: {
  meetingId: string;
  attending: boolean;
  jockeyId?: string | null;
}): Promise<{ success: boolean; attending?: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return { success: false, error: "Profile not found" };
  if (profile.role !== "jockey" && profile.role !== "agent") {
    return { success: false, error: "Only jockeys or their agent can mark attendance" };
  }

  const resolved = await resolveActingJockey(
    supabase,
    user.id,
    profile.role,
    args.jockeyId
  );
  if (resolved.error || !resolved.jockeyId) {
    return { success: false, error: resolved.error ?? "Could not resolve jockey" };
  }

  const { error } = await supabase.from("meeting_attendance").upsert(
    {
      meeting_id: args.meetingId,
      user_id: resolved.jockeyId,
      attending: args.attending,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id,user_id" }
  );

  if (error) return { success: false, error: error.message };

  revalidatePath(`/meetings/${args.meetingId}`);
  return { success: true, attending: args.attending };
}
