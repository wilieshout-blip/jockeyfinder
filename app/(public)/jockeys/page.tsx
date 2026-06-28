export const revalidate = 900;

import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { nzToday, nzDatePlusDays, registryKey } from "@/lib/utils";
import { JockeyDirectory } from "./jockey-directory";
import type { DirectoryJockey, JockeyStat } from "./jockey-cards";
import type { RegistryPerson } from "@/components/registry-people-list";

export const metadata: Metadata = {
  title: "Jockeys",
  description:
    "Verified New Zealand jockeys with current riding weights, apprentice claims, and upcoming meeting attendance.",
};

export default async function JockeysPage() {
  const supabase = createPublicClient();

  const { data: jockeysRaw } = await supabase
    .from("public_profiles")
    .select(
      "id, full_name, profile_photo_url, bio, licence_type, apprentice, apprentice_claim, riding_weight, base_region, phone"
    )
    .eq("role", "jockey")
    .order("full_name", { ascending: true });

  // Agent names + phones for every represented jockey. Read from the
  // security-definer public_jockey_agents view because agent_jockeys itself is
  // RLS-locked to the agent/jockey, so the anon directory could never see it.
  const jockeyIds = (jockeysRaw ?? []).map((j: any) => j.id);
  const agentPhoneMap: Record<string, string> = {};
  const agentNameMap: Record<string, string> = {};
  if (jockeyIds.length > 0) {
    const { data: agentLinks } = await supabase
      .from("public_jockey_agents")
      .select("jockey_id, agent_name, agent_phone")
      .in("jockey_id", jockeyIds);
    for (const link of agentLinks ?? []) {
      if ((link as any).agent_phone) agentPhoneMap[(link as any).jockey_id] = (link as any).agent_phone;
      if ((link as any).agent_name) agentNameMap[(link as any).jockey_id] = (link as any).agent_name;
    }
  }

  const jockeys: DirectoryJockey[] = (jockeysRaw ?? []).map((j: any) => ({
    ...j,
    agent_phone: agentPhoneMap[j.id] ?? null,
    agent_name: agentNameMap[j.id] ?? null,
  }));

  // Authoritative season + career stats from the LoveRacing premiership feed
  // (synced by scripts/sync-premierships.mjs). Matched to our jockeys by
  // first-initial + surname, since the feed names them "E Nicholas (a)".
  const { data: premRows } = await supabase
    .from("nztr_jockey_stats")
    .select(
      "name, season_wins, season_seconds, season_thirds, season_starts, career_wins, career_starts, career_is_true, season_id"
    );
  const premByKey = new Map<string, any>();
  for (const r of premRows ?? []) {
    const key = registryKey((r as any).name);
    if (key) premByKey.set(key, r);
  }
  const statsById: Record<string, JockeyStat> = {};
  for (const j of jockeys) {
    const r = premByKey.get(registryKey(j.full_name));
    if (!r) continue;
    statsById[j.id] = {
      season_wins: r.season_wins,
      season_seconds: r.season_seconds,
      season_thirds: r.season_thirds,
      season_starts: r.season_starts,
      career_wins: r.career_wins,
      career_starts: r.career_starts,
      career_is_true: r.career_is_true,
    };
  }

  const counts: Record<string, number> = {};
  const { data: upcoming } = await supabase
    .from("meetings")
    .select("id")
    .gte("meeting_date", nzToday())
    .lte("meeting_date", nzDatePlusDays(30));

  const meetingIds = (upcoming ?? []).map((m: any) => m.id);
  if (meetingIds.length > 0) {
    const { data: rows } = await supabase
      .from("public_meeting_attendance")
      .select("meeting_id, jockey_id")
      .in("meeting_id", meetingIds);
    for (const r of rows ?? []) {
      counts[(r as any).jockey_id] = (counts[(r as any).jockey_id] ?? 0) + 1;
    }
  }

  const { data: registryRaw } = await supabase
    .from("public_registry_people")
    .select("id, full_name, location, phone")
    .eq("role", "jockey")
    .order("full_name", { ascending: true })
    .returns<RegistryPerson[]>();

  // Race-card activity for unclaimed registry jockeys (matched by initial+surname).
  const { data: activityRows } = await supabase
    .from("race_entries")
    .select("jockey_name, meetings(meeting_date)")
    .not("jockey_name", "is", null)
    .limit(5000);

  const today = nzToday();
  const activityByJockey = new Map<
    string,
    { runner_count: number; upcoming_runner_count: number; last_seen_date: string | null }
  >();
  for (const row of (activityRows ?? []) as any[]) {
    const key = registryKey(row.jockey_name);
    if (!key) continue;
    const meeting = Array.isArray(row.meetings) ? row.meetings[0] : row.meetings;
    const date = meeting?.meeting_date ?? null;
    const current =
      activityByJockey.get(key) ?? {
        runner_count: 0,
        upcoming_runner_count: 0,
        last_seen_date: null,
      };
    current.runner_count += 1;
    if (date && date >= today) current.upcoming_runner_count += 1;
    if (date && (!current.last_seen_date || date > current.last_seen_date)) {
      current.last_seen_date = date;
    }
    activityByJockey.set(key, current);
  }

  const registryWithStats: RegistryPerson[] = (registryRaw ?? []).map((person) => ({
    ...person,
    ...(activityByJockey.get(registryKey(person.full_name)) ?? {
      runner_count: 0,
      upcoming_runner_count: 0,
      last_seen_date: null,
    }),
  }));

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
          Every jockey here has been verified by the JockeyFinder team. Tap a
          card to see stats, contact info, and details.
        </p>
      </div>

      <JockeyDirectory
        jockeys={jockeys}
        statsById={statsById}
        counts={counts}
        registryPeople={registryWithStats}
      />
    </div>
  );
}
