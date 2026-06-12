import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ClothChip, VerifiedBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DateBlock } from "@/components/racing";
import { formatClaim, formatWeight, nzToday } from "@/lib/utils";
import type { Meeting, Profile } from "@/lib/types";

interface PublicJockey {
  id: string;
  role: string;
  full_name: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  licence_type: string | null;
  apprentice: boolean;
  apprentice_claim: number | null;
  riding_weight: number | null;
  apprentice_riding_weight: number | null;
  base_region: string | null;
  preferred_tracks: string | null;
  availability_notes: string | null;
}

const LICENCE_LABELS: Record<string, string> = {
  race_jockey: "Race jockey",
  trial_jumpout_only: "Trials and jumpouts only",
};

export default async function JockeyProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: jockey } = await supabase
    .from("public_profiles")
    .select("*")
    .eq("id", params.id)
    .eq("role", "jockey")
    .maybeSingle<PublicJockey>();

  if (!jockey) notFound();

  // Upcoming meetings this jockey is attending.
  const { data: attendance } = await supabase
    .from("public_meeting_attendance")
    .select("meeting_id")
    .eq("jockey_id", jockey.id);

  let upcoming: Meeting[] = [];
  const meetingIds = (attendance ?? []).map((a) => a.meeting_id);
  if (meetingIds.length > 0) {
    const { data } = await supabase
      .from("meetings")
      .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type")
      .in("id", meetingIds)
      .gte("meeting_date", nzToday())
      .order("meeting_date", { ascending: true })
      .returns<Meeting[]>();
    upcoming = data ?? [];
  }

  // Show the request button only to verified trainers.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewer: Profile | null = null;
  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>();
    viewer = p;
  }
  const canRequest = viewer?.role === "trainer" && viewer.verified;

  const claim = formatClaim(jockey.apprentice_claim);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/jockeys" className="text-sm font-medium text-zinc-500 hover:text-ink">
        ← All jockeys
      </Link>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-5">
          <Avatar src={jockey.profile_photo_url} name={jockey.full_name} size="xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {jockey.full_name}
              </h1>
              <VerifiedBadge />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {jockey.riding_weight != null ? (
                <Badge tone="neutral">{formatWeight(jockey.riding_weight)}</Badge>
              ) : null}
              {jockey.apprentice && claim ? (
                <ClothChip tone="turf">{claim}</ClothChip>
              ) : null}
              {jockey.licence_type ? (
                <Badge tone="neutral">
                  {LICENCE_LABELS[jockey.licence_type] ?? jockey.licence_type}
                </Badge>
              ) : null}
            </div>
            {jockey.base_region ? (
              <p className="mt-2 text-sm text-zinc-500">Based in {jockey.base_region}</p>
            ) : null}
          </div>
        </div>

        {canRequest ? (
          <Link
            href={`/dashboard/requests/new?jockey=${jockey.id}`}
            className={buttonClasses("accent", "md", "shrink-0")}
          >
            Request a ride
          </Link>
        ) : null}
      </div>

      {jockey.bio ? (
        <p className="mt-6 max-w-2xl text-zinc-700">{jockey.bio}</p>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Riding details
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Riding weight</dt>
                <dd className="font-medium text-ink">
                  {formatWeight(jockey.riding_weight) ?? "Not set"}
                </dd>
              </div>
              {jockey.apprentice ? (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Apprentice claim</dt>
                    <dd className="font-medium text-ink">{claim ?? "Not set"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Weight with claim</dt>
                    <dd className="font-medium text-ink">
                      {formatWeight(jockey.apprentice_riding_weight) ?? "Not set"}
                    </dd>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Preferred tracks</dt>
                <dd className="max-w-[60%] text-right font-medium text-ink">
                  {jockey.preferred_tracks ?? "Anywhere"}
                </dd>
              </div>
            </dl>
            {jockey.availability_notes ? (
              <p className="mt-4 rounded-xl bg-mist p-3 text-sm text-zinc-600">
                {jockey.availability_notes}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Racing history
            </h2>
            <p className="text-sm text-zinc-500">
              Ride statistics and recent results will appear here once race
              level data sync is added.
            </p>
          </CardBody>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Attending upcoming meetings · {upcoming.length}
        </h2>
        {upcoming.length > 0 ? (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-white p-3 transition-colors hover:border-turf-200 hover:bg-turf-50/40"
              >
                <DateBlock date={m.meeting_date} />
                <div className="min-w-0">
                  <p className="font-medium text-ink">{m.track}</p>
                  {m.club ? (
                    <p className="truncate text-sm text-zinc-500">{m.club}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            No upcoming meetings marked yet.
          </p>
        )}
      </section>
    </div>
  );
}
