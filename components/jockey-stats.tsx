"use client";

interface RecentWin {
  horse_name: string;
  race_name: string;
  race_date: string;
  win_dividend: number | null;
  nztr_day_id: number | null;
}

export interface JockeyStatsData {
  hasPremiership: boolean;
  seasonWins: number;
  seasonSeconds: number;
  seasonThirds: number;
  seasonStarts: number;
  careerWins: number;
  careerStarts: number;
  careerIsTrue?: boolean;
  careerStakes?: number | null;
  premiershipPlace?: number | null;
  suspensionsCount?: number | null;
  lastSuspensionDate?: string | null;
  seasonLabel: string;
  recentWins: RecentWin[];
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function fmtStakes(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function StatBox({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-white p-4 text-center shadow-card">
      <span className={accent ? "font-display text-3xl font-bold text-turf-700" : "font-display text-3xl font-bold text-ink"}>
        {value}
      </span>
      <span className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">{label}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

export function JockeyStats({ stats }: { stats: JockeyStatsData }) {
  const {
    hasPremiership, seasonWins, seasonSeconds, seasonThirds, seasonStarts,
    careerWins, careerStarts, careerIsTrue, careerStakes, premiershipPlace,
    suspensionsCount, lastSuspensionDate, seasonLabel, recentWins,
  } = stats;
  const places = seasonSeconds + seasonThirds;
  const winPct = seasonStarts > 0 ? Math.round((seasonWins / seasonStarts) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatBox value={seasonWins} label="Wins" accent />
        <StatBox value={places} label="Places" />
        <StatBox value={seasonStarts} label="Rides" />
        <StatBox value={seasonStarts > 0 ? `${winPct}%` : "—"} label="Win %" />
      </div>
      <p className="text-center text-xs text-zinc-400">
        {seasonLabel} · stats from LoveRacing premierships
        {hasPremiership && careerWins > 0 ? (
          <>
            {" · "}
            {careerIsTrue ? "Career" : "Last 5 seasons"}:{" "}
            <span className="font-semibold text-zinc-500">{careerWins}</span> wins from{" "}
            {careerStarts} rides
          </>
        ) : null}
      </p>
      {hasPremiership && (premiershipPlace || (careerStakes != null && careerStakes > 0)) ? (
        <div className="flex flex-wrap justify-center gap-2">
          {premiershipPlace ? (
            <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600">
              {ordinal(premiershipPlace)} in the {seasonLabel} premiership
            </span>
          ) : null}
          {careerStakes != null && careerStakes > 0 ? (
            <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600">
              {fmtStakes(careerStakes)} career stakes
            </span>
          ) : null}
        </div>
      ) : null}
      {hasPremiership && suspensionsCount != null && suspensionsCount > 0 ? (
        <p className="text-center text-[11px] text-zinc-400">
          {suspensionsCount} career suspension{suspensionsCount === 1 ? "" : "s"}
          {lastSuspensionDate
            ? ` · last ${new Date(lastSuspensionDate + "T00:00:00").toLocaleDateString("en-NZ", { month: "short", year: "numeric" })}`
            : ""}
        </p>
      ) : null}
      {recentWins.length > 0 ? (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Recent wins</h3>
          {recentWins.map((w, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{w.horse_name}</p>
                <p className="truncate text-xs text-zinc-500">{w.race_name ? w.race_name + " · " : ""}{formatDate(w.race_date)}</p>
              </div>
              {w.win_dividend ? (
                <span className="shrink-0 rounded-full bg-turf-50 px-2 py-0.5 text-xs font-semibold text-turf-700">
                  ${w.win_dividend.toFixed(2)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : seasonWins === 0 ? (
        <p className="text-center text-sm text-zinc-400">No wins recorded yet this season.</p>
      ) : null}
    </div>
  );
}
