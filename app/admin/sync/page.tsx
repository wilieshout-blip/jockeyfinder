import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, nzToday, nzDatePlusDays } from "@/lib/utils";

export const dynamic = "force-dynamic";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? "s" : ""} ago`;
  return `${Math.round(h / 24)} day${Math.round(h / 24) !== 1 ? "s" : ""} ago`;
}

export default async function SyncHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");

  const admin = createAdminClient();
  const today = nzToday();
  const in90 = nzDatePlusDays(90);

  const [runsRes, meetingsRes, entriesRes, withJockeyRes, runsLatest] = await Promise.all([
    admin.from("sync_runs").select("source, ran_at, meetings, entries, jockeys, ok, note").order("ran_at", { ascending: false }).limit(20),
    admin.from("meetings").select("nztr_day_id", { count: "exact", head: true }).gte("meeting_date", today).lte("meeting_date", in90),
    admin.from("race_entries").select("id", { count: "exact", head: true }),
    admin.from("race_entries").select("id", { count: "exact", head: true }).not("jockey_name", "is", null),
    admin.from("sync_runs").select("ran_at, source").order("ran_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const runs = runsRes.data ?? [];
  const meetings90 = meetingsRes.count ?? 0;
  const entries = entriesRes.count ?? 0;
  const withJockey = withJockeyRes.count ?? 0;
  const lastRunAt = runsLatest.data?.ran_at ?? null;
  const stale = lastRunAt ? Date.now() - new Date(lastRunAt).getTime() > 45 * 60000 : true;

  const tiles: [string, string | number][] = [
    ["Meetings (next 90 days)", meetings90],
    ["Race entries", entries],
    ["Entries with a jockey", entries ? `${withJockey} (${Math.round((withJockey / entries) * 100)}%)` : 0],
    ["Last sync", ago(lastRunAt)],
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm font-medium text-turf-700 hover:underline">← Back to admin</Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Data sync hub</h1>
      <p className="text-sm text-zinc-500">Health of the LoveRacing / NZTR ingestion that powers meetings, fields and attendance.</p>

      {stale ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">⚠ Sync looks stale</p>
          <p className="mt-1 text-sm text-amber-800">
            The last successful sync was {ago(lastRunAt)}. Race fields, jockeys and attendance may be out of date.
            Check the machine running the 15-minute sync task is on and awake.
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <p className="font-display text-2xl font-semibold text-ink">{value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.1em] text-zinc-400">{label}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Recent sync runs</h2>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-mist text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2.5">When</th>
              <th className="px-3 py-2.5">Source</th>
              <th className="px-3 py-2.5">Meetings</th>
              <th className="px-3 py-2.5">Entries</th>
              <th className="px-3 py-2.5">Jockeys</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {runs.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2.5">{ago(r.ran_at)}</td>
                <td className="px-3 py-2.5">{r.source === "github" ? "cloud" : r.source}</td>
                <td className="px-3 py-2.5">{r.meetings ?? "—"}</td>
                <td className="px-3 py-2.5">{r.entries ?? "—"}</td>
                <td className="px-3 py-2.5">{r.jockeys ?? "—"}</td>
                <td className="px-3 py-2.5">
                  {r.ok ? (
                    <span className="rounded-full bg-turf-100 px-2 py-0.5 text-xs font-semibold text-turf-700">ok</span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700" title={r.note ?? ""}>issues</span>
                  )}
                </td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-zinc-400">No sync runs logged yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
