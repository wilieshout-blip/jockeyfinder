"use client";
import { useState } from "react";

interface Horse {
  id: string;
  name: string;
  sire: string | null;
  dam: string | null;
  nztr_trainer_name: string | null;
}

interface Link {
  id: string;
  status: string;
  horses: Horse;
}

interface Props {
  links: Link[];
  role: "trainer" | "owner";
}

export function HorsePreloadWizard({ links, role }: Props) {
  const pending = links.filter((l) => l.status === "pending");
  const [queue, setQueue] = useState(pending);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || queue.length === 0) return null;

  const apiBase = role === "trainer" ? "/api/horses/trainer-links" : "/api/horses/owner-links";
  const link = queue[current];
  const horse = link.horses;
  const total = queue.length;
  const position = current + 1;

  async function respond(status: "confirmed" | "dismissed") {
    setBusy(true);
    await fetch(`${apiBase}/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (current + 1 >= queue.length) {
      setDismissed(true);
    } else {
      setCurrent((c) => c + 1);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1">
            Horse pre-load — {position} of {total}
          </p>
          <p className="font-display text-lg font-bold text-ink">
            Is <span className="text-turf-700">{horse.name}</span> in your stable?
          </p>
          {(horse.sire || horse.dam) && (
            <p className="mt-0.5 text-sm text-zinc-500">
              {horse.sire && <>By {horse.sire}</>}
              {horse.sire && horse.dam && " · "}
              {horse.dam && <>Dam: {horse.dam}</>}
            </p>
          )}
          {role === "owner" && horse.nztr_trainer_name && (
            <p className="mt-0.5 text-xs text-zinc-400">
              Trainer: {horse.nztr_trainer_name}
            </p>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-zinc-400 hover:text-zinc-600 text-xl leading-none shrink-0 mt-0.5"
          aria-label="Dismiss all"
        >
          ×
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1 rounded-full bg-amber-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-500"
          style={{ width: `${(position / total) * 100}%` }}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => respond("confirmed")}
          disabled={busy}
          className="flex-1 rounded-xl bg-turf-600 py-2.5 text-sm font-semibold text-white hover:bg-turf-700 disabled:opacity-50 transition-colors"
        >
          Yes, it's mine
        </button>
        <button
          onClick={() => respond("dismissed")}
          disabled={busy}
          className="flex-1 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          Not mine
        </button>
      </div>

      {total > 1 && (
        <p className="mt-2 text-center text-xs text-zinc-400">
          {total - position} more horse{total - position !== 1 ? "s" : ""} to review after this
        </p>
      )}
    </div>
  );
}
