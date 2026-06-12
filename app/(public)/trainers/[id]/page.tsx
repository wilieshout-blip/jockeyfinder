import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";

interface PublicTrainer {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  base_region: string | null;
  country: string | null;
}

export default async function TrainerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: trainer } = await supabase
    .from("public_profiles")
    .select("id, full_name, profile_photo_url, bio, base_region, country")
    .eq("id", params.id)
    .eq("role", "trainer")
    .maybeSingle<PublicTrainer>();

  if (!trainer) notFound();

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
          <p className="mt-1 text-xs text-zinc-400">
            Verified against the NZTR people registry
          </p>
        </div>
      </div>

      {trainer.bio ? (
        <p className="mt-6 max-w-2xl text-zinc-700">{trainer.bio}</p>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Runners
        </h2>
        <Card>
          <CardBody>
            <p className="text-sm text-zinc-500">
              Horses and upcoming runners for this stable will appear here
              once race level data sync is added.
            </p>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
