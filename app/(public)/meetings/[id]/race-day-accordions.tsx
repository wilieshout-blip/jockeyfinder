"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { requestRideFromRaceCard } from "./actions";

export interface RaceEntryData {
  id: string;
  race_number: number;
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
  /** race_number → Set of horse_names already requested */
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
          <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
            ? "bg-mist text-zinc-400 cursor-not-allowed"
            : "bg-ink text-white hover:bg-zinc-700 active:bg-zinc-800"
        )}
      >
        {pending ? "Requesting\u2026" : "Request Ride"}
      </button>
      {err && <p className="text-[10px] text-red-500">{err}</p>}
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
  const [openRaces, setOpenRaces] = useState<Set<number>>(new Set());

  function toggleRace(num: number) {
    setOpenRaces((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  const canRequest = role === "jockey" || role === "agent";

  const allRaceNums = [
    ...new Set([
      ...races.map((r) => r.race_number),
      ...Object.keys(entriesByRace).map(Number),
    ]),
  ].sort((a, b) => a - b);

  const raceMap = new Map(races.map((r) => [r.race_number, r]));

  return (
    <div className="space-y-2">
      {allRaceNums.map((raceNum) => {
        const race = raceMap.get(raceNum);
        const entries = entriesByRace[raceNum] ?? [];
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
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                R{raceNum}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {race?.name ?? `Race ${raceNum}`}
                </p>
                <p className="text-xs text-zinc-500">
                  {race?.start_time ? formatTime(race.start_time) : ""}
                  {entries.length > 0
                    ? `${race?.start_time ? " · " : ""}${entries.length} runners`
                    : ""}
                </p>
              </div>
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

            {isOpen && (
              <div className="border-t border-line">
                {entries.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-zinc-400">
                    Entries not yet declared for this race.
                  </p>
                ) : (
                  <div className="divide-y divide-line">
                    {entries.map((entry) => {
                      const alreadyRequested =
                        requestedHorses[raceNum]?.has(entry.horse_name) ?? false;

                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          {entry.barrier != null ? (
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-white text-xs font-bold text-zinc-600">
                              {entry.barrier}
                            </span>
                          ) : (
                            <span className="w-6 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">
                              {entry.horse_name}
                            </p>
                            <p className="truncate text-xs text-zinc-500">
                              {[entry.jockey_name, entry.trainer_name]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          {canRequest && (
                            <RequestRideButton
                              horseName={entry.horse_name}
                              trainerName={entry.trainer_name}
                              raceId={entry.race_id}
                              raceNumber={raceNum}
                              meetingId={meetingId}
                              alreadyRequested={alreadyRequested}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
