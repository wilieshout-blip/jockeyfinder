import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, formatMeetingDate, formatDateTime, REQUEST_STATUS_STYLES, cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Avatar } from "@/components/ui/avatar";
import { approveUser, rejectUser, markAgentPaid } from "./actions";
import { TestAccountCards } from "@/components/test-account-cards";
import { SyncButton } from "./sync-button";
import { PageHeader } from "@/components/premium";

export const dynamic = "force-dynamic";

type PendingProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  phone: string | null;
  base_region: string | null;
  registry_match: boolean | null;
  created_at: string;
  profile_photo_url: string | null;
  id_document_path: string | null;
  licence_type: string | null;
};

async function count(admin: ReturnType<typeof createAdminClient>, table: string, filters?: (q: any) => any) {
  let q: any = admin.from(table).select("*", { count: "exact", head: true });
  if (filters) q = filters(q);
  const { count: c } = await q;
  return c || 0;
}

const TEST_ERROR_COPY: Record<string, string> = {
  unknown: "That test account is not configured.",
  setup_failed:
    "Could not sign in to that test account. It may need re-seeding in Supabase.",
  link_failed:
    "The test account exists, but the sign-in did not complete.",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ test_error?: string }>;
}) {
  const queryParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/dashboard");

  const admin = createAdminClient();

  const [jockeys, trainers, owners, agents, registryRows, meetingsAhead] =
    await Promise.all([
      count(admin, "profiles", (q) => q.eq("role", "jockey")),
      count(admin, "profiles", (q) => q.eq("role", "trainer")),
      count(admin, "profiles", (q) => q.eq("role", "owner")),
      count(admin, "profiles", (q) => q.eq("role", "agent")),
      count(admin, "nztr_people_registry"),
      count(admin, "meetings", (q) =>
        q.gte("meeting_date", new Date().toISOString().slice(0, 10))
      ),
    ]);

  // Most recent data sync (manual or the 15-minute auto-sync), for the badge by the button.
  const [{ data: lastRun }, { data: lastEntry }] = await Promise.all([
    admin.from("sync_runs").select("ran_at, source").order("ran_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("race_entries").select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const syncTimes = [lastRun?.ran_at, lastEntry?.synced_at].filter(Boolean) as string[];
  const lastSyncedAt = syncTimes.sort().at(-1) ?? null;
  const lastSyncedSource =
    lastRun?.ran_at && lastSyncedAt === lastRun.ran_at ? (lastRun.source as string) : null;

  const { data: pendingJockeys } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, role, phone, base_region, registry_match, created_at, profile_photo_url, id_document_path, licence_type"
    )
    .eq("role", "jockey")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  const { data: pendingAgents } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, role, phone, base_region, registry_match, created_at, profile_photo_url, id_document_path, licence_type"
    )
    .eq("role", "agent")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  // Short-lived links so the admin can eyeball uploaded IDs.
  const idDocLinks = new Map<string, string>();
  const pendingWithDocs = [...(pendingJockeys || []), ...(pendingAgents || [])].filter(
    (p: any) => p.id_document_path
  );
  for (const p of pendingWithDocs) {
    const { data: signed } = await admin.storage
      .from("identity-docs")
      .createSignedUrl((p as any).id_document_path, 600);
    if (signed?.signedUrl) idDocLinks.set((p as any).id, signed.signedUrl);
  }

  const { data: recentTrainers } = await admin
    .from("profiles")
    .select("id, full_name, email, created_at, registry_match")
    .eq("role", "trainer")
    .eq("verification_status", "approved")
    .order("created_at", { ascending: false })
    .limit(6);

  const { data: recentRequests } = await admin
    .from("ride_requests")
    .select("id, status, horse_name, race_number, created_at, trainer_id, jockey_id, meeting_id")
    .order("created_at", { ascending: false })
    .limit(8);

  const personIds = new Set<string>();
  const meetingIds = new Set<string>();
  for (const r of recentRequests || []) {
    if (r.trainer_id) personIds.add(r.trainer_id);
    if (r.jockey_id) personIds.add(r.jockey_id);
    if (r.meeting_id) meetingIds.add(r.meeting_id);
  }

  const [{ data: people }, { data: reqMeetings }] = await Promise.all([
    personIds.size
      ? admin.from("profiles").select("id, full_name").in("id", Array.from(personIds))
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    meetingIds.size
      ? admin
          .from("meetings")
          .select("id, track, meeting_date")
          .in("id", Array.from(meetingIds))
      : Promise.resolve({
          data: [] as { id: string; track: string | null; meeting_date: string }[],
        }),
  ]);

  const nameById = new Map((people || []).map((p) => [p.id, p.full_name || "Unknown"]));
  const meetingById = new Map((reqMeetings || []).map((m) => [m.id, m]));
  const testError = queryParams.test_error
    ? TEST_ERROR_COPY[queryParams.test_error] || "The test account sign-in failed."
    : null;

  const PendingList = ({
    rows,
    kind,
    emptyLabel,
  }: {
    rows: PendingProfile[];
    kind: "jockey" | "agent" | "trial_rider";
    emptyLabel?: string;
  }) => (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <EmptyState title={emptyLabel ?? "No " + kind + "s waiting"}>
          New signups will appear here for review.
        </EmptyState>
      ) : (
        rows.map((p) => {
          const isTrialRider = p.licence_type === "trial_jumpout_only";
          const docLabel = isTrialRider ? "View permit" : "View ID";
          return (
            <Card key={p.id}>
              <CardBody className="flex flex-wrap items-center gap-4">
                <Avatar name={p.full_name} src={p.profile_photo_url} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-semibold text-ink">
                      {p.full_name || "Unnamed"}
                    </p>
                    {isTrialRider && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Trial rider
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">
                    {p.email || "no email"}
                    {p.phone ? " · " + p.phone : ""}
                    {p.base_region ? " · " + p.base_region : ""}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Signed up {formatDateTime(p.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {idDocLinks.has(p.id) ? (
                    <a
                      href={idDocLinks.get(p.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-turf-200 bg-turf-50 px-2.5 py-0.5 text-xs font-medium text-turf-700 hover:bg-turf-100"
                    >
                      {docLabel}
                    </a>
                  ) : (
                    <Badge tone="neutral">
                      {isTrialRider ? "No permit uploaded" : "No ID uploaded"}
                    </Badge>
                  )}
                  {kind === "agent" && (
                    <Badge tone={p.registry_match ? "turf" : "amber"}>
                      {p.registry_match ? "Registry match" : "No registry match"}
                    </Badge>
                  )}
                  <form action={approveUser}>
                    <input type="hidden" name="user_id" value={p.id} />
                    <Button size="sm" type="submit">
                      Approve
                    </Button>
                  </form>
                  <form action={rejectUser}>
                    <input type="hidden" name="user_id" value={p.id} />
                    <Button size="sm" variant="ghost" type="submit">
                      Reject
                    </Button>
                  </form>
                  {kind === "agent" && (
                    <form action={markAgentPaid}>
                      <input type="hidden" name="user_id" value={p.id} />
                      <Button size="sm" variant="outline" type="submit">
                        Mark paid
                      </Button>
                    </form>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );

  // Split pending jockeys: full licence vs trial riders
  const pendingFullJockeys = (pendingJockeys || []).filter(
    (p: any) => p.licence_type !== "trial_jumpout_only"
  ) as PendingProfile[];
  const pendingTrialRiders = (pendingJockeys || []).filter(
    (p: any) => p.licence_type === "trial_jumpout_only"
  ) as PendingProfile[];

  const pendingAgentsList = (pendingAgents || []) as PendingProfile[];
  const totalPending =
    pendingFullJockeys.length + pendingTrialRiders.length + pendingAgentsList.length;

  const tools = [
    { href: "/admin/broadcast", title: "Broadcast email", blurb: "Templated email to all users or a type." },
    { href: "/admin/stand-downs", title: "Stand-downs", blurb: "Record & alert affected trainers." },
    { href: "/admin/sync", title: "Data sync hub", blurb: "Ingestion health & staleness." },
    { href: "/admin/monitor", title: "Outlier monitor", blurb: "Same-day clashes & weight anomalies." },
    { href: "/admin/chats", title: "Chat supervisor", blurb: "Oversight of booking chats." },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        dark
        eyebrow="Admin"
        title="Operations console"
        description="Approvals, registry checks, tools and the race calendar feed."
      />

      {testError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span className="font-semibold">Test sign-in failed.</span> {testError}
        </div>
      ) : null}

      {/* Compact stats strip */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          ["Jockeys", jockeys],
          ["Trainers", trainers],
          ["Owners", owners],
          ["Agents", agents],
          ["Registry", registryRows],
          ["Meetings", meetingsAhead],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-center shadow-card"
          >
            <p className="font-display text-xl font-bold text-ink">{value as number}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Work queue + quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Approvals — the recurring work, front and centre */}
        <div className="space-y-5 lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-lg font-semibold text-ink">Approvals</h2>
            {totalPending > 0 ? (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {totalPending} waiting
              </span>
            ) : (
              <span className="rounded-full bg-turf-100 px-2 py-0.5 text-xs font-semibold text-turf-700">
                All clear
              </span>
            )}
          </div>

          {totalPending === 0 ? (
            <EmptyState title="Nothing waiting for review">
              New signups will appear here for approval.
            </EmptyState>
          ) : (
            <div className="space-y-6">
              {pendingFullJockeys.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    Jockeys · {pendingFullJockeys.length}
                  </h3>
                  <PendingList rows={pendingFullJockeys} kind="jockey" />
                </div>
              ) : null}
              {pendingTrialRiders.length > 0 ? (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    Trial riders · {pendingTrialRiders.length}
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Permit required
                    </span>
                  </h3>
                  <PendingList rows={pendingTrialRiders} kind="trial_rider" />
                </div>
              ) : null}
              {pendingAgentsList.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    Agents · {pendingAgentsList.length}
                  </h3>
                  <PendingList rows={pendingAgentsList} kind="agent" />
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Quick actions sidebar */}
        <aside className="space-y-4">
          <Link
            href="/admin/users"
            className="block rounded-2xl border border-ink bg-ink p-4 text-white transition-colors hover:bg-zinc-800"
          >
            <p className="font-display font-semibold">Manage all users →</p>
            <p className="mt-0.5 text-xs text-zinc-300">
              Search, approve, change role, edit, pause or delete.
            </p>
          </Link>

          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <p className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Tools
            </p>
            <div className="divide-y divide-line">
              {tools.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-mist/60"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{t.title}</p>
                    <p className="truncate text-xs text-zinc-400">{t.blurb}</p>
                  </div>
                  <span className="shrink-0 text-zinc-300">→</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Race calendar
              </p>
              <SyncButton lastSyncedAt={lastSyncedAt} source={lastSyncedSource} />
            </div>
            <p className="text-xs text-zinc-500">
              Auto-syncs every 15 min; the button forces an immediate refresh.
            </p>
          </div>
        </aside>
      </div>

      {/* Test accounts (dev only) */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="font-display text-lg font-semibold text-ink">Test accounts</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Dev only
          </span>
          <p className="text-xs text-zinc-500">
            One-click sign-in · password{" "}
            <span className="font-mono font-medium text-ink">TestPass123!</span> · log back in as{" "}
            <span className="font-medium text-ink">wilieshout@gmail.com</span> to return.
          </p>
        </div>
        <TestAccountCards />
      </section>

      {/* Recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">
            Recently auto-approved trainers
          </h2>
          {(recentTrainers || []).length === 0 ? (
            <EmptyState title="No trainers yet">
              Trainers verify automatically when their phone matches the NZTR registry.
            </EmptyState>
          ) : (
            <Card>
              <CardBody className="divide-y divide-line p-0">
                {(recentTrainers || []).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {t.full_name || "Unnamed"}
                      </p>
                      <p className="text-xs text-zinc-400">{t.email}</p>
                    </div>
                    <Badge tone="turf">Registry match</Badge>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">
            Latest ride requests
          </h2>
          {(recentRequests || []).length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : (
            <Card>
              <CardBody className="divide-y divide-line p-0">
                {(recentRequests || []).map((r) => {
                  const m = r.meeting_id ? meetingById.get(r.meeting_id) : null;
                  return (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {nameById.get(r.trainer_id) || "Trainer"} to{" "}
                          {nameById.get(r.jockey_id) || "Jockey"}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {r.horse_name ? r.horse_name + " · " : ""}
                          {m ? m.track + ", " + formatMeetingDate(m.meeting_date) : "No meeting"}
                          {r.race_number ? " · R" + r.race_number : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                          REQUEST_STATUS_STYLES[r.status] || REQUEST_STATUS_STYLES.requested
                        )}
                      >
                        {r.status}
                      </span>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
