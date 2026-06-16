import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export const BILLING_START_DATE = new Date("2026-09-30T11:00:00.000Z");

export const ROLE_TRIAL_DAYS: Record<string, number> = {
  jockey: 14,
  trainer: 30,
  owner: 30,
};

export const ROLE_PRICE_DISPLAY: Record<string, string> = {
  jockey: "$20 NZD/week",
  trainer: "$5 NZD/week",
  owner: "$2 NZD/week",
};

export function getPriceId(role: string): string | undefined {
  switch (role) {
    case "jockey":
      return process.env.STRIPE_PRICE_ID_JOCKEY;
    case "trainer":
      return process.env.STRIPE_PRICE_ID_TRAINER;
    case "owner":
      return process.env.STRIPE_PRICE_ID_OWNER;
    default:
      return undefined;
  }
}

export function getPlanName(role: string): string {
  return role + "_weekly";
}
