"use client";

interface RecentWin {
  horse_name: string;
  race_name: string;
  race_date: string;
  win_dividend: number | null;
  nztr_day_id: number | null;
}

export interface JockeyStatsData {
  wins: number;
  places: number;
  seasonLabel: string;
  recentWins: RecentWin[];
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
  const { wins, places, seasonLabel, recentWins } = stats;
  const nonWinPlaces = places - wins;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatBox value={wins} label="Wins" accent />
        <StatBox value={nonWinPlaces} label="Places" />
        <StatBox value={places} label="Top 3" />
      </div>
      <p className="text-center text-xs text-zinc-400">{seasonLabel} · top-3 finishes tracked from LoveRacing</p>
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
      ) : wins === 0 ? (
        <p className="text-center text-sm text-zinc-400">No wins recorded yet this season.</p>
      ) : null}
    </div>
  );
}
