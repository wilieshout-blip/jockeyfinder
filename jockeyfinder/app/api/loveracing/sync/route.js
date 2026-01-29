import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseDotNetDate(dotNetDateStr) {
  // "/Date(1767178800000)/" -> "2026-01-01" (example)
  const match = String(dotNetDateStr || "").match(/Date\((\d+)\)/);
  if (!match) return null;
  const ms = Number(match[1]);
  if (Number.isNaN(ms)) return null;

  const d = new Date(ms);
  // format YYYY-MM-DD in UTC
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { ok: false, error: "Missing start or end query params" },
        { status: 400 }
      );
    }

    // Server-side Supabase client (service role, not anon)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Call LoveRacing calendar endpoint (server-side, so CORS is not an issue)
    const lrRes = await fetch(
      "https://loveracing.nz/ServerScript/RaceInfo.aspx/GetCalendarEvents",
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ start, end }),
      }
    );

    // LoveRacing returns JSON like: { d: "[{...},{...}]" }
    const raw = await lrRes.json();
    const list = JSON.parse(raw?.d || "[]");

    // Map into your meetings table fields.
    // IMPORTANT: this assumes you have these columns:
    // meetings.nztr_day_id (unique), meetings.meeting_date, meetings.track, meetings.club
    const rows = (list || [])
      .map((e) => {
        const nztrDayId = e.DayID ? Number(e.DayID) : null;
        const meetingDate = parseDotNetDate(e.RaceDate);
        const track = e.Racecourse || e.TrackAppName || e.RacecourseName || null;
        const club = e.Club || null;

        if (!nztrDayId || !meetingDate || !track) return null;

        return {
          nztr_day_id: nztrDayId,
          meeting_date: meetingDate,
          track,
          club,
          source: "loveracing",
        };
      })
      .filter(Boolean);

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, note: "No rows found" });
    }

    // Upsert into Supabase
    const { error, data } = await admin
      .from("meetings")
      .upsert(rows, { onConflict: "nztr_day_id" })
      .select("nztr_day_id");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inserted: data?.length || 0 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e.message || "Unknown error" },
      { status: 500 }
    );
  }
}
