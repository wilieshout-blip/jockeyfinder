"use server";

import { createClient } from "@/lib/supabase/server";

interface RequestRideArgs {
  meetingId: string;
  raceId: string | null;
  raceNumber: number;
  horseName: string;
  trainerName: string | null;
}

/**
 * Quick "Request Ride" from the Race Day card.
 * Looks up the trainer by full_name if possible; creates the ride request.
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

  const jockeyId = user.id;

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
