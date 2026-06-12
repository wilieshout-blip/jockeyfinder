export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { RegistryPeople } from "@/components/registry-people";

export const metadata: Metadata = {
  title: "Trainers | JockeyFinder",
  description:
    "Verified New Zealand trainers on JockeyFinder, auto-verified against the NZTR people registry.",
};

interface DirectoryTrainer {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  base_region: string | null;
  country: string | null;
}

export default async function TrainersPage() {
  const supabase = await createClient();

  const { data: trainers } = await supabase
    .from("public_profiles")
    .select("id, full_name, profile_photo_url, bio, base_region, country")
    .eq("role", "trainer")
    .order("full_name", { ascending: true })
    .returns<DirectoryTrainer[]>();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
          Verified stables
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Trainer directory
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Trainers are verified automatically against the NZTR people
          registry, so jockeys and agents know they are dealing with the real
          stable.
        </p>
      </div>

      {trainers && trainers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {trainers.map((t) => (
            <article
              key={t.id}
              className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start gap-4">
                <Avatar src={t.profile_photo_url} name={t.full_name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                      {t.full_name}
                    </h2>
                    <VerifiedBadge />
                  </div>
                  {t.base_region ? (
                    <p className="mt-1 text-sm text-zinc-500">{t.base_region}</p>
                  ) : null}
                </div>
              </div>
              {t.bio ? (
                <p className="mt-3 line-clamp-2 text-sm text-zinc-600">{t.bio}</p>
              ) : null}
              <div className="mt-4 flex justify-end border-t border-line pt-4">
                <Link
                  href={`/trainers/${t.id}`}
                  className={buttonClasses("outline", "sm")}
                >
                  View profile
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No verified trainers yet">
          Trainers are verified automatically when their phone number matches
          the NZTR registry. Sign up as a trainer to appear here.
        </EmptyState>
      )}

      <RegistryPeople role="trainer" signupLabel="I am a trainer, sign me up" />
    </div>
  );
}
