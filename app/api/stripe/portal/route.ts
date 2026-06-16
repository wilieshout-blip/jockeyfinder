import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST(_req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!sub?.stripe_customer_id)
      return NextResponse.json({ error: "No billing account found" }, { status: 404 });

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
