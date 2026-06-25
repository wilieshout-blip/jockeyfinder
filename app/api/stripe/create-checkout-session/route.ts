import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, getPriceId, getPlanName, ROLE_TRIAL_DAYS } from "@/lib/stripe";
import { SITE_URL } from "@/lib/supabase/config";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, trial_start_date, licence_type, apprentice")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const role = profile.role as string;
    const priceId = getPriceId(role);
    if (role === "agent" || role === "admin") {
      return NextResponse.json(
        { error: "No subscription is required for your account type." },
        { status: 400 }
      );
    }
    // Trial-jumpout-only riders are free — no subscription needed.
    if (profile.licence_type === "trial_jumpout_only") {
      return NextResponse.json(
        { error: "Trial riders use JockeyFinder for free — no subscription is required." },
        { status: 400 }
      );
    }
    if (!priceId || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Billing is not available yet. No payment is required during the free period." },
        { status: 503 }
      );
    }

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

    // Apprentice jockeys get a standing discount via a Stripe coupon, if one is
    // configured. (Create the coupon in Stripe and set STRIPE_APPRENTICE_COUPON_ID.)
    const apprenticeCoupon = process.env.STRIPE_APPRENTICE_COUPON_ID;
    const applyApprenticeDiscount =
      role === "jockey" && profile.apprentice === true && !!apprenticeCoupon;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      ...(applyApprenticeDiscount
        ? { discounts: [{ coupon: apprenticeCoupon! }] }
        : {}),
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          user_id: user.id,
          role,
          plan: getPlanName(role),
          apprentice: applyApprenticeDiscount ? "true" : "false",
        },
      },
      success_url: `${SITE_URL}/dashboard/billing?success=true`,
      cancel_url: `${SITE_URL}/dashboard/billing?canceled=true`,
      metadata: { user_id: user.id, role },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
