"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ClothChip } from "@/components/ui/badge";
import { cn, formatClaim, formatWeight } from "@/lib/utils";

export interface DirectoryJockey {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  licence_type: string | null;
  apprentice: boolean;
  apprentice_claim: number | null;
  riding_weight: number | null;
  base_region: string | null;
}

export interface JockeyStat {
  jockey_name: string;
  total_rides: number;
  wins: number;
  places: number;
  win_pct: number;
}

interface Props {
  jockeys: DirectoryJockey[];
  counts: Record<string, number>;
  stats: JockeyStat[];
}

const LICENCE_LABELS: Record<string, string> = {
  race_jockey: "Race jockey",
  trial_jumpout_only: "Trials and jumpouts only",
};

export function JockeyCards({ jockeys, counts, stats }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const statsByName = new Map(
    stats.map((s) => [s.jockey_name.toLowerCase(), s])
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {jockeys.map((j) => {
        const claim = formatClaim(j.apprentice_claim);
        const meetingCount = counts[j.id] ?? 0;
        const isOpen = openId === j.id;
        const stat = j.full_name
          ? statsByName.get(j.full_name.toLowerCase())
          : undefined;

        return (
          <article
            key={j.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-shadow hover:shadow-lift"
          >
            {/* Tappable header — whole collapsed surface is one button */}
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : j.id)}
              className="flex w-full cursor-pointer items-start gap-4 p-5 text-left transition-colors hover:bg-mist/60 active:bg-mist"
            >
              <Avatar src={j.profile_photo_url} name={j.full_name} size="lg" />
              <div className="min-w-0 flex-1">
                {/* Name + rotating chevron */}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                    {j.full_name}
                  </h2>
                  <svg
                    aria-hidden="true"
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M4 6l4 4 4-4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Weight / apprentice / licence badges */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {j.riding_weight != null ? (
                    <Badge tone="neutral">{formatWeight(j.riding_weight)}</Badge>
                  ) : null}
                  {j.apprentice && claim ? (
                    <ClothChip tone="turf">{claim}</ClothChip>
                  ) : null}
                  {j.licence_type ? (
                    <Badge tone="neutral">
                      {LICENCE_LABELS[j.licence_type] ?? j.licence_type}
                    </Badge>
                  ) : null}
                </div>

                {/* Region */}
                {j.base_region ? (
                  <p className="mt-1.5 text-sm text-zinc-500">{j.base_region}</p>
                ) : null}

                {/* Collapsed-only: bio preview + tap hint */}
                {!isOpen && (
                  <div className="mt-2 space-y-1">
                    {j.bio ? (
                      <p className="line-clamp-2 text-sm text-zinc-600">{j.bio}</p>
                    ) : null}
                    <p className="text-xs text-zinc-400">
                      {meetingCount > 0 ? (
                        <>
                          Attending{" "}
                          <span className="font-medium text-zinc-500">
                            {meetingCount}
                          </span>{" "}
                          upcoming {meetingCount === 1 ? "meeting" : "meetings"}
                          {" "}· tap to expand
                        </>
                      ) : (
                        "Tap to expand"
                      )}
                    </p>
                  </div>
                )}
              </div>
            </button>

            {/* Expanded panel */}
            {isOpen && (
              <div className="space-y-4 border-t border-line bg-mist/40 px-5 py-4">
                {j.bio ? (
                  <p className="text-sm text-zinc-700">{j.bio}</p>
                ) : (
                  <p className="text-sm italic text-zinc-400">No bio added yet.</p>
                )}

                {stat ? (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "Rides", value: stat.total_rides },
                      { label: "Wins", value: stat.wins },
                      { label: "Places", value: stat.places },
                      {
                        label: "Win %",
                        value: `${Number(stat.win_pct).toFixed(0)}%`,
                      },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="rounded-xl border border-line bg-white px-1 py-2.5"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                          {label}
                        </p>
                        <p className="mt-0.5 font-display text-sm font-semibold text-ink">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center justify-between text-sm">
                  <p className="text-zinc-500">
                    Attending{" "}
                    <span className="font-semibold text-ink">{meetingCount}</span>{" "}
                    upcoming {meetingCount === 1 ? "meeting" : "meetings"}
                  </p>
                  <Link
                    href={`/jockeys/${j.id}`}
                    className="font-medium text-turf-700 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Full profile →
                  </Link>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
