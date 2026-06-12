import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { MeetingCard } from "@/components/racing";
import { EmptyState } from "@/components/ui/empty";
import { nzToday, nzDatePlusDays } from "@/lib/utils";
import type { Meeting, PublicAttendance } from "@/lib/types";

export const metadata: Metadata = {
  title: "Race Meetings | JockeyFinder",
  description:
    "Upcoming New Zealand race meetings for the next 30 days, with verified jockeys who have marked themselves attending.",
};

export default async function MeetingsPage() {
  const supabase = await createClient();

  const from = nzToday();
  const to = nzDatePlusDays(30);

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type")
    .gte("meeting_date", from)
    .lte("meeting_date", to)
    .order("meeting_date", { ascending: true })
    .order("track", { ascending: true })
    .returns<Meeting[]>();

  const meetingIds = (meetings ?? []).map((m) => m.id);

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
          Next 30 days
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Race meetings
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Every upcoming New Zealand meeting, with verified jockeys who have
          marked themselves attending. Weights and claims shown as declared.
        </p>
      </div>

      {meetings && meetings.length > 0 ? (
        <div className="space-y-4">
          {meetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              attendees={byMeeting.get(m.id) ?? []}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No meetings loaded yet">
          Meetings sync from the official NZ racing calendar. Once the first
          sync has run, the next 30 days will appear here.
        </EmptyState>
      )}
    </div>
  );
}
