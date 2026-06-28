/** Tiny class-name joiner. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const FALLBACK_ADMIN = "wilieshout@gmail.com";

/** Admin is identified by email (env ADMIN_EMAIL, server side). */
export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const admin = (process.env.ADMIN_EMAIL || FALLBACK_ADMIN).toLowerCase();
  return email.toLowerCase() === admin;
}

/**
 * Normalize NZ phone numbers for registry matching.
 * Strips everything except digits, then folds +64 / 0064 into a leading 0.
 * Mirrors public.normalize_phone() in supabase/schema.sql.
 */
export function normalizePhone(input?: string | null) {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0064")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("64") && digits.length >= 10)
    digits = "0" + digits.slice(2);
  return digits || null;
}

/** 3 -> "a3", 1.5 -> "a1.5". */
export function formatClaim(claim?: number | null) {
  if (claim === null || claim === undefined || Number(claim) === 0) return null;
  const n = Number(claim);
  return `a${Number.isInteger(n) ? n : n}`;
}

/** 54.5 -> "54.5kg" */
export function formatWeight(weight?: number | null) {
  if (weight === null || weight === undefined) return null;
  return `${Number(weight)}kg`;
}

/**
 * Normalise a person's name to a "first-initial + surname" key so we can match
 * across NZTR/LoveRacing sources that abbreviate differently — e.g. registry
 * "M K Hudson", premiership "E Nicholas (a)", and profile "Elen Nicholas" all
 * collapse to a stable key. Returns "" when no usable name.
 */
export function registryKey(name: string | null): string {
  if (!name) return "";
  const clean = name
    .replace(/^(Mr|Mrs|Ms|Miss|Dr|Prof|Rev)\.?\s+/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const initial = (parts[0][0] || "").toUpperCase();
  const surname = parts[parts.length - 1].toLowerCase();
  if (!initial || !surname) return "";
  return initial + ":" + surname;
}

const NZ_TZ = "Pacific/Auckland";

/** "2026-06-13" -> { day: "13", month: "Jun", weekday: "Sat" } */
export function meetingDateParts(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    day: d.toLocaleDateString("en-NZ", { day: "2-digit" }),
    month: d.toLocaleDateString("en-NZ", { month: "short" }),
    weekday: d.toLocaleDateString("en-NZ", { weekday: "short" }),
    year: d.toLocaleDateString("en-NZ", { year: "numeric" }),
  };
}

export function formatMeetingDate(dateStr: string) {
  const p = meetingDateParts(dateStr);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-NZ", {
    timeZone: NZ_TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Today's date in NZ as YYYY-MM-DD. */
export function nzToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NZ_TZ }).format(
    new Date()
  );
}

/** YYYY-MM-DD shifted by N days, NZ calendar. */
export function nzDatePlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: NZ_TZ }).format(d);
}

export function initials(name?: string | null) {
  if (!name) return "JF";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const REQUEST_STATUS_STYLES: Record<string, string> = {
  requested: "bg-mist text-zinc-700 border-line",
  accepted: "bg-turf-50 text-turf-700 border-turf-200",
  assigned: "bg-turf-600 text-white border-turf-600",
  declined: "bg-zinc-100 text-zinc-500 border-line",
  cancelled: "bg-zinc-100 text-zinc-400 border-line line-through",
};
