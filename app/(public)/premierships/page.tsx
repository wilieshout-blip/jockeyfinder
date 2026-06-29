export const revalidate = 900;

import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { registryKey, cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Premierships",
  description:
    "New Zealand jockey and trainer premiership tables — season wins, places, stakes and strike rates, updated from LoveRacing.",
};

type EntityType = "jockey" | "trainer";

interface PremRow {
  entity_id: number;
  name: string;
  wins: number;
  seconds: number;
  thirds: number;
  starts: number;
  stakes: number;
  strike_rate: number;
}

/** Current NZ racing season label, e.g. "2025/26". Season runs Aug 1 – Jul 31. */
function seasonLabel(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

function fmtStakes(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export default async function PremiershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; code?: string }>;
}) {
  const sp = await searchParams;
  const type: EntityType = sp.type === "trainer" ? "trainer" : "jockey";
  const jumping = sp.code === "jump";
  const supabase = createPublicClient();

  // Latest season present in the feed.
  const { data: seasonRow } = await supabase
    .from("nztr_premierships")
    .select("season_id")
    .eq("entity_type", type)
    .order("season_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const seasonId = seasonRow?.season_id ?? null;

  let rows: PremRow[] = [];
  if (seasonId != null) {
    const { data } = await supabase
      .from("nztr_premierships")
      .select("entity_id, name, wins, seconds, thirds, starts, stakes, strike_rate")
      .eq("entity_type", type)
      .eq("season_id", seasonId)
      .eq("jumping", jumping)
      .order("wins", { ascending: false })
      .order("stakes", { ascending: false })
      .returns<PremRow[]>();
    rows = (data ?? []).filter((r) => r.starts > 0 || r.wins > 0);
  }

  // Link names to registered profiles where we have one.
  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, full_name, role")
    .eq("role", type);
  const profileByKey = new Map<string, string>();
  for (const p of profiles ?? []) {
    const key = registryKey((p as any).full_name);
    if (key && !profileByKey.has(key)) profileByKey.set(key, (p as any).id);
  }
  const profileId = (name: string) => {
    // Trainer feed uses partnerships ("A B & C D") — match the first partner.
    const first = type === "trainer" ? name.split("&")[0] : name;
    return profileByKey.get(registryKey(first)) ?? null;
  };

  const Toggle = ({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) => (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-zinc-700 hover:border-zinc-400"
      )}
    >
      {children}
    </Link>
  );

  const qs = (t: EntityType, c: "flat" | "jump") =>
    `/premierships?type=${t}${c === "jump" ? "&code=jump" : ""}`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
          {seasonLabel()} season · {jumping ? "Jumping" : "Flat"}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {type === "trainer" ? "Trainer" : "Jockey"} premiership
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Current-season standings from LoveRacing. Registered{" "}
          {type === "trainer" ? "trainers" : "jockeys"} link through to their JockeyFinder profile.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Toggle active={type === "jockey"} href={qs("jockey", jumping ? "jump" : "flat")}>Jockeys</Toggle>
        <Toggle active={type === "trainer"} href={qs("trainer", jumping ? "jump" : "flat")}>Trainers</Toggle>
        <span className="mx-1 h-5 w-px bg-line" />
        <Toggle active={!jumping} href={qs(type, "flat")}>Flat</Toggle>
        <Toggle active={jumping} href={qs(type, "jump")}>Jumping</Toggle>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
          <p className="text-sm text-zinc-500">No premiership data for this category yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-zinc-400">
                <th className="px-3 py-2.5 font-semibold">#</th>
                <th className="px-3 py-2.5 font-semibold">{type === "trainer" ? "Trainer" : "Jockey"}</th>
                <th className="px-3 py-2.5 text-right font-semibold">Wins</th>
                <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">2nd</th>
                <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">3rd</th>
                <th className="px-3 py-2.5 text-right font-semibold">Starts</th>
                <th className="px-3 py-2.5 text-right font-semibold">SR</th>
                <th className="hidden px-3 py-2.5 text-right font-semibold md:table-cell">Stakes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => {
                const id = profileId(r.name);
                const sr = r.starts > 0 ? `${Math.round((r.wins / r.starts) * 100)}%` : "—";
                return (
                  <tr key={r.entity_id} className={cn(i < 3 && "bg-gold-50/40")}>
                    <td className="px-3 py-2.5 font-semibold text-zinc-400">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-ink">
                      {id ? (
                        <Link href={`/${type}s/${id}`} className="text-turf-700 hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        r.name
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-display font-bold text-ink">{r.wins}</td>
                    <td className="hidden px-3 py-2.5 text-right text-zinc-500 sm:table-cell">{r.seconds}</td>
                    <td className="hidden px-3 py-2.5 text-right text-zinc-500 sm:table-cell">{r.thirds}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-500">{r.starts}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-500">{sr}</td>
                    <td className="hidden px-3 py-2.5 text-right text-zinc-500 md:table-cell">{fmtStakes(r.stakes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-400">
        Stats sourced from LoveRacing premierships and refreshed regularly. Strike rate = wins ÷ starts.
      </p>
    </div>
  );
}
