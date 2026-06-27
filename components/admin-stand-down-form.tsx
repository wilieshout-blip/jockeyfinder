"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordStandDown } from "@/app/admin/stand-downs/actions";

interface MeetingOpt {
  id: string;
  label: string;
}
interface JockeyHit {
  id: string;
  full_name: string | null;
}

export function AdminStandDownForm({ meetings }: { meetings: MeetingOpt[] }) {
  const supabase = useRef(createClient()).current;
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<JockeyHit[]>([]);
  const [selected, setSelected] = useState<JockeyHit | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setHits([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from("public_profiles")
        .select("id, full_name")
        .eq("role", "jockey")
        .ilike("full_name", `%${query.trim()}%`)
        .limit(8);
      setHits((data as JockeyHit[]) ?? []);
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, selected, supabase]);

  return (
    <form action={recordStandDown} className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <input type="hidden" name="jockey_id" value={selected?.id ?? ""} />

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Jockey</label>
        {selected ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-mist/40 px-3 py-2">
            <span className="text-sm font-medium text-ink">{selected.full_name}</span>
            <button type="button" onClick={() => { setSelected(null); setQuery(""); }} className="text-xs font-medium text-red-500">Change</button>
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jockey name…"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-turf-400"
            />
            {hits.length > 0 && (
              <div className="mt-1 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white shadow-sm">
                {hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => { setSelected(h); setHits([]); }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-mist"
                  >
                    {h.full_name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Meeting (optional)</label>
        <select name="meeting_id" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="">— No specific meeting —</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">From race</label>
          <input name="from_race" type="number" min="1" max="14" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" placeholder="e.g. 1" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">To race</label>
          <input name="to_race" type="number" min="1" max="14" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" placeholder="blank = same" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Or stood down until</label>
          <input name="end_date" type="date" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Reason (optional)</label>
        <input name="reason" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" placeholder="e.g. Medical — concussion protocol" />
      </div>

      <p className="text-xs text-zinc-500">
        Only trainers booked with this jockey in the affected race(s)/window are emailed. Leave races and date blank to scope to the whole meeting.
      </p>
      <button
        disabled={!selected}
        className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        Record stand-down &amp; alert trainers
      </button>
    </form>
  );
}
