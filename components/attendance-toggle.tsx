"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Marks a jockey attending or not attending a meeting.
 * Saves a snapshot of weight and claim at the moment attendance is marked.
 * Agents pass the managed jockey's id and profile.
 */
export function AttendanceToggle({
  meetingId,
  jockeyId,
  attending,
  snapshot,
}: {
  meetingId: string;
  jockeyId: string;
  attending: boolean;
  snapshot: {
    riding_weight: number | null;
    apprentice: boolean;
    apprentice_claim: number | null;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const next = !attending;

    const { error } = await supabase.from("meeting_attendance").upsert(
      {
        meeting_id: meetingId,
        user_id: jockeyId,
        attending: next,
        riding_weight_snapshot: snapshot.riding_weight,
        apprentice_snapshot: snapshot.apprentice,
        apprentice_claim_snapshot: snapshot.apprentice_claim,
      },
      { onConflict: "meeting_id,user_id" }
    );

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={attending ? "outline" : "accent"}
        onClick={toggle}
        disabled={busy}
      >
        {busy ? "Saving..." : attending ? "Attending ✓" : "Mark attending"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
