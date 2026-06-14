"use client";
import { useState, useMemo } from "react";
import Link from "next/link";

export interface CalMeeting {
  id: string;
  nztr_day_id: number | null;
  meeting_date: string;
  track: string;
  club: string | null;
  meeting_type: string | null;
}

const PREMIER_TRACKS = new Set([
  "ellerslie","trentham","riccarton park","wingatui","pukekohe park","te rapa",
]);

function isPremier(track: string) {
  return PREMIER_TRACKS.has(track.toLowerCase().replace(/ (synthetic|raceway|park)$/i, "").trim());
}

function getRegion(track: string) {
  const t = track.toLowerCase();
  if (/ellerslie|pukekohe|avondale|ruakaka/.test(t)) return "Auckland";
  if (/te rapa|matamata|cambridge|ruakura|te aroha|tauranga|arawa/.test(t)) return "Waikato";
  if (/trentham|taki|awapuni|woodville|foxton|waverley|wanganui|hawera|new plymouth|phar lap/.test(t)) return "Wellington";
  if (/riccarton|ashburton|rangiora/.test(t)) return "Canterbury";
  if (/wingatui|invercargill|gore|oamaru/.test(t)) return "Otago";
  if (/hastings|napier|taupo|gisborne/.test(t)) return "Hawke's Bay";
  return "Other";
}

type FilterType = "all" | "premier" | "saturday";
const REGIONS = ["Auckland","Waikato","Wellington","Canterbury","Otago","Hawke's Bay"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export function MeetingsCalendar({ meetings }: { meetings: CalMeeting[] }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [filter, setFilter] = useState<FilterType>("all");
  const [region, setRegion] = useState<string | null>(null);
  const [showTrials, setShowTrials] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map: Record<string, CalMeeting[]> = {};
    for (const m of meetings) {
      if (!showTrials && m.meeting_type === "T") continue;
      if (filter === "premier" && !isPremier(m.track)) continue;
      if (filter === "saturday") {
        const d = new Date(m.meeting_date + "T00:00:00");
        if (d.getDay() !== 6) continue;
      }
      if (region && getRegion(m.track) !== region) continue;
      if (!map[m.meeting_date]) map[m.meeting_date] = [];
      map[m.meeting_date].push(m);
    }
    return map;
  }, [meetings, filter, region, showTrials]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - ((firstDay.getDay() + 6) % 7));

  const weeks: Date[][] = [];
  const cur = new Date(gridStart);
  while (cur <= lastDay || weeks.length < 4) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
    if (cur > lastDay && weeks.length >= 4) break;
  }

  const todayStr = today.toISOString().slice(0, 10);
  const selectedMeetings = selected ? (byDate[selected] ?? []) : [];
  const monthLabel = viewMonth.toLocaleDateString("en-NZ", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all","premier","saturday"] as FilterType[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === f ? "bg-turf-600 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:border-turf-300 hover:text-turf-700"
            }`}>
            {f === "all" ? "All races" : f === "premier" ? "★ Premier" : "Saturday"}
          </button>
        ))}
        <button onClick={() => setShowTrials((v) => !v)}
          className={`ml-auto rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            showTrials ? "bg-zinc-700 text-white border-zinc-700" : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400"
          }`}>
          {showTrials ? "Hide trials" : "Show trials / jumpouts"}
        </button>
      </div>

      {/* Region chips */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setRegion(null)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${region === null ? "bg-ink text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
          All regions
        </button>
        {REGIONS.map((r) => (
          <button key={r} onClick={() => setRegion(region === r ? null : r)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${region === r ? "bg-ink text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
            {r}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border border-line bg-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <button onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span className="font-display font-semibold text-ink text-base">{monthLabel}</span>
          <button onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-7 border-b border-line bg-zinc-50">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-line border-b border-line last:border-b-0">
            {week.map((day) => {
              const ds = day.toISOString().slice(0, 10);
              const inMonth = day.getMonth() === month;
              const isToday = ds === todayStr;
              const isSel = ds === selected;
              const dayMs = byDate[ds] ?? [];
              const isSat = day.getDay() === 6;
              return (
                <button key={ds} onClick={() => setSelected(isSel ? null : ds)}
                  className={`relative min-h-[72px] p-2 text-left transition-colors ${
                    !inMonth ? "bg-zinc-50/60" : isSel ? "bg-turf-50 ring-1 ring-inset ring-turf-300" : isSat ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-zinc-50"
                  }`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday ? "bg-turf-600 text-white" : !inMonth ? "text-zinc-300" : isSat ? "text-amber-700 font-bold" : "text-ink"
                  }`}>{day.getDate()}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayMs.slice(0, 3).map((m) => (
                      <div key={m.id} className={`truncate rounded px-1 py-0.5 text-[9px] font-bold leading-tight ${
                        m.meeting_type === "T" ? "bg-zinc-200 text-zinc-500" : isPremier(m.track) ? "bg-amber-100 text-amber-800" : "bg-turf-100 text-turf-800"
                      }`}>
                        {m.track.replace(/ (Synthetic|Raceway|Park Raceway)$/i,"").replace("Riccarton Park","Riccarton").slice(0,14)}
                      </div>
                    ))}
                    {dayMs.length > 3 && <div className="text-[9px] text-zinc-400 px-1">+{dayMs.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded bg-amber-100 border border-amber-200" />Premier</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded bg-turf-100 border border-turf-200" />Race meeting</span>
        {showTrials && <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded bg-zinc-200 border border-zinc-300" />Trial</span>}
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded bg-amber-50 border border-amber-100" />Saturday</span>
      </div>

      {/* Selected day */}
      {selected && (
        <div className="rounded-2xl border border-line bg-white shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <p className="font-display font-semibold text-ink">
              {new Date(selected + "T00:00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">×</button>
          </div>
          {selectedMeetings.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-400 text-center">No meetings match your current filters.</p>
          ) : (
            <div className="divide-y divide-line">
              {selectedMeetings.map((m) => (
                <Link key={m.id} href={`/meetings/${m.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors group">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink">{m.track}</span>
                      {isPremier(m.track) && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wide">Premier</span>
                      )}
                      {m.meeting_type === "T" && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Trial</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{getRegion(m.track)}{m.club ? ` · ${m.club}` : ""}</p>
                  </div>
                  <svg width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-zinc-300 shrink-0 group-hover:text-turf-400 transition-colors"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
  }
