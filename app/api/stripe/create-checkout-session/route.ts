import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, JOCKEY_TRIAL_DAYS } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "jockey") {
    return NextResponse.json(
      { error: "Only jockey accounts have a paid plan" },
      { status: 400 }
    );
  }

  const priceId = process.env.STRIPE_PRICE_ID_JOCKEY;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    new URL(request.url).origin;
  if (!priceId) {
    return NextResponse.json(
      { error: "Billing is not configured yet" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const admin = createAdminClient();

  // Reuse an existing Stripe customer if we have one
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id || null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      name: profile.full_name || undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;

    await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        plan: "jockey_monthly",
        status: "incomplete",
      },
      { onConflict: "user_id" }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: JOCKEY_TRIAL_DAYS,
      metadata: { user_id: user.id },
    },
    allow_promotion_codes: true,
    success_url: `${siteUrl}/dashboard/billing?status=success`,
    cancel_url: `${siteUrl}/dashboard/billing?status=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
