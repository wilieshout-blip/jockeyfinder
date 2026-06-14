"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Marks a jockey attending or not attending a meeting.
 * When marking attending, also joins (or creates) the meeting group chat.
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

    const { error: upsertError } = await supabase.from("meeting_attendance").upsert(
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

    if (upsertError) {
      setBusy(false);
      setError(upsertError.message);
      return;
    }

    // When marking as attending, join (or create) the meeting group chat
    if (next) {
      try {
        await fetch("/api/chats/join-meeting-group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId, userId: jockeyId }),
        });
      } catch {
        // Non-fatal: attendance is saved; chat join failure doesn't block the UI
      }
    }

    setBusy(false);
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
