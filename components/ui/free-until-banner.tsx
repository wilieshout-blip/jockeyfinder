"use client";

import { BILLING_START_DATE } from "@/lib/stripe";

export function FreeUntilBanner() {
  const now = new Date();
  if (now >= BILLING_START_DATE) return null;
  return (
    <div className="border-b border-gold-300/30 bg-gold-400 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.11em] text-ink">
      JockeyFinder is free for everyone until 1 October 2026 — no credit card required
    </div>
  );
}
