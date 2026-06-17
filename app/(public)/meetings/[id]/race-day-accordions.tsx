"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { requestRideFromRaceCard } from "./actions";

export interface RaceEntryData {
  id: string;
  race_number: number;
  horse_number: number | null;
  horse_name: string;
  jockey_name: string | null;
  trainer_name: string | null;
  barrier: number | null;
  race_id: string | null;
}

export interface RaceData {
  race_number: number;
  name: string | null;
  start_time: string | null;
  race_id: string | null;
}

interface Props {
  races: RaceData[];
  entriesByRace: Record<number, RaceEntryData[]>;
  role: "jockey" | "agent" | "trainer" | "owner" | null;
  meetingId: string;
  requestedHorses: Record<number, Set<string>>;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-NZ", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Pacific/Auckland",
    });
  } catch {
    return "";
  }
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

interface RequestButtonProps {
  horseName: string;
  trainerName: string | null;
  raceId: string | null;
  raceNumber: number;
  meetingId: string;
  alreadyRequested: boolean;
}

function RequestRideButton({
  horseName,
  trainerName,
  raceId,
  raceNumber,
  meetingId,
  alreadyRequested,
}: RequestButtonProps) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(alreadyRequested);
  const [err, setErr] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      const res = await requestRideFromRaceCard({
        meetingId,
        raceId,
        raceNumber,
        horseName,
        trainerName,
      });
      if (res.success) {
        setDone(true);
      } else {
        setErr(res.error ?? "Failed");
      }
    });
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-turf-100 px-3 py-1 text-xs font-semibold text-turf-700">
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.5l2.5 2.5 4.5-5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
        Requested
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={pending}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
          pending
            ? "cursor-not-allowed bg-mist text-zinc-400"
            : "bg-ink text-white hover:bg-zinc-700 active:bg-zinc-800"
        )}
      >
        {pending ? "Requesting..." : "Request Ride"}
      </button>
      {err ? <p className="text-[10px] text-red-500">{err}</p> : null}
    </div>
  );
}

export function RaceDayAccordions({
  races,
  entriesByRace,
  role,
  meetingId,
  requestedHorses,
}: Props) {
  const allRaceNums = useMemo(
    () =>
      [
        ...new Set([
          ...races.map((r) => r.race_number),
          ...Object.keys(entriesByRace).map(Number),
        ]),
      ].sort((a, b) => a - b),
    [entriesByRace, races]
  );

  const [openRaces, setOpenRaces] = useState<Set<number>>(
    () => new Set(allRaceNums.slice(0, 1))
  );
  const [query, setQuery] = useState("");
  const [openRidesOnly, setOpenRidesOnly] = useState(false);

  const raceMap = useMemo(
    () => new Map(races.map((r) => [r.race_number, r])),
    [races]
  );
  const canRequest = role === "jockey" || role === "agent";

  const totals = useMemo(() => {
    const allEntries = Object.values(entriesByRace).flat();
    return {
      races: allRaceNums.length,
      runners: allEntries.length,
      confirmed: allEntries.filter((e) => e.jockey_name).length,
      open: allEntries.filter((e) => !e.jockey_name).length,
    };
  }, [allRaceNums.length, entriesByRace]);

  function toggleRace(num: number) {
    setOpenRaces((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  function toggleAll() {
    setOpenRaces((prev) =>
      prev.size === allRaceNums.length ? new Set() : new Set(allRaceNums)
    );
  }

  function visibleEntries(entries: RaceEntryData[]) {
    const q = normalize(query);
    return entries.filter((entry) => {
      if (openRidesOnly && entry.jockey_name) return false;
      if (!q) return true;
      return [entry.horse_name, entry.jockey_name, entry.trainer_name]
        .map(normalize)
        .some((value) => value.includes(q));
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-turf-700">
              Live race card
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Updates every 15 minutes from the racing feed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:flex">
            <span className="rounded-xl bg-mist px-3 py-2 text-xs font-semibold text-zinc-600">
              {totals.races} races
            </span>
            <span className="rounded-xl bg-mist px-3 py-2 text-xs font-semibold text-zinc-600">
              {totals.runners} runners
            </span>
            <span className="rounded-xl bg-turf-50 px-3 py-2 text-xs font-semibold text-turf-700">
              {totals.confirmed} confirmed riders
            </span>
            <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              {totals.open} open rides
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search race card</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search horse, jockey, trainer"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-turf-500"
            />
          </label>
          <button
            type="button"
            onClick={() => setOpenRidesOnly((v) => !v)}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              openRidesOnly
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-line bg-white text-zinc-600 hover:border-zinc-300"
            )}
          >
            Open rides
          </button>
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-300"
          >
            {openRaces.size === allRaceNums.length ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {allRaceNums.map((raceNum) => {
        const race = raceMap.get(raceNum);
        const entries = entriesByRace[raceNum] ?? [];
        const shownEntries = visibleEntries(entries);
        const confirmedCount = entries.filter((e) => e.jockey_name).length;
        const isOpen = openRaces.has(raceNum);

        return (
          <div
            key={raceNum}
            className="overflow-hidden rounded-2xl border border-line bg-white shadow-card"
          >
            <button
              type="button"
              onClick={() => toggleRace(raceNum)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-mist/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                R{raceNum}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {race?.name ?? "Race " + raceNum}
                </p>
                <p className="text-xs text-zinc-500">
                  {[formatTime(race?.start_time ?? null), entries.length + " runners"]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
              </div>
              <span className="hidden rounded-full bg-turf-50 px-2.5 py-1 text-xs font-semibold text-turf-700 sm:inline-flex">
                {confirmedCount} riders confirmed
              </span>
              <svg
                className={cn(
                  "h-4 w-4 shrink-0 text-zinc-400 transition-transform",
                  isOpen && "rotate-180"
                )}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {isOpen ? (
              <div className="border-t border-line">
                {entries.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-zinc-400">
                    Entries not yet declared for this race.
                  </p>
                ) : shownEntries.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-zinc-400">
                    No runners match this filter.
                  </p>
                ) : (
                  <div className="divide-y divide-line">
                    {shownEntries.map((entry) => {
                      const alreadyRequested =
                        requestedHorses[raceNum]?.has(entry.horse_name) ?? false;

                      return (
                        <div
                          key={entry.id}
                          className="grid gap-3 px-4 py-3 sm:grid-cols-[auto_1fr_auto]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-mist text-xs font-bold text-ink">
                              {entry.horse_number ?? "-"}
                            </span>
                            <span className="rounded-full border border-line bg-white px-2 py-1 text-xs font-semibold text-zinc-500">
                              B{entry.barrier ?? "-"}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {entry.horse_name}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                              {entry.jockey_name ? (
                                <span className="rounded-full bg-turf-50 px-2 py-1 font-semibold text-turf-700">
                                  Jockey: {entry.jockey_name}
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                                  Jockey open
                                </span>
                              )}
                              {entry.trainer_name ? (
                                <span className="rounded-full bg-mist px-2 py-1 font-medium text-zinc-600">
                                  Trainer: {entry.trainer_name}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {canRequest ? (
                            <RequestRideButton
                              horseName={entry.horse_name}
                              trainerName={entry.trainer_name}
                              raceId={entry.race_id}
                              raceNumber={raceNum}
                              meetingId={meetingId}
                              alreadyRequested={alreadyRequested}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
