import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ClothChip } from "@/components/ui/badge";
import { cn, formatClaim, formatWeight, meetingDateParts } from "@/lib/utils";
import type { Meeting, PublicAttendance } from "@/lib/types";

/** Racebook-style date block: big day number, small month and weekday. */
export function DateBlock({
  date,
  size = "md",
}: {
  date: string;
  size?: "md" | "lg";
}) {
  const p = meetingDateParts(date);
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-mist text-center",
        size === "lg" ? "h-20 w-20" : "h-16 w-16"
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-turf-700">
        {p.weekday}
      </span>
      <span
        className={cn(
          "font-display font-bold leading-none text-ink tabular-nums",
          size === "lg" ? "text-3xl" : "text-2xl"
        )}
      >
        {p.day}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {p.month}
      </span>
    </div>
  );
}

/** Compact jockey row used in attendance lists: photo, name, weight, claim. */
export function JockeyChip({ jockey }: { jockey: PublicAttendance }) {
  const claim = formatClaim(jockey.apprentice_claim);
  return (
    <Link
      href={`/jockeys/${jockey.jockey_id}`}
      className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 transition-colors hover:border-turf-200 hover:bg-turf-50/40"
    >
      <Avatar src={jockey.profile_photo_url} name={jockey.full_name} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {jockey.full_name}
      </span>
      {jockey.riding_weight != null ? (
        <span className="text-sm tabular-nums text-zinc-600">
          {formatWeight(jockey.riding_weight)}
        </span>
      ) : null}
      {jockey.apprentice && claim ? <ClothChip tone="turf">{claim}</ClothChip> : null}
    </Link>
  );
}

/** Racecard-style meeting row for the public meetings list. */
export function MeetingCard({
  meeting,
  attendees,
}: {
  meeting: Meeting;
  attendees: PublicAttendance[];
}) {
  return (
    <article className="rounded-2xl border border-line bg-white p-4 shadow-card transition-shadow hover:shadow-lift sm:p-5">
      <div className="flex items-start gap-4">
        <DateBlock date={meeting.meeting_date} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Link
              href={`/meetings/${meeting.id}`}
              className="font-display text-lg font-semibold tracking-tight text-ink hover:text-turf-700"
            >
              {meeting.track}
            </Link>
            {meeting.meeting_type ? (
              <Badge tone="neutral">{meeting.meeting_type}</Badge>
            ) : null}
          </div>
          {meeting.club ? (
            <p className="mt-0.5 truncate text-sm text-zinc-500">{meeting.club}</p>
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Riding here · {attendees.length}{" "}
              {attendees.length === 1 ? "jockey" : "jockeys"}
            </p>
            {attendees.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {attendees.map((j) => (
                  <JockeyChip key={`${meeting.id}-${j.jockey_id}`} jockey={j} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                No verified jockeys have marked attendance yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
