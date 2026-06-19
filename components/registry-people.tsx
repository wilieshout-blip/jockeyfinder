import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { RegistryPeopleList } from "@/components/registry-people-list";
import type { RegistryPerson } from "@/components/registry-people-list";

/**
 * Normalised match key: first-name initial + surname, lower-cased.
 * Registry names are "A Mudhoo"; race-card names are "Rohan Mudhoo", so we
 * match on initial + surname rather than the full string.
 */
function personKey(name: string | null): string {
  if (!name) return "";
  const clean = name
    .replace(/^(Mr|Mrs|Ms|Miss|Dr|Prof|Rev)\.?\s+/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const initial = (parts[0][0] || "").toUpperCase();
  const surname = parts[parts.length - 1].toLowerCase();
  if (!initial || !surname) return "";
  return initial + ":" + surname;
}

interface EntryStat {
  runner_count: number;
  upcoming_runner_count: number;
  last_seen_date: string | null;
}

/**
 * People from the official NZTR register who have not claimed their
 * JockeyFinder profile yet. Shows contact info from the registry plus
 * race-card activity (runners / upcoming / last seen) synced from LoveRacing.
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

  // Aggregate race-card runners per person from synced entries.
  const nameCol = role === "jockey" ? "jockey_name" : "trainer_name";
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: entries }, { data: meetings }] = await Promise.all([
    supabase.from("race_entries").select(`${nameCol}, meeting_id`).not(nameCol, "is", null),
    supabase.from("meetings").select("id, meeting_date"),
  ]);

  const dateByMeeting = new Map<string, string>(
    (meetings ?? []).map((m: { id: string; meeting_date: string }) => [m.id, m.meeting_date])
  );

  const statsByKey = new Map<string, EntryStat>();
  for (const row of (entries ?? []) as Array<Record<string, string | null>>) {
    const name = row[nameCol];
    const key = personKey(name);
    if (!key) continue;
    const date = row.meeting_id ? dateByMeeting.get(row.meeting_id) ?? null : null;
    const stat = statsByKey.get(key) ?? {
      runner_count: 0,
      upcoming_runner_count: 0,
      last_seen_date: null,
    };
    stat.runner_count += 1;
    if (date && date >= today) stat.upcoming_runner_count += 1;
    if (date && (!stat.last_seen_date || date > stat.last_seen_date)) {
      stat.last_seen_date = date;
    }
    statsByKey.set(key, stat);
  }

  const peopleWithStats: RegistryPerson[] = people.map((person) => {
    const stat = statsByKey.get(personKey(person.full_name));
    return stat ? { ...person, ...stat } : person;
  });

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
            contact info and recent race-card activity. They unlock their full
            profile the moment they sign up.
          </p>
        </div>
        <Link href={`/signup?role=${role}`} className={buttonClasses("outline", "sm")}>
          {signupLabel}
        </Link>
      </div>
      <RegistryPeopleList people={peopleWithStats} />
    </section>
  );
}
