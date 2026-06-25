/**
 * scripts/sync-entries.mjs
 *
 * Syncs race entries (incl. jockey + trainer) for upcoming meetings from the
 * LoveRacing meeting-overview pages, then refreshes stable matches.
 *
 * Why a local/curl script instead of the Vercel cron: LoveRacing's WAF now
 * returns 403 to Node's fetch (undici TLS fingerprint), so the serverless
 * /api/loveracing/sync-entries cron can't reach the page. curl is allowed, so
 * this script (and the GitHub Action that runs it) goes through curl.
 *
 * The page uses a div-based layout ("nztr-row" with col-jockey/col-trainer);
 * jockey & trainer names are mapped to each runner by the HorseID embedded in
 * their EntryDetail links (robust, not row-index based).
 *
 * Usage:
 *   node scripts/sync-entries.mjs              # next 21 days of meetings
 *   node scripts/sync-entries.mjs --days=28
 *   node scripts/sync-entries.mjs --day=55006  # one meeting (nztr_day_id)
 *   node scripts/sync-entries.mjs --dry        # parse + log, no DB writes
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
      let v = m[2].trim().replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "").trim();
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
const DAYS = parseInt(arg("days", "21"), 10);
const ONE_DAY = arg("day", null);
const DELAY = parseInt(arg("delay", "500"), 10);
const SOURCE = arg("source", "local"); // who ran it: local | github
const RUN_START = new Date().toISOString(); // entries older than this in a re-scraped race are stale

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const BASE = "https://loveracing.nz";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STATUS = "\n__STATUS__:";
function curlGet(url, { retries = 2 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      ["-s", "--compressed", "--max-time", "40", "-A", UA, "-e", BASE + "/", "-w", STATUS + "%{http_code}", url],
      { maxBuffer: 64 * 1024 * 1024, encoding: "utf8", windowsHide: true },
      async (err, stdout) => {
        if (err && !stdout) {
          if (retries > 0) { await sleep(1000); return resolve(curlGet(url, { retries: retries - 1 })); }
          return reject(new Error(err.message));
        }
        const i = stdout.lastIndexOf(STATUS);
        const status = i === -1 ? 0 : parseInt(stdout.slice(i + STATUS.length).trim(), 10);
        const body = i === -1 ? stdout : stdout.slice(0, i);
        if (status !== 200 && retries > 0) { await sleep(1000); return resolve(curlGet(url, { retries: retries - 1 })); }
        resolve({ status, body });
      }
    );
  });
}

function clean(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Parse the div-based meeting-overview layout into runner rows.
export function parseEntries(html) {
  const out = [];
  const marks = [];
  let mm;
  const idRe = new RegExp('id="toggle-detail([0-9]+)"', "g");
  while ((mm = idRe.exec(html)) !== null) marks.push({ race: parseInt(mm[1], 10), idx: mm.index });

  for (let i = 0; i < marks.length; i++) {
    const raceNum = marks[i].race;
    if (!raceNum || raceNum > 40) continue;
    const region = html.slice(marks[i].idx, i + 1 < marks.length ? marks[i + 1].idx : html.length);

    const jockey = {}, trainer = {}, draw = {}, wgt = {}, rgt = {};
    let m;
    const jRe = new RegExp('HorseID=([0-9]+)[^"]*#bm-jockey"[^>]*>([^<]+)<', "g");
    while ((m = jRe.exec(region)) !== null) jockey[m[1]] = clean(m[2]).replace(/ *[(][^)]+[)]\s*$/, "");
    const tRe = new RegExp('HorseID=([0-9]+)[^"]*#bm-trainer"[^>]*>([^<]+)<', "g");
    while ((m = tRe.exec(region)) !== null) trainer[m[1]] = clean(m[2]);
    const fRe = new RegExp(
      'col-draw">([^<]*)</div>.*?col-rgt">([^<]*)</div>.*?col-wgt">([^<]*)</div>.*?col-jockey"><a [^>]*HorseID=([0-9]+)',
      "gs"
    );
    while ((m = fRe.exec(region)) !== null) { draw[m[4]] = m[1]; rgt[m[4]] = m[2]; wgt[m[4]] = m[3]; }

    const hRe = new RegExp(
      'col-number">([0-9]+)</div>.*?col-form">([^<]*)</div>.*?col-horse">.*?HorseID=([0-9]+)[^"]*Modal01"[^>]*>([^<]+)</a><span class="subtext">([^<]*)<',
      "gs"
    );
    while ((m = hRe.exec(region)) !== null) {
      const id = m[3];
      const sub = clean(m[5]).replace(/^\(/, "").replace(/\)$/, "");
      const sm = sub.match(/^([0-9]+[a-z]+)\s+(.*)$/i);
      const ageSex = sm ? sm[1] : null;
      let sire = null, dam = null;
      if (sm) { const parts = sm[2].split(" - "); sire = parts[0] ? clean(parts[0]) : null; dam = parts[1] ? clean(parts[1]) : null; }
      out.push({
        race_number: raceNum,
        horse_number: parseInt(m[1], 10),
        // strip non-country trailing markers like " (B3)" so names stay stable
        // across syncs (keep country codes such as " (AUS)" / " (NZ)").
        horse_name: clean(m[4]).replace(/\s*\((?![A-Z]{2,3}\))[^)]*\)\s*$/, "").trim(),
        nztr_horse_id: id,
        form: clean(m[2]) || null,
        age_sex: ageSex,
        sire,
        dam,
        jockey_name: jockey[id] || null,
        trainer_name: trainer[id] || null,
        barrier: draw[id] && /^[0-9]+$/.test(draw[id].trim()) ? parseInt(draw[id], 10) : null,
        weight: wgt[id] && !isNaN(parseFloat(wgt[id])) ? parseFloat(wgt[id]) : null,
        rating: rgt[id] && /^[0-9]+$/.test(rgt[id].trim()) ? parseInt(rgt[id], 10) : null,
      });
    }
  }
  return out;
}

async function syncMeeting(meeting) {
  const url = BASE + "/RaceInfo/" + meeting.nztr_day_id + "/Meeting-Overview.aspx";
  const { status, body } = await curlGet(url);
  if (status !== 200) return { ok: false, reason: "HTTP " + status };

  const entries = parseEntries(body);
  if (entries.length === 0) return { ok: true, entries: 0, jockeys: 0 };

  const { data: races } = await supabase
    .from("races").select("id, race_number").eq("nztr_day_id", meeting.nztr_day_id);
  const raceMap = new Map((races ?? []).map((r) => [r.race_number, r.id]));

  const rows = entries.map((e) => ({
    meeting_id: meeting.id,
    race_id: raceMap.get(e.race_number) ?? null,
    nztr_day_id: meeting.nztr_day_id,
    ...e,
    synced_at: new Date().toISOString(),
  }));

  const jockeys = rows.filter((r) => r.jockey_name).length;
  if (DRY) return { ok: true, entries: rows.length, jockeys, dry: true };

  const { error } = await supabase
    .from("race_entries")
    .upsert(rows, { onConflict: "nztr_day_id,race_number,horse_name" });
  if (error) return { ok: false, reason: error.message };

  // Remove stale rows ONLY in the races we just re-captured (older than this run).
  // Races we didn't capture this run are left untouched, so a partial scrape can
  // never wipe a race. This clears prior-sync leftovers that caused duplicate
  // jockey rides (a rider showing on horses they were later replaced on).
  const capturedRaces = [...new Set(rows.map((r) => r.race_number))];
  if (capturedRaces.length > 0) {
    await supabase
      .from("race_entries")
      .delete()
      .eq("nztr_day_id", meeting.nztr_day_id)
      .in("race_number", capturedRaces)
      .lt("synced_at", RUN_START);
  }

  return { ok: true, entries: rows.length, jockeys };
}

function nzToday() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
  return d.toISOString().slice(0, 10);
}
function nzPlus(days) {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  let meetings;
  if (ONE_DAY) {
    const { data } = await supabase.from("meetings").select("id, nztr_day_id, meeting_date, track").eq("nztr_day_id", Number(ONE_DAY));
    meetings = data ?? [];
  } else {
    const { data } = await supabase
      .from("meetings").select("id, nztr_day_id, meeting_date, track")
      .gte("meeting_date", nzToday()).lte("meeting_date", nzPlus(DAYS))
      .not("nztr_day_id", "is", null).order("meeting_date", { ascending: true });
    meetings = data ?? [];
  }

  console.log(`sync-entries: ${meetings.length} meetings${DRY ? " (DRY)" : ""} [source=${SOURCE}]`);
  let totalEntries = 0, totalJockeys = 0, fails = 0;
  for (const mtg of meetings) {
    const r = await syncMeeting(mtg);
    if (r.ok) {
      totalEntries += r.entries || 0; totalJockeys += r.jockeys || 0;
      console.log(`  ${mtg.meeting_date} ${mtg.track} (${mtg.nztr_day_id}): ${r.entries || 0} entries, ${r.jockeys || 0} with jockey`);
    } else {
      fails++;
      console.warn(`  ${mtg.meeting_date} ${mtg.track} (${mtg.nztr_day_id}): FAIL ${r.reason}`);
    }
    await sleep(DELAY);
  }
  console.log(`done: ${totalEntries} entries, ${totalJockeys} with jockey, ${fails} failed`);

  if (!DRY) {
    const { error } = await supabase.rpc("refresh_stables");
    console.log(error ? `refresh_stables error: ${error.message}` : "refresh_stables: ok");
    // Log the run so it can be monitored (and so we can confirm which environments reach LoveRacing).
    await supabase.from("sync_runs").insert({
      source: SOURCE,
      meetings: meetings.length,
      entries: totalEntries,
      jockeys: totalJockeys,
      ok: fails === 0,
      note: fails > 0 ? `${fails} meetings failed` : null,
    });
  }
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
