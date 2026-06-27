/**
 * scripts/sms-fallback.mjs
 *
 * SMS fallback for unanswered ride requests. If a request has sat in
 * "requested" for >15 minutes and the jockey has a phone, text them a
 * quick-reply link — then mark sms_reminded_at so we never double-text.
 *
 * Why a script (like sync-entries.mjs): Vercel Hobby crons can't run every
 * 15 minutes, so this runs on the same machine/schedule as the data sync.
 *
 * Needs Twilio env vars (same names as lib/sms.ts):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 * Without them it's a safe no-op (logs what it *would* send).
 *
 * Usage:
 *   node scripts/sms-fallback.mjs
 *   node scripts/sms-fallback.mjs --minutes=15 --dry
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
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
const MINUTES = parseInt(arg("minutes", "15"), 10);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.jockeyfinder.com";

async function sendSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.log(`  [no Twilio] would text ${to}: ${body}`);
    return false;
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    if (!res.ok) { console.error("  Twilio error", res.status, await res.text()); return false; }
    return true;
  } catch (e) {
    console.error("  sendSms failed", e.message);
    return false;
  }
}

async function main() {
  const cutoff = new Date(Date.now() - MINUTES * 60000).toISOString();

  const { data: requests, error } = await supabase
    .from("ride_requests")
    .select("id, horse_name, race_number, created_at, jockey:profiles!jockey_id(full_name, phone), trainer:profiles!trainer_id(full_name), meetings(track)")
    .eq("status", "requested")
    .is("sms_reminded_at", null)
    .lt("created_at", cutoff)
    .limit(200);

  if (error) { console.error("query failed:", error.message); process.exit(1); }
  if (!requests || requests.length === 0) { console.log("No unanswered requests to remind."); return; }

  let sent = 0;
  for (const r of requests) {
    const jockey = Array.isArray(r.jockey) ? r.jockey[0] : r.jockey;
    const trainer = Array.isArray(r.trainer) ? r.trainer[0] : r.trainer;
    const meeting = Array.isArray(r.meetings) ? r.meetings[0] : r.meetings;
    if (!jockey?.phone) {
      // No phone — mark reminded so we don't re-check it forever.
      if (!DRY) await supabase.from("ride_requests").update({ sms_reminded_at: new Date().toISOString() }).eq("id", r.id);
      continue;
    }
    const who = trainer?.full_name || "A trainer";
    const horse = r.horse_name ? `${r.horse_name} ` : "";
    const where = [r.race_number ? `R${r.race_number}` : "", meeting?.track || ""].filter(Boolean).join(" ");
    const body = `${who} has requested you${horse ? ` for ${horse}` : ""}${where ? ` ${where}` : ""}. View: ${SITE_URL}/dashboard/requests`;

    if (DRY) { console.log(`  [dry] ${jockey.phone}: ${body}`); continue; }
    await sendSms(jockey.phone, body);
    await supabase.from("ride_requests").update({ sms_reminded_at: new Date().toISOString() }).eq("id", r.id);
    sent++;
  }
  console.log(`Done. ${sent} reminder(s) ${DRY ? "previewed" : "processed"} of ${requests.length} candidate(s).`);
}

main();
