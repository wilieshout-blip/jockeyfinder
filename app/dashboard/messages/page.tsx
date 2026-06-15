import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/utils";
import { NewConversationButton } from "./new-conversation-button";
import type { ChatThread, Meeting, Message } from "@/lib/types";

export default async function MessagesPage() {
    const supabase = await createClient();
    const {
          data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

  // Threads I am part of.
  const { data: myRows } = await supabase
      .from("chat_participants")
      .select("thread_id")
      .eq("user_id", user.id);
    const threadIds = (myRows ?? []).map((r) => r.thread_id);

  let threads: ChatThread[] = [];
    const lastMessage = new Map<string, Message>();
    const otherNames = new Map<string, { name: string; photo: string | null }>();
    const meetings = new Map<string, Meeting>();
    const horses = new Map<string, string>();

  if (threadIds.length > 0) {
        const { data: t } = await supabase
          .from("chat_threads")
          .select("*")
          .in("id", threadIds)
      .order("created_at", { ascending: false })
          .returns<ChatThread[]>();
        threads = t ?? [];

      // Latest message per thread.
      const { data: msgs } = await supabase
          .from("messages")
          .select("*")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false })
          .limit(100)
          .returns<Message[]>();
        for (const m of msgs ?? []) {
                if (!lastMessage.has(m.thread_id)) lastMessage.set(m.thread_id, m);
        }

      // The other person in each thread.
      const { data: parts } = await supabase
          .from("chat_participants")
          .select("thread_id, user_id")
          .in("thread_id", threadIds);
        const others = new Map<string, string>();
        for (const p of parts ?? []) {
                if (p.user_id !== user.id && !others.has(p.thread_id)) {
                          others.set(p.thread_id, p.user_id);
                }
        }
        const otherIds = Array.from(new Set(others.values()));
        if (otherIds.length > 0) {
                const { data: people } = await supabase
                  .from("profiles")
                  .select("id, full_name, profile_photo_url")
                  .in("id", otherIds);
                const byId = new Map(
                          (people ?? []).map((p) => [
                                      p.id,
                            { name: p.full_name ?? "Member", photo: p.profile_photo_url },
                                    ])
                        );
                for (const [threadId, otherId] of others) {
                          otherNames.set(threadId, byId.get(otherId) ?? { name: "Member", photo: null });
                }
        }

      // Meeting and horse context for ride threads.
      const meetingIds = Array.from(
              new Set(threads.map((t) => t.meeting_id).filter(Boolean))
            ) as string[];
        if (meetingIds.length > 0) {
                const { data: ms } = await supabase
                  .from("meetings")
                  .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type")
                  .in("id", meetingIds)
                  .returns<Meeting[]>();
                for (const m of ms ?? []) meetings.set(m.id, m);
        }
        const requestIds = Array.from(
                new Set(threads.map((t) => t.ride_request_id).filter(Boolean))
              ) as string[];
        if (requestIds.length > 0) {
                const { data: rs } = await supabase
                  .from("ride_requests")
                  .select("id, horse_name")
                  .in("id", requestIds);
                for (const r of rs ?? []) {
                          if (r.horse_name) horses.set(r.id, r.horse_name);
                }
        }
  }

  return (
        <div className="mx-auto w-full max-w-3xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-turf-600">
                                            Messages
                                </p>
                                <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                                            Your conversations
                                </h1>
                                <p className="mt-2 text-zinc-600">
                                            Ride chats are created automatically when a trainer assigns a
                                            jockey, so the booking and the conversation live together.
                                </p>
                      </div>
                      <NewConversationButton />
              </div>
        
          {threads.length > 0 ? (
                  <div className="space-y-2">
                    {threads.map((t) => {
                                const other = otherNames.get(t.id);
                                const meeting = t.meeting_id ? meetings.get(t.meeting_id) : null;
                                const horse = t.ride_request_id ? horses.get(t.ride_request_id) : null;
                                const last = lastMessage.get(t.id);
                                const title =
                                                t.type === "ride"
                                                  ? `${horse ? `${horse} · ` : "Ride · "}${other?.name ?? "Ride chat"}`
                                                  : other?.name ?? "Conversation";
                                return (
                                                <Link
                                                                  key={t.id}
                                                                  href={`/dashboard/messages/${t.id}`}
                                                                  className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-turf-200 hover:bg-turf-50/40"
                                                                >
                                                                <Avatar src={other?.photo} name={other?.name} size="md" />
                                                                <div className="min-w-0 flex-1">
                                                                                  <p className="truncate font-medium text-ink">{title}</p>
                                                                                  <p className="truncate text-sm text-zinc-500">
                                                                                    {last
                                                                                                            ? last.body
                                                                                                            : meeting
                                                                                                              ? `${meeting.track} · no messages yet`
                                                                                                              : "No messages yet"}
                                                                                    </p>
                                                                </div>
                                                  {last ? (
                                                                                    <span className="shrink-0 text-xs text-zinc-400">
                                                                                      {formatDateTime(last.created_at)}
                                                                                      </span>
                                                                                  ) : null}
                                                </Link>
                                              );
                  })}
                  </div>
                ) : (
                  <EmptyState title="No conversations yet">
                            When a ride is assigned, a chat opens here automatically between the
                            trainer and the jockey. Or tap <strong>+</strong> to start a new
                            conversation directly.
                  </EmptyState>
              )}
        </div>
      );
}
