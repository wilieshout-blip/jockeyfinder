import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Syncs individual races for each upcoming meeting by scraping the
// LoveRacing meeting overview page. Called by Vercel cron at 18:00 UTC daily.
// The LoveRacing ASMX service has no race-level JSON endpoint, so we
// parse the HTML race table from RaceInfo/{DayID}/Meeting-Overview.aspx.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NZ_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Referer: "https://loveracing.nz/",
  Origin: "https://loveracing.nz",
};

/** Strip HTML tags and decode basic entities. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Parse "12:30 pm" + "2026-06-16" (NZ date) -> UTC ISO timestamp.
 * NZ is UTC+12 (NZST, April-September) or UTC+13 (NZDT, Oct-March).
 */
function parseNZStartTime(timeStr: string, meetingDate: string): string | null {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && hour !== 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  // April through September = NZST (UTC+12); Oct through March = NZDT (UTC+13).
  const month = parseInt(meetingDate.split("-")[1], 10);
  const offset = month >= 4 && month <= 9 ? "+12:00" : "+13:00";
  const dt = new Date(
    `${meetingDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`
  );
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

/**
 * Fetch and parse races from a LoveRacing meeting overview page.
 * The HTML table has headers: Race | Start | Name | Conditions & Distance
 */
async function scrapeMeetingRaces(
  nztrDayId: number,
  meetingDate: string
): Promise<Array<{ race_number: number; name: string; start_time: string | null }>> {
  const url = `https://loveracing.nz/RaceInfo/${nztrDayId}/Meeting-Overview.aspx`;
  const res = await fetch(url, { headers: NZ_HEADERS, cache: "no-store" });
  if (!res.ok) return [];

  const html = await res.text();

  // Find the race table by locating the header row that contains Race/Start/Name.
  const headerMatch = html.search(/<th[^>]*>\s*Race\s*<\/th>/i);
  if (headerMatch === -1) return [];

  // Slice everything after that header row's closing </tr>.
  const afterHeader = html.indexOf("</tr>", headerMatch);
  if (afterHeader === -1) return [];
  const body = html.slice(afterHeader + 5);

  // Match all <tr>…</tr> blocks in the table body.
  const races: Array<{ race_number: number; name: string; start_time: string | null }> = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(body)) !== null) {
    const rowHtml = trMatch[1];
    // Extract <td> cell contents.
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtml(tdMatch[1]));
    }

    if (cells.length < 3) continue;

    const raceNum = parseInt(cells[0], 10);
    if (isNaN(raceNum) || raceNum < 1 || raceNum > 30) continue;

    const raceName = cells[2];
    if (!raceName) continue;

    races.push({
      race_number: raceNum,
      name: raceName,
      start_time: parseNZStartTime(cells[1], meetingDate),
    });
  }

  return races;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin client — cron has no user session, can't use RLS-bound createClient().
  const supabase = createAdminClient();

  // Fetch meetings in the next 14 days (NZ date).
  const nowNZ = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" })
  );
  const in14NZ = new Date(nowNZ);
  in14NZ.setDate(nowNZ.getDate() + 14);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date")
    .gte("meeting_date", fmt(nowNZ))
    .lte("meeting_date", fmt(in14NZ))
    .not("nztr_day_id", "is", null);

  if (meetingsError) {
    return NextResponse.json({ error: meetingsError.message }, { status: 500 });
  }

  if (!meetings || meetings.length === 0) {
    return NextResponse.json({ synced: 0, message: "No upcoming meetings in range" });
  }

  let totalSynced = 0;
  const errors: string[] = [];

  for (const meeting of meetings) {
    try {
      const races = await scrapeMeetingRaces(meeting.nztr_day_id, meeting.meeting_date);
      if (races.length === 0) continue;

      const rows = races.map((r) => ({
        meeting_id: meeting.id,
        nztr_day_id: meeting.nztr_day_id,
        race_number: r.race_number,
        name: r.name,
        start_time: r.start_time,
      }));

      const { error: upsertError } = await supabase
        .from("races")
        .upsert(rows, { onConflict: "nztr_day_id,race_number" });

      if (upsertError) {
        errors.push(`Meeting ${meeting.nztr_day_id}: ${upsertError.message}`);
      } else {
        totalSynced += rows.length;
      }
    } catch (err) {
      errors.push(`Meeting ${meeting.nztr_day_id}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    synced: totalSynced,
    meetings: meetings.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
