"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DirectoryTrainer {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  base_region: string | null;
  country: string | null;
}

export interface RegistryTrainer {
  full_name: string;
  location: string | null;
}

interface Props {
  trainers: DirectoryTrainer[];
  registry: RegistryTrainer[];
}

export function TrainerCards({ trainers, registry }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const registryByName = new Map(
    registry
      .filter((r) => r.full_name)
      .map((r) => [r.full_name.toLowerCase(), r])
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {trainers.map((t) => {
        const isOpen = openId === t.id;
        const reg = t.full_name
          ? registryByName.get(t.full_name.toLowerCase())
          : undefined;

        // Show NZTR location only if it differs from the profile base_region
        const nztrLocation =
          reg?.location && reg.location !== t.base_region
            ? reg.location
            : null;

        const hasLocationDetail =
          t.base_region ||
          nztrLocation ||
          (t.country && t.country !== "NZ" && t.country !== "New Zealand");

        return (
          <article
            key={t.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-shadow hover:shadow-lift"
          >
            {/* Tappable header — whole collapsed surface is one button */}
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : t.id)}
              className="flex w-full cursor-pointer items-start gap-4 p-5 text-left transition-colors hover:bg-mist/60 active:bg-mist"
            >
              <Avatar src={t.profile_photo_url} name={t.full_name} size="lg" />
              <div className="min-w-0 flex-1">
                {/* Name + verified badge + rotating chevron */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                      {t.full_name}
                    </h2>
                    <VerifiedBadge />
                  </div>
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

                {/* Region */}
                {t.base_region ? (
                  <p className="mt-1 text-sm text-zinc-500">{t.base_region}</p>
                ) : null}

                {/* Collapsed-only: bio preview + tap hint */}
                {!isOpen && (
                  <div className="mt-2 space-y-1">
                    {t.bio ? (
                      <p className="line-clamp-2 text-sm text-zinc-600">{t.bio}</p>
                    ) : null}
                    <p className="text-xs text-zinc-400">Tap to expand</p>
                  </div>
                )}
              </div>
            </button>

            {/* Expanded panel */}
            {isOpen && (
              <div className="space-y-3 border-t border-line bg-mist/40 px-5 py-4">
                {t.bio ? (
                  <p className="text-sm text-zinc-700">{t.bio}</p>
                ) : (
                  <p className="text-sm italic text-zinc-400">No bio added yet.</p>
                )}

                {/* Location info block */}
                {hasLocationDetail ? (
                  <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white text-sm">
                    {t.base_region ? (
                      <div className="flex items-center gap-3 px-3 py-2">
                        <span className="w-28 shrink-0 text-xs text-zinc-400">
                          Based
                        </span>
                        <span className="text-zinc-700">{t.base_region}</span>
                      </div>
                    ) : null}
                    {nztrLocation ? (
                      <div className="flex items-center gap-3 px-3 py-2">
                        <span className="w-28 shrink-0 text-xs text-zinc-400">
                          NZTR location
                        </span>
                        <span className="text-zinc-700">{nztrLocation}</span>
                      </div>
                    ) : null}
                    {t.country &&
                    t.country !== "NZ" &&
                    t.country !== "New Zealand" ? (
                      <div className="flex items-center gap-3 px-3 py-2">
                        <span className="w-28 shrink-0 text-xs text-zinc-400">
                          Country
                        </span>
                        <span className="text-zinc-700">{t.country}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex justify-end pt-1">
                  <Link
                    href={`/trainers/${t.id}`}
                    className="text-sm font-medium text-turf-700 hover:underline"
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
