import { createClient } from "@/lib/supabase/server";
import { MeetingsCalendar } from "@/components/meetings-calendar";
import type { CalMeeting } from "@/components/meetings-calendar";

export const metadata = { title: "Race Meetings | JockeyFinder" };

export default async function MeetingsPage() {
  const supabase = createClient();

  // Fetch 3 months of meetings centred on today
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  const end = new Date();
  end.setMonth(end.getMonth() + 2);

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date, track, club, meeting_type")
    .gte("meeting_date", start.toISOString().slice(0, 10))
    .lte("meeting_date", end.toISOString().slice(0, 10))
    .order("meeting_date", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-ink">Race Meetings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          New Zealand thoroughbred racing calendar
        </p>
      </div>
      <MeetingsCalendar meetings={(meetings ?? []) as CalMeeting[]} />
    </div>
  );
}
