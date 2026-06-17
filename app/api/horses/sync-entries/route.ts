import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAndSyncMeetingEntries } from "@/lib/loveracing-entries";

// Called by Vercel cron: "0 6 * * *" (6am NZT daily)
// Also callable from admin UI with ?secret=CRON_SECRET
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch upcoming meetings in the next 7 days that have a nztr_day_id
  const today = new Date();
  const in7 = new Date();
  in7.setDate(today.getDate() + 7);

  const { data: meetings, error } = await admin
    .from("meetings")
    .select("id, nztr_day_id, meeting_date, track")
    .gte("meeting_date", today.toISOString().slice(0, 10))
    .lte("meeting_date", in7.toISOString().slice(0, 10))
    .not("nztr_day_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const meeting of meetings ?? []) {
    const result = await fetchAndSyncMeetingEntries(
      meeting.nztr_day_id as number,
      meeting.id
    );
    results.push({ meeting: meeting.track, date: meeting.meeting_date, ...result });
  }

  return NextResponse.json({ ok: true, results });
}
