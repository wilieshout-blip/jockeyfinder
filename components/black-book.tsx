"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface BlackBookEntry {
  id: string;
  horse_id: string | null;
  horse_name: string;
}

interface SearchResult {
  id: string;
  name: string;
  sire: string | null;
  dam: string | null;
}

/** A jockey/agent's private black book of horses. Reads/writes black_book
 * directly under RLS. */
export function BlackBook({
  userId,
  initialEntries,
}: {
  userId: string;
  initialEntries: BlackBookEntry[];
}) {
  const supabase = useRef(createClient()).current;
  const [entries, setEntries] = useState<BlackBookEntry[]>(initialEntries);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
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

  async function add(r: SearchResult) {
    setErr(null);
    setBusy(r.id);
    const { data, error } = await supabase
      .from("black_book")
      .insert({ user_id: userId, horse_id: r.id, horse_name: r.name })
      .select("id, horse_id, horse_name")
      .single();
    setBusy(null);
    if (error) {
      setErr(/duplicate|unique/i.test(error.message) ? "That horse is already in your black book." : "Could not add that horse.");
      return;
    }
    if (data) setEntries((p) => [...p, data as BlackBookEntry]);
    setQuery("");
    setResults([]);
    setShowSearch(false);
  }

  async function remove(id: string) {
    setBusy(id);
    await supabase.from("black_book").delete().eq("id", id);
    setEntries((p) => p.filter((e) => e.id !== id));
    setBusy(null);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display font-semibold text-ink">Black book</h2>
          <p className="mt-0.5 text-xs text-zinc-400">Horses you want to track — we&apos;ll flag when they&apos;re entered to race.</p>
        </div>
        <button
          onClick={() => { setShowSearch((s) => !s); setErr(null); }}
          className="flex items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          + Add horse
        </button>
      </div>

      {showSearch && (
        <div className="border-b border-line bg-zinc-50 px-5 py-4">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search horse name…"
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-turf-400"
          />
          {results.length > 0 && (
            <div className="mt-2 max-h-52 divide-y divide-line overflow-y-auto overflow-hidden rounded-xl border border-line bg-white shadow-sm">
              {results.map((r) => {
                const already = entries.some((e) => e.horse_id === r.id || e.horse_name.toLowerCase() === r.name.toLowerCase());
                return (
                  <button
                    key={r.id}
                    onClick={() => add(r)}
                    disabled={!!busy || already}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 disabled:opacity-40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                      {(r.sire || r.dam) && (
                        <p className="truncate text-xs text-zinc-400">{r.sire ? `By ${r.sire}` : ""}{r.sire && r.dam ? " · " : ""}{r.dam ? `Dam ${r.dam}` : ""}</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-turf-600">{already ? "Added" : "Add"}</span>
                  </button>
                );
              })}
            </div>
          )}
          {query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-2 py-2 text-center text-sm text-zinc-400">No horses found for &ldquo;{query.trim()}&rdquo;</p>
          )}
        </div>
      )}

      {err ? <p className="border-b border-line bg-red-50 px-5 py-2.5 text-sm text-red-600">{err}</p> : null}

      {entries.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-zinc-400">No horses in your black book yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <p className="truncate text-sm font-medium text-ink">{e.horse_name}</p>
              <button
                onClick={() => remove(e.id)}
                disabled={busy === e.id}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40"
              >
                {busy === e.id ? "…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
