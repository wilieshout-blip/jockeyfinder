import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, nzToday, formatMeetingDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OutlierMonitorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");

  const admin = createAdminClient();
  const today = nzToday();

  // 1) Same-day double attendance (a jockey marked at 2+ meetings on one date).
  const { data: att } = await admin
    .from("meeting_attendance")
    .select("user_id, attending, meetings!inner(meeting_date, track), profiles!inner(full_name)")
    .eq("attending", true)
    .gte("meetings.meeting_date", today);

  const groups = new Map<string, { name: string; date: string; tracks: Set<string> }>();
  for (const a of (att ?? []) as any[]) {
    const date = a.meetings?.meeting_date;
    const track = a.meetings?.track;
    const name = a.profiles?.full_name ?? "Unknown";
    if (!date || !track) continue;
    const key = `${a.user_id}|${date}`;
    if (!groups.has(key)) groups.set(key, { name, date, tracks: new Set() });
    groups.get(key)!.tracks.add(track);
  }
  const clashes = [...groups.values()].filter((g) => g.tracks.size > 1);

  // 2) Weight outliers (riding weight outside a plausible 45-70kg band).
  const { data: weightRows } = await admin
    .from("profiles")
    .select("id, full_name, riding_weight, verification_status")
    .eq("role", "jockey")
    .not("riding_weight", "is", null)
    .or("riding_weight.lt.45,riding_weight.gt.70")
    .order("riding_weight", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm font-medium text-turf-700 hover:underline">← Back to admin</Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Outlier monitor</h1>
      <p className="text-sm text-zinc-500">Flags implausible rider data for a quick human check. Nothing here is enforced automatically.</p>

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Same-day attendance clashes · {clashes.length}
        </h2>
        {clashes.length > 0 ? (
          <div className="space-y-2">
            {clashes.map((c, i) => (
              <div key={i} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="text-sm text-amber-800">
                  Marked at {c.tracks.size} meetings on {formatMeetingDate(c.date)}: {[...c.tracks].join(", ")} — a rider can only be at one.
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-zinc-400">
            No same-day clashes.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Weight outliers · {weightRows?.length ?? 0}
        </h2>
        {weightRows && weightRows.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card divide-y divide-line">
            {weightRows.map((w) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">{w.full_name ?? "Unnamed"}</p>
                  <p className="text-xs text-zinc-400 capitalize">{w.verification_status ?? "pending"}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800">
                  {w.riding_weight}kg
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-zinc-400">
            No weight outliers.
          </p>
        )}
      </section>
    </div>
  );
}
