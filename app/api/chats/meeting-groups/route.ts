import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Auto-creates a meeting_group chat thread for each meeting happening tomorrow (NZ time).
// Called by Vercel cron at 06:00 UTC daily.

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use admin client — cron has no user session so the user-level client
  // would fail RLS checks on chat_threads and chat_participants inserts.
  const supabase = createAdminClient();

  // Calculate tomorrow in NZ time (Pacific/Auckland).
  // The cron fires at 06:00 UTC which is 18:00-19:00 NZ, so we calculate
  // using the NZ local date explicitly to avoid off-by-one errors.
  const nowNZ = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" })
  );
  const tomorrowNZ = new Date(nowNZ);
  tomorrowNZ.setDate(nowNZ.getDate() + 1);
  const yyyy = tomorrowNZ.getFullYear();
  const mm = String(tomorrowNZ.getMonth() + 1).padStart(2, "0");
  const dd = String(tomorrowNZ.getDate()).padStart(2, "0");
  const tomorrowStr = `${yyyy}-${mm}-${dd}`;

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
