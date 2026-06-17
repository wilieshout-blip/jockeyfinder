import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTrialEnd } from "@/lib/subscription";
import { emailTrialReminder } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, first_name, role, trial_start_date, subscriptions!left(status, trial_reminder_sent, stripe_subscription_id)")
      .in("role", ["jockey", "trainer", "owner"]);

    if (!profiles) return NextResponse.json({ sent: 0 });

    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 86_400_000);
    let sent = 0;

    for (const profile of profiles) {
      const sub = (profile.subscriptions as unknown as Array<{status: string; trial_reminder_sent: boolean; stripe_subscription_id: string | null}>)?.[0];
      if (sub?.stripe_subscription_id) continue; // already subscribed
      if (sub?.trial_reminder_sent) continue;

      const trialEnd = getTrialEnd(profile.role, profile.trial_start_date);
      if (trialEnd > now && trialEnd <= in3days) {
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86_400_000);
        await emailTrialReminder({
          to: profile.email,
          firstName: profile.first_name || "there",
          role: profile.role,
          daysLeft,
          trialEndDate: trialEnd,
        });
        await supabase.from("subscriptions").upsert({
          user_id: profile.id,
          trial_reminder_sent: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        sent++;
      }
    }
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("Trial reminders error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
