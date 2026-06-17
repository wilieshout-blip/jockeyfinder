import { createAdminClient } from "@/lib/supabase/admin";

export interface TabRaceCardSyncResult {
  ok: boolean;
  synced: number;
  meetings: number;
  races: number;
  entries: number;
  registryPeople: number;
  debug?: string[];
  errors?: string[];
  error?: string;
}

interface TabVenue {
  name?: string | null;
  country?: string | null;
  state?: string | null;
}

interface TabRace {
  id: string;
  name?: string | null;
  number?: number | string | null;
  advertisedStart?: string | null;
  finalFieldMarket?: {
    id?: string | null;
    status?: string | null;
    advertisedStart?: string | null;
  } | null;
}

interface TabMeeting {
  id: string;
  name?: string | null;
  advertisedStart?: string | null;
  meetingCode?: string | null;
  venue?: TabVenue | null;
  races?: {
    nodes?: TabRace[] | null;
  } | null;
}

interface TabRunnerRow {
  id?: string | null;
  name?: string | null;
  number?: number | string | null;
  barrier?: number | string | null;
  barrierLabel?: string | null;
  subtitle?: string | null;
  trainerName?: string | null;
  jockeyName?: string | null;
}

interface MeetingRow {
  id: string;
  nztr_day_id: number | null;
  meeting_date: string;
  track: string;
  club: string | null;
}

interface RaceRow {
  id: string;
  race_number: number;
}

const TAB_GRAPHQL_ENDPOINT = "https://api.tab.co.nz/graphql";

const RACING_DAY_QUERY = `
query RacingDay($date: Date!, $regions: [Region!]) {
  racingDay(categories: [HORSE], regions: $regions, date: $date) {
    nodes {
      id
      name
      advertisedStart
      meetingCode
      venue {
        name
        country
        state
      }
      races: racesConnection(first: 80) {
        nodes {
          id
          name
          number
          advertisedStart
          finalFieldMarket {
            id
            status
            advertisedStart
          }
        }
      }
    }
  }
}
`;

const RACE_CARD_QUERY = `
query RaceCard($id: ID!) {
  node(id: $id) {
    __typename
    id
    ... on RacingRaceCard {
      finalField(baseAvailability: true) {
        runnerRows {
          id
          name
          number
          barrier
          barrierLabel
          subtitle
        }
      }
    }
  }
}
`;

function formatNzDate(d: Date) {
  return (
    String(d.getFullYear()) +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function nzDatePlus(offsetDays: number) {
  const nowNz = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" })
  );
  nowNz.setDate(nowNz.getDate() + offsetDays);
  return formatNzDate(nowNz);
}

function toRaceCardId(raceId: string) {
  return raceId.replace(/^RacingRace:/, "RacingRaceCard:");
}

function toPseudoNztrDayId(tabMeetingId: string) {
  let hash = 0;
  for (let i = 0; i < tabMeetingId.length; i += 1) {
    hash = (hash * 31 + tabMeetingId.charCodeAt(i)) >>> 0;
  }
  return -1 * (1000000000 + (hash % 900000000));
}

function normalizeText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function personKey(value?: string | null) {
  return normalizeText(stripTitle(value)).replace(/ /g, "");
}

function stripTitle(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/^(Mr\.?|Mrs\.?|Ms\.?|Miss\.?|Dr\.?|Prof\.?|Rev\.?)\s+/i, "")
    .trim();
}

function cleanRoleName(value?: string | null, prefix?: "J" | "T") {
  if (!value) return null;
  let cleaned = value.trim();
  if (prefix) {
    cleaned = cleaned.replace(new RegExp("^" + prefix + ":\\s*", "i"), "");
  }
  cleaned = cleaned.replace(/\s+\([^)]+\)\s*$/, "").trim();
  return cleaned || null;
}

function namesFromSubtitle(subtitle?: string | null) {
  const value = subtitle ?? "";
  const jockey =
    value.match(/(?:^|\s)J:\s*([^|]+?)(?:\s+T:|$)/i)?.[1]?.trim() ?? null;
  const trainer =
    value.match(/(?:^|\s)T:\s*([^|]+?)(?:\s+J:|$)/i)?.[1]?.trim() ?? null;
  return {
    jockey: cleanRoleName(jockey, "J"),
    trainer: cleanRoleName(trainer, "T"),
  };
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isNzMeeting(meeting: TabMeeting) {
  const venue = meeting.venue;
  const country = normalizeText(venue?.country);
  const state = normalizeText(venue?.state);
  return country === "nz" || country === "new zealand" || state === "nz";
}

function tabMeetingTrack(meeting: TabMeeting) {
  return (
    meeting.venue?.name ||
    meeting.name ||
    meeting.meetingCode ||
    "TAB NZ meeting"
  );
}

function tabMeetingClub(meeting: TabMeeting) {
  return meeting.name || meeting.venue?.name || null;
}

function meetingMatches(existing: MeetingRow, tabMeeting: TabMeeting) {
  const existingTrack = normalizeText(existing.track);
  const existingClub = normalizeText(existing.club);
  const tabTrack = normalizeText(tabMeetingTrack(tabMeeting));
  const tabClub = normalizeText(tabMeetingClub(tabMeeting));
  if (!existingTrack || !tabTrack) return false;
  return (
    existingTrack === tabTrack ||
    existingTrack.includes(tabTrack) ||
    tabTrack.includes(existingTrack) ||
    (!!existingClub && existingClub === tabClub)
  );
}

async function tabGraphql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetch(TAB_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://www.tab.co.nz",
      Referer: "https://www.tab.co.nz/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("TAB responded with " + res.status + ": " + text.slice(0, 120));
  }

  const json = await res.json();
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    throw new Error(json.errors.map((e: { message?: string }) => e.message).join("; "));
  }
  return json.data as T;
}

async function fetchRacingDay(date: string) {
  const data = await tabGraphql<{
    racingDay?: { nodes?: TabMeeting[] | null } | null;
  }>(RACING_DAY_QUERY, { date, regions: ["DOMESTIC", "INTERNATIONAL"] });

  return (data.racingDay?.nodes ?? []).filter(isNzMeeting);
}

async function fetchRaceCard(raceId: string) {
  const data = await tabGraphql<{
    node?: {
      finalField?: { runnerRows?: TabRunnerRow[] | null } | null;
    } | null;
  }>(RACE_CARD_QUERY, { id: toRaceCardId(raceId) });

  return data.node?.finalField?.runnerRows ?? [];
}

async function ensureRegistryPeople(
  namesByRole: Record<"trainer" | "jockey", Set<string>>
) {
  const supabase = createAdminClient();
  let inserted = 0;

  for (const role of ["trainer", "jockey"] as const) {
    const names = [...namesByRole[role]].filter(Boolean);
    if (names.length === 0) continue;

    const { data: existing } = await supabase
      .from("nztr_people_registry")
      .select("full_name")
      .eq("role", role);

    const existingKeys = new Set(
      (existing ?? [])
        .map((row: { full_name: string | null }) => personKey(row.full_name))
        .filter(Boolean)
    );

    const rows = names
      .filter((name) => !existingKeys.has(personKey(name)))
      .map((name) => ({
        role,
        full_name: name,
        location: null,
        phone: null,
        phone_normalized: null,
      }));

    if (rows.length === 0) continue;
    const { error } = await supabase.from("nztr_people_registry").insert(rows);
    if (!error) inserted += rows.length;
  }

  return inserted;
}

export async function syncTabNzRaceCards(
  days = 14
): Promise<TabRaceCardSyncResult> {
  const supabase = createAdminClient();
  const debug: string[] = [];
  const errors: string[] = [];
  let meetingCount = 0;
  let raceCount = 0;
  let entryCount = 0;
  const registryNames: Record<"trainer" | "jockey", Set<string>> = {
    trainer: new Set(),
    jockey: new Set(),
  };

  for (let offset = 0; offset <= days; offset += 1) {
    const meetingDate = nzDatePlus(offset);

    try {
      const tabMeetings = await fetchRacingDay(meetingDate);
      if (tabMeetings.length === 0) continue;

      const { data: existingMeetings, error: existingError } = await supabase
        .from("meetings")
        .select("id, nztr_day_id, meeting_date, track, club")
        .eq("meeting_date", meetingDate)
        .returns<MeetingRow[]>();

      if (existingError) {
        errors.push(meetingDate + ": " + existingError.message);
        continue;
      }

      for (const tabMeeting of tabMeetings) {
        const matched = (existingMeetings ?? []).find((m) =>
          meetingMatches(m, tabMeeting)
        );
        const nztrDayId = matched?.nztr_day_id ?? toPseudoNztrDayId(tabMeeting.id);
        let meetingId = matched?.id ?? null;

        if (meetingId) {
          if (!matched?.nztr_day_id) {
            const { error } = await supabase
              .from("meetings")
              .update({ nztr_day_id: nztrDayId, source: "tab" })
              .eq("id", meetingId);
            if (error) errors.push(tabMeetingTrack(tabMeeting) + ": " + error.message);
          }
        } else {
          const { data: inserted, error } = await supabase
            .from("meetings")
            .upsert(
              {
                nztr_day_id: nztrDayId,
                meeting_date: meetingDate,
                track: tabMeetingTrack(tabMeeting),
                club: tabMeetingClub(tabMeeting),
                source: "tab",
                meeting_type: "R",
              },
              { onConflict: "nztr_day_id" }
            )
            .select("id")
            .single();

          if (error) {
            errors.push(tabMeetingTrack(tabMeeting) + ": " + error.message);
            continue;
          }
          meetingId = inserted.id as string;
        }

        meetingCount += 1;
        const tabRaces = tabMeeting.races?.nodes ?? [];
        if (tabRaces.length === 0) {
          debug.push(tabMeetingTrack(tabMeeting) + ": no TAB races yet");
          continue;
        }

        const raceRows = tabRaces
          .map((race) => {
            const raceNumber = numberOrNull(race.number);
            if (!raceNumber) return null;
            return {
              meeting_id: meetingId,
              nztr_day_id: nztrDayId,
              race_number: raceNumber,
              name: race.name || "Race " + raceNumber,
              start_time: race.advertisedStart ?? null,
            };
          })
          .filter(Boolean) as Array<{
          meeting_id: string;
          nztr_day_id: number;
          race_number: number;
          name: string;
          start_time: string | null;
        }>;

        const { data: upsertedRaces, error: raceError } = await supabase
          .from("races")
          .upsert(raceRows, { onConflict: "nztr_day_id,race_number" })
          .select("id, race_number")
          .returns<RaceRow[]>();

        if (raceError) {
          errors.push(tabMeetingTrack(tabMeeting) + ": " + raceError.message);
          continue;
        }

        raceCount += upsertedRaces?.length ?? 0;
        const raceMap = new Map(
          (upsertedRaces ?? []).map((r) => [r.race_number, r.id])
        );

        for (const race of tabRaces) {
          const raceNumber = numberOrNull(race.number);
          if (!raceNumber) continue;

          try {
            const runners = await fetchRaceCard(race.id);
            if (runners.length === 0) continue;

            const entryRows = runners
              .map((runner) => {
                const horseName = runner.name?.trim();
                if (!horseName) return null;

                const subtitleNames = namesFromSubtitle(runner.subtitle);
                const jockeyName =
                  cleanRoleName(runner.jockeyName, "J") ?? subtitleNames.jockey;
                const trainerName =
                  cleanRoleName(runner.trainerName, "T") ?? subtitleNames.trainer;
                if (jockeyName) registryNames.jockey.add(jockeyName);
                if (trainerName) registryNames.trainer.add(trainerName);

                return {
                  meeting_id: meetingId as string,
                  race_id: raceMap.get(raceNumber) ?? null,
                  nztr_day_id: nztrDayId,
                  race_number: raceNumber,
                  horse_number: numberOrNull(runner.number),
                  horse_name: horseName,
                  barrier: numberOrNull(runner.barrier),
                  jockey_name: jockeyName,
                  trainer_name: trainerName,
                  synced_at: new Date().toISOString(),
                };
              })
              .filter(Boolean) as Array<{
              meeting_id: string;
              race_id: string | null;
              nztr_day_id: number;
              race_number: number;
              horse_number: number | null;
              horse_name: string;
              barrier: number | null;
              jockey_name: string | null;
              trainer_name: string | null;
              synced_at: string;
            }>;

            if (entryRows.length === 0) continue;

            const { error: entryError } = await supabase
              .from("race_entries")
              .upsert(entryRows, {
                onConflict: "nztr_day_id,race_number,horse_name",
              });

            if (entryError) {
              errors.push(
                tabMeetingTrack(tabMeeting) +
                  " R" +
                  raceNumber +
                  ": " +
                  entryError.message
              );
            } else {
              entryCount += entryRows.length;
            }
          } catch (err) {
            errors.push(
              tabMeetingTrack(tabMeeting) +
                " R" +
                raceNumber +
                ": " +
                (err as Error).message
            );
          }
        }

        debug.push(
          tabMeetingTrack(tabMeeting) +
            ": " +
            tabRaces.length +
            " races, " +
            entryCount +
            " total entries"
        );
      }
    } catch (err) {
      errors.push(meetingDate + ": " + (err as Error).message);
    }
  }

  const registryPeople = await ensureRegistryPeople(registryNames);

  return {
    ok: errors.length === 0 || entryCount > 0 || raceCount > 0,
    synced: entryCount,
    meetings: meetingCount,
    races: raceCount,
    entries: entryCount,
    registryPeople,
    debug,
    errors: errors.length > 0 ? errors : undefined,
    error:
      errors.length > 0 && entryCount === 0 && raceCount === 0
        ? errors[0]
        : undefined,
  };
}
