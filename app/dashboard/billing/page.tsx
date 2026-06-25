"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BILLING_START_DATE, ROLE_PRICE_DISPLAY } from "@/lib/stripe";
import { getAccessStatus, daysUntilTrialEnd } from "@/lib/subscription";
import type { AccessStatus } from "@/lib/subscription";

type SubRow = { status: string | null; stripe_subscription_id: string | null; trial_end: string | null; current_period_end: string | null; };

function StatusBadge({ status }: { status: AccessStatus }) {
  const map: Record<AccessStatus, { label: string; cls: string }> = {
    free_period: { label: "Free period", cls: "bg-emerald-100 text-emerald-800" },
    trialing:    { label: "Trial",       cls: "bg-blue-100 text-blue-800" },
    active:      { label: "Active",      cls: "bg-green-100 text-green-800" },
    past_due:    { label: "Past due",    cls: "bg-red-100 text-red-800" },
    expired:     { label: "Expired",     cls: "bg-gray-100 text-gray-800" },
  };
  const { label, cls } = map[status] ?? map.expired;
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export default function BillingPage() {
  const [role, setRole] = useState<string | null>(null);
  const [licenceType, setLicenceType] = useState<string | null>(null);
  const [apprentice, setApprentice] = useState(false);
  const [trialStart, setTrialStart] = useState<string | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("role, trial_start_date, licence_type, apprentice").eq("id", user.id).single(),
        supabase.from("subscriptions").select("status, stripe_subscription_id, trial_end, current_period_end").eq("user_id", user.id).single(),
      ]);
      setRole(p?.role ?? null);
      setLicenceType(p?.licence_type ?? null);
      setApprentice(p?.apprentice ?? false);
      setTrialStart(p?.trial_start_date ?? null);
      setSub(s);
      setLoading(false);
    })();
  }, []);

  const handleSubscribe = async () => {
    setSubLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setActionError(data.error || "Billing is temporarily unavailable.");
    } catch {
      setActionError("Billing is temporarily unavailable.");
    }
    setSubLoading(false);
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setActionError(data.error || "Billing is temporarily unavailable.");
    } catch {
      setActionError("Billing is temporarily unavailable.");
    }
    setPortalLoading(false);
  };

  if (loading) return <div className="p-8 text-gray-500">Loading billing info…</div>;
  if (!role) return null;

  const now = new Date();
  const isFreePeriod = now < BILLING_START_DATE;
  const isTrialRider = licenceType === "trial_jumpout_only";
  const isFreeRole = role === "agent" || role === "admin" || isTrialRider;
  const price = ROLE_PRICE_DISPLAY[role] ?? "";
  const accessStatus = getAccessStatus({ role, trialStartDate: trialStart, stripeStatus: sub?.status ?? null, licenceType });
  const daysLeft = daysUntilTrialEnd(role, trialStart);
  const hasStripeSub = !!sub?.stripe_subscription_id;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Billing</h1>

      {isFreePeriod && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-emerald-800 font-semibold">JockeyFinder is free until 1 October 2026</p>
          <p className="text-emerald-700 text-sm mt-1">No credit card needed during the free period.</p>
        </div>
      )}

      {isFreeRole ? (
        <div className="p-6 bg-gray-50 rounded-lg border">
          <p className="font-semibold">{isTrialRider ? "Trial rider account" : `${role.charAt(0).toUpperCase() + role.slice(1)} account`}</p>
          <p className="text-gray-600 mt-1">
            {isTrialRider
              ? "Trial riders use JockeyFinder for free — no subscription needed."
              : "Your account type is always free."}
          </p>
        </div>
      ) : (
        <>
          <div className="p-6 border rounded-lg mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-semibold capitalize">{role} plan</p>
                <p className="text-gray-500 text-sm">{price}</p>
                {role === "jockey" && apprentice ? (
                  <p className="mt-1 inline-block rounded-full bg-turf-50 px-2 py-0.5 text-xs font-semibold text-turf-700">
                    Apprentice discount applied at checkout
                  </p>
                ) : null}
              </div>
              <StatusBadge status={accessStatus} />
            </div>

            {accessStatus === "trialing" && !hasStripeSub && daysLeft > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                <p className="text-amber-800 font-medium">Trial ends in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</p>
                <p className="text-amber-700 mt-0.5">Add a payment method to keep access after your trial.</p>
              </div>
            )}
            {(accessStatus === "past_due" || accessStatus === "expired") && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-800 font-medium">{accessStatus === "past_due" ? "Payment failed" : "Trial expired"}</p>
                <p className="text-red-700 mt-0.5">
                  {accessStatus === "past_due" ? "Update your payment method to restore access." : "Subscribe to regain access."}
                </p>
              </div>
            )}
          </div>

          {actionError ? (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {actionError}
            </p>
          ) : null}

          {isFreePeriod && !hasStripeSub ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Subscription setup will be available before the free period ends.
              No action is required now.
            </div>
          ) : hasStripeSub ? (
            <button onClick={handlePortal} disabled={portalLoading}
              className="w-full py-3 px-6 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {portalLoading ? "Opening…" : "Manage subscription →"}
            </button>
          ) : (
            <button onClick={handleSubscribe} disabled={subLoading}
              className="w-full py-3 px-6 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
              {subLoading ? "Redirecting…" : `Subscribe — ${price}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
