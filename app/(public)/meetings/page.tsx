export const revalidate = 900;

import { Suspense } from "react";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { MeetingCard } from "@/components/racing";
import { EmptyState } from "@/components/ui/empty";
import { MeetingsFilterBar } from "@/components/meetings-filter-bar";
import { nzToday, nzDatePlusDays } from "@/lib/utils";
import type { Meeting, PublicAttendance } from "@/lib/types";

export const metadata: Metadata = {
  title: "Race Meetings | JockeyFinder",
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
  searchParams: { type?: string; day?: string; cat?: string };
}) {
  const supabase = createPublicClient();

  const typeFilter = searchParams.type ?? "";
  const dayFilter = searchParams.day ?? "";
  const catFilter = searchParams.cat ?? "";

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
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
          Next 90 days
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Race meetings
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Upcoming New Zealand meetings with attending jockeys, weights, and claims as declared.
        </p>
      </div>

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
