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
import { AttendanceToggle } from "./attendance-toggle";
import { AgentAttendancePanel } from "./agent-attendance-panel";
import { RideVacancyButton } from "@/components/ride-vacancy-button";

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


function declarationDates(meetingDate: string) {
  const [y, m, d] = meetingDate.split("-").map(Number);
  const fmt = (daysBack: number) =>
    new Date(Date.UTC(y, m - 1, d - daysBack)).toLocaleDateString("en-NZ", {
      timeZone: "Pacific/Auckland",
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  return { nominations: fmt(3), riders: fmt(2) };
}

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sos?: string }>;
}) {
  const { id } = await params;
  const { sos } = await searchParams;
  const supabase = createPublicClient();

  let userRole: "jockey" | "agent" | "trainer" | "owner" | null = null;
  let userId: string | null = null;
  let userVerified = false;
  let sessionClient: Awaited<ReturnType<typeof createClient>> | null = null;

  if (await hasSupabaseSessionCookie()) {
    sessionClient = await createClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (user) {
      const { data: profile } = await sessionClient
        .from("profiles")
        .select("id, role, verified")
        .eq("id", user.id)
        .single();
      if (profile) {
        userRole = profile.role as typeof userRole;
        userId = profile.id;
        userVerified = profile.verified ?? false;
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

  // Whether the logged-in jockey has marked themselves as attending.
  let myAttending = false;
  if (sessionClient && userId && userRole === "jockey") {
    const { data: myAtt } = await sessionClient
      .from("meeting_attendance")
      .select("attending")
      .eq("meeting_id", meeting.id)
      .eq("user_id", userId)
      .maybeSingle();
    myAttending = myAtt?.attending ?? false;
  }

  // Agent: their managed riders + each rider's attendance for this meeting, so
  // the agent can mark attendance on behalf (works for trials too, which have
  // no race entries). RLS lets an approved agent read/write these rows.
  let agentRiders: { id: string; name: string; attending: boolean }[] = [];
  if (sessionClient && userId && userRole === "agent") {
    const { data: links } = await sessionClient
      .from("agent_jockeys")
      .select("jockey_id, jockey:profiles!jockey_id(full_name)")
      .eq("agent_id", userId);
    const riderIds = (links ?? []).map((l: any) => l.jockey_id);
    const attendingSet = new Set<string>();
    if (riderIds.length > 0) {
      const { data: atts } = await sessionClient
        .from("meeting_attendance")
        .select("user_id, attending")
        .eq("meeting_id", meeting.id)
        .in("user_id", riderIds);
      for (const a of atts ?? []) {
        if ((a as any).attending) attendingSet.add((a as any).user_id);
      }
    }
    agentRiders = (links ?? [])
      .map((l: any) => ({
        id: l.jockey_id,
        name: (Array.isArray(l.jockey) ? l.jockey[0] : l.jockey)?.full_name ?? "Rider",
        attending: attendingSet.has(l.jockey_id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Logged-in trainer's preferred-rider shortlist: starred and sorted to the top
  // of "Riding here". Read under RLS (trainer sees only their own rows).
  const preferredIds = new Set<string>();
  if (sessionClient && userId && userRole === "trainer") {
    const { data: prefs } = await sessionClient
      .from("trainer_preferred_jockeys")
      .select("jockey_id")
      .eq("trainer_id", userId);
    for (const p of prefs ?? []) {
      if (p.jockey_id) preferredIds.add(p.jockey_id as string);
    }
  }

  // "Riding here": everyone declared to ride at this meeting per the race card,
  // including jockeys who don't have a JockeyFinder account. App jockeys are
  // matched by name so their chip links to their profile.
  type RidingHere = {
    name: string;
    rides: number;
    profile: PublicAttendance | null;
    preferred: boolean;
  };
  let ridingHere: RidingHere[] = [];
  if (meeting.nztr_day_id) {
    const { data: re } = await supabase
      .from("race_entries")
      .select("jockey_name")
      .eq("nztr_day_id", meeting.nztr_day_id)
      .not("jockey_name", "is", null);

    const counts = new Map<string, number>();
    for (const r of re ?? []) {
      const n = (r.jockey_name ?? "").trim();
      if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
    }

    const names = [...counts.keys()];
    const profileByName = new Map<string, PublicAttendance>();
    if (names.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select(
          "id, full_name, first_name, last_name, profile_photo_url, riding_weight, apprentice, apprentice_claim"
        )
        .eq("role", "jockey")
        .eq("verified", true)
        .eq("suspended", false)
        .in("full_name", names);
      for (const p of profs ?? []) {
        if (p.full_name) {
          profileByName.set(p.full_name.toLowerCase(), {
            meeting_id: meeting.id,
            jockey_id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            full_name: p.full_name,
            profile_photo_url: p.profile_photo_url,
            riding_weight: p.riding_weight,
            apprentice_claim: p.apprentice_claim,
            apprentice: p.apprentice ?? false,
            availability: null,
          });
        }
      }
    }

    ridingHere = names
      .map((name) => {
        const profile = profileByName.get(name.toLowerCase()) ?? null;
        return {
          name,
          rides: counts.get(name) ?? 0,
          profile,
          preferred: profile ? preferredIds.has(profile.jockey_id) : false,
        };
      })
      // Preferred riders first, then alphabetical by name.
      .sort((a, b) => {
        if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

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
      .select("id, race_number, horse_number, horse_name, jockey_name, trainer_name, barrier, weight, rating, sire, dam, age_sex, form, nztr_horse_id, silk_description")
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

  // Gap Finder: a trainer's booked rider is freed up when the horse they were
  // booked on is scratched — surface them so the trainer can re-book elsewhere.
  let freedRiders: { jockey: string; horse: string; race: number | null }[] = [];
  if (sessionClient && userId && userRole === "trainer" && meeting.nztr_day_id && !isPast) {
    const { data: scratched } = await supabase
      .from("race_entries")
      .select("horse_name")
      .eq("nztr_day_id", meeting.nztr_day_id)
      .eq("scratched", true);
    const scratchedNames = (scratched ?? [])
      .map((s) => s.horse_name)
      .filter((n): n is string => !!n);
    if (scratchedNames.length > 0) {
      const { data: reqs } = await sessionClient
        .from("ride_requests")
        .select("horse_name, race_number, profiles:profiles!jockey_id(full_name)")
        .eq("meeting_id", meeting.id)
        .in("status", ["assigned", "accepted"])
        .in("horse_name", scratchedNames);
      freedRiders = (reqs ?? []).map((r: any) => ({
        jockey: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles)?.full_name ?? "Your rider",
        horse: r.horse_name,
        race: r.race_number ?? null,
      }));
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
              {isPast ? (
                <p className="text-sm font-medium text-zinc-600">No results have been synced yet for this meeting.</p>
              ) : (() => {
                const { nominations, riders } = declarationDates(meeting.meeting_date);
                return (
                  <>
                    <p className="text-sm font-semibold text-ink">Race card not yet declared</p>
                    <div className="mt-3 space-y-1.5 text-sm">
                      <p className="text-zinc-600">Nominations close <span className="font-semibold text-ink">{nominations}</span> · 12:00PM</p>
                      <p className="text-zinc-600">Withdrawals close <span className="font-semibold text-ink">{riders}</span> · 10:00AM</p>
                      <p className="text-zinc-600">Riders declared <span className="font-semibold text-ink">{riders}</span> · 1:00PM</p>
                    </div>
                    <p className="mt-3 text-xs text-zinc-400">Check back after 1:00PM on {riders}</p>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {userRole === "jockey" && !isPast ? (
            <AttendanceToggle meetingId={meeting.id} initialAttending={myAttending} />
          ) : null}
          {userRole === "agent" && !isPast ? (
            <AgentAttendancePanel meetingId={meeting.id} riders={agentRiders} />
          ) : null}
          {userRole === "trainer" && userVerified && !isPast ? (
            <RideVacancyButton meetingId={meeting.id} />
          ) : null}
          {sos ? (
            <p className="rounded-xl border border-turf-200 bg-turf-50 px-3 py-2 text-xs font-medium text-turf-700">
              Vacancy sent to {sos} attending jockey{sos === "1" ? "" : "s"}.
            </p>
          ) : null}
          {freedRiders.length > 0 ? (
            <div className="rounded-xl border border-turf-200 bg-turf-50/60 p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-turf-700">Riders freed up</p>
              <ul className="space-y-1">
                {freedRiders.map((f, i) => (
                  <li key={i} className="text-xs text-zinc-600">
                    <span className="font-medium text-ink">{f.jockey}</span> — was on {f.horse}
                    {f.race ? ` (R${f.race})` : ""}, now scratched.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Riding here · {ridingHere.length}</h2>
          {ridingHere.length > 0 ? (
            <div className="space-y-2">
              {ridingHere.map((r) =>
                r.profile ? (
                  <JockeyChip key={r.name} jockey={r.profile} preferred={r.preferred} />
                ) : (
                  <div
                    key={r.name}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-semibold text-zinc-500">
                      {r.name
                        .split(/\s+/)
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                      <p className="text-xs text-zinc-400">
                        {r.rides} ride{r.rides !== 1 ? "s" : ""} · not on JockeyFinder
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="border border-dashed border-line bg-white p-5 text-center">
              <p className="text-sm text-zinc-500">No riders declared yet for this meeting.</p>
              <Link href="/jockeys" className="mt-2 block text-xs font-medium text-turf-700 hover:underline">Browse jockeys</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
