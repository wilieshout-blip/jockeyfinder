export const revalidate = 900;

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { hasSupabaseSessionCookie } from "@/lib/supabase/session-cookie";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { startDirectMessage } from "@/app/dashboard/messages/actions";
import { Card, CardBody } from "@/components/ui/card";

interface PublicTrainer {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  base_region: string | null;
  country: string | null;
  preferred_tracks: string | null;
  created_at: string;
}

interface TrainerRunner {
  id: string;
  race_number: number;
  horse_name: string;
  jockey_name: string | null;
  meetings: {
    track: string;
    meeting_date: string;
  } | null;
  races: {
    name: string | null;
    start_time: string | null;
  } | null;
}

function formatRunnerDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatRunnerTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Pacific/Auckland",
  });
}

export default async function TrainerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createPublicClient();

  let user: { id: string } | null = null;
  if (await hasSupabaseSessionCookie()) {
    const sessionClient = await createClient();
    const {
      data: { user: signedInUser },
    } = await sessionClient.auth.getUser();
    user = signedInUser ? { id: signedInUser.id } : null;
  }

  const { data: trainer } = await supabase
    .from("public_profiles")
    .select("id, full_name, profile_photo_url, bio, base_region, country, preferred_tracks, created_at")
    .eq("id", id)
    .eq("role", "trainer")
    .maybeSingle<PublicTrainer>();

  if (!trainer) notFound();

  let runners: TrainerRunner[] = [];
  if (trainer.full_name) {
    const today = new Date().toISOString().slice(0, 10);
    const escapedName = trainer.full_name.replace(/[%_]/g, "");
    const { data } = await supabase
      .from("race_entries")
      .select(
        "id, race_number, horse_name, jockey_name, meetings!inner(track, meeting_date), races(name, start_time)"
      )
      .ilike("trainer_name", `%${escapedName}%`)
      .gte("meetings.meeting_date", today)
      .order("race_number", { ascending: true })
      .limit(12)
      .returns<TrainerRunner[]>();
    runners = data ?? [];
  }

  const verifiedSince = trainer.created_at
    ? new Date(trainer.created_at).toLocaleDateString("en-NZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/trainers"
        className="text-sm font-medium text-zinc-500 hover:text-ink"
      >
        ← All trainers
      </Link>

      <div className="mt-4 flex items-start gap-5">
        <Avatar src={trainer.profile_photo_url} name={trainer.full_name} size="xl" />
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {trainer.full_name}
            </h1>
            <VerifiedBadge />
          </div>
          {trainer.base_region ? (
            <p className="mt-2 text-sm text-zinc-500">
              Stable based in {trainer.base_region}
            </p>
          ) : null}
          {trainer.preferred_tracks ? (
            <p className="mt-1 text-sm text-zinc-500">
              Preferred tracks: {trainer.preferred_tracks}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-zinc-400">
            Verified against the NZTR people registry
            {verifiedSince ? " on " + verifiedSince : ""}
          </p>
          {user && user.id !== trainer.id ? (
            <form action={startDirectMessage} className="mt-3">
              <input type="hidden" name="user_id" value={trainer.id} />
              <button type="submit" className={buttonClasses("outline", "sm")}>
                Message
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {trainer.bio ? (
        <p className="mt-6 max-w-2xl text-zinc-700">{trainer.bio}</p>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Upcoming runners
        </h2>
        {runners.length > 0 ? (
          <Card>
            <CardBody className="divide-y divide-line p-0">
              {runners.map((runner) => {
                const meeting = runner.meetings;
                const race = runner.races;
                const time = formatRunnerTime(race?.start_time ?? null);
                return (
                  <div key={runner.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{runner.horse_name}</p>
                        <p className="mt-0.5 text-sm text-zinc-500">
                          Race {runner.race_number}
                          {race?.name ? " - " + race.name : ""}
                        </p>
                      </div>
                      <div className="text-right text-xs text-zinc-500">
                        {meeting ? (
                          <>
                            <p className="font-medium text-ink">{meeting.track}</p>
                            <p>{formatRunnerDate(meeting.meeting_date)}</p>
                          </>
                        ) : null}
                        {time ? <p>{time}</p> : null}
                      </div>
                    </div>
                    {runner.jockey_name ? (
                      <p className="mt-2 text-xs text-zinc-400">
                        Jockey: {runner.jockey_name}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
            <p className="text-sm text-zinc-500">
              No upcoming runners have been synced for this stable yet.
            </p>
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}
