"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export function AnimatedSection({
  children,
  className,
  delay = 0,
  id,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={cn("reveal-section", visible && "reveal-section-visible", className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function VideoHero({ children }: { children: ReactNode }) {
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <section className="hero-media relative isolate min-h-[calc(100svh-7.2rem)] overflow-hidden bg-ink text-white">
      <div className="hero-fallback absolute inset-0" aria-hidden />
      {!videoFailed ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-55"
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          onError={() => setVideoFailed(true)}
          aria-hidden
        >
          <source src="/videos/racing-hero.mp4" type="video/mp4" />
          <source src="/videos/parade-ring.mp4" type="video/mp4" />
          <source src="/videos/track-motion.mp4" type="video/mp4" />
        </video>
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,6,0.97)_0%,rgba(5,7,6,0.82)_38%,rgba(5,7,6,0.28)_72%,rgba(5,7,6,0.62)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,6,0.22)_0%,rgba(5,7,6,0.05)_52%,rgba(5,7,6,0.94)_100%)]" />
      <div className="hero-track-lines absolute inset-0 opacity-45" aria-hidden />
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "page-header mb-7 overflow-hidden border px-5 py-6 sm:px-7 sm:py-8",
        dark
          ? "border-white/10 bg-ink text-white"
          : "border-line bg-white text-ink shadow-card"
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.22em]",
              dark ? "text-gold-300" : "text-turf-700"
            )}
          >
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-none tracking-[-0.04em] sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {description ? (
            <div
              className={cn(
                "mt-3 max-w-2xl text-sm leading-6 sm:text-base",
                dark ? "text-zinc-300" : "text-zinc-600"
              )}
            >
              {description}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = "light",
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: "light" | "dark" | "green";
}) {
  return (
    <div
      className={cn(
        "stat-card border p-5",
        tone === "dark" && "border-white/10 bg-zinc-950 text-white",
        tone === "green" && "border-turf-700 bg-turf-800 text-white",
        tone === "light" && "border-line bg-white text-ink"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-55">
        {label}
      </p>
      <p className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em]">
        {value}
      </p>
      {detail ? <p className="mt-2 text-xs leading-5 opacity-65">{detail}</p> : null}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "gold" | "red";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
        tone === "neutral" && "border-zinc-200 bg-zinc-100 text-zinc-600",
        tone === "green" && "border-turf-200 bg-turf-50 text-turf-700",
        tone === "gold" && "border-gold-200 bg-gold-50 text-gold-800",
        tone === "red" && "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "neutral" && "bg-zinc-400",
          tone === "green" && "bg-turf-500",
          tone === "gold" && "bg-gold-500",
          tone === "red" && "bg-red-500"
        )}
      />
      {children}
    </span>
  );
}

export function FloatingCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "floating-card border border-white/12 bg-zinc-950/80 p-4 text-white shadow-[0_28px_80px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DashboardPreview() {
  return (
    <div className="relative mx-auto max-w-xl lg:mx-0">
      <div className="overflow-hidden border border-white/10 bg-zinc-950/90 shadow-[0_40px_100px_-35px_rgba(0,0,0,0.9)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400/70" />
            <span className="h-2 w-2 rounded-full bg-gold-400/80" />
            <span className="h-2 w-2 rounded-full bg-turf-400" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Race-day operations
          </span>
        </div>
        <div className="grid min-h-[390px] grid-cols-[86px_1fr]">
          <aside className="border-r border-white/10 p-3">
            <div className="h-8 rounded-lg bg-turf-700" />
            <div className="mt-5 space-y-2">
              {[72, 52, 64, 48, 58].map((width) => (
                <div
                  key={width}
                  className="h-2 rounded-full bg-zinc-800"
                  style={{ width: `${width}%` }}
                />
              ))}
            </div>
          </aside>
          <div className="p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-turf-300">
                  Saturday programme
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-white">
                  Te Rapa
                </p>
              </div>
              <StatusBadge tone="green">Live</StatusBadge>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["Rides", "6"],
                ["Confirmed", "4"],
                ["Open", "2"],
              ].map(([label, value]) => (
                <div key={label} className="border border-white/10 bg-white/[0.035] p-3">
                  <p className="font-display text-xl font-semibold text-white">{value}</p>
                  <p className="mt-1 text-[9px] uppercase tracking-wider text-zinc-500">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {[
                ["R3", "North Star", "M. Vale", "Confirmed"],
                ["R6", "Sunline", "R. Lennox", "Accepted"],
                ["R8", "Kauri Bay", "Open ride", "Action needed"],
              ].map(([race, horse, jockey, status], index) => (
                <div
                  key={race}
                  className="grid grid-cols-[36px_1fr_auto] items-center gap-3 border border-white/10 bg-zinc-900/75 p-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center bg-white font-display text-xs font-bold text-ink">
                    {race}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{horse}</p>
                    <p className="truncate text-xs text-zinc-500">{jockey}</p>
                  </div>
                  <span
                    className={cn(
                      "hidden text-[9px] font-semibold uppercase tracking-wider sm:block",
                      index === 2 ? "text-gold-300" : "text-turf-300"
                    )}
                  >
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <FloatingCard className="absolute -bottom-7 -left-5 hidden w-56 sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">
          Booking confirmed
        </p>
        <p className="mt-2 font-display text-base font-semibold">Sunline · Race 6</p>
        <p className="mt-1 text-xs text-zinc-400">R. Lennox accepted at 10:43</p>
      </FloatingCard>
    </div>
  );
}

export function VerificationCard({
  letter,
  title,
  body,
  tone = "green",
}: {
  letter: string;
  title: string;
  body: string;
  tone?: "green" | "gold" | "dark";
}) {
  return (
    <div className="group border-t border-line py-5 transition-colors hover:border-turf-300 sm:grid sm:grid-cols-[56px_1fr_auto] sm:items-start sm:gap-4">
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center font-display text-sm font-bold",
          tone === "green" && "bg-turf-700 text-white",
          tone === "gold" && "bg-gold-400 text-ink",
          tone === "dark" && "bg-ink text-white"
        )}
      >
        {letter}
      </span>
      <div className="mt-3 sm:mt-0">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600">{body}</p>
      </div>
      <span className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.14em] text-turf-700 sm:mt-1">
        Verified
      </span>
    </div>
  );
}

export function ArrowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 text-sm font-semibold transition-all hover:gap-3",
        className
      )}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}
