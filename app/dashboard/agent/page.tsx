import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { Avatar } from "@/components/ui/avatar";
import { DateBlock } from "@/components/racing";
import {
  formatClaim,
  formatWeight,
  formatMeetingDate,
  nzToday,
  cn,
  REQUEST_STATUS_STYLES,
} from "@/lib/utils";
import { linkJockeyByEmail, unlinkJockey, createPlaceholderJockey, updateManagedJockey } from "./actions";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; linked?: string; updated?: string }>;
}) {
  const queryParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, verification_status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "agent") redirect("/dashboard");

  const approved = profile.verification_status === "approved";

  let managed: {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
    riding_weight: number | null;
    apprentice: boolean | null;
    apprentice_claim: number | null;
    base_region: string | null;
    verified: boolean | null;
    is_placeholder: boolean | null;
  }[] = [];

  if (approved) {
    const { data: links } = await supabase
      .from("agent_jockeys")
      .select("jockey_id")
      .eq("agent_id", user.id);

    const ids = (links || []).map((l) => l.jockey_id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, full_name, first_name, last_name, profile_photo_url, riding_weight, apprentice, apprentice_claim, base_region, verified, is_placeholder"
        )
        .in("id", ids)
        .order("full_name");
      managed = data || [];
    }
  }

  // Stable-wide ride + attendance overview.
  const today = nzToday();
  const managedIds = managed.map((m) => m.id);
  const nameById = new Map(managed.map((m) => [m.id, m.full_name]));
  let upcomingRides: {
    id: string;
    jockey_name: string | null;
    horse_name: string | null;
    race_number: number | null;
    status: string;
    meeting_id: string | null;
    meeting_date: string | null;
    track: string | null;
  }[] = [];
  let attendingMeetings = 0;
  if (approved && managedIds.length > 0) {
    const { data: reqs } = await supabase
      .from("ride_requests")
      .select(
        "id, jockey_id, horse_name, race_number, status, meeting_id, meetings(meeting_date, track)"
      )
      .in("jockey_id", managedIds)
      .order("created_at", { ascending: false });
    upcomingRides = (reqs ?? [])
      .map((r: any) => ({
        id: r.id,
        jockey_name: nameById.get(r.jockey_id) ?? "Jockey",
        horse_name: r.horse_name,
        race_number: r.race_number,
        status: r.status as string,
        meeting_id: r.meeting_id,
        meeting_date: r.meetings?.meeting_date ?? null,
        track: r.meetings?.track ?? null,
      }))
      .filter((r) => (r.meeting_date ?? "") >= today && r.status !== "cancelled")
      .sort((a, b) => (a.meeting_date ?? "").localeCompare(b.meeting_date ?? ""))
      .slice(0, 12);

    const { data: att } = await supabase
      .from("meeting_attendance")
      .select("meeting_id")
      .in("user_id", managedIds)
      .eq("attending", true);
    attendingMeetings = new Set((att ?? []).map((a) => a.meeting_id)).size;
  }

  const errorMessages: Record<string, string> = {
    not_approved: "Your agent account needs admin approval before you can manage jockeys.",
    missing_email: "Enter the jockey's email address.",
    not_found: "No jockey account found with that email. Ask them to sign up first.",
    link_failed: "Could not link that jockey. Please try again.",
    missing_name: "Enter the rider's first and last name.",
    create_failed: "Could not create the placeholder profile. Please try again.",
    cannot_edit: "You can only edit details for placeholder riders you manage.",
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Agent tools"
        title="My jockeys"
      >
        Manage availability and ride requests on behalf of the riders you represent.
      </SectionHeading>

      {queryParams.error && errorMessages[queryParams.error] && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessages[queryParams.error]}
        </div>
      )}
      {queryParams.linked && (
        <div className="rounded-xl border border-turf-200 bg-turf-50 px-4 py-3 text-sm text-turf-700">
          Rider added. You can now set their calendar, edit their details and send requests for them.
        </div>
      )}
      {queryParams.updated && (
        <div className="rounded-xl border border-turf-200 bg-turf-50 px-4 py-3 text-sm text-turf-700">
          Rider details updated.
        </div>
      )}

      {!approved ? (
        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <Badge tone="amber">Pending approval</Badge>
              <p className="text-sm text-zinc-600">
                An admin reviews every agent account before it goes live. Once you are
                approved this page unlocks jockey management, shared calendars and
                request handling. Pricing for agents is agreed directly with the
                JockeyFinder team.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ["Jockeys", managed.length],
              ["Upcoming rides", upcomingRides.length],
              ["Meetings attending", attendingMeetings],
            ] as [string, number][]).map(([label, value]) => (
              <Card key={label}>
                <CardBody>
                  <p className="font-display text-2xl font-semibold text-ink">{value}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
                    {label}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>

          {upcomingRides.length > 0 ? (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Upcoming rides across your stable
              </h3>
              <div className="grid gap-2">
                {upcomingRides.map((r) => (
                  <Link
                    key={r.id}
                    href={r.meeting_id ? `/meetings/${r.meeting_id}` : "/meetings"}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition-all hover:border-turf-200 hover:shadow-lift"
                  >
                    {r.meeting_date ? <DateBlock date={r.meeting_date} /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-semibold text-ink">
                        {r.horse_name || "Ride"}
                        {r.race_number ? ` · R${r.race_number}` : ""}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-500">
                        {r.jockey_name}
                        {r.track ? ` · ${r.track}` : ""}
                        {r.meeting_date ? ` · ${formatMeetingDate(r.meeting_date)}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                        REQUEST_STATUS_STYLES[r.status] ?? "border-line text-zinc-500"
                      )}
                    >
                      {r.status}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {managed.length === 0 ? (
            <EmptyState title="No riders yet">
              Add a rider below — they don&apos;t need a JockeyFinder account; you manage everything for them.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {managed.map((j) => (
                <Card key={j.id}>
                  <CardBody className="flex flex-wrap items-center gap-4">
                    <Avatar
                      name={j.full_name || "Jockey"}
                      src={j.profile_photo_url}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-display font-semibold text-ink">
                        {j.full_name || "Unnamed jockey"}
                        {j.is_placeholder ? (
                          <Badge tone="amber">Placeholder</Badge>
                        ) : null}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {formatWeight(j.riding_weight)}
                        {j.apprentice ? ` · ${formatClaim(j.apprentice_claim)}` : ""}
                        {j.base_region ? ` · ${j.base_region}` : ""}
                        {!j.verified ? " · awaiting verification" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/calendar?jockey=${j.id}`}
                        className={buttonClasses("outline", "sm")}
                      >
                        Calendar
                      </Link>
                      <Link
                        href={`/dashboard/requests/new?jockey=${j.id}`}
                        className={buttonClasses("outline", "sm")}
                      >
                        New request
                      </Link>
                      <form action={unlinkJockey}>
                        <input type="hidden" name="jockey_id" value={j.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          Unlink
                        </Button>
                      </form>
                    </div>
                    {j.is_placeholder ? (
                      <details className="w-full border-t border-line pt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-turf-700">
                          Edit details
                        </summary>
                        <form
                          action={updateManagedJockey}
                          className="mt-3 grid gap-3 sm:grid-cols-2"
                        >
                          <input type="hidden" name="jockey_id" value={j.id} />
                          <div>
                            <Label htmlFor={`fn-${j.id}`}>First name</Label>
                            <Input id={`fn-${j.id}`} name="first_name" defaultValue={j.first_name ?? ""} />
                          </div>
                          <div>
                            <Label htmlFor={`ln-${j.id}`}>Last name</Label>
                            <Input id={`ln-${j.id}`} name="last_name" defaultValue={j.last_name ?? ""} />
                          </div>
                          <div>
                            <Label htmlFor={`rw-${j.id}`}>Riding weight (kg)</Label>
                            <Input id={`rw-${j.id}`} name="riding_weight" type="number" step="0.5" min="30" max="100" defaultValue={j.riding_weight ?? ""} placeholder="e.g. 54.5" />
                          </div>
                          <div>
                            <Label htmlFor={`ac-${j.id}`}>Apprentice claim (kg)</Label>
                            <Input id={`ac-${j.id}`} name="apprentice_claim" type="number" step="0.5" min="0" max="4" defaultValue={j.apprentice_claim ?? ""} placeholder="blank = none" />
                          </div>
                          <div className="sm:col-span-2">
                            <Label htmlFor={`br-${j.id}`}>Base region</Label>
                            <Input id={`br-${j.id}`} name="base_region" defaultValue={j.base_region ?? ""} placeholder="e.g. Waikato" />
                          </div>
                          <div className="sm:col-span-2">
                            <Button type="submit" size="sm">Save details</Button>
                          </div>
                        </form>
                      </details>
                    ) : null}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardBody>
              <h3 className="font-display text-base font-semibold text-ink">Add a rider</h3>
              <p className="mt-1 text-sm text-zinc-500">
                For a rider who isn&apos;t on JockeyFinder yet. You manage everything for them;
                their profile is automatically claimed when they sign up with a matching name, email or phone.
              </p>
              <form action={createPlaceholderJockey} className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pf-first">First name</Label>
                  <Input id="pf-first" name="first_name" required placeholder="Ethan" />
                </div>
                <div>
                  <Label htmlFor="pf-last">Last name</Label>
                  <Input id="pf-last" name="last_name" required placeholder="Jones" />
                </div>
                <div>
                  <Label htmlFor="pf-email">Email (optional)</Label>
                  <Input id="pf-email" name="email" type="email" placeholder="rider@example.com" />
                </div>
                <div>
                  <Label htmlFor="pf-phone">Phone (optional)</Label>
                  <Input id="pf-phone" name="phone" placeholder="+64 …" />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit">Add rider</Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="font-display text-base font-semibold text-ink">
                Link a jockey
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                They must already have a JockeyFinder account.
              </p>
              <form
                action={linkJockeyByEmail}
                className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <Label htmlFor="email">Jockey email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="rider@example.com"
                  />
                </div>
                <Button type="submit">Link jockey</Button>
              </form>
              <p className="mt-3 text-xs text-zinc-500">
                Linking lets you mark meetings, update weights and handle ride
                requests on their behalf. The jockey can see everything you do.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
