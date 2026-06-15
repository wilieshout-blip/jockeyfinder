import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Syncs race entries for each upcoming meeting by scraping the
// LoveRacing meeting overview page. Called manually or by cron after sync-races.

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
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find the inner HTML of a div whose opening tag contains `marker`.
 * Uses div-depth counting to find the matching closing tag.
 */
function findDiv(
  html: string,
  marker: string,
  fromIdx = 0
): { inner: string; endIdx: number } | null {
  const markerIdx = html.indexOf(marker, fromIdx);
  if (markerIdx === -1) return null;

  const divStart = html.lastIndexOf("<div", markerIdx);
  if (divStart === -1) return null;

  const openEnd = html.indexOf(">", divStart);
  if (openEnd === -1) return null;

  let depth = 1;
  let i = openEnd + 1;
  while (i < html.length && depth > 0) {
    const o = html.indexOf("<div", i);
    const c = html.indexOf("</div>", i);
    if (c === -1) break;
    if (o !== -1 && o < c) {
      depth++;
      i = o + 4;
    } else {
      depth--;
      i = c + 6;
    }
  }

  return {
    inner: html.slice(openEnd + 1, depth === 0 ? i - 6 : i),
    endIdx: i,
  };
}

/**
 * Extract all non-header nztr-row div inner HTMLs from a section.
 * Header rows have class="nztr-row row-header" and are skipped.
 * Data rows have class="nztr-row" (exact — no extra classes).
 */
function extractNztrRows(html: string): string[] {
  const rows: string[] = [];
  let fromIdx = 0;

  while (true) {
    const idx = html.indexOf('class="nztr-row"', fromIdx);
    if (idx === -1) break;

    const divStart = html.lastIndexOf("<div", idx);
    if (divStart === -1) break;

    const openEnd = html.indexOf(">", divStart);
    if (openEnd === -1) break;

    const openTag = html.slice(divStart, openEnd + 1);
    if (openTag.includes("row-header")) {
      fromIdx = openEnd + 1;
      continue;
    }

    let depth = 1;
    let i = openEnd + 1;
    while (i < html.length && depth > 0) {
      const o = html.indexOf("<div", i);
      const c = html.indexOf("</div>", i);
      if (c === -1) break;
      if (o !== -1 && o < c) {
        depth++;
        i = o + 4;
      } else {
        depth--;
        i = c + 6;
      }
    }

    rows.push(html.slice(openEnd + 1, depth === 0 ? i - 6 : i));
    fromIdx = depth === 0 ? i : html.length;
  }

  return rows;
}

/**
 * Extract text content of each top-level div child in a row's HTML.
 */
function getCellTexts(rowHtml: string): string[] {
  const texts: string[] = [];
  let fromIdx = 0;

  while (fromIdx < rowHtml.length) {
    const divStart = rowHtml.indexOf("<div", fromIdx);
    if (divStart === -1) break;

    const openEnd = rowHtml.indexOf(">", divStart);
    if (openEnd === -1) break;

    let depth = 1;
    let i = openEnd + 1;
    while (i < rowHtml.length && depth > 0) {
      const o = rowHtml.indexOf("<div", i);
      const c = rowHtml.indexOf("</div>", i);
      if (c === -1) break;
      if (o !== -1 && o < c) {
        depth++;
        i = o + 4;
      } else {
        depth--;
        i = c + 6;
      }
    }

    texts.push(stripHtml(rowHtml.slice(openEnd + 1, depth === 0 ? i - 6 : i)));
    fromIdx = depth === 0 ? i : rowHtml.length;
  }

  return texts;
}

/** Extract the text of the first <a> link in a string, falling back to stripped text. */
function extractLinkText(html: string): string {
  const m = html.match(/<a[^>]*>([^<]+)<\/a>/i);
  if (m) return m[1].trim();
  return stripHtml(html)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .trim();
}

/** Strip apprentice claim suffix: "Amber Riddell (a1/54kg)" → "Amber Riddell" */
function cleanJockeyName(raw: string): string | null {
  if (!raw || raw === "-") return null;
  return raw.replace(/\s*\([^)]+\)\s*$/, "").trim() || null;
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

/** Parse all race entries from the LoveRacing meeting overview HTML. */
function scrapeEntries(html: string): EntryRow[] {
  const allEntries: EntryRow[] = [];

  for (let raceNum = 1; raceNum <= 12; raceNum++) {
    const toggleSection = findDiv(html, `id="toggle-detail${raceNum}"`);
    if (!toggleSection) break;

    const horsesSection = findDiv(toggleSection.inner, 'class="horses"');
    if (!horsesSection) continue;

    const rowsSection = findDiv(horsesSection.inner, 'class="rows"');
    if (!rowsSection) continue;

    const horseRows = extractNztrRows(rowsSection.inner);

    const horseDetails = findDiv(toggleSection.inner, 'class="horse-details"');
    if (!horseDetails) continue;

    const tabContent = findDiv(horseDetails.inner, 'class="tab-content"');
    if (!tabContent) continue;

    const detailRows = extractNztrRows(tabContent.inner);

    const count = Math.min(horseRows.length, detailRows.length);

    for (let j = 0; j < count; j++) {
      const horseCells = getCellTexts(horseRows[j]);
      const horseNum = parseInt(horseCells[0] ?? "", 10) || null;

      const colHorse = findDiv(horseRows[j], 'class="col col-horse"');
      const horseName = colHorse
        ? extractLinkText(colHorse.inner)
        : (horseCells[3] ?? "").split("(")[0].trim();

      if (!horseName) continue;

      const detailCells = getCellTexts(detailRows[j]);
      const barrier = parseInt(detailCells[0] ?? "", 10) || null;
      const rating = parseInt(detailCells[1] ?? "", 10) || null;
      const weight = parseFloat(detailCells[2] ?? "") || null;
      const jockeyRaw = detailCells[3] ?? "";
      const trainerRaw = detailCells[4] ?? "";

      allEntries.push({
        race_number: raceNum,
        horse_number: horseNum,
        horse_name: horseName,
        barrier,
        rating: isNaN(rating as number) ? null : rating,
        weight: isNaN(weight as number) ? null : weight,
        jockey_name: cleanJockeyName(jockeyRaw),
        trainer_name: trainerRaw && trainerRaw !== "-" ? trainerRaw.trim() : null,
      });
    }
  }

  return allEntries;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
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
      const { data: races } = await supabase
        .from("races")
        .select("id, race_number")
        .eq("nztr_day_id", meeting.nztr_day_id);

      const raceMap = new Map(
        (races ?? []).map((r) => [r.race_number as number, r.id as string])
      );

      const url = `https://loveracing.nz/RaceInfo/${meeting.nztr_day_id}/Meeting-Overview.aspx`;
      const res = await fetch(url, { headers: NZ_HEADERS, cache: "no-store" });
      if (!res.ok) {
        errors.push(`Meeting ${meeting.nztr_day_id}: HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();
      const entries = scrapeEntries(html);

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
