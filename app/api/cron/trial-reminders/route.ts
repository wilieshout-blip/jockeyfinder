import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTrialEnd } from "@/lib/subscription";
import { emailTrialReminder } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, first_name, role, trial_start_date, licence_type, subscriptions!left(status, trial_reminder_sent, stripe_subscription_id)")
      .in("role", ["jockey", "trainer", "owner"]);

    if (!profiles) return NextResponse.json({ sent: 0 });

    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 86_400_000);
    let sent = 0;
    let deliveryFailed = 0;

    for (const profile of profiles) {
      if (profile.licence_type === "trial_jumpout_only") continue; // trial riders are free
      const sub = (profile.subscriptions as unknown as Array<{status: string; trial_reminder_sent: boolean; stripe_subscription_id: string | null}>)?.[0];
      if (sub?.stripe_subscription_id) continue; // already subscribed
      if (sub?.trial_reminder_sent) continue;

      const trialEnd = getTrialEnd(profile.role, profile.trial_start_date);
      if (trialEnd > now && trialEnd <= in3days) {
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86_400_000);
        const delivered = await emailTrialReminder({
          to: profile.email,
          firstName: profile.first_name || "there",
          role: profile.role,
          daysLeft,
          trialEndDate: trialEnd,
        });
        if (!delivered) {
          deliveryFailed++;
          continue;
        }
        await supabase.from("subscriptions").upsert({
          user_id: profile.id,
          trial_reminder_sent: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        sent++;
      }
    }
    return NextResponse.json({ sent, delivery_failed: deliveryFailed });
  } catch (err) {
    console.error("Trial reminders error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
