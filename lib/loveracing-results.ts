/**
 * lib/loveracing-results.ts
 *
 * Parses completed race results from LoveRacing meeting overview pages and
 * upserts them into race_results. Designed to run server-side only.
 */
import { createAdminClient } from "@/lib/supabase/admin";

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml)) !== null) {
    cells.push(stripTags(m[1]));
  }
  return cells;
}

function parseTableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const re = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tableHtml)) !== null) {
    const cells = parseCells(m[1]);
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function extractTables(html: string): string[] {
  const tables: string[] = [];
  const re = /<table[\s\S]*?<\/table>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    tables.push(m[0]);
  }
  return tables;
}

function parseDividend(raw: string): number | null {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

function parseDistance(conditions: string): number | null {
  const m = conditions.match(/(\d{3,5})m/i);
  return m ? parseInt(m[1], 10) : null;
}

function parsePrize(conditions: string): number | null {
  const m = conditions.match(/\$([0-9,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
}

function cleanJockeyName(raw: string): string {
  return raw.replace(/\s*\([A-Z0-9]+\)\s*$/, "").trim();
}

export interface RaceResult {
  race_number: number;
  race_name: string;
  distance_m: number | null;
  prize_total: number | null;
  position: number;
  horse_name: string;
  jockey_name: string | null;
  trainer_name: string | null;
  win_dividend: number | null;
  place_dividend: number | null;
}

export function parseMeetingResults(html: string): RaceResult[] {
  const results: RaceResult[] = [];
  const tables = extractTables(html);

  let currentRaceNum = 0;
  let currentRaceName = "";
  let currentDistanceM: number | null = null;
  let currentPrize: number | null = null;

  for (const tableHtml of tables) {
    const rows = parseTableRows(tableHtml);
    if (rows.length === 0) continue;
    const firstRow = rows[0];

    if (
      firstRow.length >= 4 &&
      /^\d{1,2}$/.test(firstRow[0]) &&
      /\d{1,2}:\d{2}/.test(firstRow[1])
    ) {
      currentRaceNum = parseInt(firstRow[0], 10);
      currentRaceName = firstRow[2] ?? "";
      currentDistanceM = firstRow[3] ? parseDistance(firstRow[3]) : null;
      currentPrize = firstRow[3] ? parsePrize(firstRow[3]) : null;
      continue;
    }

    const isResultsHeader =
      firstRow.length >= 6 &&
      firstRow.some((c) => c === "#") &&
      firstRow.some((c) => /^Horse$/i.test(c)) &&
      firstRow.some((c) => /^Jockey$/i.test(c));

    if (!isResultsHeader || currentRaceNum === 0) continue;

    let position = 0;
    for (const row of rows.slice(1)) {
      if (row.length <= 1) continue;
      if (/^Owners?:/i.test(row[0])) continue;
      if (/^Other:/i.test(row[0]) || /^Scratched:/i.test(row[0])) continue;
      if (row.length < 4) continue;
      if (row.length >= 6) {
        position++;
        const horseName = row[2] ?? "";
        const jockeyRaw = row[3] ?? "";
        const trainerName = row[4] ?? null;
        const winRaw = row[5] ?? "";
        const placeRaw = row[6] ?? "";
        if (!horseName || horseName === "#") continue;
        results.push({
          race_number: currentRaceNum,
          race_name: currentRaceName,
          distance_m: currentDistanceM,
          prize_total: currentPrize,
          position,
          horse_name: horseName,
          jockey_name: jockeyRaw ? cleanJockeyName(jockeyRaw) : null,
          trainer_name: trainerName || null,
          win_dividend: winRaw ? parseDividend(winRaw) : null,
          place_dividend: placeRaw ? parseDividend(placeRaw) : null,
        });
        if (position >= 3) break;
      }
    }
  }
  return results;
}

export interface SyncResultsResult {
  ok: boolean;
  results: number;
  error?: string;
}

export async function fetchAndSyncMeetingResults(
  nztrDayId: number,
  meetingId: string,
  raceDate: string
): Promise<SyncResultsResult> {
  const url = "https://loveracing.nz/raceinfo/" + nztrDayId + "/meeting-overview.aspx";

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "JockeyFinder/1.0 (+https://www.jockeyfinder.com)" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return { ok: false, results: 0, error: "LoveRacing " + res.status };
    html = await res.text();
  } catch (e: unknown) {
    return { ok: false, results: 0, error: String(e) };
  }

  const parsed = parseMeetingResults(html);
  if (parsed.length === 0) return { ok: true, results: 0 };

  const admin = createAdminClient();

  const rows = parsed.map((r) => ({
    meeting_id: meetingId,
    nztr_day_id: nztrDayId,
    race_number: r.race_number,
    race_name: r.race_name,
    distance_m: r.distance_m,
    prize_total: r.prize_total,
    position: r.position,
    horse_name: r.horse_name,
    jockey_name: r.jockey_name,
    trainer_name: r.trainer_name,
    win_dividend: r.win_dividend,
    place_dividend: r.place_dividend,
    race_date: raceDate,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("race_results")
    .upsert(rows, { onConflict: "nztr_day_id,race_number,position" });

  if (error) return { ok: false, results: 0, error: error.message };

  return { ok: true, results: rows.length };
}
