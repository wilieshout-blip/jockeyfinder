/**
 * scripts/import-horses.mjs
 *
 * Backfills the `horses` table with full LoveRacing / NZTR horse profiles.
 *
 * Pipeline:
 *   1. Enumerate NZ meetings over the last N days via the LoveRacing calendar API.
 *   2. Scrape each meeting's Meeting-Overview page for EntryDetail HorseID links.
 *   3. Fetch each horse's EntryDetail page and parse the full profile.
 *   4. Upsert into public.horses (keyed on nztr_horse_id).
 *
 * Rate-limited and resumable: progress is checkpointed to scripts/.cache so a
 * re-run skips horses already imported.
 *
 * Usage:
 *   node scripts/import-horses.mjs                 # full 2-season backfill (default 730 days)
 *   node scripts/import-horses.mjs --days=365      # 1 season
 *   node scripts/import-horses.mjs --sample=407681,220998   # just these horses (test)
 *   node scripts/import-horses.mjs --dry           # parse + log, no DB writes
 *   node scripts/import-horses.mjs --delay=600 --concurrency=2
 *   node scripts/import-horses.mjs --fresh         # ignore checkpoints, start over
 *
 * Env (scripts loads .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(__dirname, ".cache");

// ---------------------------------------------------------------------------
// env + args
// ---------------------------------------------------------------------------
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(REPO_ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim().replace(/^["']|["']$/g, "");
      v = v.replace(/\s+#.*$/, "").trim(); // strip trailing inline comment
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  }
}
loadEnv();

function arg(name, fallback = undefined) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
}

const DAYS = parseInt(arg("days", "730"), 10);
const DELAY = parseInt(arg("delay", "400"), 10);
const CONCURRENCY = Math.max(1, parseInt(arg("concurrency", "3"), 10));
const DRY = !!arg("dry", false);
const FRESH = !!arg("fresh", false);
const COLLECT_ONLY = !!arg("collect-only", false); // crawl meetings + horse ids, no DB
const SAMPLE = arg("sample", null);
const LIMIT = arg("limit", null) ? parseInt(arg("limit"), 10) : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DRY && !COLLECT_ONLY && (!SUPABASE_URL || !SERVICE_KEY || SERVICE_KEY.startsWith("your-"))) {
  console.error(
    "\nMissing Supabase credentials.\n" +
      "Add to .env.local in the repo root:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL=...\n" +
      "  SUPABASE_SERVICE_ROLE_KEY=...   (Supabase dashboard -> Project Settings -> API)\n" +
      "Or run with --dry to test parsing without writing.\n"
  );
  process.exit(1);
}

const supabase =
  DRY || COLLECT_ONLY || !SUPABASE_URL || !SERVICE_KEY
    ? null
    : createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// http
// ---------------------------------------------------------------------------
const BASE = "https://loveracing.nz";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// LoveRacing sits behind a WAF that fingerprints and blocks Node's TLS stack,
// so all requests go through the system `curl` binary (which it lets through).
// execFile resolves `curl` from PATH directly, bypassing any PowerShell alias.
const STATUS = "\n__STATUS__:";
function curl(args, { timeoutSec = 40 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      ["-s", "--compressed", "--max-time", String(timeoutSec), "-A", UA, "-e", BASE + "/", "-w", STATUS + "%{http_code}", ...args],
      { maxBuffer: 64 * 1024 * 1024, encoding: "utf8", windowsHide: true },
      (err, stdout) => {
        if (err && !stdout) return reject(new Error(err.message));
        const i = stdout.lastIndexOf(STATUS);
        if (i === -1) return reject(new Error("no status from curl"));
        const status = parseInt(stdout.slice(i + STATUS.length).trim(), 10);
        resolve({ status, body: stdout.slice(0, i) });
      }
    );
  });
}

async function getText(url, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { status, body } = await curl([url]);
      if (status === 200) return body;
      if (status === 404) return null;
      throw new Error("HTTP " + status);
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(800 * (attempt + 1));
    }
  }
}

async function postJson(url, body, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { status, body: out } = await curl([
        "-X", "POST",
        "-H", "Content-Type: application/json; charset=utf-8",
        "--data", JSON.stringify(body),
        url,
      ]);
      if (status !== 200) throw new Error("HTTP " + status);
      return JSON.parse(out);
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(800 * (attempt + 1));
    }
  }
}

// ---------------------------------------------------------------------------
// checkpoint helpers
// ---------------------------------------------------------------------------
fs.mkdirSync(CACHE_DIR, { recursive: true });
function loadJson(name, fallback) {
  const p = path.join(CACHE_DIR, name);
  if (FRESH || !fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}
function saveJson(name, data) {
  fs.writeFileSync(path.join(CACHE_DIR, name), JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// step 1: enumerate meeting DayIDs from the calendar
// ---------------------------------------------------------------------------
function fmt(d) {
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

async function enumerateMeetings(days) {
  const cached = loadJson("dayids.json", null);
  if (cached) {
    console.log(`  (using cached ${cached.length} meetings)`);
    return cached;
  }

  const ids = new Set();
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  // Request in 90-day windows so each call stays small.
  const windowMs = 90 * 24 * 3600 * 1000;
  for (let from = start.getTime(); from < end.getTime(); from += windowMs) {
    const winStart = new Date(from);
    const winEnd = new Date(Math.min(from + windowMs, end.getTime()));
    let list = [];
    try {
      const raw = await postJson(
        BASE + "/ServerScript/RaceInfo.aspx/GetCalendarEvents",
        { start: fmt(winStart), end: fmt(winEnd) }
      );
      list = JSON.parse(raw?.d || "[]");
    } catch (e) {
      console.warn(`  ! calendar ${fmt(winStart)}..${fmt(winEnd)}: ${e.message}`);
    }
    for (const e of list) {
      const id = e.DayID ? Number(e.DayID) : null;
      if (id) ids.add(id);
    }
    console.log(`  ${fmt(winStart)} .. ${fmt(winEnd)}: ${ids.size} meetings so far`);
    await sleep(DELAY);
  }

  const arr = [...ids];
  saveJson("dayids.json", arr);
  return arr;
}

// ---------------------------------------------------------------------------
// step 2: collect HorseIDs from each meeting overview
// ---------------------------------------------------------------------------
async function collectHorseIds(dayIds) {
  const state = loadJson("horseids.json", { horseIds: [], doneDays: [] });
  const horseIds = new Set(state.horseIds);
  const doneDays = new Set(state.doneDays);

  let processed = 0;
  for (const dayId of dayIds) {
    if (doneDays.has(dayId)) continue;
    try {
      const html = await getText(BASE + "/RaceInfo/" + dayId + "/Meeting-Overview.aspx");
      if (html) {
        const re = /EntryDetail\.aspx\?HorseID=(\d+)/gi;
        let m;
        while ((m = re.exec(html)) !== null) horseIds.add(m[1]);
      }
    } catch (e) {
      console.warn(`  ! meeting ${dayId}: ${e.message}`);
    }
    doneDays.add(dayId);
    processed++;
    if (processed % 10 === 0) {
      saveJson("horseids.json", { horseIds: [...horseIds], doneDays: [...doneDays] });
      console.log(`  meetings ${doneDays.size}/${dayIds.length}, horses found: ${horseIds.size}`);
    }
    await sleep(DELAY);
  }

  saveJson("horseids.json", { horseIds: [...horseIds], doneDays: [...doneDays] });
  return [...horseIds];
}

// ---------------------------------------------------------------------------
// step 3: parse a horse EntryDetail page
// ---------------------------------------------------------------------------
function toText(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
function parseDate(s) {
  const m = s && s.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return null;
  const mo = MONTHS[m[2].toLowerCase()];
  if (!mo) return null;
  return `${m[3]}-${String(mo).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}
function num(s) {
  if (s == null) return null;
  const n = parseInt(String(s).replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function parseHorse(html, horseId) {
  const text = toText(html);

  const profileUrl = (html.match(/\/Breeding\/\d+\/[A-Za-z0-9'.-]+\.aspx/i) || [null])[0];

  // name (country) year — e.g. "Breeding A Mandarin (NZ) 2019 Trainer:"
  let name = null, country = null, year = null;
  const idM = text.match(/Breeding\s+(.+?)\s+\(([A-Z]{2,3})\)\s+(\d{4})\s+Trainer:/);
  if (idM) {
    name = idM[1].trim();
    country = idM[2];
    year = num(idM[3]);
  } else if (profileUrl) {
    // fallback: derive from slug "A-Mandarin-NZ-2019"
    const slug = profileUrl.split("/")[3].replace(/\.aspx$/i, "");
    const parts = slug.split("-");
    if (/^\d{4}$/.test(parts[parts.length - 1])) year = num(parts.pop());
    if (/^[A-Z]{2,3}$/.test(parts[parts.length - 1])) country = parts.pop();
    name = parts.join(" ") || null;
  }

  const trainerM = text.match(/Trainer:\s*(.+?)\s+Location:\s*(.+?)\s+Race info/);
  const trainer = trainerM ? trainerM[1].trim() : null;
  const location = trainerM ? trainerM[2].trim() : null;

  const ratingM = text.match(
    /Flat Rating:\s*(\d+)\s+Steeple Rating:\s*(\d+)\s+Hurdle Rating:\s*(\d+)/
  );

  // "Horse Details 6YO Chestnut Mare Owner:" (colour may be multi-word)
  const detM = text.match(
    /Horse Details\s+(\d+)YO\s+(.+?)\s+(Mare|Gelding|Colt|Filly|Horse|Rig|Stallion|Entire|Stal\.?)\s+Owner:/i
  );
  const colour = detM ? detM[2].trim() : null;
  const sex = detM ? detM[3].trim() : null;

  // Owner / Breeder / Sire / Dam / Foaling — capture each label up to the next.
  const field = (label, stops) => {
    const re = new RegExp(
      `${label}:\\s*(.+?)\\s+(?:${stops.join("|")}):`,
      "i"
    );
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  const owner = field("Owner", ["Breeder", "Sire", "Dam", "Foaling"]);
  const breeder = field("Breeder", ["Sire", "Dam", "Foaling"]);
  const sire = field("Sire", ["Dam", "Foaling"]);
  const dam = field("Dam", ["Foaling", "Current", "Performance"]);
  const foalingM = text.match(/Foaling:\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/);
  const foaling_date = foalingM ? parseDate(foalingM[1]) : null;

  const formM = text.match(/\bForm\s+([0-9xX]{1,12})\b/);

  // career: split the "Career stats" section into individual start lines.
  let career = null;
  const careerIdx = text.indexOf("Career stats");
  if (careerIdx !== -1) {
    const tail = text.slice(careerIdx, careerIdx + 60000);
    const starts = tail
      .split(/(?=\d{1,2}-\d{1,2}\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/)
      .map((s) => s.trim())
      .filter((s) => /^\d{1,2}-\d{1,2}\s+\d{1,2}\s+[A-Za-z]{3}/.test(s))
      .slice(0, 200);
    if (starts.length) career = starts;
  }

  // recent-form stats block (1st up / 2nd up etc.)
  let stats = null;
  const statsM = text.match(/Recent starts(.+?)Sectionals/);
  if (statsM) stats = { recent: statsM[1].trim().slice(0, 1000) };

  return {
    nztr_horse_id: String(horseId),
    name,
    country,
    year_of_birth: year,
    sex,
    colour,
    foaling_date,
    sire,
    dam,
    breeder,
    owner_text: owner,
    nztr_trainer_name: trainer,
    location,
    flat_rating: ratingM ? num(ratingM[1]) : null,
    steeple_rating: ratingM ? num(ratingM[2]) : null,
    hurdle_rating: ratingM ? num(ratingM[3]) : null,
    form: formM ? formM[1] : null,
    profile_url: profileUrl,
    career,
    stats,
    synced_at: new Date().toISOString(),
  };
}

async function fetchHorse(horseId) {
  const html = await getText(
    BASE +
      "/Common/SystemTemplates/Modal/EntryDetail.aspx?HorseID=" +
      horseId +
      "&DisplayContext=Modal"
  );
  if (!html) return null;
  return parseHorse(html, horseId);
}

// ---------------------------------------------------------------------------
// step 4: enrich + upsert with bounded concurrency
// ---------------------------------------------------------------------------
async function enrichHorses(horseIds) {
  const done = new Set(loadJson("done.json", []));
  const todo = horseIds.filter((id) => !done.has(String(id)));
  const target = LIMIT ? todo.slice(0, LIMIT) : todo;

  console.log(
    `  ${horseIds.length} horses total, ${done.size} already done, ${target.length} to fetch`
  );

  let ok = 0, fail = 0, i = 0;
  const failures = [];
  const batch = [];

  async function worker() {
    while (i < target.length) {
      const idx = i++;
      const id = target[idx];
      try {
        const row = await fetchHorse(id);
        if (!row || !row.name) {
          fail++;
          failures.push({ id, reason: "no profile / unparsed" });
        } else {
          if (DRY) {
            console.log(JSON.stringify(row, null, 2));
          } else {
            batch.push(row);
          }
          ok++;
        }
        done.add(String(id));
      } catch (e) {
        fail++;
        failures.push({ id, reason: e.message });
      }

      if (batch.length >= 50) {
        const rows = batch.splice(0, batch.length);
        const { error } = await supabase
          .from("horses")
          .upsert(rows, { onConflict: "nztr_horse_id" });
        if (error) console.error("  ! upsert error:", error.message);
      }
      if ((ok + fail) % 25 === 0) {
        saveJson("done.json", [...done]);
        process.stdout.write(`\r  progress ${ok + fail}/${target.length} (ok ${ok}, fail ${fail})   `);
      }
      await sleep(DELAY);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (!DRY && batch.length) {
    const { error } = await supabase
      .from("horses")
      .upsert(batch, { onConflict: "nztr_horse_id" });
    if (error) console.error("  ! upsert error:", error.message);
  }
  saveJson("done.json", [...done]);
  if (failures.length) saveJson("failures.json", failures);

  console.log(`\n  enrich complete: ok ${ok}, fail ${fail}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`horse importer  (days=${DAYS}, delay=${DELAY}ms, concurrency=${CONCURRENCY}${DRY ? ", DRY" : ""})`);

  if (SAMPLE) {
    const ids = String(SAMPLE).split(",").map((s) => s.trim()).filter(Boolean);
    console.log(`\n[sample] enriching ${ids.length} horse(s): ${ids.join(", ")}`);
    await enrichHorses(ids);
    return;
  }

  console.log("\n[1/3] enumerating meetings…");
  const dayIds = await enumerateMeetings(DAYS);
  console.log(`      ${dayIds.length} meetings`);

  console.log("\n[2/3] collecting horse ids from meeting overviews…");
  const horseIds = await collectHorseIds(dayIds);
  console.log(`      ${horseIds.length} distinct horses`);

  if (COLLECT_ONLY) {
    console.log("\ncollect-only: cached horse ids, skipping DB enrichment.");
    return;
  }

  console.log("\n[3/3] fetching + parsing horse profiles…");
  await enrichHorses(horseIds);

  console.log("\ndone.");
}

main().catch((e) => {
  console.error("\nfatal:", e);
  process.exit(1);
});
