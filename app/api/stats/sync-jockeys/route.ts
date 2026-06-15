/**
 * app/api/stats/sync-jockeys/route.ts
 *
 * Aggregates jockey season stats from race_results and rebuilds
 * jockey_season_stats. Runs as a Vercel cron (GET) or admin POST.
 *
 * The NZ racing season runs Aug 1 - Jul 31 each year.
 * Stats are computed from race_results.position for the current season.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** YYYY-MM-DD for the first day of the current NZ racing season (Aug 1). */
function nzSeasonStart(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" })
  );
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-08-01`;
}

async function computeAndSave() {
  const admin = createAdminClient();
  const seasonStart = nzSeasonStart();

  // All results for this season (we need every row to count total rides)
  const { data: allRows, error: err } = await admin
    .from("race_results")
    .select("jockey_name, position")
    .gte("race_date", seasonStart)
    .not("jockey_name", "is", null);

  if (err) return { ok: false, error: err.message };

  // Aggregate per jockey
  const agg = new Map<string, { total_rides: number; wins: number; places: number }>();
  for (const r of allRows ?? []) {
    if (!r.jockey_name) continue;
    if (!agg.has(r.jockey_name))
      agg.set(r.jockey_name, { total_rides: 0, wins: 0, places: 0 });
    const s = agg.get(r.jockey_name)!;
    s.total_rides++;
    if (r.position === 1) s.wins++;
    if (r.position <= 3) s.places++;
  }

  const rows = Array.from(agg.entries()).map(([jockey_name, s]) => ({
    jockey_name,
    total_rides: s.total_rides,
    wins: s.wins,
    places: s.places,
    win_pct:
      s.total_rides > 0
        ? Math.round((s.wins / s.total_rides) * 1000) / 10
        : 0,
  }));

  // Rebuild table: clear all existing rows then insert fresh data
  const { error: delErr } = await admin
    .from("jockey_season_stats")
    .delete()
    .not("jockey_name", "is", null); // matches every non-null row

  if (delErr) return { ok: false, error: `Clear failed: ${delErr.message}` };

  if (rows.length > 0) {
    const { error: insertErr } = await admin
      .from("jockey_season_stats")
      .insert(rows);
    if (insertErr)
      return { ok: false, error: `Insert failed: ${insertErr.message}` };
  }

  return {
    ok: true,
    jockeys: rows.length,
    season_start: seasonStart,
    source_rows: allRows?.length ?? 0,
  };
}

/** GET — Vercel cron (Authorization: Bearer <CRON_SECRET>) */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await computeAndSave();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

/** POST — admin manual trigger from dashboard */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await computeAndSave();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
