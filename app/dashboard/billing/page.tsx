import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubscribeButton } from "./subscribe-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import type { Profile, Subscription } from "@/lib/types";

function nzDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_TONES: Record<string, "turf" | "amber" | "red" | "neutral"> = {
  active: "turf",
  trialing: "turf",
  past_due: "amber",
  canceled: "red",
  unpaid: "red",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!me) redirect("/login");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Subscription>();

  const hasActive =
    sub?.status === "active" || sub?.status === "trialing";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
          Billing
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Your plan
        </h1>
      </div>

      {searchParams.status === "success" ? (
        <div className="mb-4 rounded-2xl border border-turf-200 bg-turf-50 p-4 text-sm text-turf-800">
          You are all set. Stripe will confirm your subscription in a moment;
          refresh if the status below has not updated yet.
        </div>
      ) : null}
      {searchParams.status === "cancelled" ? (
        <div className="mb-4 rounded-2xl border border-line bg-mist p-4 text-sm text-zinc-600">
          Checkout cancelled. No charge was made.
        </div>
      ) : null}

      {me.role === "jockey" ? (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Jockey membership
                </h2>
                <p className="text-sm text-zinc-500">
                  Full access to ride requests, attendance, and messaging.
                </p>
              </div>
              {sub?.status ? (
                <Badge tone={STATUS_TONES[sub.status] ?? "neutral"} className="capitalize">
                  {sub.status}
                </Badge>
              ) : (
                <Badge tone="neutral">Not subscribed</Badge>
              )}
            </div>

            <div className="rounded-xl bg-mist p-4">
              <p className="font-display text-3xl font-semibold text-ink">
                $40 <span className="text-base font-normal text-zinc-500">NZD / month</span>
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                Starts with a 100 day free trial. Cancel any time during the
                trial and you will not be charged.
              </p>
            </div>

            {hasActive ? (
              <dl className="space-y-2 text-sm">
                {sub?.trial_end && sub.status === "trialing" ? (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Free trial ends</dt>
                    <dd className="font-medium text-ink">{nzDate(sub.trial_end)}</dd>
                  </div>
                ) : null}
                {sub?.current_period_end ? (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Current period ends</dt>
                    <dd className="font-medium text-ink">
                      {nzDate(sub.current_period_end)}
                    </dd>
                  </div>
                ) : null}
                <p className="pt-2 text-xs text-zinc-500">
                  Manage or cancel your subscription from the receipt emails
                  Stripe sends you.
                </p>
              </dl>
            ) : (
              <SubscribeButton />
            )}
          </CardBody>
        </Card>
      ) : null}

      {me.role === "agent" ? (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-ink">
                Agent membership
              </h2>
              {sub?.status === "active" ? (
                <Badge tone="turf">Active</Badge>
              ) : (
                <Badge tone="neutral">Price on negotiation</Badge>
              )}
            </div>
            <p className="text-sm text-zinc-600">
              Agent pricing depends on how many jockeys you manage, so it is
              agreed directly with the JockeyFinder team rather than through
              self serve checkout. Once agreed, an admin activates your
              account here.
            </p>
            <p className="text-sm text-zinc-600">
              Get in touch via the email on your welcome message to set this up.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {me.role === "trainer" || me.role === "owner" ? (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-ink">
                Free plan
              </h2>
              <Badge tone="turf">Included</Badge>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              {me.role === "trainer"
                ? "Trainer accounts are free. View attending jockeys, request rides, assign jockeys, and message them at no cost."
                : "Owner accounts are free. Follow meetings, jockeys, and ride plans at no cost."}
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
