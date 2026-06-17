"use client";
import { useState, useEffect, useRef } from "react";

interface Horse {
  id: string;
  name: string;
  sire: string | null;
  dam: string | null;
  nztr_trainer_name: string | null;
}
interface Link { id: string; status: string; horses: Horse; }
interface SearchResult { id: string; name: string; sire: string | null; dam: string | null; }

interface Props {
  initialLinks: Link[];
  role?: "trainer" | "owner";
}

export function TrainerHorses({ initialLinks, role = "trainer" }: Props) {
  const apiBase = role === "trainer" ? "/api/horses/trainer-links" : "/api/horses/owner-links";
  const [links, setLinks] = useState<Link[]>(initialLinks.filter(l => l.status === "confirmed"));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/horses/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  async function addHorse(horse: SearchResult) {
    setAdding(horse.id);
    const res = await fetch(`${role === "trainer" ? "/api/horses/trainer-links" : "/api/horses/owner-links"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horse_id: horse.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setLinks(prev => [
        ...prev,
        { id: data.id, status: "confirmed", horses: { id: horse.id, name: horse.name, sire: horse.sire, dam: horse.dam, nztr_trainer_name: null } },
      ]);
    }
    setAdding(null);
    setQuery("");
    setResults([]);
    setShowSearch(false);
  }

  async function removeHorse(linkId: string) {
    setRemoving(linkId);
    await fetch(`${apiBase}/${linkId}`, { method: "DELETE" });
    setLinks(prev => prev.filter(l => l.id !== linkId));
    setRemoving(null);
  }

  const label = role === "trainer" ? "Stable" : "Horses";

  return (
    <div className="rounded-2xl border border-line bg-white shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line">
        <h2 className="font-display font-semibold text-ink">My {label}</h2>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1.5 rounded-xl bg-turf-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-turf-700 transition-colors"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>
          Add horse
        </button>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="px-5 py-4 border-b border-line bg-zinc-50">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search horse name…"
            autoFocus
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-turf-400"
          />
          {results.length > 0 && (
            <div className="mt-2 rounded-xl border border-line bg-white shadow-sm overflow-hidden divide-y divide-line max-h-52 overflow-y-auto">
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => addHorse(r)}
                  disabled={!!adding || links.some(l => l.horses.id === r.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 disabled:opacity-40 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-sm text-ink">{r.name}</p>
                    {(r.sire || r.dam) && (
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {r.sire && `By ${r.sire}`}{r.sire && r.dam && " · "}{r.dam && `Dam: ${r.dam}`}
                      </p>
                    )}
                  </div>
                  {links.some(l => l.horses.id === r.id)
                    ? <span className="text-xs text-turf-600 font-semibold">Added</span>
                    : <span className="text-xs text-zinc-400">Add →</span>
                  }
                </button>
              ))}
            </div>
          )}
          {query.length >= 2 && results.length === 0 && (
            <p className="mt-2 text-sm text-zinc-400 text-center py-2">No horses found for "{query}"</p>
          )}
        </div>
      )}

      {/* Horse list */}
      {links.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-zinc-400 text-sm">No horses linked yet.</p>
          <p className="text-zinc-400 text-xs mt-1">Click "Add horse" to search and add horses to your {label.toLowerCase()}.</p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {links.map((link) => (
            <div key={link.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-semibold text-ink">{link.horses.name}</p>
                {(link.horses.sire || link.horses.dam) && (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {link.horses.sire && `By ${link.horses.sire}`}
                    {link.horses.sire && link.horses.dam && " · "}
                    {link.horses.dam && `Dam: ${link.horses.dam}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeHorse(link.id)}
                disabled={removing === link.id}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                {removing === link.id ? "…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
