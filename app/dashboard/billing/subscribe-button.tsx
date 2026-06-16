"use client";

import { useState } from "react";
import { ROLE_PRICE_DISPLAY } from "@/lib/stripe";

export function SubscribeButton({ role }: { role: string }) {
  const [loading, setLoading] = useState(false);
  const price = ROLE_PRICE_DISPLAY[role] ?? "";

  const handleClick = async () => {
    setLoading(true);
    const res = await fetch("/api/stripe/create-checkout-session", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
    >
      {loading ? "Redirecting…" : `Subscribe${price ? " — " + price : ""}`}
    </button>
  );
}
