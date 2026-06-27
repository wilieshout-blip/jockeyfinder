import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatThreadClient } from "./chat";
import { VoiceNotes } from "@/components/voice-notes";
import type { VoiceNote } from "@/components/voice-notes";
import { formatMeetingDate } from "@/lib/utils";
import type { ChatThread, Meeting, Message } from "@/lib/types";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS only returns the thread if the user participates in it.
  const { data: thread } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle<ChatThread>();
  if (!thread) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true })
    .returns<Message[]>();

  // Participant names and photos for the header and bubbles.
  const { data: parts } = await supabase
    .from("chat_participants")
    .select("user_id")
    .eq("thread_id", thread.id);
  const memberIds = (parts ?? []).map((p) => p.user_id);

  const senders: Record<string, { name: string; photo: string | null }> = {};
  if (memberIds.length > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name, profile_photo_url")
      .in("id", memberIds);
    for (const p of people ?? []) {
      senders[p.id] = { name: p.full_name ?? "Member", photo: p.profile_photo_url };
    }
  }

  let meeting: Meeting | null = null;
  if (thread.meeting_id) {
    const { data: m } = await supabase
      .from("meetings")
      .select("id, nztr_day_id, meeting_date, track, club, source, meeting_type")
      .eq("id", thread.meeting_id)
      .maybeSingle<Meeting>();
    meeting = m;
  }

  let horse: string | null = null;
  if (thread.ride_request_id) {
    const { data: r } = await supabase
      .from("ride_requests")
      .select("horse_name")
      .eq("id", thread.ride_request_id)
      .maybeSingle<{ horse_name: string | null }>();
    horse = r?.horse_name ?? null;
  }

  // Voice notes (private bucket → short-lived signed URLs).
  const { data: vnRows } = await supabase
    .from("voice_notes")
    .select("id, kind, created_at, sender_id, duration_s, audio_path")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });
  const voiceNotes: VoiceNote[] = [];
  for (const n of vnRows ?? []) {
    const { data: signed } = await supabase.storage
      .from("voice-notes")
      .createSignedUrl(n.audio_path as string, 3600);
    voiceNotes.push({
      id: n.id as string,
      kind: n.kind as string,
      created_at: n.created_at as string,
      sender_id: (n.sender_id as string) ?? null,
      duration_s: (n.duration_s as number) ?? null,
      url: signed?.signedUrl ?? null,
    });
  }

  const others = memberIds
    .filter((id) => id !== user.id)
    .map((id) => senders[id]?.name ?? "Member");

  const title =
    thread.type === "ride"
      ? horse ?? "Ride chat"
      : others.join(", ") || "Conversation";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <div className="mb-4">
        <Link
          href="/dashboard/messages"
          className="text-sm font-medium text-zinc-500 hover:text-ink"
        >
          ← All messages
        </Link>
        <h1 className="mt-2 font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          {others.length > 0 ? `With ${others.join(", ")}` : ""}
          {meeting
            ? ` · ${meeting.track}, ${formatMeetingDate(meeting.meeting_date)}`
            : ""}
        </p>
      </div>

      <ChatThreadClient
        threadId={thread.id}
        meId={user.id}
        initialMessages={messages ?? []}
        senders={senders}
      />

      <VoiceNotes
        threadId={thread.id}
        meId={user.id}
        initialNotes={voiceNotes}
        senders={senders}
      />
    </div>
  );
}
