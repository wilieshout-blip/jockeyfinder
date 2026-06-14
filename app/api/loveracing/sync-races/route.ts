import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Syncs individual races for each meeting from the LoveRacing NZ API
// Called by Vercel cron at 18:00 UTC daily

const LOVERACING_RACES_URL =
  "https://loveracing.nz/ServerScript/RaceInfo.aspx/GetRacesByMeeting";

interface LoveRacingRace {
  RaceId: number;
  RaceNumber: number;
  RaceName: string;
  Distance: number;
  StartTime: string;
  TrackCondition: string;
  NumberOfRunners: number;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const today = new Date();
  const in14Days = new Date(today);
  in14Days.setDate(today.getDate() + 14);

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id, external_id, race_date")
    .gte("race_date", today.toISOString().split("T")[0])
    .lte("race_date", in14Days.toISOString().split("T")[0]);

  if (meetingsError) {
    return NextResponse.json({ error: meetingsError.message }, { status: 500 });
  }

  if (!meetings || meetings.length === 0) {
    return NextResponse.json({ synced: 0, message: "No upcoming meetings" });
  }

  let totalSynced = 0;
  const errors: string[] = [];

  for (const meeting of meetings) {
    try {
      const res = await fetch(LOVERACING_RACES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.external_id }),
      });

      if (!res.ok) {
        errors.push(`Meeting ${meeting.external_id}: HTTP ${res.status}`);
        continue;
      }

      const json = await res.json();
      const races: LoveRacingRace[] = json.d ?? json.races ?? [];

      if (!Array.isArray(races) || races.length === 0) continue;

      const upsertRows = races.map((r) => ({
        meeting_id: meeting.id,
        race_number: r.RaceNumber,
        race_name: r.RaceName,
        distance_m: r.Distance,
        start_time: r.StartTime ? new Date(r.StartTime).toISOString() : null,
        track_condition: r.TrackCondition ?? null,
        runner_count: r.NumberOfRunners ?? 0,
        external_id: String(r.RaceId),
      }));

      const { error: upsertError } = await supabase
        .from("races")
        .upsert(upsertRows, { onConflict: "meeting_id,race_number" });

      if (upsertError) {
        errors.push(`Meeting ${meeting.external_id}: ${upsertError.message}`);
      } else {
        totalSynced += upsertRows.length;
      }
    } catch (err) {
      errors.push(`Meeting ${meeting.external_id}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    synced: totalSynced,
    meetings: meetings.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
