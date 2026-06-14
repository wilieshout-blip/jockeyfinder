import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Auto-creates a group chat thread for each meeting happening tomorrow.
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
    .select("id, venue, race_date")
    .eq("race_date", tomorrowStr);

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
      // Check if a group thread already exists for this meeting
      const { data: existing } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("meeting_id", meeting.id)
        .eq("is_group", true)
        .maybeSingle();

      if (existing) continue;

      // Find all jockeys attending this meeting
      const { data: attendees, error: attendeesError } = await supabase
        .from("meeting_attendance")
        .select("jockey_id")
        .eq("meeting_id", meeting.id);

      if (attendeesError || !attendees || attendees.length === 0) continue;

      // Create the group thread
      const threadTitle = `${meeting.venue} – ${new Date(meeting.race_date).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}`;

      const { data: thread, error: threadError } = await supabase
        .from("chat_threads")
        .insert({
          title: threadTitle,
          meeting_id: meeting.id,
          is_group: true,
        })
        .select("id")
        .single();

      if (threadError || !thread) {
        errors.push(`Meeting ${meeting.id}: ${threadError?.message ?? "insert failed"}`);
        continue;
      }

      // Add all attending jockeys as participants
      const participants = attendees.map((a) => ({
        thread_id: thread.id,
        user_id: a.jockey_id,
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
