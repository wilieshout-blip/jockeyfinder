import { NextResponse } from "next/server";
import { syncTabNzRaceCards } from "@/lib/tab-racing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  return Boolean(secret) && authHeader === "Bearer " + secret;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncTabNzRaceCards(3);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
