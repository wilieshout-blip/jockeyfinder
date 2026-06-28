/**
 * scripts/sync-premierships.mjs
 *
 * Syncs the AUTHORITATIVE LoveRacing premiership + apprentice-claim feeds into
 * nztr_premierships / nztr_jockey_claims. These power the correct season &
 * career stats on jockey/trainer profiles + directories (replacing the old
 * race_results-derived numbers, which only covered the few meetings we scraped).
 *
 * Why curl from the PC (like sync-entries/sync-results): LoveRacing's WAF 403s
 * Node/serverless fetch. Run on the same machine/schedule as the other syncs.
 *
 * Feeds (Angular app backend, returns {d:"<json>"} with .rows):
 *   POST /ServerScript/PremiershipsAndClaims.aspx/GetPremiershipDataJson
 *        {seasonID, jockey, trainer, jumping}
 *        rows: EntityID, Name, Wins, Seconds, Thirds, Starts, Stakes, StrikeRate
 *   POST /ServerScript/PremiershipsAndClaims.aspx/GetJockeyClaimsDataJson
 *        {apprentice, highweight, jumping}
 *        rows: JockeyID, Rider, Allowance, WebClaimTypeID, Wins, CareerStarts, NormalWeight
 *
 * Usage:
 *   node scripts/sync-premierships.mjs            # current season only (fast; for 15-min schedule)
 *   node scripts/sync-premierships.mjs --all      # all seasons (backfills career totals; run occasionally)
 *   node scripts/sync-premierships.mjs --dry      # fetch + log, no DB writes
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(REPO_ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "").trim();
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  }
}
loadEnv();

function arg(name, fallback) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
}

const DRY = !!arg("dry", false);
const ALL_SEASONS = !!arg("all", false);
const PROFILES = !!arg("profiles", false);
const DELAY = parseInt(arg("delay", "400"), 10);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const BASE = "https://loveracing.nz";
const PREM_PAGE = BASE + "/RaceInfo/Jockey-Premierships.aspx";
const API = BASE + "/ServerScript/PremiershipsAndClaims.aspx";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STATUS = "\n__STATUS__:";
function curl(args, { retries = 2 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      [...args, "-w", STATUS + "%{http_code}"],
      { maxBuffer: 64 * 1024 * 1024, encoding: "utf8", windowsHide: true },
      async (err, stdout) => {
        if (err && !stdout) {
          if (retries > 0) { await sleep(1000); return resolve(curl(args, { retries: retries - 1 })); }
          return reject(new Error(err.message));
        }
        const i = stdout.lastIndexOf(STATUS);
        const status = i === -1 ? 0 : parseInt(stdout.slice(i + STATUS.length).trim(), 10);
        const body = i === -1 ? stdout : stdout.slice(0, i);
        if (status !== 200 && retries > 0) { await sleep(1000); return resolve(curl(args, { retries: retries - 1 })); }
        resolve({ status, body });
      }
    );
  });
}

function curlGet(url) {
  return curl(["-s", "--compressed", "--max-time", "40", "-A", UA, "-e", BASE + "/", url]);
}
function curlPostJson(url, referer, payload) {
  return curl([
    "-s", "--compressed", "--max-time", "40", "-A", UA, "-e", referer,
    "-H", "Content-Type: application/json; charset=utf-8",
    "-H", "X-Requested-With: XMLHttpRequest",
    "--data", JSON.stringify(payload), url,
  ]);
}

/** The feed double-encodes: {"d":"<json string>"}. */
function parseRows(body) {
  const outer = JSON.parse(body);
  const inner = JSON.parse(outer.d);
  return inner.rows ?? [];
}

const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

async function discoverSeasons() {
  const { status, body } = await curlGet(PREM_PAGE);
  if (status !== 200) throw new Error("premiership page HTTP " + status);
  const ids = [...body.matchAll(/data-season-id="(\d+)"/g)].map((m) => parseInt(m[1], 10));
  const unique = [...new Set(ids)].sort((a, b) => b - a);
  if (unique.length === 0) throw new Error("no season ids found on premiership page");
  return unique;
}

async function fetchPremiership(seasonID, kind, jumping) {
  const payload = {
    seasonID: String(seasonID),
    jockey: String(kind === "jockey"),
    trainer: String(kind === "trainer"),
    jumping: String(jumping),
  };
  const { status, body } = await curlPostJson(API + "/GetPremiershipDataJson", PREM_PAGE, payload);
  if (status !== 200) throw new Error(kind + " s" + seasonID + (jumping ? " jump" : " flat") + " HTTP " + status);
  return parseRows(body);
}

async function syncPremierships(seasons) {
  let totalRows = 0;
  for (const kind of ["jockey", "trainer"]) {
    for (const seasonID of seasons) {
      for (const jumping of [false, true]) {
        let rows;
        try {
          rows = await fetchPremiership(seasonID, kind, jumping);
        } catch (e) {
          console.log(`  ${kind} s${seasonID} ${jumping ? "jump" : "flat"}: ERROR ${e.message}`);
          continue;
        }
        const mapped = rows
          .filter((r) => r.EntityID != null)
          .map((r) => ({
            entity_id: r.EntityID,
            entity_type: kind,
            season_id: seasonID,
            jumping,
            name: String(r.Name ?? "").trim(),
            wins: num(r.Wins),
            seconds: num(r.Seconds),
            thirds: num(r.Thirds),
            starts: num(r.Starts),
            stakes: num(r.Stakes),
            strike_rate: num(r.StrikeRate),
            synced_at: new Date().toISOString(),
          }));
        console.log(`  ${kind} s${seasonID} ${jumping ? "jump" : "flat"}: ${mapped.length} rows`);
        totalRows += mapped.length;
        if (!DRY && mapped.length) {
          const { error } = await supabase
            .from("nztr_premierships")
            .upsert(mapped, { onConflict: "entity_id,entity_type,season_id,jumping" });
          if (error) console.log(`    upsert error: ${error.message}`);
        }
        await sleep(DELAY);
      }
    }
  }
  return totalRows;
}

async function syncClaims() {
  const byId = new Map();
  for (const [apprentice, highweight] of [[true, false], [false, true]]) {
    for (const jumping of [false, true]) {
      let rows;
      try {
        const { status, body } = await curlPostJson(
          API + "/GetJockeyClaimsDataJson",
          BASE + "/RaceInfo/Jockey-Claims.aspx",
          { apprentice: String(apprentice), highweight: String(highweight), jumping: String(jumping) }
        );
        if (status !== 200) { console.log(`  claims a${apprentice}/h${highweight}/${jumping}: HTTP ${status}`); continue; }
        rows = parseRows(body);
      } catch (e) {
        console.log(`  claims a${apprentice}/h${highweight}: ERROR ${e.message}`);
        continue;
      }
      for (const r of rows) {
        if (r.JockeyID == null) continue;
        byId.set(r.JockeyID, {
          jockey_id: r.JockeyID,
          rider: String(r.Rider ?? "").trim(),
          allowance: num(r.Allowance),
          claim_type: r.WebClaimTypeID ?? null,
          career_wins: num(r.Wins),
          career_starts: num(r.CareerStarts),
          normal_weight: num(r.NormalWeight),
          jumping,
          synced_at: new Date().toISOString(),
        });
      }
      await sleep(DELAY);
    }
  }
  const claims = [...byId.values()];
  console.log(`  claims: ${claims.length} riders`);
  if (!DRY && claims.length) {
    const { error } = await supabase
      .from("nztr_jockey_claims")
      .upsert(claims, { onConflict: "jockey_id" });
    if (error) console.log(`    claims upsert error: ${error.message}`);
  }
  return claims.length;
}

// ── Per-jockey profile scrape: TRUE career totals + suspension summary ───────
// LoveRacing renders these server-side in the Stats Overview table on
// /RaceInfo/Jockeys/{EntityID}/Profile.aspx (no XHR). The premiership feed only
// spans ~5 seasons, so it undercounts career — this is the authoritative all-time.
function parseProfile(html) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ");
  const intOf = (s) => (s == null ? null : parseInt(String(s).replace(/[^0-9]/g, ""), 10));
  const career = text.match(/Career\s+([\d,]+)\s+\$([\d,]+)\s+([\d,]+)/);
  const susp = text.match(/Suspensions\s*\(Last:\s*([A-Za-z]+\s+\d+\s+\d{4})\)\s*(\d+)/);
  const place = text.match(/Current Premiership place \([^)]*\)\s*(\d+)/);
  const ridesSince = text.match(/Rides since last win\s*(\d+)/);

  let lastSusp = null;
  if (susp) {
    const d = new Date(susp[1]);
    if (!isNaN(d.getTime())) lastSusp = d.toISOString().slice(0, 10);
  }
  return {
    career_wins: career ? intOf(career[1]) : null,
    career_stakes: career ? intOf(career[2]) : null,
    career_starts: career ? intOf(career[3]) : null,
    suspensions_count: susp ? intOf(susp[2]) : null,
    last_suspension_date: lastSusp,
    premiership_place: place ? intOf(place[1]) : null,
    rides_since_win: ridesSince ? intOf(ridesSince[1]) : null,
  };
}

async function syncProfiles() {
  // Current-season jockey entity ids — these are the riders worth a profile hit.
  const { data: ids, error } = await supabase
    .from("nztr_premierships")
    .select("entity_id, season_id")
    .eq("entity_type", "jockey");
  if (error) {
    console.log("  could not load entity ids:", error.message);
    return 0;
  }
  const maxSeason = Math.max(...(ids ?? []).map((r) => r.season_id));
  const entityIds = [...new Set((ids ?? []).filter((r) => r.season_id === maxSeason).map((r) => r.entity_id))];
  console.log(`  fetching ${entityIds.length} jockey profiles (career + suspensions)…`);

  let ok = 0;
  for (const entityId of entityIds) {
    const url = BASE + "/RaceInfo/Jockeys/" + entityId + "/Profile.aspx";
    try {
      const { status, body } = await curlGet(url);
      if (status !== 200) { console.log(`  ${entityId}: HTTP ${status}`); await sleep(DELAY); continue; }
      const p = parseProfile(body);
      if (p.career_wins == null) { await sleep(DELAY); continue; } // no stats table
      if (!DRY) {
        const { error: upErr } = await supabase
          .from("nztr_jockey_profiles")
          .upsert({ entity_id: entityId, ...p, synced_at: new Date().toISOString() }, { onConflict: "entity_id" });
        if (upErr) console.log(`  ${entityId}: upsert ${upErr.message}`);
      }
      ok++;
    } catch (e) {
      console.log(`  ${entityId}: ${e.message}`);
    }
    await sleep(DELAY);
  }
  console.log(`  profiles: ${ok} jockeys updated`);
  return ok;
}

async function main() {
  const allSeasons = await discoverSeasons();
  const seasons = ALL_SEASONS ? allSeasons : [allSeasons[0]];
  console.log(`Seasons available: ${allSeasons.join(", ")}`);
  console.log(`Syncing: ${seasons.join(", ")}${DRY ? " [dry]" : ""}`);

  console.log("Premierships (jockey + trainer, flat + jump):");
  const rows = await syncPremierships(seasons);

  console.log("Apprentice / highweight claims:");
  const claims = await syncClaims();

  let profiles = 0;
  if (PROFILES) {
    console.log("Jockey profiles (true career + suspensions):");
    profiles = await syncProfiles();
  }

  // Validation sample: Elen Nicholas (EntityID 125271).
  if (!DRY) {
    const { data } = await supabase
      .from("nztr_jockey_stats")
      .select("name, season_wins, season_starts, career_wins, career_is_true, suspensions_count, season_id")
      .eq("entity_id", 125271)
      .maybeSingle();
    if (data) {
      console.log(
        `\nValidation — ${data.name}: season ${data.season_wins}W/${data.season_starts}starts, career ${data.career_wins}W (${data.career_is_true ? "true all-time" : "5-season est."}), ${data.suspensions_count ?? "?"} suspensions.`
      );
    }
  }

  console.log(
    `\nDone. ${rows} premiership rows, ${claims} claim rows${PROFILES ? `, ${profiles} profiles` : ""} ${DRY ? "parsed (dry)" : "upserted"}.`
  );
}

main();
