"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setMeetingAttendance } from "./actions";

interface Props {
  meetingId: string;
  initialAttending: boolean;
}

/** Lets a logged-in jockey mark / unmark that they are attending this meeting. */
export function AttendanceToggle({ meetingId, initialAttending }: Props) {
  const [attending, setAttending] = useState(initialAttending);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle() {
    const next = !attending;
    setErr(null);
    startTransition(async () => {
      const res = await setMeetingAttendance({ meetingId, attending: next });
      if (res.success) setAttending(next);
      else setErr(res.error ?? "Something went wrong");
    });
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={attending}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
          attending
            ? "bg-turf-100 text-turf-700 hover:bg-turf-200"
            : "bg-ink text-white hover:bg-zinc-700 active:bg-zinc-800",
          pending && "cursor-not-allowed opacity-60"
        )}
      >
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
        {pending ? "Saving…" : attending ? "You're attending" : "I'm attending"}
      </button>
      {attending && !pending ? (
        <p className="text-center text-[11px] text-zinc-400">Tap to remove your attendance</p>
      ) : null}
      {err ? <p className="text-center text-[11px] text-red-500">{err}</p> : null}
    </div>
  );
}
