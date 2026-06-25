import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, ClothChip } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { DateBlock } from "@/components/racing";
import { QuickWeightForm } from "@/components/quick-weight-form";
import { IdUploadForm } from "@/components/id-upload-form";
import { HorsePreloadWizard } from "@/components/horse-preload-wizard";
import { TrainerHorses } from "@/components/trainer-horses";
import { PreferredRiders } from "@/components/preferred-riders";
import type { PreferredJockey } from "@/components/preferred-riders";
import { OwnerHorseClaim } from "@/components/owner-horse-claim";
import { PageHeader } from "@/components/premium";
import {
  REQUEST_STATUS_STYLES,
  cn,
  formatClaim,
  formatMeetingDate,
  isAdminEmail,
  nzToday,
  nzDatePlusDays,
} from "@/lib/utils";
import type { Meeting, Profile, RideRequest } from "@/lib/types";

function VerificationBanner({ profile }: { profile: Profile }) {
  if (profile.verification_status === "approved") return null;
  if (profile.verification_status === "rejected") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Your verification was declined. If you think this is a mistake, reply
        to your welcome email and the team will take another look.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <span className="font-semibold">Verification pending.</span>{" "}
      {profile.role === "jockey"
        ? "You can set up your profile and mark attendance now. Once an admin verifies you, your profile goes public and you can request rides."
        : profile.role === "agent"
        ? "Agent accounts are approved manually by an admin, even when your phone matches the registry. You will get full access once approved."
        : "We could not match your phone number against the NZTR registry. Check it on your profile page, or wait for a manual review."}
      {!profile.registry_match && profile.role !== "agent" ? (
        <IdUploadForm
          userId={profile.id}
          uploadedAt={profile.id_document_uploaded_at ?? null}
        />
      ) : null}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");

  const admin = isAdminEmail(user.email);
  const firstName = profile.first_name || "there";

  const { data: upcomingMeetings } = await supabase
    .from("meetings")
    .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type")
    .gte("meeting_date", nzToday())
    .lte("meeting_date", nzDatePlusDays(14))
    .order("meeting_date", { ascending: true })
    .limit(6)
    .returns<Meeting[]>();

  let attendingMeetings: Meeting[] = [];
  if (profile.role === "jockey") {
    const { data: rows } = await supabase
      .from("meeting_attendance")
      .select("meeting_id")
      .eq("user_id", user.id)
      .eq("attending", true);
    const ids = (rows ?? []).map((r) => r.meeting_id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("meetings")
        .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type")
        .in("id", ids)
        .gte("meeting_date", nzToday())
        .order("meeting_date", { ascending: true })
        .limit(6)
        .returns<Meeting[]>();
      attendingMeetings = data ?? [];
    }
  }

  const { data: requests } = await supabase
    .from("ride_requests")
    .select("*")
    .or(`trainer_id.eq.${user.id},jockey_id.eq.${user.id},created_by.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<RideRequest[]>();

  let managed: Profile[] = [];
  if (profile.role === "agent") {
    const { data: links } = await supabase
      .from("agent_jockeys")
      .select("jockey_id")
      .eq("agent_id", user.id);
    const ids = (links ?? []).map((l) => l.jockey_id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids)
        .returns<Profile[]>();
      managed = data ?? [];
    }
  }

  // Trainer: horse links (pending + confirmed). On first visit, auto-load the
  // trainer's stable from the horse registry (matched on nztr_trainer_name) so
  // they only have to confirm or deny each horse rather than search them up.
  let trainerHorseLinks: any[] = [];
  if (profile.role === "trainer") {
    const { count } = await supabase
      .from("trainer_horse_links")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", user.id);
    if (!count) {
      await supabase.rpc("match_trainer_horses", { p_trainer_id: user.id });
    }
    const { data } = await supabase
      .from("trainer_horse_links")
      .select("id, status, horses(id, name, sire, dam, nztr_trainer_name)")
      .eq("trainer_id", user.id)
      .in("status", ["pending", "confirmed"])
      .order("created_at", { ascending: false });
    trainerHorseLinks = data ?? [];
  }

  // Trainer: upcoming runners from confirmed stable horses.
  let trainerUpcomingRunners: any[] = [];
  if (profile.role === "trainer") {
    const confirmedNames = trainerHorseLinks
      .filter((link) => link.status === "confirmed")
      .map((link) => link.horses?.name)
      .filter(Boolean) as string[];
    if (confirmedNames.length > 0) {
      const { data: runners } = await supabase
        .from("race_entries")
        .select(
          "id, race_number, horse_number, horse_name, jockey_name, trainer_name, barrier, weight, meetings!inner(id, meeting_date, track, club), races(name, distance, race_class, start_time)"
        )
        .in("horse_name", confirmedNames)
        .gte("meetings.meeting_date", nzToday())
        .limit(20);

      trainerUpcomingRunners = (runners ?? [])
        .sort((a: any, b: any) => {
          const aDate = a.meetings?.meeting_date ?? "";
          const bDate = b.meetings?.meeting_date ?? "";
          if (aDate !== bDate) return aDate.localeCompare(bDate);
          return Number(a.race_number ?? 0) - Number(b.race_number ?? 0);
        })
        .slice(0, 6);
    }
  }

  // Trainer: preferred-rider shortlist (max 5). Rows are managed under RLS by the
  // trainer; we join the jockeys' public display data for the manager UI.
  let preferredRiders: PreferredJockey[] = [];
  if (profile.role === "trainer") {
    const { data: rows } = await supabase
      .from("trainer_preferred_jockeys")
      .select("id, jockey_id, created_at")
      .eq("trainer_id", user.id)
      .order("created_at", { ascending: true });
    const jockeyIds = (rows ?? []).map((r) => r.jockey_id);
    if (jockeyIds.length > 0) {
      const { data: jockeys } = await supabase
        .from("public_profiles")
        .select("id, full_name, profile_photo_url, riding_weight, apprentice, apprentice_claim")
        .in("id", jockeyIds);
      const byId = new Map((jockeys ?? []).map((j: any) => [j.id, j]));
      preferredRiders = (rows ?? [])
        .filter((r) => byId.has(r.jockey_id))
        .map((r) => {
          const j: any = byId.get(r.jockey_id);
          return {
            id: r.id,
            jockey_id: r.jockey_id,
            full_name: j.full_name,
            profile_photo_url: j.profile_photo_url,
            riding_weight: j.riding_weight,
            apprentice: j.apprentice ?? false,
            apprentice_claim: j.apprentice_claim,
          };
        });
    }
  }

  // Owner: horse links (pending + confirmed). On first visit, auto-load the
  // owner's horses from the registry (matched on registered owner name) so they
  // only have to confirm or deny each one.
  let ownerHorseLinks: any[] = [];
  if (profile.role === "owner") {
    const { count } = await supabase
      .from("owner_horse_links")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    if (!count) {
      await supabase.rpc("match_owner_horses", { p_owner_id: user.id });
    }
    const { data } = await supabase
      .from("owner_horse_links")
      .select("id, status, horses(id, name, sire, dam, nztr_trainer_name)")
      .eq("owner_id", user.id)
      .in("status", ["pending", "confirmed"])
      .order("created_at", { ascending: false });
    ownerHorseLinks = data ?? [];
  }

  let ownerHorseClaims: any[] = [];
  let ownerUpcomingRunners: any[] = [];
  if (profile.role === "owner") {
    const { data: claims } = await supabase
      .from("owner_horse_claims")
      .select(
        "id, race_entry_id, status, race_entries(id, horse_name, race_number, jockey_name, trainer_name, owner_text, meetings(meeting_date, track))"
      )
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    ownerHorseClaims = claims ?? [];

    const linkedHorseNames = ownerHorseLinks
      .map((link) => link.horses?.name)
      .filter(Boolean) as string[];

    if (linkedHorseNames.length > 0) {
      const { data: runners } = await supabase
        .from("race_entries")
        .select(
          "id, race_number, horse_number, horse_name, jockey_name, trainer_name, barrier, weight, meetings!inner(id, meeting_date, track, club), races(name, distance, race_class, start_time)"
        )
        .in("horse_name", linkedHorseNames)
        .gte("meetings.meeting_date", nzToday())
        .limit(20);

      ownerUpcomingRunners = (runners ?? [])
        .sort((a: any, b: any) => {
          const aDate = a.meetings?.meeting_date ?? "";
          const bDate = b.meetings?.meeting_date ?? "";
          if (aDate !== bDate) return aDate.localeCompare(bDate);
          return Number(a.race_number ?? 0) - Number(b.race_number ?? 0);
        })
        .slice(0, 6);
    }
  }

  const ownerConfirmedLinks = ownerHorseLinks.filter((link) => link.status === "confirmed");
  const ownerPendingLinks = ownerHorseLinks.filter((link) => link.status === "pending");

  // Getting-started checklist for users still setting up. Hidden once complete.
  const verified = profile.verification_status === "approved";
  const trainerConfirmed = trainerHorseLinks.filter((l) => l.status === "confirmed").length;
  const startSteps: { label: string; done: boolean; href: string }[] =
    profile.role === "jockey"
      ? [
          { label: "Set your current riding weight", done: profile.riding_weight != null, href: "/dashboard" },
          { label: "Mark the meetings you're attending", done: attendingMeetings.length > 0, href: "/dashboard/calendar" },
          { label: "Get verified to appear publicly", done: verified, href: "/dashboard/profile" },
        ]
      : profile.role === "trainer"
      ? [
          { label: "Confirm the horses in your stable", done: trainerConfirmed > 0, href: "/dashboard" },
          { label: "Send your first ride request", done: (requests?.length ?? 0) > 0, href: "/dashboard/requests/new" },
          { label: "Get verified to appear publicly", done: verified, href: "/dashboard/profile" },
        ]
      : profile.role === "owner"
      ? [
          { label: "Confirm your horses", done: ownerConfirmedLinks.length > 0, href: "/dashboard" },
          { label: "Get verified", done: verified, href: "/dashboard/profile" },
        ]
      : [];
  const showGettingStarted = startSteps.some((s) => !s.done);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Race-day workspace"
        title={`Hi ${firstName}`}
        description="Your current meetings, bookings and account actions in one operational view."
        action={
          <Badge tone="neutral" className="capitalize">
            {profile.role}
          </Badge>
        }
      />

      {admin ? (
        <Link
          href="/admin"
          className="block rounded-2xl border border-ink bg-ink p-4 text-sm text-white transition-colors hover:bg-zinc-800"
        >
          <span className="font-semibold">Admin tools</span>
          <span className="ml-2 text-zinc-300">
            Approvals, registry, meeting sync →
          </span>
        </Link>
      ) : null}

      <VerificationBanner profile={profile} />

      {showGettingStarted ? (
        <section className="rounded-2xl border border-turf-200 bg-turf-50/50 p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Getting started</h2>
          <p className="mt-0.5 text-sm text-zinc-600">
            A few quick steps to get the most out of JockeyFinder.
          </p>
          <ul className="mt-3 space-y-2">
            {startSteps.map((s) => (
              <li key={s.label}>
                <Link
                  href={s.href}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 transition-colors hover:border-turf-300"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      s.done ? "bg-turf-600 text-white" : "border border-zinc-300 text-transparent"
                    )}
                  >
                    ✓
                  </span>
                  <span className={cn("text-sm", s.done ? "text-zinc-400 line-through" : "font-medium text-ink")}>
                    {s.label}
                  </span>
                  {!s.done ? <span className="ml-auto text-xs font-medium text-turf-700">Do it →</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {profile.role === "jockey" ? (
        <>
          <Card>
            <CardBody>
              <h2 className="mb-1 font-display text-lg font-semibold text-ink">
                Today&apos;s weight
              </h2>
              <p className="mb-4 text-sm text-zinc-500">
                Keep this current. Trainers see it next to your name on every
                meeting you are attending.
              </p>
              <QuickWeightForm
                userId={profile.id}
                ridingWeight={profile.riding_weight}
                apprentice={profile.apprentice}
                apprenticeClaim={profile.apprentice_claim}
              />
            </CardBody>
          </Card>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                You are attending
              </h2>
              <Link
                href="/dashboard/calendar"
                className="text-sm font-medium text-turf-700 hover:underline"
              >
                Open my calendar
              </Link>
            </div>
            {attendingMeetings.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {attendingMeetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 transition-colors hover:border-turf-200 hover:bg-turf-50/40"
                  >
                    <DateBlock date={m.meeting_date} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{m.track}</p>
                      {m.club ? (
                        <p className="truncate text-sm text-zinc-500">{m.club}</p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No meetings marked yet">
                Open{" "}
                <Link href="/dashboard/calendar" className="font-medium text-turf-700 underline">
                  My Calendar
                </Link>{" "}
                and tap the meetings you plan to ride at.
              </EmptyState>
            )}
          </section>
        </>
      ) : null}

      {profile.role === "trainer" ? (
        <>
          <HorsePreloadWizard links={trainerHorseLinks} role="trainer" />
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Next two weeks
              </h2>
              <Link
                href="/dashboard/requests/new"
                className={buttonClasses("accent", "sm")}
              >
                Request a jockey
              </Link>
            </div>
            {upcomingMeetings && upcomingMeetings.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {upcomingMeetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 transition-colors hover:border-turf-200 hover:bg-turf-50/40"
                  >
                    <DateBlock date={m.meeting_date} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{m.track}</p>
                      <p className="truncate text-sm text-zinc-500">
                        {m.club ?? "View attending jockeys"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No meetings in the next two weeks">
                Once the meeting sync has run, upcoming race days appear here.
              </EmptyState>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Your runners
              </h2>
              <Link
                href="/meetings"
                className="text-sm font-medium text-turf-700 hover:underline"
              >
                Browse meetings
              </Link>
            </div>
            {trainerUpcomingRunners.length > 0 ? (
              <div className="grid gap-2">
                {trainerUpcomingRunners.map((runner: any) => {
                  const meeting = runner.meetings;
                  const race = Array.isArray(runner.races) ? runner.races[0] : runner.races;
                  return (
                    <Link
                      key={runner.id}
                      href={meeting?.id ? `/meetings/${meeting.id}` : "/meetings"}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition-all hover:border-turf-200 hover:shadow-lift"
                    >
                      {meeting?.meeting_date ? (
                        <DateBlock date={meeting.meeting_date} />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display font-semibold text-ink">
                            {runner.horse_name}
                          </p>
                          {runner.race_number ? (
                            <ClothChip tone="ink">R{runner.race_number}</ClothChip>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-zinc-500">
                          {meeting?.track || "Upcoming meeting"}
                          {meeting?.meeting_date ? " · " + formatMeetingDate(meeting.meeting_date) : ""}
                          {race?.distance ? " · " + race.distance + "m" : ""}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {runner.jockey_name ? "Jockey: " + runner.jockey_name : "Jockey TBC"}
                          {runner.barrier != null ? " · Barrier " + runner.barrier : ""}
                        </p>
                      </div>
                      <span className="rounded-full border border-turf-200 bg-turf-50 px-2.5 py-0.5 text-xs font-medium text-turf-700">
                        View race day
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No upcoming runners yet">
                Confirm the horses in your stable above. When their race-card
                entries sync, your runners appear here with meeting and jockey details.
              </EmptyState>
            )}
          </section>

          <PreferredRiders trainerId={profile.id} initialPreferred={preferredRiders} />

          <TrainerHorses initialLinks={trainerHorseLinks} role="trainer" />
        </>
      ) : null}

      {profile.role === "owner" ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-turf-600">
                  Owner race room
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
                  Your stable at a glance
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600">
                  Track linked horses, confirm ownership matches from race cards,
                  and see upcoming runners without hunting through the public pages.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Linked horses", ownerConfirmedLinks.length],
                    ["Waiting approval", ownerPendingLinks.length],
                    ["Race-card matches", ownerHorseClaims.length],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl border border-line bg-paper p-4">
                      <p className="font-display text-2xl font-semibold text-ink">
                        {value as number}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-ink p-5 text-white sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-turf-200">
                  Fast actions
                </p>
                <div className="mt-4 space-y-2">
                  {[
                    { href: "/meetings", title: "Open race meetings", blurb: "Race cards, runners and attending riders." },
                    { href: "/trainers", title: "Find trainer details", blurb: "Stable contacts, regions and runners." },
                    { href: "/dashboard/messages", title: "Open messages", blurb: "Ride chats and stable conversations." },
                  ].map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="block rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 transition-colors hover:border-turf-700 hover:bg-turf-800/30"
                    >
                      <p className="text-sm font-semibold text-white">{action.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{action.blurb}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <OwnerHorseClaim claims={ownerHorseClaims} />

          <HorsePreloadWizard links={ownerHorseLinks} role="owner" />

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Upcoming runners
              </h2>
              <Link
                href="/meetings"
                className="text-sm font-medium text-turf-700 hover:underline"
              >
                Browse meetings
              </Link>
            </div>
            {ownerUpcomingRunners.length > 0 ? (
              <div className="grid gap-2">
                {ownerUpcomingRunners.map((runner: any) => {
                  const meeting = runner.meetings;
                  const race = Array.isArray(runner.races) ? runner.races[0] : runner.races;
                  return (
                    <Link
                      key={runner.id}
                      href={meeting?.id ? `/meetings/${meeting.id}` : "/meetings"}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition-all hover:border-turf-200 hover:shadow-lift"
                    >
                      {meeting?.meeting_date ? (
                        <DateBlock date={meeting.meeting_date} />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display font-semibold text-ink">
                            {runner.horse_name}
                          </p>
                          {runner.race_number ? (
                            <ClothChip tone="ink">R{runner.race_number}</ClothChip>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-zinc-500">
                          {meeting?.track || "Upcoming meeting"}
                          {meeting?.meeting_date ? " · " + formatMeetingDate(meeting.meeting_date) : ""}
                          {race?.distance ? " · " + race.distance + "m" : ""}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {runner.trainer_name ? "Trainer: " + runner.trainer_name : "Trainer TBC"}
                          {" · "}
                          {runner.jockey_name ? "Jockey: " + runner.jockey_name : "Jockey TBC"}
                        </p>
                      </div>
                      <span className="rounded-full border border-turf-200 bg-turf-50 px-2.5 py-0.5 text-xs font-medium text-turf-700">
                        View race day
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No upcoming runners linked yet">
                Link your horses below. When race-card entries sync, your runners
                will appear here with meeting, trainer and jockey details.
              </EmptyState>
            )}
          </section>

          <TrainerHorses initialLinks={ownerHorseLinks} role="owner" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { href: "/meetings", title: "Race meetings", blurb: "See the next 30 days and who is riding where." },
              { href: "/jockeys", title: "Jockeys", blurb: "Verified riders with weights and claims." },
              { href: "/trainers", title: "Trainers", blurb: "Verified stables across New Zealand." },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift"
              >
                <p className="font-display font-semibold text-ink">{c.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{c.blurb}</p>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {profile.role === "agent" ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Your jockeys · {managed.length}
            </h2>
            <Link
              href="/dashboard/agent"
              className="text-sm font-medium text-turf-700 hover:underline"
            >
              Manage jockeys
            </Link>
          </div>
          {managed.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {managed.map((j) => (
                <div
                  key={j.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4"
                >
                  <div>
                    <p className="font-medium text-ink">{j.full_name}</p>
                    <p className="text-sm text-zinc-500">
                      {j.riding_weight != null ? j.riding_weight + "kg" : "No weight set"}
                      {j.apprentice && formatClaim(j.apprentice_claim)
                        ? " · claims " + formatClaim(j.apprentice_claim)
                        : ""}
                    </p>
                  </div>
                  {j.apprentice && formatClaim(j.apprentice_claim) ? (
                    <ClothChip tone="turf">{formatClaim(j.apprentice_claim)}</ClothChip>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No jockeys linked yet">
              Add the jockeys you manage from the My Jockeys page.
            </EmptyState>
          )}
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Recent ride requests
          </h2>
          <Link
            href="/dashboard/requests"
            className="text-sm font-medium text-turf-700 hover:underline"
          >
            View all
          </Link>
        </div>
        {requests && requests.length > 0 ? (
          <div className="space-y-2">
            {requests.map((r) => (
              <Link
                key={r.id}
                href="/dashboard/requests"
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-turf-200"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {r.horse_name || "Ride request"}
                    {r.race_number ? " · R" + r.race_number : ""}
                  </p>
                  {r.note ? (
                    <p className="truncate text-sm text-zinc-500">{r.note}</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                    REQUEST_STATUS_STYLES[r.status]
                  )}
                >
                  {r.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No ride requests yet">
            {profile.role === "trainer"
              ? "Request a jockey from any meeting page or the Requests tab."
              : profile.role === "jockey"
              ? "Once verified, you can request rides and receive offers from trainers here."
              : "Ride requests involving you will appear here."}
          </EmptyState>
        )}
      </section>
    </div>
  );
}
