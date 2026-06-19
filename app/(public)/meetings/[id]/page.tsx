export const revalidate = 900;

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { hasSupabaseSessionCookie } from "@/lib/supabase/session-cookie";
import { DateBlock, JockeyChip } from "@/components/racing";
import { Badge } from "@/components/ui/badge";
import { cn, nzToday } from "@/lib/utils";
import type { PublicAttendance } from "@/lib/types";
import { RaceDayAccordions } from "./race-day-accordions";
import type { RaceEntryData, RaceData } from "./race-day-accordions";

interface TrackCondition {
  label: string;
  value: string;
  icon: string | null;
}

interface MeetingRow {
  id: string;
  nztr_day_id: number | null;
  meeting_date: string;
  track: string;
  club: string | null;
  meeting_type: string | null;
  is_jumps: boolean;
  track_conditions: TrackCondition[] | null;
}

interface RaceRow {
  id: string;
  race_number: number;
  name: string | null;
  race_class: string | null;
  distance: number | null;
  start_time: string | null;
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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createPublicClient();

  let userRole: "jockey" | "agent" | "trainer" | "owner" | null = null;
  let userId: string | null = null;
  let sessionClient: Awaited<ReturnType<typeof createClient>> | null = null;

  if (await hasSupabaseSessionCookie()) {
    sessionClient = await createClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (user) {
      const { data: profile } = await sessionClient
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();
      if (profile) {
        userRole = profile.role as typeof userRole;
        userId = profile.id;
      }
    }
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date, track, club, meeting_type, is_jumps, track_conditions")
    .eq("id", id)
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

  let racesFromDb: RaceRow[] = [];
  if (meeting.nztr_day_id) {
    const { data } = await supabase
      .from("races")
      .select("id, race_number, name, race_class, distance, start_time")
      .eq("nztr_day_id", meeting.nztr_day_id)
      .order("race_number", { ascending: true })
      .returns<RaceRow[]>();
    racesFromDb = data ?? [];
  }

  let entries: RaceEntryData[] = [];
  if (!isPast && meeting.nztr_day_id) {
    const raceIdMap = new Map(racesFromDb.map((r) => [r.race_number, r.id]));
    const { data } = await supabase
      .from("race_entries")
      .select("id, race_number, horse_number, horse_name, jockey_name, trainer_name, barrier, weight, rating, sire, dam, age_sex, form, nztr_horse_id")
      .eq("nztr_day_id", meeting.nztr_day_id)
      .order("race_number", { ascending: true })
      .order("barrier", { ascending: true, nullsFirst: false })
      .returns<Omit<RaceEntryData, "race_id">[]>();
    entries = (data ?? []).map((e) => ({
      ...e,
      race_id: raceIdMap.get(e.race_number) ?? null,
    }));
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

  const requestedHorses: Record<number, Set<string>> = {};
  if (sessionClient && userId && (userRole === "jockey" || userRole === "agent")) {
    const { data: myRequests } = await sessionClient
      .from("ride_requests")
      .select("race_number, horse_name")
      .eq("meeting_id", meeting.id)
      .eq("jockey_id", userId)
      .not("status", "eq", "cancelled");
    for (const req of myRequests ?? []) {
      if (req.race_number && req.horse_name) {
        if (!requestedHorses[req.race_number]) requestedHorses[req.race_number] = new Set();
        requestedHorses[req.race_number].add(req.horse_name);
      }
    }
  }

  const raceDataList: RaceData[] = racesFromDb.map((r) => ({
    race_number: r.race_number,
    name: r.name,
    race_class: r.race_class,
    distance: r.distance,
    start_time: r.start_time,
    race_id: r.id,
  }));

  const entriesByRace: Record<number, RaceEntryData[]> = {};
  for (const e of entries) {
    if (!entriesByRace[e.race_number]) entriesByRace[e.race_number] = [];
    entriesByRace[e.race_number].push(e);
  }

  const resultsByRace = new Map<number, { name: string | null; distanceM: number | null; prize: number | null; rows: RaceResult[] }>();
  for (const r of results) {
    const ex = resultsByRace.get(r.race_number);
    if (ex) { ex.rows.push(r); }
    else { resultsByRace.set(r.race_number, { name: r.race_name, distanceM: r.distance_m, prize: r.prize_total, rows: [r] }); }
  }

  const hasEntries = entries.length > 0;
  const hasResults = results.length > 0;
  const meetingLabel = meeting.meeting_type === "T" ? "Trial Day" : "Race Day";
  const resultRaceNums = [...resultsByRace.keys()].sort((a, b) => a - b);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/meetings" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-ink transition-colors">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All meetings
      </Link>

      <div className="premium-grid mt-5 overflow-hidden border border-white/10 bg-ink p-5 text-white shadow-premium sm:p-7">
        <div className="flex items-start gap-5 sm:gap-6">
          <DateBlock date={meeting.meeting_date} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-300">
              {meetingLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">{meeting.track}</h1>
              {meeting.is_jumps && <Badge tone="amber">Jumps</Badge>}
              {isToday && <Badge tone="turf">Today</Badge>}
              {isPast && !isToday && <Badge tone="neutral">Results available</Badge>}
            </div>
            {meeting.club && <p className="mt-2 truncate text-zinc-400">{meeting.club}</p>}
          </div>
        </div>
      </div>

      {Array.isArray(meeting.track_conditions) && meeting.track_conditions.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {meeting.track_conditions.map((c) => (
            <div key={c.label} className="border border-line bg-white px-3 py-2.5 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {c.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{c.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {hasResults ? "Results" : "Race card"}
            </h2>
            {(userRole === "jockey" || userRole === "agent") && !isPast && hasEntries && (
              <p className="text-xs text-zinc-500">Tap a race to request rides</p>
            )}
          </div>

          {hasResults ? (
            <div className="space-y-4">
              {resultRaceNums.map((raceNum) => {
                const race = resultsByRace.get(raceNum)!;
                return (
                  <div key={raceNum} className="overflow-hidden border border-line bg-white shadow-card">
                    <div className="flex items-center justify-between border-b border-line bg-mist px-4 py-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Race {raceNum}</p>
                        <p className="font-semibold text-ink">{race.name ?? `Race ${raceNum}`}</p>
                      </div>
                      <div className="text-right text-xs text-zinc-500 space-y-0.5">
                        {race.distanceM ? <p className="font-medium">{race.distanceM}m</p> : null}
                        {race.prize ? <p>${race.prize.toLocaleString("en-NZ")}</p> : null}
                      </div>
                    </div>
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
                  </div>
                );
              })}
            </div>
          ) : hasEntries ? (
            <RaceDayAccordions
              races={raceDataList}
              entriesByRace={entriesByRace}
              role={userRole}
              meetingId={meeting.id}
              requestedHorses={requestedHorses}
            />
          ) : (
            <div className="border border-line bg-white p-8 text-center shadow-card">
              <p className="text-sm font-medium text-zinc-600">
                {isPast
                  ? "No results have been synced yet for this meeting."
                  : "Race entries will appear here once declared — usually about a week before race day."}
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
            <div className="border border-dashed border-line bg-white p-5 text-center">
              <p className="text-sm text-zinc-500">No verified jockeys have marked attendance yet.</p>
              <Link href="/jockeys" className="mt-2 block text-xs font-medium text-turf-700 hover:underline">Browse jockeys</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
