import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Syncs individual races for each upcoming meeting by scraping the
// LoveRacing meeting overview page. Race summaries live in
// <table class="overview-info"> elements (one per race).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-NZ,en;q=0.9",
  Referer: "https://loveracing.nz/",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
};

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/s+/g, " ")
    .trim();
}

function parseNZStartTime(timeStr: string, meetingDate: string): string | null {
  const m = timeStr.match(/^(d{1,2}):(d{2})s*(am|pm)$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && hour !== 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  const month = parseInt(meetingDate.split("-")[1], 10);
  const offset = month >= 4 && month <= 9 ? "+12:00" : "+13:00";
  const dt = new Date(
    meetingDate + "T" + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0") + ":00" + offset
  );
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

/** Parse distance (metres) and race_class from "MDN 1200m - $17,000" */
function parseConditions(condsDist: string): {
  distance: number | null;
  race_class: string | null;
} {
  const distMatch = condsDist.match(/(d{3,5})m/);
  const distance = distMatch ? parseInt(distMatch[1], 10) : null;
  const classPart = condsDist
    .split(/d{3,5}m/)[0]
    .trim()
    .replace(/[-s]+$/, "")
    .trim();
  return { distance, race_class: classPart || null };
}

async function scrapeMeetingRaces(
  nztrDayId: number,
  meetingDate: string
): Promise<
  Array<{
    race_number: number;
    name: string;
    start_time: string | null;
    distance: number | null;
    race_class: string | null;
  }>
> {
  const url = "https://loveracing.nz/RaceInfo/" + nztrDayId + "/Meeting-Overview.aspx";
  const res = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" });
  if (!res.ok) return [];

  const html = await res.text();

  // Race summaries are in <table class="overview-info"> elements, one per race.
  // Single data row: [race_num, start_time, name, conds_dist, time, open/close]
  const races: Array<{
    race_number: number;
    name: string;
    start_time: string | null;
    distance: number | null;
    race_class: string | null;
  }> = [];

  const tableRegex = /<table[^>]+class="overview-info"[^>]*>([sS]*?)</table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([sS]*?)</td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(tableHtml)) !== null) {
      cells.push(stripHtml(tdMatch[1]));
    }

    if (cells.length < 3) continue;

    const raceNum = parseInt(cells[0], 10);
    if (isNaN(raceNum) || raceNum < 1 || raceNum > 30) continue;

    const raceName = cells[2];
    if (!raceName) continue;

    const condsDist = cells[3] ?? "";
    const { distance, race_class } = parseConditions(condsDist);

    races.push({
      race_number: raceNum,
      name: raceName,
      start_time: parseNZStartTime(cells[1], meetingDate),
      distance,
      race_class,
    });
  }

  return races;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== "Bearer " + process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const nowNZ = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" })
  );
  const in14NZ = new Date(nowNZ);
  in14NZ.setDate(nowNZ.getDate() + 14);

  const fmt = (d: Date) =>
    d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

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
  const debug: string[] = [];

  for (const meeting of meetings) {
    try {
      const races = await scrapeMeetingRaces(meeting.nztr_day_id, meeting.meeting_date);
      debug.push("Meeting " + meeting.nztr_day_id + ": scraped " + races.length + " races");
      if (races.length === 0) continue;

      const rows = races.map((r) => ({
        meeting_id: meeting.id,
        nztr_day_id: meeting.nztr_day_id,
        race_number: r.race_number,
        name: r.name,
        start_time: r.start_time,
        distance: r.distance,
        race_class: r.race_class,
      }));

      const { error: upsertError } = await supabase
        .from("races")
        .upsert(rows, { onConflict: "nztr_day_id,race_number" });

      if (upsertError) {
        errors.push("Meeting " + meeting.nztr_day_id + ": " + upsertError.message);
      } else {
        totalSynced += rows.length;
      }
    } catch (err) {
      errors.push("Meeting " + meeting.nztr_day_id + ": " + (err as Error).message);
    }
  }

  return NextResponse.json({
    synced: totalSynced,
    meetings: meetings.length,
    debug,
    errors: errors.length > 0 ? errors : undefined,
  });
}
