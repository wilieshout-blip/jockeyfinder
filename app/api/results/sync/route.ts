/**
 * app/api/results/sync/route.ts
 *
 * POST: sync results for one meeting by nztr_day_id
 * GET: backfill last N days of past meetings (Vercel cron)
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAndSyncMeetingResults } from "@/lib/loveracing-results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const legacyHeader = req.headers.get("x-cron-secret");
  if (legacyHeader === cronSecret) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { nztr_day_id?: number } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { nztr_day_id } = body;
  if (!nztr_day_id) return NextResponse.json({ error: "nztr_day_id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: meeting, error: mErr } = await admin
    .from("meetings").select("id, meeting_date, meeting_type")
    .eq("nztr_day_id", nztr_day_id).maybeSingle();

  if (mErr || !meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

  const today = new Date().toISOString().split("T")[0];
  if (meeting.meeting_date >= today) return NextResponse.json({ ok: false, skipped: "Future meeting" });
  if (meeting.meeting_type === "T") return NextResponse.json({ ok: false, skipped: "Trial" });

  const result = await fetchAndSyncMeetingResults(nztr_day_id, meeting.id, meeting.meeting_date);
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("backfill_days") ?? "7", 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const admin = createAdminClient();
  const { data: meetings, error } = await admin.from("meetings")
    .select("id, nztr_day_id, meeting_date").lt("meeting_date", today)
    .gte("meeting_date", cutoffStr).neq("meeting_type", "T")
    .not("nztr_day_id", "is", null).order("meeting_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{nztr_day_id: number; date: string; ok: boolean; count: number}> = [];
  for (const m of meetings ?? []) {
    if (!m.nztr_day_id) continue;
    const r = await fetchAndSyncMeetingResults(m.nztr_day_id, m.id, m.meeting_date);
    results.push({ nztr_day_id: m.nztr_day_id, date: m.meeting_date, ok: r.ok, count: r.results });
    await new Promise(res => setTimeout(res, 400));
  }
  return NextResponse.json({ synced: results.length, results });
}
