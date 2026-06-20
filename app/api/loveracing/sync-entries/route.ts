import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Syncs race entries for each upcoming meeting by scraping the
// LoveRacing meeting overview page. Called by cron after sync-races.
// Entries live in <table id="toggle-detail{N}" class="alternating-rows further-detail">
// elements -- confirmed via browser inspection (tagName === "TABLE").
//
// CODING RULES: No regex literals with backslash sequences and no template
// literals -- both get corrupted by the CodeMirror editor. Use new RegExp()
// with 's' flag (dotAll) instead of [sS], use [0-9] instead of d,
// split closing tags as '<' + '/tag>', and use string concatenation.

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
 * Parse all race entries from the LoveRacing meeting overview HTML.
 *
 * HTML structure (confirmed via browser):
 *   <table id="toggle-detail1" class="alternating-rows further-detail">
 *     <tr><th>...</th>...</tr>   <- header, skip
 *     <tr><td>1</td><td>Horse</td>...</tr>
 *
 * Pre-race columns: [0]=num [1]=horse [2]=? [3]=barrier [4]=weight [5]=jockey [6]=trainer
 * Results columns:  [0]=pos [1]=horse [2]=? [3]=jockey  [4]=trainer
 * Detect format: col[3] is a small int (1-30) => pre-race, else => results.
 */
function scrapeEntries(html: string): EntryRow[] {
  const allEntries: EntryRow[] = [];

  // Use 's' (dotAll) flag so '.' matches newlines.
  // Split '</table>' so the '/' does not terminate a regex literal.
  const tableRegex = new RegExp(
    '<table[^>]+id="toggle-detail([0-9]+)"[^>]*>(.*?)<' + "/table>",
    "gis"
  );
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const raceNum = parseInt(tableMatch[1], 10);
    if (isNaN(raceNum) || raceNum < 1 || raceNum > 20) continue;

    const tableBody = tableMatch[2];

    const rowRegex = new RegExp("<tr[^>]*>(.*?)<" + "/tr>", "gis");
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
      const rowHtml = rowMatch[1];

      // Skip header rows
      if (new RegExp("<th", "i").test(rowHtml)) continue;

      const cells: string[] = [];
      const tdRegex = new RegExp("<td[^>]*>(.*?)<" + "/td>", "gis");
      let tdMatch: RegExpExecArray | null;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(stripHtml(tdMatch[1]));
      }

      if (cells.length < 4) continue;

      // First cell must be a valid horse/position number (1-30)
      const col0 = parseInt(cells[0], 10);
      if (isNaN(col0) || col0 < 1 || col0 > 30) continue;

      const horseName = (cells[1] ?? "").trim();
      if (!horseName) continue;

      let barrier: number | null = null;
      let weight: number | null = null;
      let jockeyName: string | null = null;
      let trainerName: string | null = null;
      const rating: number | null = null;

      // Pre-race: col[3] = barrier (small int 1-30)
      const col3 = parseFloat(cells[3] ?? "");
      if (!isNaN(col3) && col3 >= 1 && col3 <= 30) {
        barrier = Math.round(col3);
        const w = parseFloat(cells[4] ?? "");
        weight = isNaN(w) ? null : w;
        jockeyName = (cells[5] ?? "").trim() || null;
        trainerName = (cells[6] ?? "").trim() || null;
      } else {
        // Results format
        jockeyName = (cells[3] ?? "").trim() || null;
        trainerName = (cells[4] ?? "").trim() || null;
      }

      // Strip jockey claim suffix "Amber Riddell (a1/54kg)" -> "Amber Riddell"
      // Use [(] and [)] character classes to avoid backslash sequences.
      if (jockeyName) {
        jockeyName =
          jockeyName
            .replace(new RegExp(" *[(][^)]+[)]$"), "")
            .trim() || null;
      }

      allEntries.push({
        race_number: raceNum,
        horse_number: col0,
        horse_name: horseName,
        barrier,
        weight,
        jockey_name: jockeyName,
        trainer_name: trainerName,
        rating,
      });
    }
  }

  return allEntries;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const nowNZ = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" })
  );
  const in14NZ = new Date(nowNZ);
  in14NZ.setDate(nowNZ.getDate() + 14);

  const fmt = (d: Date) =>
    String(d.getFullYear()) +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");

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
    return NextResponse.json({
      synced: 0,
      message: "No upcoming meetings in range",
    });
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

      const url =
        "https://loveracing.nz/RaceInfo/" +
        meeting.nztr_day_id +
        "/Meeting-Overview.aspx";
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        cache: "no-store",
      });
      if (!res.ok) {
        errors.push(
          "Meeting " + meeting.nztr_day_id + ": HTTP " + res.status
        );
        continue;
      }

      const html = await res.text();
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

      const { error: upsertError } = await supabase
        .from("race_entries")
        .upsert(rows, { onConflict: "nztr_day_id,race_number,horse_name" });

      if (upsertError) {
        errors.push(
          "Meeting " + meeting.nztr_day_id + ": " + upsertError.message
        );
      } else {
        totalSynced += rows.length;
      }
    } catch (err) {
      errors.push(
        "Meeting " + meeting.nztr_day_id + ": " + (err as Error).message
      );
    }
  }

  return NextResponse.json({
    synced: totalSynced,
    meetings: meetings.length,
    debug,
    errors: errors.length > 0 ? errors : undefined,
  });
}
