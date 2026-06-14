"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

interface RaceEntry {
  id: string;
  horse_name: string;
  race_number: number;
  jockey_name: string | null;
  trainer_name: string | null;
  owner_text: string | null;
  meetings: {
    meeting_date: string;
    track: string;
  } | null;
}

interface Claim {
  id: string;
  race_entry_id: string;
  status: string;
  race_entries: RaceEntry | null;
}

interface OwnerHorseClaimProps {
  claims: Claim[];
}

export function OwnerHorseClaim({ claims: initialClaims }: OwnerHorseClaimProps) {
  const [claims, setClaims] = useState(initialClaims.filter((c) => c.status === "pending"));
  const [isPending, startTransition] = useTransition();

  async function respond(claimId: string, action: "confirmed" | "dismissed") {
    const supabase = createClient();
    await supabase
      .from("owner_horse_claims")
      .update({ status: action })
      .eq("id", claimId);

    startTransition(() => {
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
    });
  }

  if (claims.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {claims.map((claim) => {
        const entry = claim.race_entries;
        if (!entry) return null;
        const meeting = entry.meetings;
        const date = meeting?.meeting_date
          ? new Date(meeting.meeting_date).toLocaleDateString("en-NZ", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })
          : null;

        return (
          <div
            key={claim.id}
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-0.5">
                Is this your horse?
              </p>
              <p className="font-semibold text-ink text-base leading-tight">
                {entry.horse_name}
              </p>
              {meeting && (
                <p className="text-sm text-zinc-500 mt-0.5">
                  Race {entry.race_number}
                  {date ? ` · ${date}` : ""}
                  {meeting.track ? ` · ${meeting.track}` : ""}
                </p>
              )}
              {entry.owner_text && (
                <p className="text-xs text-zinc-400 mt-1 truncate">
                  Listed as: {entry.owner_text}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                disabled={isPending}
                onClick={() => respond(claim.id, "confirmed")}
                className="px-4 py-2 rounded-lg bg-turf-600 text-white text-sm font-semibold hover:bg-turf-700 disabled:opacity-50"
              >
                Yes, it's mine
              </button>
              <button
                disabled={isPending}
                onClick={() => respond(claim.id, "dismissed")}
                className="px-4 py-2 rounded-lg bg-white border border-zinc-200 text-zinc-600 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >
                Not mine
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
