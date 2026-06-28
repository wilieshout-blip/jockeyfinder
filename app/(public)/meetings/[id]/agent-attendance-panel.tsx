"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setMeetingAttendance } from "./actions";

interface Rider {
  id: string;
  name: string;
  attending: boolean;
}

/**
 * Lets an approved agent mark attendance on this meeting for any of their
 * managed riders. Works on trial days too (which have no race entries), so an
 * agent can still flag that a rider is going to the trials.
 */
export function AgentAttendancePanel({
  meetingId,
  riders,
}: {
  meetingId: string;
  riders: Rider[];
}) {
  const [state, setState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(riders.map((r) => [r.id, r.attending]))
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(rider: Rider) {
    const next = !state[rider.id];
    setErr(null);
    setPendingId(rider.id);
    startTransition(async () => {
      const res = await setMeetingAttendance({
        meetingId,
        attending: next,
        jockeyId: rider.id,
      });
      if (res.success) setState((s) => ({ ...s, [rider.id]: next }));
      else setErr(res.error ?? "Something went wrong");
      setPendingId(null);
    });
  }

  if (riders.length === 0) return null;

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
        Mark attendance for your riders
      </p>
      <div className="space-y-1.5">
        {riders.map((rider) => {
          const attending = state[rider.id];
          const pending = pendingId === rider.id;
          return (
            <button
              key={rider.id}
              type="button"
              onClick={() => toggle(rider)}
              disabled={pending}
              aria-pressed={attending}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                attending
                  ? "bg-turf-100 text-turf-700 hover:bg-turf-200"
                  : "bg-mist text-zinc-700 hover:bg-zinc-200",
                pending && "cursor-not-allowed opacity-60"
              )}
            >
              <span className="truncate">{rider.name}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs">
                {attending && !pending ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6.5l2.5 2.5 4.5-5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                ) : null}
                {pending ? "Saving…" : attending ? "Attending" : "Mark in"}
              </span>
            </button>
          );
        })}
      </div>
      {err ? <p className="text-[11px] text-red-500">{err}</p> : null}
    </div>
  );
}
