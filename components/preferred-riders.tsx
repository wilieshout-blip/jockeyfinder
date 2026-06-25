"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { ClothChip } from "@/components/ui/badge";
import { formatClaim, formatWeight } from "@/lib/utils";

const MAX_PREFERRED = 5;

export interface PreferredJockey {
  id: string; // trainer_preferred_jockeys row id
  jockey_id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  riding_weight: number | null;
  apprentice: boolean;
  apprentice_claim: number | null;
}

interface SearchResult {
  id: string; // jockey profile id
  full_name: string | null;
  profile_photo_url: string | null;
  riding_weight: number | null;
  apprentice: boolean;
  apprentice_claim: number | null;
}

interface Props {
  trainerId: string;
  initialPreferred: PreferredJockey[];
}

/**
 * Trainer-managed shortlist of up to 5 preferred riders. Reads/writes
 * trainer_preferred_jockeys directly under RLS (trainer manages own rows);
 * the 5-cap is enforced by a DB trigger, mirrored here for the UI.
 */
export function PreferredRiders({ trainerId, initialPreferred }: Props) {
  const supabase = useRef(createClient()).current;
  const [preferred, setPreferred] = useState<PreferredJockey[]>(initialPreferred);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const atCap = preferred.length >= MAX_PREFERRED;

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from("public_profiles")
        .select("id, full_name, profile_photo_url, riding_weight, apprentice, apprentice_claim")
        .eq("role", "jockey")
        .ilike("full_name", `%${query.trim()}%`)
        .order("full_name", { ascending: true })
        .limit(8);
      setResults((data as SearchResult[]) ?? []);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, supabase]);

  async function addJockey(j: SearchResult) {
    setErr(null);
    setAdding(j.id);
    const { data, error } = await supabase
      .from("trainer_preferred_jockeys")
      .insert({ trainer_id: trainerId, jockey_id: j.id })
      .select("id")
      .single();
    setAdding(null);
    if (error) {
      setErr(
        /at most/i.test(error.message)
          ? `You can have at most ${MAX_PREFERRED} preferred riders.`
          : /duplicate|unique/i.test(error.message)
          ? "That rider is already on your shortlist."
          : "Could not add that rider. Please try again."
      );
      return;
    }
    setPreferred((prev) => [
      ...prev,
      {
        id: data!.id,
        jockey_id: j.id,
        full_name: j.full_name,
        profile_photo_url: j.profile_photo_url,
        riding_weight: j.riding_weight,
        apprentice: j.apprentice,
        apprentice_claim: j.apprentice_claim,
      },
    ]);
    setQuery("");
    setResults([]);
    setShowSearch(false);
  }

  async function removeJockey(rowId: string) {
    setErr(null);
    setRemoving(rowId);
    const { error } = await supabase
      .from("trainer_preferred_jockeys")
      .delete()
      .eq("id", rowId);
    setRemoving(null);
    if (error) {
      setErr("Could not remove that rider. Please try again.");
      return;
    }
    setPreferred((prev) => prev.filter((p) => p.id !== rowId));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display font-semibold text-ink">Preferred riders</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            {preferred.length}/{MAX_PREFERRED} · starred &amp; sorted to the top of
            &ldquo;Riding here&rdquo; on every meeting.
          </p>
        </div>
        {!atCap ? (
          <button
            onClick={() => {
              setShowSearch((s) => !s);
              setErr(null);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-turf-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-turf-700"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            Add rider
          </button>
        ) : (
          <span className="rounded-full bg-mist px-3 py-1 text-xs font-medium text-zinc-500">
            Shortlist full
          </span>
        )}
      </div>

      {showSearch && !atCap && (
        <div className="border-b border-line bg-zinc-50 px-5 py-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search verified jockeys by name…"
            autoFocus
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-turf-400"
          />
          {results.length > 0 && (
            <div className="mt-2 max-h-56 divide-y divide-line overflow-y-auto overflow-hidden rounded-xl border border-line bg-white shadow-sm">
              {results.map((r) => {
                const already = preferred.some((p) => p.jockey_id === r.id);
                const claim = formatClaim(r.apprentice_claim);
                return (
                  <button
                    key={r.id}
                    onClick={() => addJockey(r)}
                    disabled={!!adding || already}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 disabled:opacity-40"
                  >
                    <Avatar src={r.profile_photo_url} name={r.full_name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {r.full_name}
                    </span>
                    {r.riding_weight != null ? (
                      <span className="text-xs tabular-nums text-zinc-500">
                        {formatWeight(r.riding_weight)}
                      </span>
                    ) : null}
                    {r.apprentice && claim ? <ClothChip tone="turf">{claim}</ClothChip> : null}
                    <span className="text-xs font-semibold text-turf-600">
                      {already ? "Added" : "Add →"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-2 py-2 text-center text-sm text-zinc-400">
              No verified jockeys found for &ldquo;{query.trim()}&rdquo;
            </p>
          )}
        </div>
      )}

      {err ? (
        <p className="border-b border-line bg-red-50 px-5 py-2.5 text-sm text-red-600">{err}</p>
      ) : null}

      {preferred.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-zinc-400">No preferred riders yet.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Add up to {MAX_PREFERRED} jockeys to spot them instantly on every race day.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {preferred.map((p) => {
            const claim = formatClaim(p.apprentice_claim);
            return (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="text-amber-400" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L10 14.77l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85z" />
                  </svg>
                </span>
                <Avatar src={p.profile_photo_url} name={p.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{p.full_name}</p>
                  {p.riding_weight != null ? (
                    <p className="text-xs tabular-nums text-zinc-500">{formatWeight(p.riding_weight)}</p>
                  ) : null}
                </div>
                {p.apprentice && claim ? <ClothChip tone="turf">{claim}</ClothChip> : null}
                <button
                  onClick={() => removeJockey(p.id)}
                  disabled={removing === p.id}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
                >
                  {removing === p.id ? "…" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
