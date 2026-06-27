"use client";

import { useState } from "react";
import { broadcastRideVacancy } from "@/app/dashboard/requests/actions";

/** S.O.S. button for verified trainers on a meeting page. */
export function RideVacancyButton({ meetingId }: { meetingId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
      >
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
        Broadcast ride vacancy (S.O.S.)
      </button>
    );
  }

  return (
    <form
      action={broadcastRideVacancy}
      className="space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3"
    >
      <input type="hidden" name="meeting_id" value={meetingId} />
      <input
        name="race_number"
        type="number"
        min="1"
        max="14"
        placeholder="Race # (optional)"
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
      />
      <input
        name="note"
        placeholder="Short note (optional)"
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <button className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
          Alert attending jockeys
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700"
        >
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">
        Emails (and texts, if set up) every verified jockey marked attending who isn&apos;t already booked here.
      </p>
    </form>
  );
}
