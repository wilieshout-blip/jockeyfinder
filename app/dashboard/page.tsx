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
import {
  REQUEST_STATUS_STYLES,
  cn,
  formatClaim,
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

  // Trainer: horse links (pending + confirmed)
  let trainerHorseLinks: any[] = [];
  if (profile.role === "trainer") {
    const { data } = await supabase
      .from("trainer_horse_links")
      .select("id, status, horses(id, name, sire, dam, nztr_trainer_name)")
      .eq("trainer_id", user.id)
      .in("status", ["pending", "confirmed"])
      .order("created_at", { ascending: false });
    trainerHorseLinks = data ?? [];
  }

  // Owner: horse links (pending + confirmed)
  let ownerHorseLinks: any[] = [];
  if (profile.role === "owner") {
    const { data } = await supabase
      .from("owner_horse_links")
      .select("id, status, horses(id, name, sire, dam, nztr_trainer_name)")
      .eq("owner_id", user.id)
      .in("status", ["pending", "confirmed"])
      .order("created_at", { ascending: false });
    ownerHorseLinks = data ?? [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
            Dashboard
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Hi {firstName}
          </h1>
        </div>
        <Badge tone="neutral" className="capitalize">
          {profile.role}
        </Badge>
      </div>

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
          <TrainerHorses initialLinks={trainerHorseLinks} role="trainer" />
        </>
      ) : null}

      {profile.role === "owner" ? (
        <>
          <HorsePreloadWizard links={ownerHorseLinks} role="owner" />
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
