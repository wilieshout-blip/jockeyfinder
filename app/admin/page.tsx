import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, formatMeetingDate, formatDateTime, REQUEST_STATUS_STYLES, cn } from "@/lib/utils";
import { Card, CardBody, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Avatar } from "@/components/ui/avatar";
import { approveUser, rejectUser, markAgentPaid } from "./actions";
import { switchToTestUser } from "./test-actions";
import { SyncButton } from "./sync-button";

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
};

async function count(admin: ReturnType<typeof createAdminClient>, table: string, filters?: (q: any) => any) {
  let q: any = admin.from(table).select("*", { count: "exact", head: true });
  if (filters) q = filters(q);
  const { count: c } = await q;
  return c || 0;
}

const TEST_ACCOUNTS = [
  { email: "test-jockey@jockeyfinder.com", label: "Jockey", icon: "🏇", bg: "bg-turf-50 border-turf-200 hover:bg-turf-100" },
  { email: "test-trainer@jockeyfinder.com", label: "Trainer", icon: "📋", bg: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
  { email: "test-owner@jockeyfinder.com", label: "Owner", icon: "🏆", bg: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
  { email: "test-agent@jockeyfinder.com", label: "Agent", icon: "🤝", bg: "bg-violet-50 border-violet-200 hover:bg-violet-100" },
];

export default async function AdminPage() {
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

  const { data: pendingJockeys } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, role, phone, base_region, registry_match, created_at, profile_photo_url, id_document_path"
    )
    .eq("role", "jockey")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  const { data: pendingAgents } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, role, phone, base_region, registry_match, created_at, profile_photo_url, id_document_path"
    )
    .eq("role", "agent")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

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

  const PendingList = ({ rows, kind }: { rows: PendingProfile[]; kind: "jockey" | "agent" }) => (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <EmptyState title={`No ${kind}s waiting`}>
          New {kind} signups will appear here for review.
        </EmptyState>
      ) : (
        rows.map((p) => (
          <Card key={p.id}>
            <CardBody className="flex flex-wrap items-center gap-4">
              <Avatar name={p.full_name} src={p.profile_photo_url} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink">
                  {p.full_name || "Unnamed"}
                </p>
                <p className="text-sm text-zinc-500">
                  {p.email || "no email"}
                  {p.phone ? ` · ${p.phone}` : ""}
                  {p.base_region ? ` · ${p.base_region}` : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Signed up {formatDateTime(p.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {idDocLinks.has(p.id) ? (
                  <a
                    href={idDocLinks.get(p.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-turf-200 bg-turf-50 px-2.5 py-0.5 text-xs font-medium text-turf-700 hover:bg-turf-100"
                  >
                    View ID
                  </a>
                ) : (
                  <Badge tone="neutral">No ID uploaded</Badge>
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
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-10">
      <SectionHeading eyebrow="Admin" title="Operations console">
        Approvals, registry checks and the race calendar feed.
      </SectionHeading>

      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">
            Test accounts
          </h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Dev only
          </span>
        </div>
        <p className="mb-4 text-sm text-zinc-500">
          Click any card to instantly sign in as that test user via a one-time link.
          Your admin session ends — log back in as{" "}
          <span className="font-medium text-ink">wilieshout@gmail.com</span> to return here.
          Password for manual login: <span className="font-mono font-medium text-ink">TestPass123!</span>
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TEST_ACCOUNTS.map((account) => (
            <form key={account.email} action={switchToTestUser}>
              <input type="hidden" name="email" value={account.email} />
              <button
                type="submit"
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-all",
                  account.bg
                )}
              >
                <span className="mb-2 block text-2xl">{account.icon}</span>
                <p className="text-sm font-semibold text-ink">
                  Test {account.label}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">Sign in →</p>
              </button>
            </form>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Jockeys", jockeys],
          ["Trainers", trainers],
          ["Owners", owners],
          ["Agents", agents],
          ["Registry rows", registryRows],
          ["Meetings ahead", meetingsAhead],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardBody className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {label}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">
                {value as number}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">
            Race calendar
          </h2>
          <SyncButton />
        </div>
        <p className="text-sm text-zinc-500">
          Pulls the next three months of NZ meetings from LoveRacing. The Vercel
          cron does this daily, this button is for manual refreshes.
        </p>
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">
          Jockeys awaiting approval
        </h2>
        <PendingList rows={(pendingJockeys || []) as PendingProfile[]} kind="jockey" />
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">
          Agents awaiting approval
        </h2>
        <PendingList rows={(pendingAgents || []) as PendingProfile[]} kind="agent" />
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">
          Recently auto approved trainers
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
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">
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
                        {r.horse_name ? `${r.horse_name} · ` : ""}
                        {m ? `${m.track}, ${formatMeetingDate(m.meeting_date)}` : "No meeting"}
                        {r.race_number ? ` · R${r.race_number}` : ""}
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
  );
   }
