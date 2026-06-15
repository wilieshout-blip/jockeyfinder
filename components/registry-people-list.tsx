"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Strip NZTR title prefixes (Mr, Mrs, Ms, Miss, Dr, etc.) */
function stripTitle(name: string | null): string | null {
  if (!name) return name;
  return name.replace(/^(Mr\.?|Mrs\.?|Ms\.?|Miss\.?|Dr\.?|Prof\.?|Rev\.?)\s+/i, "").trim();
}

export interface RegistryPerson {
  id: string;
  full_name: string | null;
  location: string | null;
  phone: string | null;
}

interface Props {
  people: RegistryPerson[];
}

export function RegistryPeopleList({ people }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-dashed border-line bg-white">
      {people.map((p) => {
        const isOpen = openId === p.id;
        const displayName = stripTitle(p.full_name);

        return (
          <div key={p.id}>
            {/* Tappable row */}
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : p.id)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-mist/60 active:bg-mist",
                isOpen && "bg-mist/40"
              )}
            >
              <Avatar name={displayName} src={null} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-700">
                  {displayName}
                </p>
                {p.location && !isOpen ? (
                  <p className="truncate text-xs text-zinc-400">{p.location}</p>
                ) : null}
              </div>
              <Badge tone="neutral">Unclaimed</Badge>
              <svg
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200",
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
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div className="border-t border-line bg-mist/30 px-4 py-3">
                <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white text-sm">
                  {p.location ? (
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className="w-20 shrink-0 text-xs text-zinc-400">
                        Location
                      </span>
                      <span className="text-zinc-700">{p.location}</span>
                    </div>
                  ) : null}
                  {p.phone ? (
                    <a
                      href={`tel:${p.phone.replace(/\s/g, "")}`}
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
                        NZTR contact
                      </span>
                      <span className="font-medium text-ink">{p.phone}</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className="w-20 shrink-0 text-xs text-zinc-400">
                        Contact
                      </span>
                      <span className="text-zinc-400 italic">Not listed in registry</span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  This person hasn&apos;t claimed their JockeyFinder profile yet.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
