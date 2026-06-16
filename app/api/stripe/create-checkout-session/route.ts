import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, getPriceId, getPlanName, ROLE_TRIAL_DAYS } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, trial_start_date")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const role = profile.role as string;
    const priceId = getPriceId(role);
    if (!priceId) return NextResponse.json({ error: "No subscription required for your account type" }, { status: 400 });

    const stripe = getStripe();

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = sub?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id, role },
      });
      customerId = customer.id;
    }

    const trialDays = ROLE_TRIAL_DAYS[role] ?? 14;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: { user_id: user.id, role, plan: getPlanName(role) },
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?canceled=true`,
      metadata: { user_id: user.id, role },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
