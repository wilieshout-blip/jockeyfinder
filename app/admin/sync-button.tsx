"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncNow } from "./actions";
import type { ManualSyncResult } from "./actions";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d !== 1 ? "s" : ""} ago`;
}

export function SyncButton({
  lastSyncedAt,
  source,
}: {
  lastSyncedAt?: string | null;
  source?: string | null;
}) {
  const [result, setResult] = useState<ManualSyncResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const r = await syncNow();
        setResult(r);
      } catch {
        setResult({
          ok: false,
          meetings: {
            ok: false,
            fetched: 0,
            upserted: 0,
            rangeStart: "",
            rangeEnd: "",
            error: "Sync failed. Check the server logs.",
          },
          races: { ok: false, synced: 0, meetings: 0, error: "Not run" },
          entries: { ok: false, synced: 0, meetings: 0, error: "Not run" },
          tab: {
            ok: false,
            synced: 0,
            meetings: 0,
            races: 0,
            entries: 0,
            registryPeople: 0,
            error: "Not run",
          },
        });
      }
    });
  }

  const error =
    result?.tab.error ||
    result?.tab.errors?.[0] ||
    result?.meetings.error ||
    result?.races.error ||
    result?.entries.error ||
    result?.races.errors?.[0] ||
    result?.entries.errors?.[0];

  return (
    <div className="space-y-2">
      <Button onClick={run} disabled={pending} variant="accent" size="sm">
        {pending ? "Syncing..." : "Sync meetings now"}
      </Button>
      {lastSyncedAt ? (
        <p className="text-xs text-zinc-500">
          Last synced {timeAgo(lastSyncedAt)}
          {source === "github" ? " (auto · cloud)" : source === "local" ? " (auto)" : ""}
        </p>
      ) : null}
      {result ? (
        result.ok ? (
          <div className="text-sm text-turf-700">
            <p>
              Synced {result.tab.meetings || result.meetings.upserted} meetings,{" "}
              {result.tab.races || result.races.synced} races and{" "}
              {result.tab.entries || result.entries.synced} runners.
            </p>
            <p className="text-xs text-zinc-500">
              Added {result.tab.registryPeople} trainer/jockey directory names.
              {result.meetings.error ? " LoveRacing is blocked, so TAB NZ was used." : ""}
            </p>
          </div>
        ) : (
          <p className="text-sm text-red-700">
            Sync failed: {error ?? "unknown error"}
          </p>
        )
      ) : null}
    </div>
  );
}
