"use client";

import { useState, useEffect, useRef } from "react";
import { addSyndicateHorse } from "@/app/dashboard/syndicates/actions";

interface Result {
  id: string;
  name: string;
  sire: string | null;
  dam: string | null;
}

export function SyndicateHorseAdder({
  groupId,
  existingIds,
}: {
  groupId: string;
  existingIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/horses/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-turf-700 hover:bg-mist"
      >
        + Add horse
      </button>
    );
  }

  return (
    <div className="w-full">
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search horse name…"
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-turf-400"
      />
      {results.length > 0 && (
        <div className="mt-2 max-h-48 divide-y divide-line overflow-y-auto overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          {results.map((r) => {
            const already = existingIds.includes(r.id);
            return (
              <form key={r.id} action={addSyndicateHorse} className="flex items-center justify-between gap-3 px-3 py-2">
                <input type="hidden" name="group_id" value={groupId} />
                <input type="hidden" name="horse_id" value={r.id} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                  {(r.sire || r.dam) && (
                    <p className="truncate text-xs text-zinc-400">
                      {r.sire ? `By ${r.sire}` : ""}{r.sire && r.dam ? " · " : ""}{r.dam ? `Dam ${r.dam}` : ""}
                    </p>
                  )}
                </div>
                <button
                  disabled={already}
                  className="shrink-0 rounded-lg bg-turf-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-turf-700 disabled:opacity-40"
                >
                  {already ? "Added" : "Add"}
                </button>
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}
