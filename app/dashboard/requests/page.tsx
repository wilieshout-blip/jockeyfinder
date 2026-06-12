import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateRequestStatus } from "./actions";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { DateBlock } from "@/components/racing";
import { cn, REQUEST_STATUS_STYLES, formatDateTime } from "@/lib/utils";
import type { Meeting, Profile, RideRequest } from "@/lib/types";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: { created?: string; error?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!me) redirect("/login");

  const { data: requests } = await supabase
    .from("ride_requests")
    .select("*")
    .or(`trainer_id.eq.${user.id},jockey_id.eq.${user.id},created_by.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .returns<RideRequest[]>();

  const all = requests ?? [];

  // Names of the people on each request.
  const personIds = Array.from(
    new Set(all.flatMap((r) => [r.trainer_id, r.jockey_id]))
  ).filter((id) => id !== user.id);

  const names = new Map<string, string>();
  if (personIds.length > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", personIds);
    for (const p of people ?? []) names.set(p.id, p.full_name ?? "Member");
  }

  // Meetings referenced by these requests.
  const meetingIds = Array.from(
    new Set(all.map((r) => r.meeting_id).filter(Boolean))
  ) as string[];
  const meetings = new Map<string, Meeting>();
  if (meetingIds.length > 0) {
    const { data } = await supabase
      .from("meetings")
      .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type")
      .in("id", meetingIds)
      .returns<Meeting[]>();
    for (const m of data ?? []) meetings.set(m.id, m);
  }

  // Threads for assigned requests so we can deep link to the chat.
  const threadByRequest = new Map<string, string>();
  const assignedIds = all.filter((r) => r.status === "assigned").map((r) => r.id);
  if (assignedIds.length > 0) {
    const { data: threads } = await supabase
      .from("chat_threads")
      .select("id, ride_request_id")
      .in("ride_request_id", assignedIds);
    for (const t of threads ?? []) {
      if (t.ride_request_id) threadByRequest.set(t.ride_request_id, t.id);
    }
  }

  const canCreate =
    (me.role === "trainer" && me.verified) ||
    (me.role === "jockey" && me.verified) ||
    (me.role === "agent" && me.verification_status === "approved");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
            Ride requests
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Requests
          </h1>
        </div>
        {canCreate ? (
          <Link href="/dashboard/requests/new" className={buttonClasses("accent", "sm")}>
            New request
          </Link>
        ) : null}
      </div>

      {searchParams.created ? (
        <div className="mb-4 rounded-2xl border border-turf-200 bg-turf-50 p-4 text-sm text-turf-800">
          Request sent. You will see the answer here and in Messages once assigned.
        </div>
      ) : null}
      {searchParams.error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Something went wrong: {searchParams.error}
        </div>
      ) : null}

      {!canCreate ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {me.role === "owner"
            ? "Owners have view access. Your trainer can add you to ride chats once a jockey is assigned."
            : "You can send and receive ride requests once your account is verified."}
        </div>
      ) : null}

      {all.length > 0 ? (
        <div className="space-y-3">
          {all.map((r) => {
            const meeting = r.meeting_id ? meetings.get(r.meeting_id) : null;
            const otherId = r.trainer_id === user.id ? r.jockey_id : r.trainer_id;
            const otherName = names.get(otherId) ?? "Member";
            const otherRole = r.trainer_id === user.id ? "Jockey" : "Trainer";
            const iCreated = r.created_by === user.id;
            const iAmTrainer = r.trainer_id === user.id;
            const threadId = threadByRequest.get(r.id);

            return (
              <article
                key={r.id}
                className="rounded-2xl border border-line bg-white p-4 shadow-card"
              >
                <div className="flex items-start gap-4">
                  {meeting ? <DateBlock date={meeting.meeting_date} /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">
                        {r.horse_name || "Ride request"}
                        {r.race_number ? ` · R${r.race_number}` : ""}
                      </p>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                          REQUEST_STATUS_STYLES[r.status]
                        )}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {otherRole}: <span className="font-medium text-zinc-700">{otherName}</span>
                      {meeting ? ` · ${meeting.track}` : ""}
                    </p>
                    {r.note ? (
                      <p className="mt-2 rounded-xl bg-mist p-3 text-sm text-zinc-600">
                        {r.note}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-zinc-400">
                      {iCreated ? "Sent" : "Received"} {formatDateTime(r.created_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                  {r.status === "requested" && !iCreated ? (
                    <>
                      <form action={updateRequestStatus}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="next_status" value="declined" />
                        <Button size="sm" variant="outline">Decline</Button>
                      </form>
                      {iAmTrainer ? (
                        <form action={updateRequestStatus}>
                          <input type="hidden" name="request_id" value={r.id} />
                          <input type="hidden" name="next_status" value="assigned" />
                          <Button size="sm" variant="accent">Accept and assign</Button>
                        </form>
                      ) : (
                        <form action={updateRequestStatus}>
                          <input type="hidden" name="request_id" value={r.id} />
                          <input type="hidden" name="next_status" value="accepted" />
                          <Button size="sm" variant="accent">Accept</Button>
                        </form>
                      )}
                    </>
                  ) : null}

                  {r.status === "requested" && iCreated ? (
                    <form action={updateRequestStatus}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="next_status" value="cancelled" />
                      <Button size="sm" variant="outline">Cancel request</Button>
                    </form>
                  ) : null}

                  {r.status === "accepted" && iAmTrainer ? (
                    <form action={updateRequestStatus}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="next_status" value="assigned" />
                      <Button size="sm" variant="accent">
                        Assign ride and open chat
                      </Button>
                    </form>
                  ) : null}

                  {r.status === "assigned" && threadId ? (
                    <Link
                      href={`/dashboard/messages/${threadId}`}
                      className={buttonClasses("primary", "sm")}
                    >
                      Open ride chat
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No ride requests yet">
          {me.role === "trainer"
            ? "Open a meeting to see who is riding, then request a jockey from their profile."
            : me.role === "jockey"
              ? "Mark your race days first so trainers can find you, or request a ride with a trainer once verified."
              : "Requests you make for your jockeys will show up here."}
        </EmptyState>
      )}
    </div>
  );
}
