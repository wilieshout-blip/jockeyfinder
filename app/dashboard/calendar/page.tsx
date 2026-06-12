import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DateBlock } from "@/components/racing";
import { AttendanceToggle } from "@/components/attendance-toggle";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { cn, nzToday, nzDatePlusDays } from "@/lib/utils";
import type { Meeting, Profile } from "@/lib/types";

interface AttendanceRow {
  meeting_id: string;
  attending: boolean;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { jockey?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!me) redirect("/login");

  if (me.role !== "jockey" && me.role !== "agent") redirect("/meetings");

  // Agents pick which managed jockey's calendar they are working on.
  let managed: Profile[] = [];
  let target: Profile | null = me.role === "jockey" ? me : null;

  if (me.role === "agent") {
    const { data: links } = await supabase
      .from("agent_jockeys")
      .select("jockey_id")
      .eq("agent_id", user.id);
    const ids = (links ?? []).map((l) => l.jockey_id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids)
        .order("full_name")
        .returns<Profile[]>();
      managed = data ?? [];
    }
    target =
      managed.find((j) => j.id === searchParams.jockey) ?? managed[0] ?? null;
  }

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type")
    .gte("meeting_date", nzToday())
    .lte("meeting_date", nzDatePlusDays(60))
    .order("meeting_date", { ascending: true })
    .returns<Meeting[]>();

  let attendance = new Map<string, boolean>();
  if (target && meetings && meetings.length > 0) {
    const { data: rows } = await supabase
      .from("meeting_attendance")
      .select("meeting_id, attending")
      .eq("user_id", target.id)
      .in(
        "meeting_id",
        meetings.map((m) => m.id)
      )
      .returns<AttendanceRow[]>();
    attendance = new Map((rows ?? []).map((r) => [r.meeting_id, r.attending]));
  }

  const attendingCount = [...attendance.values()].filter(Boolean).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
          Next 60 days
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          My calendar
        </h1>
        <p className="mt-2 text-zinc-600">
          Tap the meetings {me.role === "agent" ? "your jockey plans" : "you plan"} to
          ride at. Your current weight and claim are saved with each meeting,
          and verified profiles show publicly to trainers.
        </p>
      </div>

      {me.role === "agent" ? (
        managed.length > 0 ? (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-600">Calendar for:</span>
            {managed.map((j) => (
              <Link
                key={j.id}
                href={`/dashboard/calendar?jockey=${j.id}`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  target?.id === j.id
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-zinc-600 hover:border-zinc-400"
                )}
              >
                {j.full_name}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No jockeys linked yet">
            Add the jockeys you manage on the{" "}
            <Link href="/dashboard/agent" className="font-medium text-turf-700 underline">
              My Jockeys
            </Link>{" "}
            page first, then manage their calendars here.
          </EmptyState>
        )
      ) : null}

      {target ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <Badge tone="turf">
              {attendingCount} {attendingCount === 1 ? "meeting" : "meetings"} marked
            </Badge>
            {!target.verified ? (
              <p className="text-xs text-zinc-500">
                Attendance is private until {me.role === "agent" ? "this jockey is" : "you are"} verified.
              </p>
            ) : null}
          </div>

          {meetings && meetings.length > 0 ? (
            <div className="space-y-2">
              {meetings.map((m) => {
                const attending = attendance.get(m.id) ?? false;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl border bg-white p-3 sm:p-4",
                      attending ? "border-turf-200 bg-turf-50/40" : "border-line"
                    )}
                  >
                    <DateBlock date={m.meeting_date} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/meetings/${m.id}`}
                        className="font-medium text-ink hover:text-turf-700"
                      >
                        {m.track}
                      </Link>
                      <p className="truncate text-sm text-zinc-500">
                        {m.club ?? ""}
                        {m.meeting_type ? ` · ${m.meeting_type}` : ""}
                      </p>
                    </div>
                    <AttendanceToggle
                      meetingId={m.id}
                      jockeyId={target.id}
                      attending={attending}
                      snapshot={{
                        riding_weight: target.riding_weight,
                        apprentice: target.apprentice,
                        apprentice_claim: target.apprentice_claim,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No meetings loaded yet">
              Meetings sync from the official NZ racing calendar. Once the
              first sync has run they will appear here.
            </EmptyState>
          )}
        </>
      ) : null}
    </div>
  );
}
