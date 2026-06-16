"use client";

import { BILLING_START_DATE } from "@/lib/stripe";

export function FreeUntilBanner() {
  const now = new Date();
  if (now >= BILLING_START_DATE) return null;
  return (
    <div className="bg-emerald-600 text-white text-center py-2 px-4 text-sm font-medium">
      JockeyFinder is free for everyone until 1 October 2026 — no credit card required
    </div>
  );
}
