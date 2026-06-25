export const revalidate = 900;

import { Suspense } from "react";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { MeetingCard } from "@/components/racing";
import { EmptyState } from "@/components/ui/empty";
import { MeetingsFilterBar } from "@/components/meetings-filter-bar";
import { PageHeader } from "@/components/premium";
import { nzToday, nzDatePlusDays } from "@/lib/utils";
import type { Meeting, PublicAttendance } from "@/lib/types";

export const metadata: Metadata = {
  title: "Race Meetings",
  description: "Upcoming New Zealand race meetings and trials with attending jockeys, weights, and claims.",
};

const PREMIER_TRACKS = [
  "Ellerslie",
  "Te Rapa",
  "Riccarton Park",
  "Hastings",
  "Taupo",
  "New Plymouth Raceway",
  "Awapuni",
  "Wingatui",
];

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; day?: string; cat?: string }>;
}) {
  const queryParams = await searchParams;
  const supabase = createPublicClient();

  const typeFilter = queryParams.type ?? "";
  const dayFilter = queryParams.day ?? "";
  const catFilter = queryParams.cat ?? "";

  const isTrials = typeFilter === "trial";

  const from = nzToday();
  const to = nzDatePlusDays(90);

  let query = supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type, is_jumps")
    .gte("meeting_date", from)
    .lte("meeting_date", to)
    .order("meeting_date", { ascending: true })
    .order("track", { ascending: true });

  if (isTrials) {
    query = query.eq("meeting_type", "T");
  } else {
    query = query.eq("meeting_type", "R");
  }

  if (catFilter === "jumps") {
    query = query.eq("is_jumps", true);
  }

  const { data: allMeetings } = await query.returns<Meeting[]>();
  let filtered = allMeetings ?? [];

  const DAY_MAP: Record<string, number> = { sun: 0, mon: 1, wed: 3, sat: 6 };
  if (dayFilter && DAY_MAP[dayFilter] !== undefined) {
    const targetDay = DAY_MAP[dayFilter];
    filtered = filtered.filter(
      (m) => new Date(m.meeting_date + "T00:00:00").getDay() === targetDay
    );
  }

  if (catFilter === "premier") {
    filtered = filtered.filter((m) =>
      PREMIER_TRACKS.some((t) => m.track.startsWith(t))
    );
  }

  // Drop meetings whose last race has already run, so the tab only shows
  // live/upcoming days. A meeting is considered done ~30 min after its final
  // race's scheduled start time. Meetings with no known race times are kept.
  const FINISHED_BUFFER_MS = 30 * 60 * 1000;
  const nowMs = Date.now();
  const dayIds = filtered
    .map((m) => m.nztr_day_id)
    .filter((v): v is number => v != null);
  if (dayIds.length > 0) {
    const { data: raceRows } = await supabase
      .from("races")
      .select("nztr_day_id, start_time")
      .in("nztr_day_id", dayIds)
      .not("start_time", "is", null);
    const lastStartByDay = new Map<number, number>();
    for (const r of raceRows ?? []) {
      const t = r.start_time ? new Date(r.start_time as string).getTime() : NaN;
      if (!Number.isNaN(t)) {
        lastStartByDay.set(
          r.nztr_day_id,
          Math.max(lastStartByDay.get(r.nztr_day_id) ?? 0, t)
        );
      }
    }
    filtered = filtered.filter((m) => {
      const last = m.nztr_day_id != null ? lastStartByDay.get(m.nztr_day_id) : undefined;
      if (last === undefined) return true; // no race times known — keep it
      return last + FINISHED_BUFFER_MS >= nowMs;
    });
  }

  const meetingIds = filtered.map((m) => m.id);
  let attendance: PublicAttendance[] = [];
  if (meetingIds.length > 0) {
    const { data } = await supabase
      .from("public_meeting_attendance")
      .select("*")
      .in("meeting_id", meetingIds)
      .returns<PublicAttendance[]>();
    attendance = data ?? [];
  }

  const byMeeting = new Map<string, PublicAttendance[]>();
  for (const row of attendance) {
    const list = byMeeting.get(row.meeting_id) ?? [];
    list.push(row);
    byMeeting.set(row.meeting_id, list);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Next 90 days"
        title="Race meetings"
        description="Upcoming New Zealand meetings with attending jockeys, weights, and claims as declared."
      />

      <p className="-mt-3 mb-1 text-sm text-zinc-500">
        {filtered.length} upcoming {filtered.length === 1 ? "meeting" : "meetings"} · race and trial
        days · attendance updates appear here as verified jockeys mark the meetings they&apos;re riding.
      </p>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-12 w-48 animate-pulse rounded-2xl bg-mist" />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-mist" />
              ))}
            </div>
          </div>
        }
      >
        <MeetingsFilterBar
          activeType={typeFilter || "race"}
          activeDay={dayFilter}
          activeCat={catFilter}
          totalCount={filtered.length}
        />
      </Suspense>

      <div className="mt-6">
        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                attendees={byMeeting.get(m.id) ?? []}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No meetings match your filters">
            Try a different combination — or clear the filters to see all upcoming meetings.
          </EmptyState>
        )}
      </div>
    </div>
  );
           }
