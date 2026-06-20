/**
 * app/api/stats/sync-jockeys/route.ts
 *
 * Checks the jockey_season_stats aggregate view. The view calculates current
 * season totals directly from race_results, so no destructive rebuild is
 * required. GET is cron-compatible and POST is available to admins.
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

  const { count, error } = await admin
    .from("jockey_season_stats")
    .select("jockey_name", { count: "exact", head: true });

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    jockeys: count ?? 0,
    season_start: seasonStart,
  };
}

/** GET — Vercel cron (Authorization: Bearer <CRON_SECRET>) */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
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
