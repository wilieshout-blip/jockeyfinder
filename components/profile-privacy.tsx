"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  initialShowPhone: boolean;
  initialShowAgentPhone: boolean;
}

type Key = "show_phone" | "show_agent_phone";

function Toggle({
  checked,
  pending,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  pending: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={pending}
        onClick={onChange}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-turf-600" : "bg-zinc-300",
          pending && "opacity-60"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

/** Jockey-only privacy controls for what contact info shows on the public
 * profile. Writes directly to the jockey's own profile row under RLS. */
export function ProfilePrivacy({ userId, initialShowPhone, initialShowAgentPhone }: Props) {
  const [showPhone, setShowPhone] = useState(initialShowPhone);
  const [showAgentPhone, setShowAgentPhone] = useState(initialShowAgentPhone);
  const [pendingKey, setPendingKey] = useState<Key | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function update(key: Key, next: boolean) {
    setErr(null);
    setPendingKey(key);
    if (key === "show_phone") setShowPhone(next);
    else setShowAgentPhone(next);

    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ [key]: next }).eq("id", userId);

    setPendingKey(null);
    if (error) {
      if (key === "show_phone") setShowPhone(!next);
      else setShowAgentPhone(!next);
      setErr("Couldn't save that change. Please try again.");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      <h2 className="font-display text-lg font-semibold text-ink">Contact privacy</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        Control what shows on your public jockey profile. Trainers can always message you
        through the app regardless of these settings.
      </p>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      <div className="mt-2 divide-y divide-line">
        <Toggle
          label="Show my phone number"
          description="Display your own phone number on your public profile."
          checked={showPhone}
          pending={pendingKey === "show_phone"}
          onChange={() => update("show_phone", !showPhone)}
        />
        <Toggle
          label="Show my agent's phone number"
          description="Display your agent's phone number on your profile so trainers can reach them."
          checked={showAgentPhone}
          pending={pendingKey === "show_agent_phone"}
          onChange={() => update("show_agent_phone", !showAgentPhone)}
        />
      </div>
    </section>
  );
}
