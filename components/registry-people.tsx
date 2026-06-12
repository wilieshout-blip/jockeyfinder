import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";

/**
 * People from the official NZTR register who have not claimed their
 * JockeyFinder profile yet. Names and locations only, phone numbers
 * stay private. Once they sign up with their registered phone number
 * their live profile takes over and they disappear from this list.
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
    .select("id, full_name, location")
    .eq("role", role)
    .order("full_name", { ascending: true });

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
            Licensed {role}s from the official register. They unlock their
            profile the moment they sign up with their registered phone number.
          </p>
        </div>
        <Link href="/signup" className={buttonClasses("outline", "sm")}>
          {signupLabel}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-mist/50 px-4 py-3"
          >
            <Avatar name={p.full_name} src={null} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-700">
                {p.full_name}
              </p>
              {p.location ? (
                <p className="truncate text-xs text-zinc-400">{p.location}</p>
              ) : null}
            </div>
            <Badge tone="neutral">Unclaimed</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}
