import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, formatMeetingDate, nzToday, nzDatePlusDays } from "@/lib/utils";
import { AdminStandDownForm } from "@/components/admin-stand-down-form";
import { deleteStandDown } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminStandDownsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: meetings } = await admin
    .from("meetings")
    .select("id, track, meeting_date")
    .gte("meeting_date", nzToday())
    .lte("meeting_date", nzDatePlusDays(21))
    .order("meeting_date", { ascending: true });
  const meetingOpts = (meetings ?? []).map((m) => ({
    id: m.id,
    label: `${formatMeetingDate(m.meeting_date)} — ${m.track}`,
  }));

  const { data: standDowns } = await admin
    .from("medical_stand_downs")
    .select("id, from_race, to_race, end_date, reason, created_at, profiles:profiles!jockey_id(full_name), meetings(track, meeting_date)")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm font-medium text-turf-700 hover:underline">← Back to admin</Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Medical stand-downs</h1>
      <p className="text-sm text-zinc-500">
        Record a confirmed stand-down or suspension. Only the trainers booked with that jockey in the
        affected race(s) or window are emailed — nothing is auto-published or scraped.
      </p>

      <div className="mt-6">
        <AdminStandDownForm meetings={meetingOpts} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Recorded · {standDowns?.length ?? 0}
        </h2>
        {standDowns && standDowns.length > 0 ? (
          <div className="space-y-2">
            {standDowns.map((s) => {
              const j = (s as any).profiles;
              const m = (s as any).meetings;
              const scope =
                s.from_race
                  ? `Race ${s.from_race}${s.to_race && s.to_race !== s.from_race ? `–${s.to_race}` : ""}${m?.track ? ` · ${m.track}` : ""}`
                  : m?.track
                  ? `${m.track}${m.meeting_date ? ` · ${formatMeetingDate(m.meeting_date)}` : ""}`
                  : s.end_date
                  ? `Until ${formatMeetingDate(s.end_date)}`
                  : "Upcoming";
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{j?.full_name ?? "Jockey"}</p>
                    <p className="text-sm text-zinc-500">{scope}{s.reason ? ` · ${s.reason}` : ""}</p>
                  </div>
                  <form action={deleteStandDown}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">Remove</button>
                  </form>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-zinc-400">
            No stand-downs recorded.
          </p>
        )}
      </section>
    </div>
  );
}
