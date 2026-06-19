export const revalidate = 900;

import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { TrainerDirectory } from "./trainer-directory";
import type { DirectoryTrainer, RegistryTrainer } from "./trainer-cards";
import type { RegistryPerson } from "@/components/registry-people-list";
import { nzToday } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Trainers",
  description:
    "Verified New Zealand trainers on JockeyFinder, auto-verified against the NZTR people registry.",
};

interface TrainerActivityRow {
  trainer_name: string | null;
  meetings:
    | {
        meeting_date: string | null;
      }
    | Array<{
        meeting_date: string | null;
      }>
    | null;
}

interface TrainerActivity {
  runner_count: number;
  upcoming_runner_count: number;
  last_seen_date: string | null;
}

function stripTitle(name: string | null) {
  if (!name) return "";
  return name
    .replace(/^(Mr\.?|Mrs\.?|Ms\.?|Miss\.?|Dr\.?|Prof\.?|Rev\.?)\s+/i, "")
    .trim();
}

// Registry names are "J Smith"; race-card names are "John Smith" — so match on
// first-name initial + surname rather than the full normalised string.
function trainerKey(name: string | null) {
  const clean = stripTitle(name)
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const initial = (parts[0][0] || "").toUpperCase();
  const surname = parts[parts.length - 1].toLowerCase();
  if (!initial || !surname) return "";
  return initial + ":" + surname;
}

function meetingDate(row: TrainerActivityRow) {
  const meeting = Array.isArray(row.meetings) ? row.meetings[0] : row.meetings;
  return meeting?.meeting_date ?? null;
}

function buildTrainerActivity(rows: TrainerActivityRow[]) {
  const today = nzToday();
  const map = new Map<string, TrainerActivity>();

  for (const row of rows) {
    const key = trainerKey(row.trainer_name);
    if (!key) continue;
    const date = meetingDate(row);
    const current =
      map.get(key) ??
      ({ runner_count: 0, upcoming_runner_count: 0, last_seen_date: null } satisfies TrainerActivity);

    current.runner_count += 1;
    if (date && date >= today) current.upcoming_runner_count += 1;
    if (date && (!current.last_seen_date || date > current.last_seen_date)) {
      current.last_seen_date = date;
    }
    map.set(key, current);
  }

  return map;
}

export default async function TrainersPage() {
  const supabase = createPublicClient();

  const { data: trainers } = await supabase
    .from("public_profiles")
    .select("id, full_name, profile_photo_url, bio, base_region, country, preferred_tracks, created_at")
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

  const { data: activityRows } = await supabase
    .from("race_entries")
    .select("trainer_name, meetings(meeting_date)")
    .not("trainer_name", "is", null)
    .limit(5000)
    .returns<TrainerActivityRow[]>();

  const activityByTrainer = buildTrainerActivity(activityRows ?? []);
  const withActivity = <T extends { full_name: string | null }>(person: T): T & TrainerActivity => ({
    ...person,
    ...(activityByTrainer.get(trainerKey(person.full_name)) ?? {
      runner_count: 0,
      upcoming_runner_count: 0,
      last_seen_date: null,
    }),
  });

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
        trainers={(trainers ?? []).map(withActivity)}
        registry={registry ?? []}
        registryPeople={(registryRaw ?? []).map(withActivity)}
      />
    </div>
  );
}
