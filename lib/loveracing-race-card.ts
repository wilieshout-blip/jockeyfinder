import { createAdminClient } from "@/lib/supabase/admin";

export interface RaceCardSyncResult {
  ok: boolean;
  synced: number;
  meetings: number;
  debug?: string[];
  errors?: string[];
  error?: string;
}

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
    .replace(new RegExp("<[^>]+>", "g"), " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .split(" ")
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatNzDate(d: Date) {
  return (
    String(d.getFullYear()) +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function upcomingRange(days: number) {
  const start = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" })
  );
  const end = new Date(start);
  end.setDate(start.getDate() + days);
  return { start: formatNzDate(start), end: formatNzDate(end) };
}

function parseNZStartTime(timeStr: string, meetingDate: string): string | null {
  const m = timeStr.match(new RegExp("^([0-9]{1,2}):([0-9]{2}) *(am|pm)$", "i"));
  if (!m) return null;

  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && hour !== 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  const month = parseInt(meetingDate.split("-")[1], 10);
  const offset = month >= 4 && month <= 9 ? "+12:00" : "+13:00";
  const dt = new Date(
    meetingDate +
      "T" +
      String(hour).padStart(2, "0") +
      ":" +
      String(minute).padStart(2, "0") +
      ":00" +
      offset
  );
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

function parseConditions(condsDist: string): {
  distance: number | null;
  race_class: string | null;
} {
  const distMatch = condsDist.match(new RegExp("([0-9]{3,5})m"));
  const distance = distMatch ? parseInt(distMatch[1], 10) : null;
  const classPart = condsDist
    .split(new RegExp("[0-9]{3,5}m"))[0]
    .trim()
    .replace(new RegExp("[- ]+$"), "")
    .trim();
  return { distance, race_class: classPart || null };
}

async function fetchMeetingOverview(nztrDayId: number): Promise<string | null> {
  const url =
    "https://loveracing.nz/RaceInfo/" +
    nztrDayId +
    "/Meeting-Overview.aspx";
  const res = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" });
  return res.ok ? res.text() : null;
}

function scrapeMeetingRaces(
  html: string,
  meetingDate: string
): Array<{
  race_number: number;
  name: string;
  start_time: string | null;
  distance: number | null;
  race_class: string | null;
}> {
  const races: Array<{
    race_number: number;
    name: string;
    start_time: string | null;
    distance: number | null;
    race_class: string | null;
  }> = [];

  const tableRegex = new RegExp(
    '<table[^>]+class="overview-info"[^>]*>(.*?)<' + "/table>",
    "gis"
  );
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const cells: string[] = [];
    const tdRegex = new RegExp("<td[^>]*>(.*?)<" + "/td>", "gis");
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(tableHtml)) !== null) {
      cells.push(stripHtml(tdMatch[1]));
    }

    if (cells.length < 3) continue;

    const raceNum = parseInt(cells[0], 10);
    if (isNaN(raceNum) || raceNum < 1 || raceNum > 30) continue;

    const raceName = cells[2];
    if (!raceName) continue;

    const { distance, race_class } = parseConditions(cells[3] ?? "");

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

interface EntryRow {
  race_number: number;
  horse_number: number | null;
  horse_name: string;
  barrier: number | null;
  jockey_name: string | null;
  trainer_name: string | null;
  weight: number | null;
  rating: number | null;
}

function scrapeEntries(html: string): EntryRow[] {
  const allEntries: EntryRow[] = [];
  const tableRegex = new RegExp(
    '<table[^>]+id="toggle-detail([0-9]+)"[^>]*>(.*?)<' + "/table>",
    "gis"
  );
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const raceNum = parseInt(tableMatch[1], 10);
    if (isNaN(raceNum) || raceNum < 1 || raceNum > 20) continue;

    const rowRegex = new RegExp("<tr[^>]*>(.*?)<" + "/tr>", "gis");
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableMatch[2])) !== null) {
      const rowHtml = rowMatch[1];
      if (new RegExp("<th", "i").test(rowHtml)) continue;

      const cells: string[] = [];
      const tdRegex = new RegExp("<td[^>]*>(.*?)<" + "/td>", "gis");
      let tdMatch: RegExpExecArray | null;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(stripHtml(tdMatch[1]));
      }

      if (cells.length < 4) continue;

      const col0 = parseInt(cells[0], 10);
      if (isNaN(col0) || col0 < 1 || col0 > 30) continue;

      const horseName = (cells[1] ?? "").trim();
      if (!horseName) continue;

      let barrier: number | null = null;
      let weight: number | null = null;
      let jockeyName: string | null = null;
      let trainerName: string | null = null;
      const rating: number | null = null;

      const col3 = parseFloat(cells[3] ?? "");
      if (!isNaN(col3) && col3 >= 1 && col3 <= 30) {
        barrier = Math.round(col3);
        const w = parseFloat(cells[4] ?? "");
        weight = isNaN(w) ? null : w;
        jockeyName = (cells[5] ?? "").trim() || null;
        trainerName = (cells[6] ?? "").trim() || null;
      } else {
        jockeyName = (cells[3] ?? "").trim() || null;
        trainerName = (cells[4] ?? "").trim() || null;
      }

      if (jockeyName) {
        jockeyName =
          jockeyName.replace(new RegExp(" *[(][^)]+[)]$"), "").trim() || null;
      }

      allEntries.push({
        race_number: raceNum,
        horse_number: col0,
        horse_name: horseName,
        barrier,
        jockey_name: jockeyName,
        trainer_name: trainerName,
        weight,
        rating,
      });
    }
  }

  return allEntries;
}

export async function syncUpcomingRaces(days = 14): Promise<RaceCardSyncResult> {
  const supabase = createAdminClient();
  const { start, end } = upcomingRange(days);

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date")
    .gte("meeting_date", start)
    .lte("meeting_date", end)
    .not("nztr_day_id", "is", null);

  if (meetingsError) {
    return { ok: false, synced: 0, meetings: 0, error: meetingsError.message };
  }

  let totalSynced = 0;
  const errors: string[] = [];
  const debug: string[] = [];

  for (const meeting of meetings ?? []) {
    try {
      const html = await fetchMeetingOverview(meeting.nztr_day_id);
      if (!html) {
        errors.push("Meeting " + meeting.nztr_day_id + ": LoveRacing fetch failed");
        continue;
      }

      const races = scrapeMeetingRaces(html, meeting.meeting_date);
      debug.push(
        "Meeting " + meeting.nztr_day_id + ": scraped " + races.length + " races"
      );
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

      const { error } = await supabase
        .from("races")
        .upsert(rows, { onConflict: "nztr_day_id,race_number" });

      if (error) errors.push("Meeting " + meeting.nztr_day_id + ": " + error.message);
      else totalSynced += rows.length;
    } catch (err) {
      errors.push("Meeting " + meeting.nztr_day_id + ": " + (err as Error).message);
    }
  }

  return {
    ok: errors.length === 0,
    synced: totalSynced,
    meetings: meetings?.length ?? 0,
    debug,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function syncUpcomingRaceEntries(
  days = 14
): Promise<RaceCardSyncResult> {
  const supabase = createAdminClient();
  const { start, end } = upcomingRange(days);

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date")
    .gte("meeting_date", start)
    .lte("meeting_date", end)
    .not("nztr_day_id", "is", null);

  if (meetingsError) {
    return { ok: false, synced: 0, meetings: 0, error: meetingsError.message };
  }

  let totalSynced = 0;
  const errors: string[] = [];
  const debug: string[] = [];

  for (const meeting of meetings ?? []) {
    try {
      const { data: races } = await supabase
        .from("races")
        .select("id, race_number")
        .eq("nztr_day_id", meeting.nztr_day_id);

      const raceMap = new Map(
        (races ?? []).map((r) => [r.race_number as number, r.id as string])
      );

      const html = await fetchMeetingOverview(meeting.nztr_day_id);
      if (!html) {
        errors.push("Meeting " + meeting.nztr_day_id + ": LoveRacing fetch failed");
        continue;
      }

      const entries = scrapeEntries(html);
      debug.push(
        "Meeting " +
          meeting.nztr_day_id +
          ": scraped " +
          entries.length +
          " entries"
      );
      if (entries.length === 0) continue;

      const rows = entries.map((e) => ({
        meeting_id: meeting.id,
        race_id: raceMap.get(e.race_number) ?? null,
        nztr_day_id: meeting.nztr_day_id,
        race_number: e.race_number,
        horse_number: e.horse_number,
        horse_name: e.horse_name,
        barrier: e.barrier,
        jockey_name: e.jockey_name,
        trainer_name: e.trainer_name,
        weight: e.weight,
        rating: e.rating,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("race_entries")
        .upsert(rows, { onConflict: "nztr_day_id,race_number,horse_name" });

      if (error) errors.push("Meeting " + meeting.nztr_day_id + ": " + error.message);
      else totalSynced += rows.length;
    } catch (err) {
      errors.push("Meeting " + meeting.nztr_day_id + ": " + (err as Error).message);
    }
  }

  return {
    ok: errors.length === 0,
    synced: totalSynced,
    meetings: meetings?.length ?? 0,
    debug,
    errors: errors.length > 0 ? errors : undefined,
  };
}
