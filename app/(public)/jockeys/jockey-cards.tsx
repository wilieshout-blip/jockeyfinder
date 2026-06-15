"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ClothChip } from "@/components/ui/badge";
import { cn, formatClaim, formatWeight } from "@/lib/utils";

/** Strip NZTR title prefixes (Mr, Mrs, Ms, Miss, Dr, etc.) */
function stripTitle(name: string | null): string | null {
  if (!name) return name;
  return name.replace(/^(Mr\.?|Mrs\.?|Ms\.?|Miss\.?|Dr\.?|Prof\.?|Rev\.?)\s+/i, "").trim();
}

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
  phone: string | null;
  agent_phone: string | null;
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
  trial_jumpout_only: "Trial rider",
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
        const displayName = stripTitle(j.full_name);
        const stat = j.full_name
          ? statsByName.get(j.full_name.toLowerCase())
          : undefined;
        const contactPhone = j.phone ?? j.agent_phone ?? null;
        const contactLabel = j.phone ? "Mobile" : j.agent_phone ? "Via agent" : null;
        const isTrialRider = j.licence_type === "trial_jumpout_only";

        return (
          <article
            key={j.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-shadow hover:shadow-lift"
          >
            {/* Tappable header */}
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : j.id)}
              className="flex w-full cursor-pointer items-start gap-4 p-5 text-left transition-colors hover:bg-mist/60 active:bg-mist"
            >
              <Avatar src={j.profile_photo_url} name={displayName} size="lg" />
              <div className="min-w-0 flex-1">
                {/* Name + rotating chevron */}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                    {displayName}
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

                {/* Badges */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {j.riding_weight != null ? (
                    <Badge tone="neutral">{formatWeight(j.riding_weight)}</Badge>
                  ) : null}
                  {j.apprentice && claim ? (
                    <ClothChip tone="turf">{claim}</ClothChip>
                  ) : null}
                  {isTrialRider ? (
                    <Badge tone="amber">Trial rider</Badge>
                  ) : j.licence_type === "race_jockey" ? null : j.licence_type ? (
                    <Badge tone="neutral">
                      {LICENCE_LABELS[j.licence_type] ?? j.licence_type}
                    </Badge>
                  ) : null}
                </div>

                {/* Region */}
                {j.base_region ? (
                  <p className="mt-1.5 text-sm text-zinc-500">{j.base_region}</p>
                ) : null}

                {/* Collapsed-only preview */}
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

                {/* Contact info */}
                {contactPhone ? (
                  <div className="overflow-hidden rounded-xl border border-line bg-white text-sm">
                    <a
                      href={`tel:${contactPhone.replace(/\s/g, "")}`}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-mist/60"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg
                        className="h-4 w-4 shrink-0 text-turf-600"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      <span className="w-20 shrink-0 text-xs text-zinc-400">
                        {contactLabel}
                      </span>
                      <span className="font-medium text-ink">{contactPhone}</span>
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">No contact info listed.</p>
                )}

                {/* Season stats */}
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
