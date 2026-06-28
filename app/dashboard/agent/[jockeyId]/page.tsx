import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Card, CardBody } from "@/components/ui/card";
import { DateBlock } from "@/components/racing";
import { EmptyState } from "@/components/ui/empty";
import { BlackBook } from "@/components/black-book";
import type { BlackBookEntry } from "@/components/black-book";
import {
  formatWeight,
  formatClaim,
  formatMeetingDate,
  nzToday,
  cn,
  REQUEST_STATUS_STYLES,
} from "@/lib/utils";
import { updateManagedJockey } from "../actions";
import { updateRequestStatus } from "@/app/dashboard/requests/actions";

export const dynamic = "force-dynamic";

export default async function ActingForJockeyPage({
  params,
  searchParams,
}: {
  params: Promise<{ jockeyId: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { jockeyId } = await params;
  const { updated } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, verification_status")
    .eq("id", user.id)
    .single();
  if (!me || me.role !== "agent" || me.verification_status !== "approved") redirect("/dashboard");

  const { data: link } = await supabase
    .from("agent_jockeys")
    .select("jockey_id")
    .eq("agent_id", user.id)
    .eq("jockey_id", jockeyId)
    .maybeSingle();
  if (!link) notFound();

  const { data: jockey } = await supabase
    .from("profiles")
    .select("id, full_name, first_name, last_name, riding_weight, apprentice, apprentice_claim, base_region, is_placeholder, profile_photo_url")
    .eq("id", jockeyId)
    .single();
  if (!jockey) notFound();

  // Their black book (agent can now manage it via RLS) + which are racing soon.
  const { data: bb } = await supabase
    .from("black_book")
    .select("id, horse_id, horse_name")
    .eq("user_id", jockeyId)
    .order("created_at", { ascending: false });
  const blackBook = (bb ?? []) as BlackBookEntry[];

  const today = nzToday();
  let nominations: any[] = [];
  const bbNames = blackBook.map((b) => b.horse_name);
  if (bbNames.length > 0) {
    const { data: noms } = await supabase
      .from("race_entries")
      .select("id, horse_name, race_number, jockey_name, meetings!inner(id, meeting_date, track)")
      .in("horse_name", bbNames)
      .gte("meetings.meeting_date", today)
      .limit(40);
    nominations = (noms ?? [])
      .sort((a: any, b: any) => (a.meetings?.meeting_date ?? "").localeCompare(b.meetings?.meeting_date ?? ""))
      .slice(0, 8);
  }

  // Their ride requests.
  const { data: reqRows } = await supabase
    .from("ride_requests")
    .select("id, horse_name, race_number, status, meeting_id, created_by, created_at, meetings(meeting_date, track)")
    .eq("jockey_id", jockeyId)
    .order("created_at", { ascending: false })
    .limit(30);
  const requests = (reqRows ?? []) as any[];
  const upcoming = requests.filter((r) => (r.meetings?.meeting_date ?? "") >= today && r.status !== "cancelled");

  // Meetings they're attending.
  const { data: att } = await supabase
    .from("meeting_attendance")
    .select("meeting_id")
    .eq("user_id", jockeyId)
    .eq("attending", true);
  const attendingCount = new Set((att ?? []).map((a) => a.meeting_id)).size;

  const name = jockey.full_name || "Rider";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="text-sm font-medium text-zinc-500 hover:text-ink">← Back to my dashboard</Link>
        <span className="rounded-full bg-turf-50 px-3 py-1 text-xs font-semibold text-turf-700">Acting on their behalf</span>
      </div>

      {updated ? (
        <div className="rounded-xl border border-turf-200 bg-turf-50 px-4 py-3 text-sm text-turf-700">Details updated.</div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={name} src={jockey.profile_photo_url} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{name}</h1>
              {jockey.is_placeholder ? <Badge tone="amber">Placeholder</Badge> : null}
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              {formatWeight(jockey.riding_weight)}
              {jockey.apprentice && formatClaim(jockey.apprentice_claim) ? ` · claims ${formatClaim(jockey.apprentice_claim)}` : ""}
              {jockey.base_region ? ` · ${jockey.base_region}` : ""}
            </p>
            {jockey.is_placeholder ? (
              <p className="mt-1 text-xs text-amber-600">(needs to create an account to sync)</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/calendar?jockey=${jockey.id}`} className={buttonClasses("outline", "sm")}>Set attendance</Link>
          <Link href={`/dashboard/requests/new?jockey=${jockey.id}`} className={buttonClasses("accent", "sm")}>Request a ride</Link>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Upcoming rides", upcoming.length],
          ["Attending", attendingCount],
          ["Black-book horses", blackBook.length],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardBody className="py-4">
              <p className="font-display text-2xl font-semibold text-ink">{value as number}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">{label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Edit details (placeholder riders only) */}
      {jockey.is_placeholder ? (
        <Card>
          <CardBody>
            <h2 className="font-display text-base font-semibold text-ink">Edit details</h2>
            <form action={updateManagedJockey} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="jockey_id" value={jockey.id} />
              <div>
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" name="first_name" defaultValue={jockey.first_name ?? ""} />
              </div>
              <div>
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" name="last_name" defaultValue={jockey.last_name ?? ""} />
              </div>
              <div>
                <Label htmlFor="rw">Riding weight (kg)</Label>
                <Input id="rw" name="riding_weight" type="number" step="0.5" min="30" max="100" defaultValue={jockey.riding_weight ?? ""} placeholder="e.g. 54.5" />
              </div>
              <div>
                <Label htmlFor="ac">Apprentice claim (kg)</Label>
                <Input id="ac" name="apprentice_claim" type="number" step="0.5" min="0" max="4" defaultValue={jockey.apprentice_claim ?? ""} placeholder="blank = none" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="br">Base region</Label>
                <Input id="br" name="base_region" defaultValue={jockey.base_region ?? ""} placeholder="e.g. Waikato" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm">Save details</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}

      {/* Their ride requests */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Ride requests · {requests.length}</h2>
        {requests.length > 0 ? (
          <div className="grid gap-2">
            {requests.slice(0, 12).map((r) => {
              const incoming = r.status === "requested" && r.created_by !== user.id;
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card"
                >
                  {r.meetings?.meeting_date ? <DateBlock date={r.meetings.meeting_date} /> : null}
                  <Link href={r.meeting_id ? `/meetings/${r.meeting_id}` : "/dashboard/requests"} className="min-w-0 flex-1">
                    <p className="font-display font-semibold text-ink hover:text-turf-700">{r.horse_name || "Ride"}{r.race_number ? ` · R${r.race_number}` : ""}</p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {r.meetings?.track ?? "Meeting"}
                      {r.meetings?.meeting_date ? ` · ${formatMeetingDate(r.meetings.meeting_date)}` : ""}
                    </p>
                  </Link>
                  {incoming ? (
                    <div className="flex items-center gap-2">
                      <form action={updateRequestStatus}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="next_status" value="declined" />
                        <Button size="sm" variant="outline">Decline</Button>
                      </form>
                      <form action={updateRequestStatus}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="next_status" value="accepted" />
                        <Button size="sm" variant="accent">Accept</Button>
                      </form>
                    </div>
                  ) : (
                    <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", REQUEST_STATUS_STYLES[r.status] ?? "border-line text-zinc-500")}>{r.status}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No ride requests yet">
            Request a ride for {name} from any meeting page or the button above.
          </EmptyState>
        )}
      </section>

      {/* Their black book */}
      <section className="space-y-3">
        <BlackBook userId={jockey.id} initialEntries={blackBook} />
        {nominations.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Black-book horses racing soon</p>
            <div className="space-y-2">
              {nominations.map((n: any) => {
                const m = n.meetings;
                return (
                  <Link key={n.id} href={m?.id ? `/meetings/${m.id}` : "/meetings"} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2.5 transition-colors hover:border-turf-200">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{n.horse_name}</p>
                      <p className="truncate text-xs text-zinc-500">{m?.track}{m?.meeting_date ? " · " + formatMeetingDate(m.meeting_date) : ""}{n.race_number ? " · R" + n.race_number : ""}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-turf-200 bg-turf-50 px-2.5 py-0.5 text-xs font-medium text-turf-700">View</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
