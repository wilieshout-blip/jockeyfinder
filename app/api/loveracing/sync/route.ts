import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";
import { syncMeetings } from "@/lib/loveracing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET is for the Vercel cron job. It must carry the shared secret:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncMeetings();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

/**
 * POST is for a signed-in admin triggering a manual sync.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncMeetings();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
