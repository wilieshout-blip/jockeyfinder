"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncNow } from "./actions";
import type { SyncResult } from "@/lib/loveracing";

export function SyncButton() {
  const [result, setResult] = useState<SyncResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const r = await syncNow();
        setResult(r);
      } catch {
        setResult({
          ok: false,
          fetched: 0,
          upserted: 0,
          rangeStart: "",
          rangeEnd: "",
          error: "Sync failed. Check the server logs.",
        });
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={run} disabled={pending} variant="accent" size="sm">
        {pending ? "Syncing..." : "Sync meetings now"}
      </Button>
      {result ? (
        result.ok ? (
          <p className="text-sm text-turf-700">
            Synced {result.upserted} meetings ({result.rangeStart} to{" "}
            {result.rangeEnd}).
          </p>
        ) : (
          <p className="text-sm text-red-700">
            Sync failed: {result.error ?? "unknown error"}
          </p>
        )
      ) : null}
    </div>
  );
}
