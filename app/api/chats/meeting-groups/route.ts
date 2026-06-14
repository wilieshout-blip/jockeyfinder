import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Auto-creates a meeting_group chat thread for each meeting happening tomorrow.
// Called by Vercel cron at 06:00 UTC daily.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Find meetings happening tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id, track, meeting_date")
    .eq("meeting_date", tomorrowStr);

  if (meetingsError) {
    return NextResponse.json({ error: meetingsError.message }, { status: 500 });
  }

  if (!meetings || meetings.length === 0) {
    return NextResponse.json({ created: 0, message: "No meetings tomorrow" });
  }

  let created = 0;
  const errors: string[] = [];

  for (const meeting of meetings) {
    try {
      // Skip if a meeting_group thread already exists for this meeting
      const { data: existing } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("meeting_id", meeting.id)
        .eq("type", "meeting_group")
        .maybeSingle();

      if (existing) continue;

      // Find all attendees confirmed for this meeting
      const { data: attendees, error: attendeesError } = await supabase
        .from("meeting_attendance")
        .select("user_id")
        .eq("meeting_id", meeting.id)
        .eq("attending", true);

      if (attendeesError || !attendees || attendees.length === 0) continue;

      // Create the group thread
      const { data: thread, error: threadError } = await supabase
        .from("chat_threads")
        .insert({
          type: "meeting_group",
          meeting_id: meeting.id,
        })
        .select("id")
        .single();

      if (threadError || !thread) {
        errors.push(`Meeting ${meeting.id}: ${threadError?.message ?? "insert failed"}`);
        continue;
      }

      // Add all attendees as participants
      const participants = attendees.map((a) => ({
        thread_id: thread.id,
        user_id: a.user_id,
      }));

      const { error: participantsError } = await supabase
        .from("chat_participants")
        .insert(participants);

      if (participantsError) {
        errors.push(`Thread ${thread.id} participants: ${participantsError.message}`);
      } else {
        created++;
      }
    } catch (err) {
      errors.push(`Meeting ${meeting.id}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    created,
    meetings: meetings.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
