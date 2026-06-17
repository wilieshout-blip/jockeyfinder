import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "turf" | "amber" | "red" | "ink";

const tones: Record<Tone, string> = {
  neutral: "bg-mist text-zinc-700 border-line",
  turf: "bg-turf-50 text-turf-700 border-turf-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  ink: "bg-ink text-white border-ink",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        "text-[10px] font-semibold uppercase tracking-[0.1em]",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <Badge tone="turf">
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M8 0l1.9 1.6 2.4-.4.8 2.3 2.2 1-.6 2.4L16 8l-1.3 2.1.6 2.4-2.2 1-.8 2.3-2.4-.4L8 16l-1.9-1.6-2.4.4-.8-2.3-2.2-1 .6-2.4L0 8l1.3-2.1-.6-2.4 2.2-1 .8-2.3 2.4.4L8 0zm3.1 5.6L7 9.7 4.9 7.6 3.8 8.7 7 11.9l5.2-5.2-1.1-1.1z" />
      </svg>
      Verified
    </Badge>
  );
}

/**
 * Saddlecloth-style chip used for apprentice claims (a1, a2, a3)
 * and race numbers. The squared shape echoes a saddlecloth number.
 */
export function ClothChip({
  children,
  tone = "ink",
}: {
  children: ReactNode;
  tone?: "ink" | "turf" | "neutral";
}) {
  const map = {
    ink: "bg-ink text-white",
    turf: "bg-turf-600 text-white",
    neutral: "bg-mist text-zinc-700 border border-line",
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5",
        "font-display text-xs font-semibold tabular-nums",
        map[tone]
      )}
    >
      {children}
    </span>
  );
}
