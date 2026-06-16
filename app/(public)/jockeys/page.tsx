export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty";
import { RegistryPeople } from "@/components/registry-people";
import { nzToday, nzDatePlusDays } from "@/lib/utils";
import { JockeyCards } from "./jockey-cards";
import type { DirectoryJockey, JockeyStat } from "./jockey-cards";

export const metadata: Metadata = {
  title: "Jockeys | JockeyFinder",
  description:
    "Verified New Zealand jockeys with current riding weights, apprentice claims, and upcoming meeting attendance.",
};

export default async function JockeysPage() {
  const supabase = await createClient();

  const { data: jockeysRaw } = await supabase
    .from("public_profiles")
    .select(
      "id, full_name, profile_photo_url, bio, licence_type, apprentice, apprentice_claim, riding_weight, base_region, phone"
    )
    .eq("role", "jockey")
    .order("full_name", { ascending: true });

  // Agent phones: jockey_id -> agent phone
  const jockeyIds = (jockeysRaw ?? []).map((j: any) => j.id);
  const agentPhoneMap: Record<string, string> = {};
  if (jockeyIds.length > 0) {
    const { data: agentLinks } = await supabase
      .from("agent_jockeys")
      .select("jockey_id, agent:profiles!agent_id(phone)")
      .in("jockey_id", jockeyIds);
    for (const link of agentLinks ?? []) {
      const agentPhone = (link as any).agent?.phone;
      if (agentPhone) agentPhoneMap[link.jockey_id] = agentPhone;
    }
  }

  const jockeys: DirectoryJockey[] = (jockeysRaw ?? []).map((j: any) => ({
    ...j,
    agent_phone: agentPhoneMap[j.id] ?? null,
  }));

  // Season stats - keyed by jockey_name for matching
  const { data: statsRows } = await supabase
    .from("jockey_season_stats")
    .select("jockey_name, total_rides, wins, places, win_pct")
    .returns<JockeyStat[]>();

  // Count upcoming meetings each jockey is attending (next 30 days)
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

      {jockeys.length > 0 ? (
        <JockeyCards
          jockeys={jockeys}
          stats={statsRows ?? []}
          counts={counts}
        />
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
