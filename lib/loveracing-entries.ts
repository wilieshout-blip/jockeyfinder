/**
 * lib/loveracing-entries.ts
 *
 * Fetches declared race fields from LoveRacing meeting pages, parses horse/owner
 * data from the HTML, upserts into race_entries, then fuzzy-matches owner names
 * against our profiles table to create owner_horse_claims.
 *
 * Server-only — uses admin client with service role key.
 */
import { createAdminClient } from "@/lib/supabase/admin";

const BASE = "https://loveracing.nz";

export interface RaceEntry {
  race_number: number;
  horse_name: string;
  jockey_name: string | null;
  trainer_name: string | null;
  owner_text: string | null;
  sire: string | null;
  dam: string | null;
}

/**
 * Parses the plain-text content of a LoveRacing meeting-overview.aspx page.
 *
 * The page text follows this repeating pattern per race:
 *   Race  <N>  <start_time>  <race_name>  ...
 *   # Silk Horse Jockey Trainer ...
 *   <barrier>
 *   <HorseName>  <JockeyName>  <TrainerName>  ...
 *   Owners: <owner text>  Breeder: ...  Sire: <sire>  Dam: <dam>
 */
export function parseMeetingHtml(text: string): RaceEntry[] {
  const entries: RaceEntry[] = [];

  // Split into race blocks on "Race\nN" boundaries
  // The overview page emits: "Race Start Name ..."  then per-race blocks
  const raceBlocks = text.split(/\bRace\b(?=\s*\n)/);

  let currentRaceNum = 0;
  for (const block of raceBlocks) {
    // Look for a race number at the start of the block
    const raceNumMatch = block.match(/^\s*(\d+)\s+\d{1,2}:\d{2}/);
    if (raceNumMatch) {
      currentRaceNum = parseInt(raceNumMatch[1], 10);
    }

    if (currentRaceNum === 0) continue;

    // Find each "Owners:" line — one per horse entry
    const ownerLines = [...block.matchAll(/Owners?:\s*([^\n]+)(?:\s*Breeder[^\n]*)?(?:\s*Sire:\s*(\S[^\n]*?))?(?:\s*Dam:\s*(\S[^\n]*))?/gi)];

    for (const m of ownerLines) {
      const ownerText = m[1]?.trim() ?? null;
      const sire = m[2]?.replace(/\s+\d{4}.*$/, "").trim() ?? null; // strip year+country
      const dam = m[3]?.replace(/\s+\d{4}.*$/, "").trim() ?? null;

      // The horse line is immediately before the Owners line.
      // In the text dump: barrier\nHorseName  Jockey  Trainer  [odds]
      const beforeOwner = block.slice(0, m.index);
      const lines = beforeOwner.trim().split("\n");

      let horseName: string | null = null;
      let jockeyName: string | null = null;
      let trainerName: string | null = null;

      // Walk backwards to find the horse line (non-empty, not "# Silk..." header)
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line || /^#|^Silk|^Other:|^Scratched/i.test(line)) continue;
        if (/^\d+$/.test(line)) continue; // barrier number only line

        // Split by 2+ spaces or tabs to separate columns
        const cols = line.split(/\s{2,}|\t/).map((c) => c.trim()).filter(Boolean);

        // Remove trailing odds like "$2.20 $1.30" or "2.4L"
        const cleaned = cols.filter((c) => !/^\$|\d+\.\d+L?$/.test(c));

        if (cleaned.length >= 1) horseName = cleaned[0] ?? null;
        if (cleaned.length >= 2) jockeyName = cleaned[1] ?? null;
        if (cleaned.length >= 3) trainerName = cleaned[2] ?? null;
        break;
      }

      if (horseName) {
        entries.push({
          race_number: currentRaceNum,
          horse_name: horseName,
          jockey_name: jockeyName,
          trainer_name: trainerName,
          owner_text: ownerText,
          sire,
          dam,
        });
      }
    }
  }

  return entries;
}

export interface SyncEntriesResult {
  ok: boolean;
  entries: number;
  claims: number;
  error?: string;
}

/**
 * 1. Fetches the LoveRacing meeting overview page.
 * 2. Parses horse entries.
 * 3. Upserts into race_entries.
 * 4. Fuzzy-matches owner_text against profiles.full_name to create owner_horse_claims.
 */
export async function fetchAndSyncMeetingEntries(
  nztrDayId: number,
  meetingId: string
): Promise<SyncEntriesResult> {
  const url = `${BASE}/raceinfo/${nztrDayId}/meeting-overview.aspx`;
 * lib/loveracing-entries.ts
 *
 * Fetches declared race fields from LoveRacing meeting pages, parses horse/owner
 * data from the HTML, upserts into race_entries, then fuzzy-matches owner names
 * against our profiles table to create owner_horse_claims.
 *
 * Server-only — uses admin client with service role key.
 */
import { createAdminClient } from "@/lib/supabase/admin";

const BASE = "https://loveracing.nz";

export interface RaceEntry {
  race_number: number;
  horse_name: string;
  jockey_name: string | null;
  trainer_name: string | null;
  owner_text: string | null;
  sire: string | null;
  dam: string | null;
}

/**
 * Parses the plain-text content of a LoveRacing meeting-overview.aspx page.
 * Extracts horse entries with owner strings from the HTML stripped to text.
 */
export function parseMeetingHtml(text: string): RaceEntry[] {
  const entries: RaceEntry[] = [];
  const raceBlocks = text.split(/\bRace\b(?=\s*\n)/);

  let currentRaceNum = 0;
  for (const block of raceBlocks) {
    const raceNumMatch = block.match(/^\s*(\d+)\s+\d{1,2}:\d{2}/);
    if (raceNumMatch) {
      currentRaceNum = parseInt(raceNumMatch[1], 10);
    }
    if (currentRaceNum === 0) continue;

    const ownerLines = [...block.matchAll(/Owners?:\s*([^\n]+)(?:\s*Breeder[^\n]*)?(?:\s*Sire:\s*(\S[^\n]*?))?(?:\s*Dam:\s*(\S[^\n]*))?/gi)];

    for (const m of ownerLines) {
      const ownerText = m[1]?.trim() ?? null;
      const sire = m[2]?.replace(/\s+\d{4}.*$/, "").trim() ?? null;
      const dam = m[3]?.replace(/\s+\d{4}.*$/, "").trim() ?? null;

      const beforeOwner = block.slice(0, m.index);
      const lines = beforeOwner.trim().split("\n");

      let horseName: string | null = null;
      let jockeyName: string | null = null;
      let trainerName: string | null = null;

      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line || /^#|^Silk|^Other:|^Scratched/i.test(line)) continue;
        if (/^\d+$/.test(line)) continue;

        const cols = line.split(/\s{2,}|\t/).map((c) => c.trim()).filter(Boolean);
        const cleaned = cols.filter((c) => !/^\$|\d+\.\d+L?$/.test(c));

        if (cleaned.length >= 1) horseName = cleaned[0] ?? null;
        if (cleaned.length >= 2) jockeyName = cleaned[1] ?? null;
        if (cleaned.length >= 3) trainerName = cleaned[2] ?? null;
        break;
      }

      if (horseName) {
        entries.push({ race_number: currentRaceNum, horse_name: horseName, jockey_name: jockeyName, trainer_name: trainerName, owner_text: ownerText, sire, dam });
      }
    }
  }
  return entries;
}

export interface SyncEntriesResult {
  ok: boolean;
  entries: number;
  claims: number;
  error?: string;
}

/**
 * 1. Fetches the LoveRacing meeting overview page.
 * 2. Parses horse entries.
 * 3. Upserts into race_entries.
 * 4. Fuzzy-matches owner_text against profiles.full_name to create owner_horse_claims.
 */
export async function fetchAndSyncMeetingEntries(
  nztrDayId: number,
  meetingId: string
): Promise<SyncEntriesResult> {
  const url = `${BASE}/raceinfo/${nztrDayId}/meeting-overview.aspx`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "JockeyFinder/1.0 (+https://www.jockeyfinder.com)" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return { ok: false, entries: 0, claims: 0, error: `LoveRacing ${res.status}` };
    html = await res.text();
  } catch (e: unknown) {
    return { ok: false, entries: 0, claims: 0, error: String(e) };
  }

  const text = html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  const parsed = parseMeetingHtml(text);
  if (parsed.length === 0) return { ok: true, entries: 0, claims: 0 };

  const admin = createAdminClient();

  const rows = parsed.map((e) => ({
    meeting_id: meetingId,
    nztr_day_id: nztrDayId,
    ...e,
    synced_at: new Date().toISOString(),
  }));

  const { error: upsertErr } = await admin
    .from("race_entries")
    .upsert(rows, { onConflict: "nztr_day_id,race_number,horse_name" });

  if (upsertErr) return { ok: false, entries: 0, claims: 0, error: upsertErr.message };

  const { data: savedEntries } = await admin
    .from("race_entries")
    .select("id, owner_text")
    .eq("nztr_day_id", nztrDayId);

  if (!savedEntries?.length) return { ok: true, entries: rows.length, claims: 0 };

  const { data: owners } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "owner")
    .not("full_name", "is", null);

  if (!owners?.length) return { ok: true, entries: rows.length, claims: 0 };

  const claimRows: { user_id: string; race_entry_id: string; status: string }[] = [];

  for (const entry of savedEntries) {
    if (!entry.owner_text) continue;
    const ownerLower = entry.owner_text.toLowerCase();

    for (const owner of owners) {
      if (!owner.full_name) continue;
      const nameParts = owner.full_name.toLowerCase().split(/\s+/);
      const lastName = nameParts[nameParts.length - 1];
      if (lastName.length >= 3 && ownerLower.includes(lastName)) {
        claimRows.push({ user_id: owner.id, race_entry_id: entry.id, status: "pending" });
      }
    }
  }

  if (claimRows.length > 0) {
    await admin
      .from("owner_horse_claims")
      .upsert(claimRows, { onConflict: "user_id,race_entry_id", ignoreDuplicates: true });
  }

  return { ok: true, entries: rows.length, claims: claimRows.length };
   }
