import { createAdminClient } from "@/lib/supabase/admin";

const LOVERACING_ENDPOINT =
  "https://loveracing.nz/ServerScript/RaceInfo.aspx/GetCalendarEvents";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Date -> "01-Jan-2026" (format the LoveRacing endpoint expects). */
function toLoveRacingDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

/** Any timestamp -> calendar date in NZ as YYYY-MM-DD. */
function toNzDateString(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
  }).format(d);
}

/**
 * The ASMX endpoint returns dates either as "/Date(1735689600000)/"
 * or as plain strings. Handle both.
 */
function parseRaceDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value);

  const dotNet = s.match(/\/Date\((-?\d+)/);
  if (dotNet) {
    const d = new Date(Number(dotNet[1]));
    return isNaN(d.getTime()) ? null : toNzDateString(d);
  }

  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : toNzDateString(d);
}

interface LoveRacingEvent {
  DayID?: number;
  RaceDate?: unknown;
  Racecourse?: string;
  TrackAppName?: string;
  Club?: string;
  WebMeetingType?: string;
  WebDateType?: string;
  MeetingTotalPool?: unknown;
}

export interface SyncResult {
  ok: boolean;
  fetched: number;
  upserted: number;
  rangeStart: string;
  rangeEnd: string;
  error?: string;
}

/**
 * Pulls the NZ race calendar from today to 3 months ahead and upserts
 * into public.meetings. Uses the service-role client, so call this from
 * server code only.
 */
export async function syncMeetings(): Promise<SyncResult> {
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 3);

  const rangeStart = toLoveRacingDate(start);
  const rangeEnd = toLoveRacingDate(end);

  const res = await fetch(LOVERACING_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start: rangeStart, end: rangeEnd }),
    cache: "no-store",
  });

  if (!res.ok) {
    return {
      ok: false, fetched: 0, upserted: 0, rangeStart, rangeEnd,
      error: `LoveRacing responded with ${res.status}`,
    };
  }

  const payload = await res.json();

  // The "d" field is a JSON string that must be parsed again.
  let events: LoveRacingEvent[] = [];
  try {
    events =
      typeof payload?.d === "string"
        ? JSON.parse(payload.d)
        : Array.isArray(payload?.d)
          ? payload.d
          : [];
  } catch {
    return {
      ok: false, fetched: 0, upserted: 0, rangeStart, rangeEnd,
      error: "Could not parse the d field from LoveRacing",
    };
  }

  const rows = events
    .map((e) => ({
      nztr_day_id: e.DayID ?? null,
      meeting_date: parseRaceDate(e.RaceDate),
      track: e.TrackAppName || e.Racecourse || "TBC",
      club: e.Club ?? null,
      meeting_type: e.WebMeetingType || e.WebDateType || null,
      source: "loveracing",
    }))
    .filter((r) => r.nztr_day_id !== null && r.meeting_date !== null);

  const admin = createAdminClient();

  // Upsert in chunks to stay well under request limits.
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const { error } = await admin
      .from("meetings")
      .upsert(chunk, { onConflict: "nztr_day_id" });
    if (error) {
      return {
        ok: false, fetched: events.length, upserted, rangeStart, rangeEnd,
        error: error.message,
      };
    }
    upserted += chunk.length;
  }

  return { ok: true, fetched: events.length, upserted, rangeStart, rangeEnd };
}
