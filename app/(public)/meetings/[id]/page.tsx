export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DateBlock, JockeyChip } from "@/components/racing";
import { AttendanceToggle } from "@/components/attendance-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { formatMeetingDate } from "@/lib/utils";
import type { Meeting, Profile, PublicAttendance } from "@/lib/types";

export default async function MeetingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type")
    .eq("id", params.id)
    .single<Meeting>();

  if (!meeting) notFound();

  const { data: attendees } = await supabase
    .from("public_meeting_attendance")
    .select("*")
    .eq("meeting_id", meeting.id)
    .returns<PublicAttendance[]>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let myAttendance: { attending: boolean } | null = null;

  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>();
    profile = p;

    if (p?.role === "jockey") {
      const { data: a } = await supabase
        .from("meeting_attendance")
        .select("attending")
        .eq("meeting_id", meeting.id)
        .eq("user_id", user.id)
        .maybeSingle<{ attending: boolean }>();
      myAttendance = a;
    }
  }

  const isJockey = profile?.role === "jockey";
  const isVerifiedTrainer = profile?.role === "trainer" && profile.verified;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/meetings"
        className="text-sm font-medium text-zinc-500 hover:text-ink"
      >
        ← All meetings
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <DateBlock date={meeting.meeting_date} size="lg" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {meeting.track}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {formatMeetingDate(meeting.meeting_date)}
              {meeting.club ? ` · ${meeting.club}` : ""}
            </p>
            {meeting.meeting_type ? (
              <div className="mt-2">
                <Badge tone="neutral">{meeting.meeting_type}</Badge>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isJockey && profile ? (
            <AttendanceToggle
              meetingId={meeting.id}
              jockeyId={profile.id}
              attending={myAttendance?.attending ?? false}
              snapshot={{
                riding_weight: profile.riding_weight,
                apprentice: profile.apprentice,
                apprentice_claim: profile.apprentice_claim,
              }}
            />
          ) : null}
          {isVerifiedTrainer ? (
            <Link
              href={`/dashboard/requests/new?meeting=${meeting.id}`}
              className={buttonClasses("accent", "sm")}
            >
              Request a jockey for this meeting
            </Link>
          ) : null}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Riding here · {attendees?.length ?? 0}{" "}
          {(attendees?.length ?? 0) === 1 ? "jockey" : "jockeys"}
        </h2>
        {attendees && attendees.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {attendees.map((j) => (
              <JockeyChip key={j.jockey_id} jockey={j} />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody>
              <p className="text-sm text-zinc-500">
                No verified jockeys have marked attendance for this meeting
                yet. Jockeys can mark themselves attending from their
                dashboard, and verified riders appear here automatically.
              </p>
            </CardBody>
          </Card>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Races
        </h2>
        <Card>
          <CardBody>
            <p className="text-sm text-zinc-500">
              Race fields will appear here once race level sync is added. The
              schema already supports it, so individual races, distances, and
              stakes can be displayed inside each meeting in a future update.
            </p>
          </CardBody>
        </Card>
      </section>

      {!user ? (
        <div className="mt-10 rounded-2xl border border-line bg-mist p-5 text-sm text-zinc-600">
          <span className="font-medium text-ink">Riding at this meeting?</span>{" "}
          <Link href="/signup" className="font-medium text-turf-700 underline">
            Create a free account
          </Link>{" "}
          to mark attendance, or log in if you already have one.
        </div>
      ) : null}
    </div>
  );
}
