"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

interface Props {
  activeType: string;
  activeDay: string;
  activeCat: string;
  totalCount: number;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
        active
          ? "bg-ink text-white shadow-sm"
          : "bg-white border border-line text-zinc-600 hover:border-zinc-300 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

export function MeetingsFilterBar({
  activeType,
  activeDay,
  activeCat,
  totalCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(pathname + (params.toString() ? "?" + params.toString() : ""));
    },
    [router, pathname, searchParams]
  );

  const toggleType = (t: string) => {
    if (t === "trial") {
      update({ type: "trial", day: null, cat: null });
    } else {
      update({ type: null, day: null, cat: null });
    }
  };

  const toggleDay = (d: string) =>
    update({ day: activeDay === d ? null : d });

  const toggleCat = (c: string) =>
    update({ cat: activeCat === c ? null : c });

  const isRaces = activeType !== "trial";

  return (
    <div className="space-y-4">
      {/* Races / Trials primary toggle */}
      <div className="flex items-center gap-1 rounded-2xl border border-line bg-white p-1.5 shadow-card w-fit">
        <button
          type="button"
          onClick={() => toggleType("race")}
          aria-pressed={isRaces}
          className={cn(
            "rounded-[10px] px-5 py-2 text-sm font-semibold transition-all",
            isRaces
              ? "bg-turf-600 text-white shadow-sm"
              : "text-zinc-500 hover:text-ink"
          )}
        >
          Races
        </button>
        <button
          type="button"
          onClick={() => toggleType("trial")}
          aria-pressed={!isRaces}
          className={cn(
            "rounded-[10px] px-5 py-2 text-sm font-semibold transition-all",
            !isRaces
              ? "bg-zinc-700 text-white shadow-sm"
              : "text-zinc-500 hover:text-ink"
          )}
        >
          Trials
        </button>
      </div>

      {/* Extra filters - races only */}
      {isRaces && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mr-1">
            Filter
          </span>
          <FilterChip
            active={activeCat === "premier"}
            onClick={() => toggleCat("premier")}
          >
            Star Premier
          </FilterChip>
          <FilterChip
            active={activeDay === "sat"}
            onClick={() => toggleDay("sat")}
          >
            Saturday
          </FilterChip>
          <FilterChip
            active={activeDay === "wed"}
            onClick={() => toggleDay("wed")}
          >
            Wednesday
          </FilterChip>
          <FilterChip
            active={activeDay === "sun"}
            onClick={() => toggleDay("sun")}
          >
            Sunday
          </FilterChip>
          {activeDay || activeCat ? (
            <button
              type="button"
              onClick={() => update({ day: null, cat: null })}
              className="px-2 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-ink"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      )}

      <p className="text-xs text-zinc-400" aria-live="polite">
        {totalCount} {totalCount === 1 ? "meeting" : "meetings"}
      </p>
    </div>
  );
}
