export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ClothChip } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { RegistryPeople } from "@/components/registry-people";
import { formatClaim, formatWeight, nzToday, nzDatePlusDays } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Jockeys | JockeyFinder",
  description:
    "Verified New Zealand jockeys with current riding weights, apprentice claims, and upcoming meeting attendance.",
};

interface DirectoryJockey {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  licence_type: string | null;
  apprentice: boolean;
  apprentice_claim: number | null;
  riding_weight: number | null;
  base_region: string | null;
}

const LICENCE_LABELS: Record<string, string> = {
  race_jockey: "Race jockey",
  trial_jumpout_only: "Trials and jumpouts only",
};

export default async function JockeysPage() {
  const supabase = await createClient();

  const { data: jockeys } = await supabase
    .from("public_profiles")
    .select(
      "id, full_name, profile_photo_url, bio, licence_type, apprentice, apprentice_claim, riding_weight, base_region"
    )
    .eq("role", "jockey")
    .order("full_name", { ascending: true })
    .returns<DirectoryJockey[]>();

  // Count upcoming meetings each jockey is attending (next 30 days).
  const counts = new Map<string, number>();
  const { data: upcoming } = await supabase
    .from("meetings")
    .select("id")
    .gte("meeting_date", nzToday())
    .lte("meeting_date", nzDatePlusDays(30));

  const meetingIds = (upcoming ?? []).map((m) => m.id);
  if (meetingIds.length > 0) {
    const { data: rows } = await supabase
      .from("public_meeting_attendance")
      .select("meeting_id, jockey_id")
      .in("meeting_id", meetingIds);
    for (const r of rows ?? []) {
      counts.set(r.jockey_id, (counts.get(r.jockey_id) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
          Verified riders
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Jockey directory
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Every jockey here has been verified by the JockeyFinder team.
          Weights and claims are as declared on their profile.
        </p>
      </div>

      {jockeys && jockeys.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {jockeys.map((j) => {
            const claim = formatClaim(j.apprentice_claim);
            const meetingCount = counts.get(j.id) ?? 0;
            return (
              <article
                key={j.id}
                className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift"
              >
                <div className="flex items-start gap-4">
                  <Avatar src={j.profile_photo_url} name={j.full_name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                      {j.full_name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {j.riding_weight != null ? (
                        <Badge tone="neutral">{formatWeight(j.riding_weight)}</Badge>
                      ) : null}
                      {j.apprentice && claim ? (
                        <ClothChip tone="turf">{claim}</ClothChip>
                      ) : null}
                      {j.licence_type ? (
                        <Badge tone="neutral">
                          {LICENCE_LABELS[j.licence_type] ?? j.licence_type}
                        </Badge>
                      ) : null}
                    </div>
                    {j.base_region ? (
                      <p className="mt-1.5 text-sm text-zinc-500">{j.base_region}</p>
                    ) : null}
                  </div>
                </div>

                {j.bio ? (
                  <p className="mt-3 line-clamp-2 text-sm text-zinc-600">{j.bio}</p>
                ) : null}

                <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                  <p className="text-sm text-zinc-500">
                    Attending{" "}
                    <span className="font-semibold text-ink">{meetingCount}</span>{" "}
                    upcoming {meetingCount === 1 ? "meeting" : "meetings"}
                  </p>
                  <Link
                    href={`/jockeys/${j.id}`}
                    className={buttonClasses("outline", "sm")}
                  >
                    View profile
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No verified jockeys yet">
          Jockeys appear here once their profile has been verified. If you are
          a jockey, sign up and complete your profile to get verified.
        </EmptyState>
      )}

      <RegistryPeople role="jockey" signupLabel="I am a jockey, sign me up" />
    </div>
  );
}
