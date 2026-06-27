"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

/**
 * Weight changes daily, so this lives front and centre on the jockey
 * dashboard. Updates riding_weight and apprentice_claim on the profile.
 */
export function QuickWeightForm({
  userId,
  ridingWeight,
  apprentice,
  apprenticeClaim,
}: {
  userId: string;
  ridingWeight: number | null;
  apprentice: boolean;
  apprenticeClaim: number | null;
}) {
  const router = useRouter();
  const [weight, setWeight] = useState(ridingWeight?.toString() ?? "");
  const [claim, setClaim] = useState(apprenticeClaim?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  async function save(force = false) {
    const w = weight ? Number(weight) : null;
    // Typo guard: plausible riding weights sit between ~30 and ~75kg. Anything
    // outside that is almost certainly a mistype (e.g. 5, 545, 150). Ask before
    // saving — don't show the thresholds, and don't hard-block.
    if (w !== null && !force && (Number.isNaN(w) || w < 30 || w > 75)) {
      setConfirm(`${weight}kg looks unusual for a riding weight. Is that right?`);
      setError(null);
      setSaved(false);
      return;
    }
    setConfirm(null);
    setBusy(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        riding_weight: weight ? Number(weight) : null,
        apprentice_claim: apprentice && claim ? Number(claim) : null,
      })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-32">
        <Label htmlFor="qw-weight">Riding weight (kg)</Label>
        <Input
          id="qw-weight"
          type="number"
          step="0.5"
          min="30"
          max="100"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="54.5"
        />
      </div>
      {apprentice ? (
        <div className="w-28">
          <Label htmlFor="qw-claim">Claim (kg)</Label>
          <Input
            id="qw-claim"
            type="number"
            step="0.5"
            min="0"
            max="4"
            inputMode="decimal"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="3"
          />
        </div>
      ) : null}
      <Button onClick={() => save()} disabled={busy} variant="accent">
        {busy ? "Saving..." : "Update"}
      </Button>
      {saved ? <p className="text-sm font-medium text-turf-700">Saved</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {confirm ? (
        <div className="flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="flex-1 text-sm text-amber-800">{confirm}</p>
          <button
            type="button"
            onClick={() => save(true)}
            className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Yes, save it
          </button>
          <button
            type="button"
            onClick={() => setConfirm(null)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-700"
          >
            Edit
          </button>
        </div>
      ) : null}
    </div>
  );
}
