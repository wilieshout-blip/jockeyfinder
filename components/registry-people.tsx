import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { RegistryPeopleList } from "@/components/registry-people-list";
import type { RegistryPerson } from "@/components/registry-people-list";

/**
 * People from the official NZTR register who have not claimed their
 * JockeyFinder profile yet. Shows contact info from the registry.
 * Once they sign up with their registered phone number their live
 * profile takes over and they disappear from this list.
 */
export async function RegistryPeople({
  role,
  signupLabel,
}: {
  role: "jockey" | "trainer";
  signupLabel: string;
}) {
  const supabase = await createClient();
  const { data: people } = await supabase
    .from("public_registry_people")
    .select("id, full_name, location, phone")
    .eq("role", role)
    .order("full_name", { ascending: true })
    .returns<RegistryPerson[]>();

  if (!people || people.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
            NZTR register
          </p>
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
            Not on JockeyFinder yet
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Licensed {role}s from the official register. Tap a name to see their
            contact info. They unlock their full profile the moment they sign up.
          </p>
        </div>
        <Link href="/signup" className={buttonClasses("outline", "sm")}>
          {signupLabel}
        </Link>
      </div>
      <RegistryPeopleList people={people} />
    </section>
  );
}
