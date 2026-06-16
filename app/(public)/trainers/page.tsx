export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TrainerDirectory } from "./trainer-directory";
import type { DirectoryTrainer, RegistryTrainer } from "./trainer-cards";
import type { RegistryPerson } from "@/components/registry-people-list";

export const metadata: Metadata = {
    title: "Trainers | JockeyFinder",
      description:
          "Verified New Zealand trainers on JockeyFinder, auto-verified against the NZTR people registry.",
};

export default async function TrainersPage() {
    const supabase = await createClient();

      const { data: trainers } = await supabase
          .from("public_profiles")
              .select("id, full_name, profile_photo_url, bio, base_region, country")
                  .eq("role", "trainer")
                      .order("full_name", { ascending: true })
                          .returns<DirectoryTrainer[]>();

                            const { data: registry } = await supabase
                                .from("nztr_people_registry")
                                    .select("full_name, location")
                                        .eq("role", "trainer")
                                            .returns<RegistryTrainer[]>();

                                              const { data: registryRaw } = await supabase
                                                  .from("public_registry_people")
                                                      .select("id, full_name, location, phone")
                                                          .eq("role", "trainer")
                                                              .order("full_name", { ascending: true })
                                                                  .returns<RegistryPerson[]>();

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
                                                                                                                                                      Trainers are verified automatically against the NZTR people registry.
                                                                                                                                                                Tap a card to see their details.
                                                                                                                                                                        </p>
                                                                                                                                                                              </div>

                                                                                                                                                                                    <TrainerDirectory
                                                                                                                                                                                            trainers={trainers ?? []}
                                                                                                                                                                                                    registry={registry ?? []}
                                                                                                                                                                                                            registryPeople={registryRaw ?? []}
                                                                                                                                                                                                                  />
                                                                                                                                                                                                                      </div>
                                                                    );
}
