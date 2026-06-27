/**
 * scripts/sync-results.mjs
 *
 * Syncs completed race RESULTS (top placings + dividends) for recent past
 * meetings from the LoveRacing meeting-overview pages into race_results.
 *
 * Why a local/curl script (like sync-entries.mjs): LoveRacing's WAF 403s Node's
 * fetch from datacenter/serverless IPs, so the Vercel /api/results/sync cron
 * can't reach the pages. curl from a residential IP works. Run this on the same
 * machine/schedule as sync-entries.mjs.
 *
 * Populating race_results lights up jockey season stats (wins/places) on the
 * jockey profiles and directory.
 *
 * Usage:
 *   node scripts/sync-results.mjs                 # past 7 days of meetings
 *   node scripts/sync-results.mjs --days=14
 *   node scripts/sync-results.mjs --day=55006     # one meeting (nztr_day_id)
 *   node scripts/sync-results.mjs --dry           # parse + log, no DB writes
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
const DAYS = parseInt(arg("days", "7"), 10);
const ONE_DAY = arg("day", null);
const DELAY = parseInt(arg("delay", "500"), 10);

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

// ── Parser (ported from lib/loveracing-results.ts) ──────────────────────────
function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
function parseCells(rowHtml) {
  const cells = [];
  const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let m;
  while ((m = re.exec(rowHtml)) !== null) cells.push(stripTags(m[1]));
  return cells;
}
function parseTableRows(tableHtml) {
  const rows = [];
  const re = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = re.exec(tableHtml)) !== null) {
    const cells = parseCells(m[1]);
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}
function extractTables(html) {
  const tables = [];
  const re = /<table[\s\S]*?<\/table>/gi;
  let m;
  while ((m = re.exec(html)) !== null) tables.push(m[0]);
  return tables;
}
function parseDividend(raw) {
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}
function parseDistance(conditions) {
  const m = conditions.match(/(\d{3,5})m/i);
  return m ? parseInt(m[1], 10) : null;
}
function parsePrize(conditions) {
  const m = conditions.match(/\$([0-9,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
}
function cleanJockeyName(raw) {
  return raw.replace(/\s*\([A-Z0-9]+\)\s*$/, "").trim();
}
function parseMeetingResults(html) {
  const results = [];
  const tables = extractTables(html);
  let currentRaceNum = 0;
  let currentRaceName = "";
  let currentDistanceM = null;
  let currentPrize = null;

  for (const tableHtml of tables) {
    const rows = parseTableRows(tableHtml);
    if (rows.length === 0) continue;
    const firstRow = rows[0];

    if (firstRow.length >= 4 && /^\d{1,2}$/.test(firstRow[0]) && /\d{1,2}:\d{2}/.test(firstRow[1])) {
      currentRaceNum = parseInt(firstRow[0], 10);
      currentRaceName = firstRow[2] ?? "";
      currentDistanceM = firstRow[3] ? parseDistance(firstRow[3]) : null;
      currentPrize = firstRow[3] ? parsePrize(firstRow[3]) : null;
      continue;
    }

    const isResultsHeader =
      firstRow.length >= 6 &&
      firstRow.some((c) => c === "#") &&
      firstRow.some((c) => /^Horse$/i.test(c)) &&
      firstRow.some((c) => /^Jockey$/i.test(c));
    if (!isResultsHeader || currentRaceNum === 0) continue;

    let position = 0;
    for (const row of rows.slice(1)) {
      if (row.length <= 1) continue;
      if (/^Owners?:/i.test(row[0])) continue;
      if (/^Other:/i.test(row[0]) || /^Scratched:/i.test(row[0])) continue;
      if (row.length < 6) continue;
      position++;
      const horseName = row[2] ?? "";
      const jockeyRaw = row[3] ?? "";
      const trainerName = row[4] ?? null;
      const winRaw = row[5] ?? "";
      const placeRaw = row[6] ?? "";
      if (!horseName || horseName === "#") continue;
      results.push({
        race_number: currentRaceNum,
        race_name: currentRaceName,
        distance_m: currentDistanceM,
        prize_total: currentPrize,
        position,
        horse_name: horseName,
        jockey_name: jockeyRaw ? cleanJockeyName(jockeyRaw) : null,
        trainer_name: trainerName || null,
        win_dividend: winRaw ? parseDividend(winRaw) : null,
        place_dividend: placeRaw ? parseDividend(placeRaw) : null,
      });
      if (position >= 3) break;
    }
  }
  return results;
}

async function syncMeetingResults(meeting) {
  const url = BASE + "/RaceInfo/" + meeting.nztr_day_id + "/Meeting-Overview.aspx";
  const { status, body } = await curlGet(url);
  if (status !== 200) return { ok: false, reason: "HTTP " + status };

  const parsed = parseMeetingResults(body);
  if (parsed.length === 0) return { ok: true, results: 0 };

  const rows = parsed.map((r) => ({
    meeting_id: meeting.id,
    nztr_day_id: meeting.nztr_day_id,
    race_number: r.race_number,
    race_name: r.race_name,
    distance_m: r.distance_m,
    prize_total: r.prize_total,
    position: r.position,
    horse_name: r.horse_name,
    jockey_name: r.jockey_name,
    trainer_name: r.trainer_name,
    win_dividend: r.win_dividend,
    place_dividend: r.place_dividend,
    race_date: meeting.meeting_date,
    synced_at: new Date().toISOString(),
  }));

  if (DRY) return { ok: true, results: rows.length, dry: true };

  const { error } = await supabase
    .from("race_results")
    .upsert(rows, { onConflict: "nztr_day_id,race_number,position" });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, results: rows.length };
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);

  let query = supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date")
    .lt("meeting_date", today)
    .neq("meeting_type", "T")
    .not("nztr_day_id", "is", null)
    .order("meeting_date", { ascending: false });
  query = ONE_DAY ? query.eq("nztr_day_id", Number(ONE_DAY)) : query.gte("meeting_date", cutoff);

  const { data: meetings, error } = await query;
  if (error) { console.error("meeting query failed:", error.message); process.exit(1); }
  if (!meetings || meetings.length === 0) { console.log("No past meetings to sync."); return; }

  let total = 0;
  for (const m of meetings) {
    try {
      const r = await syncMeetingResults(m);
      console.log(`day ${m.nztr_day_id} (${m.meeting_date}): ${r.ok ? r.results + " results" + (r.dry ? " [dry]" : "") : "FAILED " + r.reason}`);
      if (r.ok) total += r.results;
    } catch (e) {
      console.log(`day ${m.nztr_day_id}: error ${e.message}`);
    }
    await sleep(DELAY);
  }
  console.log(`Done. ${total} result rows ${DRY ? "parsed (dry)" : "upserted"} across ${meetings.length} meetings.`);
}

main();
