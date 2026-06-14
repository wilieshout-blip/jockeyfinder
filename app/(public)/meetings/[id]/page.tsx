export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DateBlock, JockeyChip } from "@/components/racing";
import { Badge } from "@/components/ui/badge";
import { cn, nzToday } from "@/lib/utils";
import type { PublicAttendance } from "@/lib/types";

interface MeetingRow {
  id: string;
  nztr_day_id: number | null;
  meeting_date: string;
  track: string;
  club: string | null;
  meeting_type: string | null;
  is_jumps: boolean;
}

interface RaceEntry {
  id: string;
  race_number: number;
  horse_name: string;
  jockey_name: string | null;
  trainer_name: string | null;
  barrier: number | null;
}

interface RaceResult {
  race_number: number;
  race_name: string | null;
  distance_m: number | null;
  prize_total: number | null;
  position: number;
  horse_name: string;
  jockey_name: string | null;
  win_dividend: number | null;
  place_dividend: number | null;
}

function positionStyle(pos: number) {
  if (pos === 1) return "bg-amber-400 text-white";
  if (pos === 2) return "bg-zinc-300 text-zinc-700";
  if (pos === 3) return "bg-amber-100 text-amber-700";
  return "bg-mist text-zinc-500";
}

export default async function MeetingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date, track, club, meeting_type, is_jumps")
    .eq("id", params.id)
    .maybeSingle<MeetingRow>();

  if (!meeting) notFound();

  const today = nzToday();
  const isPast = meeting.meeting_date < today;
  const isToday = meeting.meeting_date === today;

  const { data: attendance } = await supabase
    .from("public_meeting_attendance")
    .select("*")
    .eq("meeting_id", meeting.id)
    .returns<PublicAttendance[]>();

  const jockeys = attendance ?? [];

  let entries: RaceEntry[] = [];
  if (!isPast && meeting.nztr_day_id) {
    const { data } = await supabase
      .from("race_entries")
      .select("id, race_number, horse_name, jockey_name, trainer_name, barrier")
      .eq("nztr_day_id", meeting.nztr_day_id)
      .order("race_number", { ascending: true })
      .order("barrier", { ascending: true })
      .returns<RaceEntry[]>();
    entries = data ?? [];
  }

  let results: RaceResult[] = [];
  if ((isPast || isToday) && meeting.nztr_day_id) {
    const { data } = await supabase
      .from("race_results")
      .select("race_number, race_name, distance_m, prize_total, position, horse_name, jockey_name, win_dividend, place_dividend")
      .eq("nztr_day_id", meeting.nztr_day_id)
      .order("race_number", { ascending: true })
      .order("position", { ascending: true })
      .returns<RaceResult[]>();
    results = data ?? [];
  }

  const entriesByRace = new Map<number, RaceEntry[]>();
  for (const e of entries) {
    const list = entriesByRace.get(e.race_number) ?? [];
    list.push(e);
    entriesByRace.set(e.race_number, list);
  }

  const resultsByRace = new Map<number, { name: string | null; distanceM: number | null; prize: number | null; rows: RaceResult[] }>();
  for (const r of results) {
    const existing = resultsByRace.get(r.race_number);
    if (existing) {
      existing.rows.push(r);
    } else {
      resultsByRace.set(r.race_number, { name: r.race_name, distanceM: r.distance_m, prize: r.prize_total, rows: [r] });
    }
  }

  const raceNumbers = [...new Set([...Array.from(entriesByRace.keys()), ...Array.from(resultsByRace.keys())])].sort((a, b) => a - b);
  const hasRaceData = raceNumbers.length > 0;
  const showResults = isPast || isToday;
  const meetingLabel = meeting.meeting_type === "T" ? "Trial Day" : "Race Day";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/meetings" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-ink transition-colors">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All meetings
      </Link>

      <div className="mt-5 flex items-start gap-5 sm:gap-6">
        <DateBlock date={meeting.meeting_date} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{meeting.track}</h1>
            {meeting.is_jumps && <Badge tone="amber">Jumps</Badge>}
            {isToday && <Badge tone="turf">Today</Badge>}
            {isPast && !isToday && <Badge tone="neutral">Results available</Badge>}
          </div>
          {meeting.club && <p className="mt-1 text-zinc-500 truncate">{meeting.club}</p>}
          <p className="mt-1 text-sm text-zinc-400">{meetingLabel}</p>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {showResults && results.length > 0 ? "Results" : "Race card"}
          </h2>
          {hasRaceData ? (
            raceNumbers.map((raceNum) => {
              const race = resultsByRace.get(raceNum);
              const raceEntries = entriesByRace.get(raceNum) ?? [];
              const hasResults = race && race.rows.length > 0;
              return (
                <div key={raceNum} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                  <div className="flex items-center justify-between border-b border-line bg-mist px-4 py-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Race {raceNum}</p>
                      <p className="font-semibold text-ink">{race?.name ?? "Race " + raceNum}</p>
                    </div>
                    <div className="text-right text-xs text-zinc-500 space-y-0.5">
                      {race?.distanceM ? <p className="font-medium">{race.distanceM}m</p> : null}
                      {race?.prize ? <p>${race.prize.toLocaleString("en-NZ")}</p> : null}
                    </div>
                  </div>
                  {hasResults ? (
                    <div className="divide-y divide-line">
                      {race.rows.map((r) => (
                        <div key={r.position} className="flex items-center gap-3 px-4 py-3">
                          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", positionStyle(r.position))}>{r.position}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{r.horse_name}</p>
                            {r.jockey_name ? <p className="truncate text-xs text-zinc-500">{r.jockey_name}</p> : null}
                          </div>
                          <div className="shrink-0 text-right text-xs">
                            {r.position === 1 && r.win_dividend ? <p className="font-semibold text-turf-700">${r.win_dividend.toFixed(2)}</p> : null}
                            {r.place_dividend ? <p className="text-zinc-400">${r.place_dividend.toFixed(2)} pl</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : raceEntries.length > 0 ? (
                    <div className="divide-y divide-line">
                      {raceEntries.map((e) => (
                        <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                          {e.barrier != null ? (
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-white text-xs font-bold text-zinc-600">{e.barrier}</span>
                          ) : <span className="w-6 shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{e.horse_name}</p>
                            <p className="truncate text-xs text-zinc-500">{[e.jockey_name, e.trainer_name].filter(Boolean).join(" · ")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-4 text-sm text-zinc-400">Entries not yet declared</p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-line bg-white p-8 text-center">
              <p className="text-sm font-medium text-zinc-600">
                {isPast ? "No results have been synced yet for this meeting." : "Race entries will appear here once declared — usually 2 days before race day."}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Riding here · {jockeys.length}</h2>
          {jockeys.length > 0 ? (
            <div className="space-y-2">
              {jockeys.map((j) => <JockeyChip key={j.jockey_id} jockey={j} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-white p-5 text-center">
              <p className="text-sm text-zinc-500">No verified jockeys have marked attendance yet.</p>
              <Link href="/jockeys" className="mt-2 block text-xs font-medium text-turf-700 hover:underline">Browse jockeys</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
