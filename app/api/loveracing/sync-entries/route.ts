import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Syncs race entries for each upcoming meeting by scraping the
// LoveRacing meeting overview page. Race entries live in
// <table id="toggle-detail{N}" class="alternating-rows further-detail">
// elements (one table per race). Owner detail rows are skipped.

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

function cleanJockeyName(raw: string): string | null {
  if (!raw || raw === "-") return null;
  return raw.replace(/s*([^)]+)s*$/, "").trim() || null;
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

/**
 * Parse race entries from a LoveRacing meeting overview HTML.
 *
 * The page has two formats depending on race state:
 *   Pre-race: [#, Silk, Horse, Barrier, Weight, Jockey, Trainer, ...]
 *   Results:  [#, Silk, Horse, Jockey, Trainer, Win, Place, Lgth]
 *
 * Format is detected by checking whether cells[3] is a small integer (barrier).
 * Owner/detail rows (colspan) are skipped because cells[0] won't parse as a
 * valid horse number (1-30).
 */
function scrapeEntries(html: string): EntryRow[] {
  const allEntries: EntryRow[] = [];

  const tableRegex =
    /<table[^>]+id="toggle-detail(d+)"[^>]*>([sS]*?)</table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const raceNum = parseInt(tableMatch[1], 10);
    if (isNaN(raceNum) || raceNum < 1 || raceNum > 30) continue;
    const tableHtml = tableMatch[2];

    const rowRegex = /<tr[^>]*>([sS]*?)</tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];

      // Skip header rows
      if (/<th/i.test(rowHtml)) continue;

      // Extract td text
      const cells: string[] = [];
      const tdRegex = /<td[^>]*>([sS]*?)</td>/gi;
      let tdMatch: RegExpExecArray | null;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(stripHtml(tdMatch[1]));
      }

      if (cells.length < 3) continue;

      // cells[0] must be a horse number (1-30); owner rows fail this check
      const horseNum = parseInt(cells[0], 10);
      if (isNaN(horseNum) || horseNum < 1 || horseNum > 30) continue;

      const horseName = cells[2];
      if (!horseName || horseName.length < 2) continue;

      let barrier: number | null = null;
      let weight: number | null = null;
      let jockeyName: string | null = null;
      let trainerName: string | null = null;

      // Detect pre-race format: cells[3] is a small integer (barrier 1-30)
      const cells3Num = parseFloat(cells[3] ?? "");
      if (
        !isNaN(cells3Num) &&
        cells3Num >= 1 &&
        cells3Num <= 30 &&
        cells.length >= 6
      ) {
        barrier = parseInt(cells[3], 10) || null;
        weight = parseFloat(cells[4]) || null;
        jockeyName = cleanJockeyName(cells[5] ?? "");
        trainerName = cells[6] && cells[6] !== "-" ? cells[6].trim() : null;
      } else {
        // Results format: Jockey in cells[3], Trainer in cells[4]
        jockeyName = cleanJockeyName(cells[3] ?? "");
        trainerName = cells[4] && cells[4] !== "-" ? cells[4].trim() : null;
      }

      allEntries.push({
        race_number: raceNum,
        horse_number: horseNum,
        horse_name: horseName,
        barrier,
        weight,
        rating: null,
        jockey_name: jockeyName,
        trainer_name: trainerName,
      });
    }
  }

  return allEntries;
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
      const { data: races } = await supabase
        .from("races")
        .select("id, race_number")
        .eq("nztr_day_id", meeting.nztr_day_id);

      const raceMap = new Map(
        (races ?? []).map((r) => [r.race_number as number, r.id as string])
      );

      const url = "https://loveracing.nz/RaceInfo/" + meeting.nztr_day_id + "/Meeting-Overview.aspx";
      const res = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" });
      if (!res.ok) {
        errors.push("Meeting " + meeting.nztr_day_id + ": HTTP " + res.status);
        continue;
      }

      const html = await res.text();
      const entries = scrapeEntries(html);
      debug.push("Meeting " + meeting.nztr_day_id + ": scraped " + entries.length + " entries");

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

      const { error: upsertError } = await supabase
        .from("race_entries")
        .upsert(rows, { onConflict: "nztr_day_id,race_number,horse_name" });

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
